'use strict';

// Versión de la app (se ve en la pantalla de inicio). Arreglos y ajustes: 0.1.x; novedades: 0.x.0.
const APP_VERSION = '0.1.2';
// Uso de la app en Vercel Analytics: es una sola página, así que cada función se cuenta como una
// página virtual. Solo se envía el nombre de la función, nunca datos de la app.
const track = (path) => { try { window.va?.('pageview', { path }); } catch (_) { /* sin analítica */ } };
const trackLabel = (label) => track(`/${label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`);
const ME_KEY = 'meet:me';
const LAST_KEY = 'meet:last';
const DISPLAY_KEY = 'meet:display';
const INSTALL_HINT_KEY = 'meet:installHint';
const API = 'api/meet';
const MAX_PEERS = 6;
const POLL_BUSY_MS = 1200;   // mientras alguien se conecta o esperas a los demás
const POLL_IDLE_MS = 3000;   // con todos conectados, las señales casi no hacen falta
const ICE_WAIT_MS = 4000;    // las señales llevan todas las rutas: se espera a reunirlas (las del TURN tardan algo más)
const MAX_RETRIES = 2;
const SHARE_BITRATE = 2500000;

const ICONS = {
  video: '<rect x="3.5" y="6.5" width="12.5" height="11" rx="2.5"/><path d="M16 10.5l4.3-2.7a.5.5 0 0 1 .7.4v7.6a.5.5 0 0 1-.7.4L16 13.5z"/>',
  videoOff: '<path d="M7 6.5h6.5A2.5 2.5 0 0 1 16 9v6"/><path d="M4.4 7.2A2.5 2.5 0 0 0 3.5 9v6A2.5 2.5 0 0 0 6 17.5h7.5a2.5 2.5 0 0 0 1.8-.8"/><path d="M16 10.5l4.3-2.7a.5.5 0 0 1 .7.4v7.6a.5.5 0 0 1-.4.5"/><path d="M3.5 3.5l17 17"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
  micOff: '<path d="M15 10V6.5a3 3 0 0 0-5.8-1.1M9 9v2.5a3 3 0 0 0 4.6 2.5"/><path d="M5.5 11.5a6.5 6.5 0 0 0 10.4 5.2M18.5 11.5a6.5 6.5 0 0 1-.6 2.7M12 18v2.5"/><path d="M3.5 3.5l17 17"/>',
  screen: '<rect x="3" y="4.5" width="18" height="12.5" rx="2"/><path d="M9 20.5h6M12 17v3.5"/><path d="M12 13.5v-6M9.2 10l2.8-2.8 2.8 2.8"/>',
  flip: '<path d="M4 8.5A2 2 0 0 1 6 6.5h2l1.5-2h5L16 6.5h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M15.5 11a3.8 3.8 0 0 0-6.7-.5M8.5 15a3.8 3.8 0 0 0 6.7.5"/><path d="M8.6 8.8v1.8h1.8M15.4 17.2v-1.8h-1.8"/>',
  invite: '<circle cx="9.5" cy="8.5" r="3.5"/><path d="M3.5 19.5a6 6 0 0 1 11.5-2.4"/><path d="M18 13v7M14.5 16.5h7"/>',
  hangup: '<path d="M3.2 14.5c5-4.7 12.6-4.7 17.6 0 .6.6.6 1.5 0 2l-1.6 1.6c-.5.5-1.3.5-1.8.1l-1.7-1.3c-.4-.3-.6-.7-.6-1.2v-1.5a10 10 0 0 0-6.2 0v1.5c0 .5-.2.9-.6 1.2l-1.7 1.3c-.5.4-1.3.4-1.8-.1l-1.6-1.6c-.5-.5-.5-1.4 0-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.1-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
};
const icon = (name, size = 22) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// Logo de MeetCTRL: anillo fino, anillo discontinuo, arco y una cámara de vídeo
let logoCount = 0;
function logoSVG(size) {
  const id = `mtg-g${logoCount++}`;
  return `
    <svg class="logo-mark" viewBox="0 0 120 120" width="${size}" height="${size}" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <defs>
        <linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#0891b2"/><stop offset=".55" stop-color="#22d3ee"/><stop offset="1" stop-color="#a5f3fc"/>
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="52" stroke="url(#${id})" stroke-width="1.2" opacity=".55"/>
      <circle cx="60" cy="60" r="42" stroke="url(#${id})" stroke-width=".8" stroke-dasharray="2 5" opacity=".6"/>
      <path class="logo-arc" pathLength="1" d="M60 8 A52 52 0 1 1 14.97 86" stroke="url(#${id})" stroke-width="3"/>
      <circle class="logo-dot" cx="14.97" cy="86" r="3" fill="#a5f3fc" stroke="none"/>
      <rect x="33" y="41" width="40" height="38" rx="7" stroke="url(#${id})" stroke-width="1.8"/>
      <path d="M73 54.5l13-8.5a1.5 1.5 0 0 1 2.3 1.3v25.4a1.5 1.5 0 0 1-2.3 1.3l-13-8.5z" stroke="url(#${id})" stroke-width="1.8"/>
      <circle cx="53" cy="60" r="8" stroke="url(#${id})" stroke-width="1.5"/>
      <circle cx="53" cy="60" r="2.4" stroke="url(#${id})" stroke-width="1.2" opacity=".7"/>
    </svg>`;
}
document.querySelectorAll('[data-logo]').forEach((el) => { el.innerHTML = logoSVG(Number(el.dataset.logo)); });
document.getElementById('app-version').textContent = `Versión ${APP_VERSION}`;

