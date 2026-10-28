# Modified for Vitalis (apps/drone): plugins, CORS and /capabilities removed; every
# endpoint needs TURBODRONE_TOKEN; sticks centre when the controlling socket closes;
# /status reports how fresh the video and the drone's replies are; exits with its bridge.
import asyncio
import hmac
import threading
import queue
import time
from contextlib import asynccontextmanager
from typing import Any, Optional
import logging
import os
import signal
import sys

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from utils.logging_config import bootstrap_runtime, configure_logging

bootstrap_runtime()

from services.flight_controller import FlightController
from control.strategies import DirectStrategy, IncrementalStrategy
from services.video_receiver import VideoReceiverService
from models.s2x_rc import S2xDroneModel as S2xRcModel
from models.debug_rc import DebugRcModel
from protocols.s2x_rc_protocol_adapter import S2xRCProtocolAdapter
from protocols.debug_rc_protocol_adapter import DebugRcProtocolAdapter
from protocols.s2x_video_protocol import S2xVideoProtocolAdapter
from protocols.debug_video_protocol import DebugVideoProtocolAdapter
from protocols.wifi_uav_rc_protocol_adapter import WifiUavRcProtocolAdapter
from protocols.wifi_uav_video_protocol import WifiUavVideoProtocolAdapter
from models.wifi_uav_rc import WifiUavRcModel
from models.cooingdv_rc import CooingdvRcModel
from protocols.cooingdv_rc_protocol_adapter import CooingdvRcProtocolAdapter
from protocols.cooingdv_jieli_rc_protocol_adapter import CooingdvJieliRcProtocolAdapter
from protocols.cooingdv_jieli_video_protocol import CooingdvJieliVideoProtocolAdapter
from protocols.cooingdv_video_protocol import CooingdvVideoProtocolAdapter
from models.wifi_cam_rc import WifiCamRcModel
from protocols.wifi_cam_rc_protocol_adapter import WifiCamRcProtocolAdapter
from protocols.wifi_cam_video_protocol import WifiCamVideoProtocolAdapter
from models.x69_lg_rc import X69LgRcModel
from protocols.x69_lg_rc_protocol_adapter import X69LgRcProtocolAdapter
from protocols.x69_lg_video_protocol import X69LgVideoProtocolAdapter
from protocols.x69_lg_rtsp_video_protocol import X69LgRtspVideoProtocolAdapter
from protocols.x69_lg_jpeg_video_protocol import X69LgJpegVideoProtocolAdapter
from protocols.x69_lg_video_mode import normalize_x69_video_mode
from utils.dropping_queue import DroppingQueue
from utils.wifi_uav_variants import (
    WIFI_UAV_DRONE_TYPES,
    resolve_wifi_uav_variant,
)

COOINGDV_DRONE_TYPES = {"cooingdv", "cooingdv_jieli"}

configure_logging()
logger = logging.getLogger(__name__)

# The server has no users, so a shared token is the only thing stopping any web page
# open on this computer (or anyone on the drone's Wi-Fi) from flying the drone.
# The Vitalis bridge generates one per run and passes it in.
TOKEN = os.getenv("TURBODRONE_TOKEN", "")


def _authorised(token: Optional[str]) -> bool:
    return bool(TOKEN) and isinstance(token, str) and hmac.compare_digest(token.encode(), TOKEN.encode())


def _coerce_camera_tilt_state(data: dict[str, Any]) -> Optional[int]:
    """
    Convert frontend-facing tilt directions into the model's raw tilt state.

    The UI sends direction values where +1 means tilt up and -1 means tilt down.
    WiFi-UAV's decompiled PTZ field uses 0=neutral, 1=down, 2=up.
    """
    if "camera_tilt_direction" in data:
        try:
            direction = float(data.get("camera_tilt_direction", 0))
        except (TypeError, ValueError):
            return None
        if direction > 0:
            return 2
        if direction < 0:
            return 1
        return 0

    if "camera_tilt" in data:
        try:
            return max(0, min(2, int(data.get("camera_tilt", 0))))
        except (TypeError, ValueError):
            return None

    return None

