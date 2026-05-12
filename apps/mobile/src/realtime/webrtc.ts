import { socket } from './socket';

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

export class LiveLink {
  pc = new RTCPeerConnection({ iceServers: ICE });
  remote = new MediaStream();

  constructor(public roomId: string) {
    this.pc.ontrack = e => e.streams[0].getTracks().forEach(t => this.remote.addTrack(t));
    this.pc.onicecandidate = e =>
      e.candidate && socket.emit('rtc:ice', { roomId, candidate: e.candidate });

    socket.emit('rtc:join', roomId);
    socket.on('rtc:peer-joined', () => this.makeOffer());
    socket.on('rtc:offer', async ({ from, sdp }) => {
      await this.pc.setRemoteDescription(sdp);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      socket.emit('rtc:answer', { roomId, sdp: answer, to: from });
    });
    socket.on('rtc:answer', ({ sdp }) => this.pc.setRemoteDescription(sdp));
    socket.on('rtc:ice', ({ candidate }) => this.pc.addIceCandidate(candidate));
  }

  async startLocal() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach(t => this.pc.addTrack(t, stream));
    return stream;
  }

  async makeOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    socket.emit('rtc:offer', { roomId: this.roomId, sdp: offer });
  }

  close() {
    socket.emit('rtc:leave', this.roomId);
    this.pc.close();
  }
}