// ---------- Utilidades ----------

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (_) { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* sin almacenamiento */ } };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const isTouch = matchMedia('(pointer: coarse)').matches;
const canShare = () => !!navigator.mediaDevices?.getDisplayMedia;

// ---------- Salas: código secreto y cifrado de las señales ----------
// Cada sala tiene un código (16 letras y números). De él salen, aquí, el identificador de la sala en
// el servidor (SHA-256) y la clave AES-256-GCM (PBKDF2). El código nunca sale del dispositivo salvo
// en el enlace que comparte cada uno, detrás de «#».
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // sin 0/o, 1/l/i, para dictarlo sin líos
const CODE_LEN = 16;
const utf8 = new TextEncoder();
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (str) => Uint8Array.from(atob(str), (ch) => ch.charCodeAt(0));

function newCode() {
  let out = '';
  while (out.length < CODE_LEN) {
    for (const b of crypto.getRandomValues(new Uint8Array(CODE_LEN * 2))) {
      if (b >= 248 || out.length === CODE_LEN) continue; // 248 = 31 × 8: todas las letras salen con la misma probabilidad
      out += CODE_CHARS[b % CODE_CHARS.length];
    }
  }
  return out;
}
// Acepta el código con guiones, espacios o mayúsculas, o el enlace entero; devuelve '' si no vale
function cleanCode(text) {
  const raw = String(text || '');
  const c = (raw.includes('#s=') ? raw.split('#s=')[1] : raw).toLowerCase().replace(/[^a-z0-9]/g, '');
  return c.length === CODE_LEN && [...c].every((ch) => CODE_CHARS.includes(ch)) ? c : '';
}
const prettyCode = (c) => c.match(/.{1,4}/g).join('-');
const roomLink = (code) => `${location.origin}${location.pathname}#s=${code}`;

async function deriveRoom(code) {
  const base = await crypto.subtle.importKey('raw', utf8.encode(code), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: utf8.encode('meetctrl-key'), iterations: 100000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const rid = hex(await crypto.subtle.digest('SHA-256', utf8.encode(`meetctrl-room:${code}`)));
  return { code, rid, key };
}
async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8.encode(JSON.stringify(obj)));
  return `${toB64(iv)}.${toB64(ct)}`;
}
async function unseal(key, blob) {
  const [iv, ct] = blob.split('.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct));
  return JSON.parse(new TextDecoder().decode(plain));
}

async function api(action, data = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || 'server'), { code: json.error });
  return json;
}

// ---------- Cámara y micrófono ----------

const local = { mic: true, cam: true, facing: 'user', micTrack: null, camTrack: null, screenTrack: null, name: load(ME_KEY, '') };
const VIDEO = (facing) => ({ width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24 }, facingMode: facing });

async function grabMedia() {
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) return;
  const want = async (constraints) => { try { return await md.getUserMedia(constraints); } catch (_) { return null; } };
  const stream = await want({ audio: true, video: local.cam ? VIDEO(local.facing) : false })
    || await want({ audio: true });
  if (!stream) return;
  local.micTrack = stream.getAudioTracks()[0] || null;
  local.camTrack = stream.getVideoTracks()[0] || null;
  if (local.micTrack) local.micTrack.enabled = local.mic;
  if (!local.camTrack) local.cam = false;
}
function dropMedia() {
  for (const k of ['micTrack', 'camTrack', 'screenTrack']) { local[k]?.stop(); local[k] = null; }
}
async function setCam(on) {
  if (on) {
    if (!local.camTrack) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO(local.facing) });
        local.camTrack = stream.getVideoTracks()[0];
      } catch (_) {
        toast('No se puede usar la cámara: revisa los permisos', { warn: true });
        return;
      }
    }
  } else {
    local.camTrack?.stop();
    local.camTrack = null;
  }
  local.cam = !!local.camTrack;
}
async function setMic(on) {
  if (on && !local.micTrack) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      local.micTrack = stream.getAudioTracks()[0];
    } catch (_) {
      toast('No se puede usar el micrófono: revisa los permisos', { warn: true });
      return;
    }
  }
  local.mic = on;
  if (local.micTrack) local.micTrack.enabled = on;
}
async function flipCam() {
  local.facing = local.facing === 'user' ? 'environment' : 'user';
  local.camTrack?.stop();
  local.camTrack = null;
  await setCam(true);
}

// ---------- Portada ----------

const view = $('view');
let lastRoom = load(LAST_KEY, null);