def _apply_camera_tilt_command(model: Any, data: dict[str, Any]) -> None:
    tilt_state = _coerce_camera_tilt_state(data)
    if tilt_state is None:
        return

    setter = getattr(model, "set_camera_tilt_state", None)
    if callable(setter):
        setter(tilt_state)

class FrameHub:
    """
    Fan-out hub for MJPEG frames.

    Each /mjpeg client gets its own asyncio.Queue, so multiple clients don't
    steal frames from each other.
    """
    def __init__(self, per_client_queue_size: int = 2):
        self._per_client_queue_size = per_client_queue_size
        self._clients: set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    async def register(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(self._per_client_queue_size)
        async with self._lock:
            self._clients.add(q)
        return q

    async def unregister(self, q: asyncio.Queue) -> None:
        async with self._lock:
            self._clients.discard(q)

    async def publish(self, frame: Optional[bytes]) -> None:
        # Snapshot under lock; we only do non-blocking puts.
        async with self._lock:
            clients = list(self._clients)

        for q in clients:
            try:
                q.put_nowait(frame)
            except asyncio.QueueFull:
                # Drop oldest then try again.
                try:
                    _ = q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(frame)
                except Exception:
                    # Give up on this client queue; it's likely stalled.
                    await self.unregister(q)

FRAME_HUB = FrameHub(per_client_queue_size=2)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global flight_controller, receiver, active_drone_type

    if not TOKEN:
        raise RuntimeError("TURBODRONE_TOKEN is required (the Vitalis bridge sets it).")

    if os.getenv("TURBODRONE_WATCH_STDIN") == "1":
        # The bridge holds our stdin open. EOF means it is gone (even if it crashed),
        # so stop rather than keep a drone hovering with nobody at the controls.
        def _watch_stdin():
            sys.stdin.read()
            logger.warning("[main] Bridge went away; shutting down.")
            os.kill(os.getpid(), signal.SIGTERM)
        threading.Thread(target=_watch_stdin, name="StdinWatch", daemon=True).start()

    drone_type = os.getenv("DRONE_TYPE", "s2x").lower()
    active_drone_type = drone_type

    logger.info("[main] Using drone type: %s", drone_type)

    if drone_type == "s2x":
        logger.info("[main] Using S2X drone implementation.")
        # Allow overriding IP and ports via env to match prior behavior
        default_ip = "172.16.10.1"
        default_ctrl_port = 8080
        default_video_port = 8888
        default_control_rate = 80.0

        drone_ip = os.getenv("DRONE_IP", default_ip)
        ctrl_port = int(os.getenv("CONTROL_PORT", default_ctrl_port))
        video_port = int(os.getenv("VIDEO_PORT", default_video_port))

        model = S2xRcModel()
        rc_proto = S2xRCProtocolAdapter(drone_ip, ctrl_port)
        # Optional remap via env: some S2x variants swap yaw and roll
        try:
            rc_proto.swap_yaw_roll = os.getenv("S2X_SWAP_YAW_ROLL", "false").lower() in ("1", "true", "yes", "on")
            if rc_proto.swap_yaw_roll:
                logger.info("[main] S2X swap_yaw_roll enabled")
        except Exception:
            pass
        video_adapter_cls = S2xVideoProtocolAdapter
        video_adapter_args = {
            "drone_ip": drone_ip,
            "control_port": ctrl_port,
            "video_port": video_port,
        }
    elif drone_type in WIFI_UAV_DRONE_TYPES:
        wifi_uav_variant = resolve_wifi_uav_variant(drone_type)
        logger.info("[main] Using WiFi UAV drone implementation (variant=%s).", wifi_uav_variant)
        # Align with previous working setup: env-configurable IP and ports
        default_ip = "192.168.169.1"
        default_ctrl_port = 8800
        default_video_port = 8800
        default_control_rate = 80.0

        drone_ip = os.getenv("DRONE_IP", default_ip)
        ctrl_port = int(os.getenv("CONTROL_PORT", default_ctrl_port))
        video_port = int(os.getenv("VIDEO_PORT", default_video_port))

        model = WifiUavRcModel()
        rc_proto = WifiUavRcProtocolAdapter(drone_ip, ctrl_port, variant=wifi_uav_variant)
        video_adapter_cls = WifiUavVideoProtocolAdapter
        video_adapter_args = {
            "drone_ip": drone_ip,
            "control_port": ctrl_port,
            "video_port": video_port,
            "variant": wifi_uav_variant,
            "debug": os.getenv("WIFI_UAV_VIDEO_DEBUG", "false").lower() in ("1", "true", "yes", "on"),
        }
    elif drone_type in COOINGDV_DRONE_TYPES:
        logger.info("[main] Using Cooingdv drone implementation (RC UFO, KY UFO, E88 Pro).")
        if drone_type == "cooingdv_jieli":
            default_ip = "192.168.8.15"
            default_ctrl_port = 2228
            default_video_port = 0
            default_control_rate = 20.0
        else:
            default_ip = "192.168.1.1"
            default_ctrl_port = 7099
            default_video_port = 7070  # RTSP port
            default_control_rate = 20.0

        drone_ip = os.getenv("DRONE_IP", default_ip)
        ctrl_port = int(os.getenv("CONTROL_PORT", default_ctrl_port))
        video_port = int(os.getenv("VIDEO_PORT", default_video_port))

        model = CooingdvRcModel()
        if drone_type == "cooingdv_jieli":
            rc_proto = CooingdvJieliRcProtocolAdapter(drone_ip, ctrl_port)
            video_adapter_cls = CooingdvJieliVideoProtocolAdapter
            video_adapter_args = {
                "drone_ip": drone_ip,
                "control_port": ctrl_port,
                "video_port": int(os.getenv("JIELI_RTP_VIDEO_PORT", video_port or 6666)),
                "audio_port": int(os.getenv("JIELI_RTP_AUDIO_PORT", 1234)),
                "sdp_port": int(os.getenv("JIELI_SDP_PORT", 6789)),
                "width": int(os.getenv("JIELI_VIDEO_WIDTH", 640)),
                "height": int(os.getenv("JIELI_VIDEO_HEIGHT", 360)),
                "fps": int(os.getenv("JIELI_VIDEO_FPS", 30)),
            }
        else:
            rc_proto = CooingdvRcProtocolAdapter(drone_ip, ctrl_port)
            video_adapter_cls = CooingdvVideoProtocolAdapter
            video_adapter_args = {
                "drone_ip": drone_ip,
                "control_port": ctrl_port,
                "video_port": video_port,
            }
    elif drone_type == "wifi_cam":
        logger.info("[main] Using WiFi_CAM native UDP implementation.")
        default_ip = "192.168.4.153"
        default_ctrl_port = 8090
        default_video_port = 8080
        default_control_rate = 25.0

        drone_ip = os.getenv("DRONE_IP", default_ip)
        ctrl_port = int(os.getenv("CONTROL_PORT", default_ctrl_port))
        video_port = int(os.getenv("VIDEO_PORT", default_video_port))
        command_mode = os.getenv("WIFI_CAM_COMMAND_MODE", "auto")

        model = WifiCamRcModel()
        rc_proto = WifiCamRcProtocolAdapter(drone_ip, ctrl_port, command_mode=command_mode)
        video_adapter_cls = WifiCamVideoProtocolAdapter
        video_adapter_args = {
            "drone_ip": drone_ip,
            "control_port": ctrl_port,
            "video_port": video_port,
            "debug": os.getenv("WIFI_CAM_VIDEO_DEBUG", "false").lower() in ("1", "true", "yes", "on"),
        }
    elif drone_type == "x69_lg":
        x69_video_mode = normalize_x69_video_mode(os.getenv("X69_LG_VIDEO_MODE"))
        default_ip = "172.16.11.1"
        default_ctrl_port = 23458
        default_control_rate = 25.0

        drone_ip = os.getenv("DRONE_IP", default_ip)
        ctrl_port = int(os.getenv("CONTROL_PORT", default_ctrl_port))
        local_port = int(os.getenv("X69_LG_LOCAL_CONTROL_PORT", 0))
        x69_debug = os.getenv("X69_LG_VIDEO_DEBUG", "false").lower() in ("1", "true", "yes", "on")

        model = X69LgRcModel()
        rc_proto = X69LgRcProtocolAdapter(drone_ip, ctrl_port, local_port=local_port)

        if x69_video_mode == "jpeg":
            logger.info("[main] Using X69/LG JPEG video (legacy UDP 7070/7080 path).")
            video_adapter_cls = X69LgJpegVideoProtocolAdapter
            video_adapter_args = {
                "drone_ip": drone_ip,
                "control_port": int(os.getenv("X69_LG_JPEG_CMD_PORT", 7080)),
                "video_port": int(os.getenv("X69_LG_JPEG_LOCAL_PORT", os.getenv("VIDEO_PORT", 7070))),
                "local_port": int(os.getenv("X69_LG_JPEG_LOCAL_PORT", 7070)),
                "cmd_port": int(os.getenv("X69_LG_JPEG_CMD_PORT", 7080)),
                "decrypt_packets": os.getenv("X69_LG_JPEG_DECRYPT", "true").lower()
                in ("1", "true", "yes", "on"),
                "stop_h265_first": os.getenv("X69_LG_JPEG_STOP_H265", "true").lower()
                in ("1", "true", "yes", "on"),
                "debug": x69_debug,
            }
        elif x69_video_mode == "rtsp":
            logger.info("[main] Using X69/LG RTSP video.")
            default_rtsp_port = 554
            video_port = int(os.getenv("VIDEO_PORT", os.getenv("X69_LG_RTSP_PORT", default_rtsp_port)))
            video_adapter_cls = X69LgRtspVideoProtocolAdapter
            video_adapter_args = {
                "drone_ip": drone_ip,
                "control_port": int(os.getenv("X69_LG_VIDEO_CONTROL_PORT", 23459)),
                "video_port": video_port,
                "rtsp_path": os.getenv("X69_LG_RTSP_PATH", "/live/ch00_1"),
                "rtsp_url": os.getenv("X69_LG_RTSP_URL", "").strip() or None,
                "jpeg_quality": int(os.getenv("X69_LG_RTSP_JPEG_QUALITY", "85")),
                "debug": x69_debug,
            }
        else:
            logger.info("[main] Using X69/LG H.265 video (UDP port 1234).")
            default_video_port = 1234
            video_port = int(os.getenv("VIDEO_PORT", default_video_port))
            local_video_control_port = int(os.getenv("X69_LG_LOCAL_VIDEO_CONTROL_PORT", 23459))
            x69_jpeg_quality = int(os.getenv("X69_LG_JPEG_QUALITY", 12))
            x69_output_width = int(os.getenv("X69_LG_OUTPUT_WIDTH", 640))
            x69_output_fps = int(os.getenv("X69_LG_OUTPUT_FPS", 15))
            video_adapter_cls = X69LgVideoProtocolAdapter
            video_adapter_args = {
                "drone_ip": drone_ip,
                "control_port": int(os.getenv("X69_LG_VIDEO_CONTROL_PORT", 23459)),
                "video_port": video_port,
                "local_control_port": local_video_control_port,
                "jpeg_quality": x69_jpeg_quality,
                "output_width": x69_output_width,
                "output_fps": x69_output_fps,
                "debug": x69_debug,
            }
    elif drone_type == "debug":
        logger.info("[main] Using debug drone implementation.")
        default_control_rate = 80.0
        model = DebugRcModel()
        rc_proto = DebugRcProtocolAdapter()
        video_adapter_cls = DebugVideoProtocolAdapter
        video_adapter_args = {"camera_index": 0, "debug": False}
    else:
        raise ValueError(f"Unknown drone type: {drone_type}")

    # 1. Video – let the service create / recycle the adapter
    video_service_args = {
        "protocol_adapter_class": video_adapter_cls,
        "protocol_adapter_args": video_adapter_args,
        "frame_queue": RAW_Q,
    }
    if drone_type in WIFI_UAV_DRONE_TYPES or drone_type == "wifi_cam":
        video_service_args["rc_adapter"] = rc_proto
    
    receiver = VideoReceiverService(**video_service_args)
    receiver.start()

    # Wait a moment for video to stabilize
    await asyncio.sleep(1)

    # 2. RC / flight
    # Optional: enable low-level RC packet debug via env
    try:
        if os.getenv("RC_DEBUG_PACKETS", "false").lower() in ("1", "true", "yes", "on"):
            try:
                rc_proto.toggle_debug()
                logger.info("[main] RC packet debug: ON")
            except Exception:
                pass
    except Exception:
        pass

    try:
        control_rate = float(os.getenv("CONTROL_RATE", default_control_rate))
    except (TypeError, ValueError):
        control_rate = default_control_rate

    flight_controller = FlightController(model, rc_proto, control_rate)
    flight_controller.start()

    # 3. start bridge thread (daemon) for video pump (always, for MJPEG)
    _pump_stop = threading.Event()
    main_loop = asyncio.get_running_loop()
    _pump_thread = threading.Thread(
        target=_frame_pump_worker,
        args=(RAW_Q, FRAME_HUB, _pump_stop, main_loop),
        name="FramePump",
        daemon=True,
    )
    _pump_thread.start()

    yield

    # Shutdown
    if flight_controller:
        flight_controller.stop()
    if receiver:
        receiver.stop()
    if _pump_stop:
        _pump_stop.set()
    if _pump_thread:
        _pump_thread.join(timeout=1.0)

# No CORS middleware: the only client is the Vitalis bridge, which is not a browser.
app = FastAPI(title="Drone web adapter", lifespan=lifespan)

# ───────────────────────────────────────────────────────────────
# Global objects (single-drone)
# ───────────────────────────────────────────────────────────────
RAW_Q: queue.Queue = DroppingQueue(maxsize=2)          # thread-safe → pump

flight_controller: Optional[FlightController] = None
receiver: Optional[VideoReceiverService] = None
active_drone_type = os.getenv("DRONE_TYPE", "s2x").lower()
last_frame_at: Optional[float] = None  # time.monotonic() of the newest video frame


def _age(t: Optional[float]) -> Optional[float]:
    return None if t is None else round(time.monotonic() - t, 2)


@app.get("/status")
async def status(token: str = ""):
    """
    These drones report no battery or height, so the bridge judges the link by how
    recently a video frame or a reply from the drone arrived.
    """
    if not _authorised(token):
        raise HTTPException(status_code=401, detail="Bad token")
    protocol = flight_controller.protocol if flight_controller else None
    return {
        "drone_type": active_drone_type,
        "video_age_s": _age(last_frame_at),
        "rc_age_s": _age(getattr(protocol, "last_rx_at", None)),
        # CooingDV "gl" drones use one button for take off and land.
        "variant": protocol._active_variant() if hasattr(protocol, "_active_variant") else None,
    }

# ───────────────────────────────────────────────────────────────
# Websocket handlers
# ───────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
    if not _authorised(websocket.query_params.get("token")):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            if not flight_controller:
                continue

            msg_type = data.get("type")
            if msg_type == "axes":
                mode = data.get("mode", "abs")

                # Switch strategy based on mode (treat "mouse" as absolute)
                try:
                    if mode in ("abs", "mouse"):
                        if not isinstance(flight_controller.model.strategy, DirectStrategy):
                            flight_controller.model.set_strategy(DirectStrategy())
                    else:
                        if not isinstance(flight_controller.model.strategy, IncrementalStrategy):
                            flight_controller.model.set_strategy(IncrementalStrategy())
                except Exception:
                    pass

                throttle = float(data.get("throttle", 0))
                yaw      = float(data.get("yaw", 0))
                pitch    = float(data.get("pitch", 0))
                roll     = float(data.get("roll", 0))

                flight_controller.set_axes_from("frontend", throttle, yaw, pitch, roll)
                _apply_camera_tilt_command(flight_controller.model, data)
            elif msg_type == "set_profile":
                try:
                    flight_controller.model.set_profile(data.get("name", "normal"))
                except Exception:
                    pass
            elif msg_type in ("set_speed_index", "speed_index"):
                try:
                    flight_controller.model.set_speed_index(data.get("speed_index", data.get("value", 2)))
                except Exception:
                    pass
            elif msg_type == "takeoff":
                try:
                    flight_controller.model.takeoff()
                except Exception:
                    pass
            elif msg_type == "land":
                try:
                    flight_controller.model.land()
                except Exception:
                    pass
            elif msg_type in ("estop", "emergency_stop"):
                try:
                    flight_controller.model.emergency_stop()
                except Exception:
                    try:
                        flight_controller.model.stop_flag = True
                    except Exception:
                        pass
            elif msg_type in ("set_camera_tilt", "camera_tilt"):
                try:
                    _apply_camera_tilt_command(flight_controller.model, data)
                except Exception:
                    pass
    except WebSocketDisconnect:
        logger.info("[WebSocket] Client disconnected")
    except Exception as e:
        logger.exception("[WebSocket] Error: %s", e)
    finally:
        # Whoever was steering is gone: centre the sticks so the drone hovers
        # instead of flying on with the last input.
        if flight_controller:
            flight_controller.set_axes_from("disconnect", 0, 0, 0, 0)

# ───────────────────────────────────────────────────────────────
# Video streaming
# ───────────────────────────────────────────────────────────────

def _frame_pump_worker(
    raw_q: queue.Queue,
    frame_hub: FrameHub,
    stop_event: threading.Event,
    loop: asyncio.AbstractEventLoop,
):
    """
    This worker runs in a separate thread and pumps frames from the
    thread-safe queue to the asyncio queues.
    """
    global last_frame_at
    # Wait for the very first frame before starting keepalive, to avoid
    # prematurely closing the MJPEG stream during initial connection.
    first_frame_seen = False
    last_frame_time = time.monotonic()
    timed_out = False
    while not stop_event.is_set() and not first_frame_seen:
        try:
            frame = raw_q.get(timeout=5.0)
            if frame:
                first_frame_seen = True
                last_frame_time = last_frame_at = time.monotonic()
                # Send to MJPEG pipeline immediately
                asyncio.run_coroutine_threadsafe(frame_hub.publish(frame.data), loop)
                break
        except queue.Empty:
            # keep waiting for initial frame without killing the stream
            continue

    # After frames start flowing, if the stream stalls for too long we close
    # existing MJPEG clients by publishing None. (Pump continues regardless.)
    stream_timeout_s = 3.0
    while not stop_event.is_set():
        try:
            frame = raw_q.get(timeout=1.0)
            if frame:
                last_frame_time = last_frame_at = time.monotonic()
                timed_out = False
                try:
                    asyncio.run_coroutine_threadsafe(frame_hub.publish(frame.data), loop)
                except Exception:
                    pass
        except queue.Empty:
            if first_frame_seen and not timed_out and (time.monotonic() - last_frame_time) > stream_timeout_s:
                timed_out = True
                try:
                    asyncio.run_coroutine_threadsafe(frame_hub.publish(None), loop)
                except Exception:
                    pass
            continue

@app.get("/mjpeg")
async def mjpeg_stream(token: str = ""):
    """
    Streams JPEG frames over HTTP multipart/x-mixed-replace.
    """
    from fastapi.responses import StreamingResponse

    if not _authorised(token):
        raise HTTPException(status_code=401, detail="Bad token")

    async def frame_generator():
        q = await FRAME_HUB.register()
        try:
            while True:
                frame = await q.get()
                if frame is None:
                    break
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
                )
        finally:
            await FRAME_HUB.unregister(q)

    return StreamingResponse(
        frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame"
    )
