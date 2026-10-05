/**
 * Screenshot a screen of the web build, signed in.  Needs Metro (8081) and the API (4000) running.
 *   node scripts/shot.mjs /profile profile 1600          → .expo/shots/profile.png (390 wide, 1600 tall)
 *   CLICK="Ilaçet" node scripts/shot.mjs /profile open   → taps the element with that exact text first
 * Env: EMAIL/PASS (default demo account), APP, API, WAIT (ms), GEO="lat,lng" (fake location),
 *      WIDTH (desktop width, e.g. 1440 for the web console).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
const [route = '/', name = 'shot', height = '844'] = process.argv.slice(2);
const CH = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const APP = process.env.APP ?? 'http://localhost:8081';
const API = process.env.API ?? 'http://localhost:4000/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CH, ['--headless', `--remote-debugging-port=${port}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 50 && !ws; i++) {
  await sleep(200);
  try {
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {}
}
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

if (process.env.GEO) {
  const [latitude, longitude] = process.env.GEO.split(',').map(Number);
  await send('Browser.grantPermissions', { permissions: ['geolocation'] });
  await send('Emulation.setGeolocationOverride', { latitude, longitude, accuracy: 20 });
}
await send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.WIDTH ?? 390), height: Number(height), deviceScaleFactor: process.env.WIDTH ? 1 : 2, mobile: !process.env.WIDTH });
if (process.env.EMAIL !== '') {
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.EMAIL ?? 'demo@vitalis.com', password: process.env.PASS ?? 'Demo1234!' }),
  })).json();
  await send('Page.navigate', { url: `${APP}/` });
  await sleep(2500);
  await send('Runtime.evaluate', { expression: `localStorage.setItem('at', ${JSON.stringify(login.accessToken)}); localStorage.setItem('rt', ${JSON.stringify(login.refreshToken)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify(login.user))});` });
}
await send('Page.navigate', { url: APP + route });
await sleep(Number(process.env.WAIT ?? 7000));
if (process.env.CLICK) {
  // Prefer real controls (tabs, buttons) over plain text with the same words.
  const text = JSON.stringify(process.env.CLICK);
  await send('Runtime.evaluate', { expression: `([...document.querySelectorAll('button,[role=tab],[role=button],[role=link]')].find((e) => e.textContent.trim() === ${text}) ?? [...document.querySelectorAll('div,span')].find((e) => e.textContent.trim() === ${text}))?.click()` });
  await sleep(1500);
}
if (process.env.SCROLL) {
  // Scroll every scrollable area to its end, like a finger would.
  await send('Runtime.evaluate', { expression: `[...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible').forEach((e) => { e.scrollTop = e.scrollHeight; })` });
  await sleep(1200);
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
mkdirSync('.expo/shots', { recursive: true });
writeFileSync(`.expo/shots/${name}.png`, Buffer.from(shot.result.data, 'base64'));
chrome.kill();
process.exit(0);