function renderHome() {
  view.innerHTML = `
    <section class="home-hero">
      <h1>Hablad cara a cara</h1>
      <p>Crea una sala, envía el enlace y comparte tu pantalla. Sin cuentas.</p>
    </section>
    <section class="card home-card">
      <label class="field"><span>Tu nombre</span><input id="name" maxlength="30" autocomplete="name" placeholder="Cómo te verán los demás" value="${esc(local.name)}" /></label>
      <button class="primary-btn" id="new-room" type="button">${icon('video')} Nueva sala</button>
    </section>
    <section class="card home-card">
      <div class="join-row">
        <label class="field"><span>Unirte a una sala</span><input id="code" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Código o enlace" /></label>
        <button class="ghost-btn" id="join-room" type="button">Unirme</button>
      </div>
    </section>
    ${cleanCode(lastRoom?.code) ? `
    <button class="card recent" id="last-room" type="button">
      <span>${icon('video', 20)}</span>
      <span><b>Volver a tu última sala</b><small>${prettyCode(lastRoom.code)}</small></span>
      ${icon('chevron', 16)}
    </button>` : ''}
    <p class="home-note">El vídeo va directo entre vosotros, cifrado. Nada se graba ni se guarda.</p>`;
  const keepName = () => { local.name = $('name').value.trim(); save(ME_KEY, local.name); };
  $('name').addEventListener('input', keepName);
  $('new-room').addEventListener('click', () => { track('/nueva-sala'); openLobby(newCode()); });
  const join = () => {
    const code = cleanCode($('code').value);
    if (!code) { toast('Ese código no es válido', { warn: true }); return; }
    track('/unirse');
    openLobby(code);
  };
  $('join-room').addEventListener('click', join);
  $('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  $('last-room')?.addEventListener('click', () => openLobby(lastRoom.code));
}

// ---------- Sala de espera: te ves antes de entrar ----------

let lobbyCode = '';

async function openLobby(code) {
  lobbyCode = code;
  lastRoom = { code };
  save(LAST_KEY, lastRoom);
  history.replaceState(null, '', location.pathname); // el código no se queda en la barra de direcciones
  renderLobby();
  if (!local.micTrack && !local.camTrack) {
    await grabMedia();
    if (lobbyCode === code) renderLobby();
  }
}

function renderLobby() {
  const noDevices = !local.micTrack && !local.camTrack;
  view.innerHTML = `
    <section class="lobby">
      <div class="preview">
        <video id="preview" autoplay playsinline muted ${local.camTrack ? '' : 'hidden'} class="${local.facing === 'user' ? '' : 'back'}"></video>
        ${local.camTrack ? '' : `<div class="preview-off">${icon('videoOff', 30)}<span>${noDevices ? 'Sin cámara ni micrófono. Puedes entrar igualmente para ver y oír a los demás.' : 'Cámara apagada'}</span></div>`}
        <div class="preview-tools">
          <button class="round ${local.mic && local.micTrack ? '' : 'off'}" id="l-mic" type="button" aria-label="${local.mic ? 'Silenciar el micrófono' : 'Activar el micrófono'}">${icon(local.mic && local.micTrack ? 'mic' : 'micOff')}</button>
          <button class="round ${local.camTrack ? '' : 'off'}" id="l-cam" type="button" aria-label="${local.camTrack ? 'Apagar la cámara' : 'Encender la cámara'}">${icon(local.camTrack ? 'video' : 'videoOff')}</button>
          ${isTouch && local.camTrack ? `<button class="round" id="l-flip" type="button" aria-label="Cambiar de cámara">${icon('flip')}</button>` : ''}
        </div>
      </div>
      <label class="field"><span>Tu nombre</span><input id="name" maxlength="30" autocomplete="name" placeholder="Cómo te verán los demás" value="${esc(local.name)}" /></label>
      <div class="card lobby-invite">
        <span><small>Código de la sala</small><b>${prettyCode(lobbyCode)}</b></span>
        <button class="ghost-btn" id="l-invite" type="button">Invitar</button>
      </div>
      <button class="primary-btn" id="enter" type="button">Entrar en la sala</button>
      <button class="ghost-btn lobby-back" id="l-back" type="button">Volver</button>
    </section>`;
  if (local.camTrack) $('preview').srcObject = new MediaStream([local.camTrack]);
  $('name').addEventListener('input', () => { local.name = $('name').value.trim(); save(ME_KEY, local.name); });
  $('l-mic').addEventListener('click', async () => { await setMic(!(local.mic && local.micTrack)); renderLobby(); });
  $('l-cam').addEventListener('click', async () => { await setCam(!local.camTrack); renderLobby(); });
  $('l-flip')?.addEventListener('click', async () => { await flipCam(); renderLobby(); });
  $('l-invite').addEventListener('click', () => invite(lobbyCode));
  $('l-back').addEventListener('click', () => { lobbyCode = ''; dropMedia(); renderHome(); });
  $('enter').addEventListener('click', enterCall);
}

async function invite(code) {
  const url = roomLink(code);
  track('/invitar');
  if (isTouch && navigator.share) {
    try { await navigator.share({ title: 'MeetCTRL', text: 'Únete a mi videollamada', url }); } catch (_) { /* cancelado */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Enlace copiado');
  } catch (_) {
    toast(url, { stay: false });
  }
}

// ---------- Llamada ----------
// Cada participante se conecta directamente con cada uno de los demás. Cada conexión tiene siempre
// las mismas tres pistas (voz, cámara, pantalla) y un canal de datos para el estado: encender algo
// es cambiar lo que se envía por su pista, sin volver a negociar.

let call = null; // { room, pid, ice, peers: Map, started, session… }
let pinned = null;
let wakeLock = null;

async function enterCall() {
  const btn = $('enter');
  btn.disabled = true;
  const code = lobbyCode;
  try {
    const room = await deriveRoom(code);
    const pid = hex(crypto.getRandomValues(new Uint8Array(16)));
    const { iceServers } = await api('ice', { rid: room.rid });
    const { peers } = await api('join', { rid: room.rid, pid });
    call = { room, pid, ice: iceServers, peers: new Map(), listed: new Set(peers), started: 0, timer: 0 };
    pinned = null;
    track('/llamada');
    $('call').hidden = false;
    for (const id of peers) offerTo(id);
    renderCall();
    call.timer = setInterval(renderStatus, 1000);
    keepAwake();
    pollLoop(call);
  } catch (err) {
    btn.disabled = false;
    toast(err.code === 'full' ? `La sala está llena (máximo ${MAX_PEERS})` : 'No se ha podido entrar: revisa la conexión', { warn: true });
  }
}

async function leaveCall() {
  const c = call;
  if (!c) return;
  call = null;
  clearInterval(c.timer);
  for (const p of c.peers.values()) {
    try { p.dc.readyState === 'open' && p.dc.send(JSON.stringify({ bye: true })); } catch (_) { /* ya cerrado */ }
    p.pc.close();
  }
  dropMedia();
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
  $('call').hidden = true;
  $('stage').replaceChildren();
  lobbyCode = '';
  renderHome();
  api('leave', { rid: c.room.rid, pid: c.pid }).catch(() => {});
}
// Al cerrar la app, avisa para que los demás no te esperen
window.addEventListener('pagehide', () => {
  if (call) navigator.sendBeacon?.(API, new Blob([JSON.stringify({ action: 'leave', rid: call.room.rid, pid: call.pid })], { type: 'application/json' }));
});

async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (_) { /* no compatible */ }
}
document.addEventListener('visibilitychange', () => { if (call && !document.hidden) keepAwake(); });

async function pollLoop(session) {
  while (call === session) {
    try {
      const { peers, inbox } = await api('poll', { rid: session.room.rid, pid: session.pid });
      if (call !== session) return;
      session.listed = new Set(peers);
      for (const m of inbox) await onSignal(session, m);
      for (const p of [...session.peers.values()]) {
        // Una conexión viva no se corta aunque el otro tarde en avisar (móvil en segundo plano)
        if (!session.listed.has(p.id) && p.dc.readyState !== 'open') dropPeer(p);
      }
    } catch (_) { /* sin conexión: se reintenta */ }
    const allUp = session.peers.size > 0 && [...session.peers.values()].every((p) => p.state === 'up');
    await sleep(allUp ? POLL_IDLE_MS : POLL_BUSY_MS);
  }
}

function newPeer(id, offerer, tries = 0) {
  const pc = new RTCPeerConnection({ iceServers: call.ice });
  const dc = pc.createDataChannel('state', { negotiated: true, id: 0 });
  const p = { id, pc, dc, offerer, tries, name: '', mic: true, cam: false, share: false, state: 'connecting', senders: [], camStream: null, screenStream: null };
  call.peers.set(id, p);
  dc.onopen = () => { sendState(p); renderCall(); };
  dc.onmessage = (e) => {
    let s;
    try { s = JSON.parse(e.data); } catch (_) { return; }
    if (s.bye) { dropPeer(p); return; }
    if (typeof s.name === 'string') p.name = s.name.slice(0, 30);
    p.mic = !!s.mic; p.cam = !!s.cam; p.share = !!s.share;
    if (!p.share && pinned === `${id}:screen`) pinned = null;
    renderCall();
  };
  pc.onconnectionstatechange = () => {
    if (call?.peers.get(id) !== p) return;
    const st = pc.connectionState;
    if (st === 'connected') {
      p.state = 'up';
      p.tries = 0;
      if (!call.started) call.started = Date.now();
      limitShare(p);
    } else if (st === 'disconnected') {
      p.state = 'connecting';
    } else if (st === 'failed') {
      p.state = 'failed';
      if (offerer && p.tries < MAX_RETRIES && call.listed.has(id)) {
        const n = p.tries + 1;
        pc.close();
        offerTo(id, n);
      } else if (!call.listed.has(id)) {
        dropPeer(p);
      }
    }
    renderCall();
  };
  return p;
}

// Las tres pistas, en este orden en ambos lados
function bindTracks(p) {
  const [audio, cam, screen] = p.pc.getTransceivers();
  for (const t of [audio, cam, screen]) t.direction = 'sendrecv';
  p.senders = [audio.sender, cam.sender, screen.sender];
  p.camStream = new MediaStream([audio.receiver.track, cam.receiver.track]);
  p.screenStream = new MediaStream([screen.receiver.track]);
  sendTracks(p);
}
function sendTracks(p) {
  if (p.senders.length < 3) return;
  const tracks = [local.micTrack, local.camTrack, local.screenTrack];
  p.senders.forEach((s, i) => { if (s.track !== tracks[i]) s.replaceTrack(tracks[i]).catch(() => {}); });
  limitShare(p);
}
function limitShare(p) {
  const s = p.senders[2];
  if (!s || !local.screenTrack) return;
  const params = s.getParameters();
  if (!params.encodings?.length) return;
  params.encodings[0].maxBitrate = SHARE_BITRATE;
  s.setParameters(params).catch(() => {});
}
function myState() {
  return { name: local.name, mic: local.mic && !!local.micTrack, cam: !!local.camTrack, share: !!local.screenTrack };
}
function sendState(p) {
  if (p.dc.readyState === 'open') p.dc.send(JSON.stringify(myState()));
}
function syncAll() {
  if (!call) return;
  for (const p of call.peers.values()) { sendTracks(p); sendState(p); }
  renderCall();
}

function waitIce(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); clearTimeout(timer); resolve(); };
    const check = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, ICE_WAIT_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}
async function signal(session, to, msg) {
  const sig = await seal(session.room.key, msg);
  await api('send', { rid: session.room.rid, pid: session.pid, to, sig });
}

async function offerTo(id, tries = 0) {
  const session = call;
  const p = newPeer(id, true, tries);
  try {
    for (const kind of ['audio', 'video', 'video']) p.pc.addTransceiver(kind, { direction: 'sendrecv' });
    bindTracks(p);
    await p.pc.setLocalDescription(await p.pc.createOffer());
    await waitIce(p.pc);
    if (call === session && session.peers.get(id) === p) await signal(session, id, { t: 'offer', sdp: p.pc.localDescription.sdp, name: local.name });
  } catch (_) {
    p.state = 'failed';
  }
  renderCall();
}

async function onSignal(session, { from, sig }) {
  let m;
  try { m = await unseal(session.room.key, sig); } catch (_) { return; } // no es de esta sala
  let p = session.peers.get(from);
  if (m.t === 'offer') {
    // Si dos se ofrecen a la vez, gana la oferta del identificador menor
    if (p?.pc.signalingState === 'have-local-offer' && session.pid < from) return;
    if (p) { p.pc.close(); session.peers.delete(from); }
    p = newPeer(from, false);
    p.name = String(m.name || '').slice(0, 30);
    try {
      await p.pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
      bindTracks(p);
      await p.pc.setLocalDescription(await p.pc.createAnswer());
      await waitIce(p.pc);
      await signal(session, from, { t: 'answer', sdp: p.pc.localDescription.sdp, name: local.name });
    } catch (_) {
      p.state = 'failed';
    }
    renderCall();
  } else if (m.t === 'answer' && p?.pc.signalingState === 'have-local-offer') {
    p.name = String(m.name || p.name).slice(0, 30);
    await p.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp }).catch(() => { p.state = 'failed'; });
    renderCall();
  }
}

function dropPeer(p) {
  if (call?.peers.get(p.id) !== p) return;
  p.pc.close();
  call.peers.delete(p.id);
  if (pinned?.startsWith(p.id)) pinned = null;
  renderCall();
}

async function toggleShare() {
  if (!canShare()) { toast('Este dispositivo no permite compartir la pantalla. Hazlo desde un ordenador; aquí sí puedes ver la de los demás.', { warn: true }); return; }
  if (local.screenTrack) { stopShare(); return; }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
    const t = stream.getVideoTracks()[0];
    if (!call) { t.stop(); return; }
    t.contentHint = 'detail';
    t.onended = stopShare;
    local.screenTrack = t;
    track('/compartir-pantalla');
    syncAll();
  } catch (err) {
    if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') toast('No se ha podido compartir la pantalla', { warn: true });
  }
}
function stopShare() {
  local.screenTrack?.stop();
  local.screenTrack = null;
  if (pinned === 'me:screen') pinned = null;
  syncAll();
}

// ---------- Pantalla de la llamada ----------

function makeTile({ key, name, stream, self, screen, nocam, muted: silent, wait }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `tile${self ? ' self' : ''}${screen ? ' screen' : ''}${nocam ? ' nocam' : ''}${self && !screen && local.facing === 'user' ? ' mirror' : ''}`;
  el.setAttribute('aria-label', name);
  const v = document.createElement('video');
  v.autoplay = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.muted = !!self;
  el.append(v);
  el.insertAdjacentHTML('beforeend', `
    <span class="tile-avatar">${esc((name || '?').charAt(0).toUpperCase())}</span>
    <span class="tile-name">${silent ? icon('micOff', 14) : ''}${esc(name)}</span>
    ${wait ? `<span class="tile-wait">${wait}</span>` : ''}`);
  if (stream) {
    v.srcObject = stream;
    if (!self) v.dataset.remote = key;
  }
  el.addEventListener('click', () => { pinned = pinned === key ? null : key; renderCall(); });
  return el;
}

function callTiles() {
  const list = [];
  for (const p of call.peers.values()) {
    const name = p.name || 'Invitado';
    if (p.share) list.push({ key: `${p.id}:screen`, name: `Pantalla de ${name}`, stream: p.screenStream, screen: true });
    const wait = p.state === 'up' ? '' : p.state === 'failed' ? 'No se ha podido conectar' : 'Conectando…';
    list.push({ key: p.id, name, stream: p.camStream, nocam: !p.cam, muted: !p.mic, wait });
  }
  if (local.screenTrack) list.push({ key: 'me:screen', name: 'Tu pantalla', stream: new MediaStream([local.screenTrack]), self: true, screen: true });
  list.push({ key: 'me', name: local.name || 'Tú', stream: local.camTrack ? new MediaStream([local.camTrack]) : null, self: true, nocam: !local.camTrack, muted: !(local.mic && local.micTrack) });
  return list;
}

function renderCall() {
  if (!call) return;
  renderBar();
  renderStatus();
  const stage = $('stage');
  const tiles = callTiles();
  const focus = tiles.find((t) => t.key === pinned) || tiles.find((t) => t.screen && !t.self) || tiles.find((t) => t.screen);
  stage.replaceChildren();
  stage.className = 'stage';
  if (focus) {
    stage.classList.add('focus');
    const strip = document.createElement('div');
    strip.className = 'strip';
    strip.append(...tiles.filter((t) => t !== focus).map(makeTile));
    stage.append(makeTile(focus), strip);
  } else if (tiles.length === 2) {
    stage.classList.add('duo');
    stage.append(...tiles.map(makeTile));
  } else {
    stage.classList.add('grid');
    const wide = innerWidth > innerHeight;
    const cells = tiles.length === 1 ? 2 : tiles.length;
    stage.style.setProperty('--cols', cells <= 2 ? (wide ? 2 : 1) : cells <= 4 ? 2 : (wide ? 3 : 2));
    stage.append(...tiles.map(makeTile));
    if (tiles.length === 1) {
      const empty = document.createElement('div');
      empty.className = 'call-empty';
      empty.innerHTML = `<span>Eres la primera persona aquí. Envía el enlace a los demás.</span><button class="ghost-btn" type="button">Invitar</button>`;
      empty.querySelector('button').addEventListener('click', () => invite(call.room.code));
      stage.append(empty);
    }
  }
  playAll();
}
window.addEventListener('resize', () => { if (call) renderCall(); });

// Si el navegador no deja reproducir con sonido sin un toque (sin micrófono activo), lo pide
function playAll() {
  let blocked = false;
  const plays = [...$('stage').querySelectorAll('video')].filter((v) => v.srcObject).map((v) => v.play().catch((e) => { if (e.name === 'NotAllowedError') blocked = true; }));
  Promise.all(plays).then(() => {
    const had = document.querySelector('.sound-btn');
    if (!blocked) { had?.remove(); return; }
    if (had) return;
    const b = document.createElement('button');
    b.className = 'sound-btn';
    b.type = 'button';
    b.textContent = 'Toca para activar el sonido';
    b.addEventListener('click', () => { b.remove(); playAll(); });
    $('call').append(b);
  });
}

function renderStatus() {
  if (!call) return;
  const up = [...call.peers.values()].filter((p) => p.state === 'up').length;
  const n = up + 1;
  const time = call.started ? ` · ${clock(Math.floor((Date.now() - call.started) / 1000))}` : '';
  $('call-status').textContent = up ? `${n} personas${time}` : call.peers.size ? 'Conectando…' : 'Esperando a los demás';
}

function renderBar() {
  const micOn = local.mic && !!local.micTrack;
  const bar = $('call-bar');
  bar.innerHTML = `
    <button class="round ${micOn ? '' : 'off'}" data-a="mic" type="button" aria-label="${micOn ? 'Silenciar el micrófono' : 'Activar el micrófono'}" title="Micrófono">${icon(micOn ? 'mic' : 'micOff')}</button>
    <button class="round ${local.camTrack ? '' : 'off'}" data-a="cam" type="button" aria-label="${local.camTrack ? 'Apagar la cámara' : 'Encender la cámara'}" title="Cámara">${icon(local.camTrack ? 'video' : 'videoOff')}</button>
    ${isTouch && local.camTrack ? `<button class="round" data-a="flip" type="button" aria-label="Cambiar de cámara" title="Cambiar de cámara">${icon('flip')}</button>` : ''}
    ${canShare() || isTouch ? `<button class="round ${local.screenTrack ? 'on' : canShare() ? '' : 'unavailable'}" data-a="share" type="button" aria-label="${local.screenTrack ? 'Dejar de compartir la pantalla' : 'Compartir la pantalla'}" title="Compartir pantalla">${icon('screen')}</button>` : ''}
    <button class="round" data-a="invite" type="button" aria-label="Invitar" title="Invitar">${icon('invite')}</button>
    <button class="round end" data-a="end" type="button" aria-label="Salir de la llamada" title="Salir">${icon('hangup')}</button>`;
  bar.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => ACTIONS[b.dataset.a]()));
}
const ACTIONS = {
  mic: async () => { await setMic(!(local.mic && local.micTrack)); syncAll(); },
  cam: async () => { await setCam(!local.camTrack); syncAll(); },
  flip: async () => { await flipCam(); syncAll(); },
  share: toggleShare,
  invite: () => invite(call.room.code),
  end: leaveCall,
};

// ---------- Hojas ----------

function closeSheet() {
  document.querySelector('.sheet-backdrop')?.remove();
}
function newSheet(center = false) {
  closeSheet();
  const back = document.createElement('div');
  back.className = `sheet-backdrop${center ? ' center' : ''}`;
  document.body.append(back);
  back.addEventListener('click', (e) => { if (e.target === back) closeSheet(); });
  return back;
}

// ---------- Menú ⋯ ----------

const MENU = [
  { label: 'Nueva sala', icon: 'plus', run: () => openLobby(newCode()) },
  { label: 'Opciones de visualización', icon: 'palette', run: () => openDisplaySheet() },
  { label: 'Información', icon: 'info', run: () => openInfoSheet() },
];

function openMenu() {
  const menu = $('menu');
  menu.innerHTML = MENU.map((m, i) =>
    `<button class="menu-item" role="menuitem" data-i="${i}">${icon(m.icon, 20)}<span>${m.label}</span></button>`).join('');
  menu.querySelectorAll('.menu-item').forEach((b) => b.addEventListener('click', () => {
    closeMenu();
    trackLabel(MENU[b.dataset.i].label);
    MENU[b.dataset.i].run();
  }));
  const r = $('menu-btn').getBoundingClientRect();
  menu.style.top = `${r.bottom + 6}px`;
  menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  menu.hidden = false;
  $('menu-btn').setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  $('menu').hidden = true;
  $('menu-btn').setAttribute('aria-expanded', 'false');
}
$('menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  if ($('menu').hidden) openMenu();
  else closeMenu();
});
document.addEventListener('click', (e) => {
  if (!$('menu').hidden && !e.target.closest('#menu')) closeMenu();
});
window.addEventListener('resize', closeMenu);

function openInfoSheet() {
  const back = newSheet(true);
  back.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Información">
      <span class="install-logo">${logoSVG(56)}</span>
      <h2 class="sheet-title">MeetCTRL</h2>
      <p class="small muted">Versión ${APP_VERSION} · by OmT Finance</p>
      <p class="small">Videollamadas de hasta ${MAX_PEERS} personas con pantalla compartida. Crea una sala y envía el enlace: no hacen falta cuentas.</p>
      <p class="small muted">El vídeo, el audio y la pantalla van directos entre vosotros, cifrados. El servidor solo os pone en contacto y no guarda nada. Compartir la pantalla funciona desde un ordenador; en el iPhone y el iPad se puede ver, pero no compartir.</p>
      <div class="sheet-actions"><button type="button" class="done-btn" data-close>Cerrar</button></div>
    </div>`;
  back.querySelector('[data-close]').addEventListener('click', closeSheet);
}

// ---------- Opciones de visualización (modo y fondo) ----------

const WALLS = {
  cian: { name: 'Cian', c: ['8 145 178', '103 232 249', '34 211 238', '21 94 117'] },
  noche: { name: 'Noche', c: ['100 116 139', '148 163 184', '59 130 246', '30 64 175'] },
  menta: { name: 'Menta', c: ['45 212 191', '134 239 172', '20 184 166', '6 95 70'] },
  coral: { name: 'Coral', c: ['251 113 133', '253 186 116', '244 63 94', '136 19 55'] },
};
const lightQuery = matchMedia('(prefers-color-scheme: light)');
let display = { theme: 'auto', wall: 'cian', ...load(DISPLAY_KEY, {}) };
if (!WALLS[display.wall]) display.wall = 'cian';

function applyDisplay() {
  const light = display.theme === 'light' || (display.theme === 'auto' && lightQuery.matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.documentElement.dataset.wall = display.wall;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', light ? '#f0fbfd' : '#060f12');
}
lightQuery.addEventListener('change', () => { if (display.theme === 'auto') applyDisplay(); });

function wallPreview(key) {
  const [c1, c2, c3, c4] = WALLS[key].c;
  const light = document.documentElement.dataset.theme === 'light';
  const a = light ? 0.4 : 0.5;
  const base = light ? '#f0fbfd' : '#060f12';
  return `radial-gradient(70% 60% at 15% 10%, rgb(${c1} / ${a}), transparent 70%), radial-gradient(60% 55% at 90% 25%, rgb(${c2} / ${a * 0.8}), transparent 72%),
    radial-gradient(70% 60% at 75% 95%, rgb(${c3} / ${a * 0.85}), transparent 70%), radial-gradient(60% 55% at 5% 85%, rgb(${c4} / ${a * 0.8}), transparent 72%), ${base}`;
}

function openDisplaySheet() {
  const back = newSheet();
  const draw = () => {
    back.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Opciones de visualización">
        <h2 class="sheet-title">Opciones de visualización</h2>
        <p class="opt-label">Modo</p>
        <div class="seg" role="group" aria-label="Modo">
          ${[['dark', 'Oscuro'], ['light', 'Claro'], ['auto', 'Automático']].map(([v, l]) =>
            `<button type="button" data-theme-opt="${v}" class="${display.theme === v ? 'on' : ''}" aria-pressed="${display.theme === v}">${l}</button>`).join('')}
        </div>
        <p class="muted small">${display.theme === 'auto' ? 'Sigue el modo claro u oscuro del sistema.' : '&nbsp;'}</p>
        <p class="opt-label">Fondo</p>
        <div class="walls">
          ${Object.entries(WALLS).map(([k, w]) =>
            `<button type="button" class="wall ${display.wall === k ? 'on' : ''}" data-wall-opt="${k}" style="background:${wallPreview(k)}" aria-pressed="${display.wall === k}">${w.name}</button>`).join('')}
        </div>
        <div class="sheet-actions"><button class="done-btn" type="button">Listo</button></div>
      </div>`;
    back.querySelectorAll('[data-theme-opt]').forEach((b) => b.addEventListener('click', () => {
      display.theme = b.dataset.themeOpt;
      save(DISPLAY_KEY, display);
      applyDisplay();
      draw();
    }));
    back.querySelectorAll('[data-wall-opt]').forEach((b) => b.addEventListener('click', () => {
      display.wall = b.dataset.wallOpt;
      save(DISPLAY_KEY, display);
      applyDisplay();
      draw();
    }));
    back.querySelector('.done-btn').addEventListener('click', closeSheet);
  };
  draw();
}

// ---------- Aviso breve ----------

let toastTimer = 0;
function toast(text, { warn = false, stay = false } = {}) {
  const el = $('toast');
  el.textContent = text;
  el.classList.toggle('warn', warn);
  el.hidden = false;
  clearTimeout(toastTimer);
  if (!stay) toastTimer = setTimeout(() => { el.hidden = true; }, warn ? 5000 : 2400);
}

// ---------- Pantalla de inicio ----------
// Sin botón Entrar: el logo aparece (el arco se dibuja), se ve un instante y se pasa sola a la app
// con la transición de cristal, como en las demás apps.
const SPLASH_HOLD_MS = 1700;
const SPLASH_OUT_MS = 1200;
function enterApp() {
  const body = document.body;
  if (!$('splash') || body.classList.contains('entering')) return;
  body.classList.add('entering');
  setTimeout(() => {
    $('splash').remove();
    body.classList.remove('booting', 'entering');
    maybeShowInstallHint();
  }, SPLASH_OUT_MS);
}
setTimeout(enterApp, SPLASH_HOLD_MS);

// ---------- Aviso: añadir a la pantalla de inicio (solo móvil y tablet) ----------

const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const HINT_ICONS = {
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M7 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1"/>',
  more: '<circle cx="12" cy="5.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="18.5" r="1.5" fill="currentColor"/>',
  add: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const hintIcon = (name) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HINT_ICONS[name]}</svg>`;

function maybeShowInstallHint() {
  if (!(isIOS || isAndroid) || isStandalone() || lobbyCode) return; // quien llega por un enlace va directo a la sala
  if (load(INSTALL_HINT_KEY, null) === 'off') return;
  const steps = isIOS
    ? [
        ['share', 'Pulsa el botón <b>Compartir</b> de Safari (abajo en el iPhone, arriba en el iPad).'],
        ['add', 'Desliza hacia abajo y elige <b>Añadir a pantalla de inicio</b>.'],
        ['check', 'Pulsa <b>Añadir</b>. El icono de MeetCTRL aparecerá junto a tus apps.'],
      ]
    : [
        ['more', 'Pulsa el menú <b>⋮</b> de Chrome, arriba a la derecha.'],
        ['add', 'Elige <b>Añadir a pantalla de inicio</b> o <b>Instalar aplicación</b>.'],
        ['check', 'Confirma con <b>Instalar</b>. El icono de MeetCTRL aparecerá junto a tus apps.'],
      ];
  const back = newSheet(true);
  back.innerHTML = `
    <div class="sheet install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <span class="install-logo">${logoSVG(56)}</span>
      <h2 class="sheet-title" id="install-title">Añade MeetCTRL a tu pantalla de inicio</h2>
      <p class="muted small">Así la abrirás como una app más, a pantalla completa y con un solo toque.</p>
      <ol class="install-steps">
        ${steps.map(([ic, text]) => `<li><span class="step-icon">${hintIcon(ic)}</span><span>${text}</span></li>`).join('')}
      </ol>
      <div class="install-footer">
        <label class="no-more"><input type="checkbox" id="install-no-more" /> No mostrar más</label>
        <button class="done-btn" type="button" id="install-ok">Aceptar</button>
      </div>
    </div>`;
  back.querySelector('#install-ok').addEventListener('click', () => {
    if (back.querySelector('#install-no-more').checked) save(INSTALL_HINT_KEY, 'off');
    closeSheet();
  });
}

// ---------- Sin zoom (Safari en iOS ignora user-scalable=no) ----------
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ---------- Service worker y enlaces de invitación ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

function openFromLink() {
  const code = location.hash.startsWith('#s=') ? cleanCode(location.hash) : '';
  if (code && !call) openLobby(code);
}
window.addEventListener('hashchange', openFromLink);

applyDisplay();
renderHome();
openFromLink();
