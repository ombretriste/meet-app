// Función serverless de Vercel: pone en contacto a los participantes de una sala de MeetCTRL.
//
// El vídeo, el audio y la pantalla van directos entre dispositivos (WebRTC, cifrados). El servidor
// solo sabe quién está conectado a cada sala y pasa las señales para conectarlos, cifradas con una
// clave que sale del código de la sala (va en el enlace, detrás de «#», y nunca llega aquí).
//
//   GET  /api/meet                                 -> { configured } | { configured: false, vars }  (comprobación)
//   POST /api/meet { action: 'ice', rid }          -> { iceServers }  (servidores STUN/TURN)
//   POST /api/meet { action: 'join', rid, pid }    -> { peers } | 409 { error: 'full' }
//   POST /api/meet { action: 'poll', rid, pid }    -> { peers, inbox: [{ from, sig }] }
//   POST /api/meet { action: 'send', rid, pid, to, sig } -> { ok }
//   POST /api/meet { action: 'leave', rid, pid }   -> { ok }
//
// Almacenamiento: Upstash Redis (integración de Vercel), vía su API REST. Todas las claves empiezan
// por «mtg:» y caducan solas, así que puede compartir base de datos con las otras apps de OmT.

// Variables de la base de datos (mismo criterio que ChatCTRL: vale cualquier par …REST_API_URL/TOKEN)
function findRedisEnv(env = process.env) {
  const known = [['KV_REST_API_URL', 'KV_REST_API_TOKEN'], ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']];
  for (const [u, t] of known) if (env[u] && env[t]) return { url: env[u], token: env[t] };
  for (const k of Object.keys(env)) {
    const m = k.match(/^(.*)(REST_API_URL|REDIS_REST_URL)$/);
    if (!m || !/^https:\/\//.test(env[k] || '')) continue;
    const tk = m[1] + m[2].replace('URL', 'TOKEN');
    if (env[tk]) return { url: env[k], token: env[tk] };
  }
  return { url: null, token: null };
}
const { url: REDIS_URL, token: REDIS_TOKEN } = findRedisEnv();
const RID = /^[a-f0-9]{64}$/;
const PID = /^[a-f0-9]{32}$/;
const MAX_PEERS = 6;       // cada uno envía su vídeo a todos: más de 6 satura los móviles
const STALE_MS = 15000;    // sin noticias en 15 s, ese participante ya no está
const ROOM_TTL_S = 60;     // la sala desaparece en cuanto se queda vacía
const MAX_SIG = 40000;     // tamaño máximo de una señal cifrada
const MAX_INBOX = 20;      // señales que se recogen de una vez
const RATE_PER_MIN = 300;  // señales por minuto y sala

async function redis(...command) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}
// Varias órdenes en una sola llamada
async function pipeline(commands) {
  if (!commands.length) return [];
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error(json.error || 'pipeline');
  return json.map((r) => r.result);
}

const roomKey = (rid) => `mtg:r:${rid}`;
const inboxKey = (rid, pid) => `mtg:q:${rid}:${pid}`;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL) {
    const vars = Object.keys(process.env).filter((k) => /KV|REDIS|UPSTASH|REST_API/.test(k)).sort();
    return res.status(req.method === 'GET' ? 200 : 503).json({ configured: false, error: 'not-configured', vars });
  }
  if (req.method === 'GET') {
    try {
      await redis('PING');
      return res.status(200).json({ configured: true });
    } catch (err) {
      return res.status(200).json({ configured: false, error: `redis: ${err.message}` });
    }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { action, rid, pid } = body;
  if (!RID.test(rid || '')) return res.status(400).json({ error: 'bad-request' });

  try {
    if (action === 'ice') {
      const iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
      const { TURN_URLS, TURN_USER, TURN_PASS } = process.env;
      if (TURN_URLS && TURN_USER && TURN_PASS) iceServers.push({ urls: TURN_URLS.split(',').map((u) => u.trim()), username: TURN_USER, credential: TURN_PASS });
      return res.status(200).json({ iceServers });
    }

    if (!PID.test(pid || '')) return res.status(400).json({ error: 'bad-request' });
    const now = Date.now();
    const key = roomKey(rid);

    if (action === 'join') {
      const [, list] = await pipeline([
        ['ZREMRANGEBYSCORE', key, 0, now - STALE_MS],
        ['ZRANGE', key, 0, -1],
      ]);
      const peers = (list || []).filter((p) => p !== pid);
      if (peers.length >= MAX_PEERS) return res.status(409).json({ error: 'full' });
      await pipeline([['ZADD', key, now, pid], ['EXPIRE', key, ROOM_TTL_S]]);
      return res.status(200).json({ peers });
    }

    if (action === 'poll') {
      const [, , list, inbox] = await pipeline([
        ['ZADD', key, now, pid],
        ['EXPIRE', key, ROOM_TTL_S],
        ['ZRANGEBYSCORE', key, now - STALE_MS, '+inf'],
        ['LPOP', inboxKey(rid, pid), MAX_INBOX],
      ]);
      return res.status(200).json({
        peers: (list || []).filter((p) => p !== pid),
        inbox: (inbox || []).map((m) => JSON.parse(m)),
      });
    }

    if (action === 'send') {
      const { to, sig } = body;
      if (!PID.test(to || '') || typeof sig !== 'string' || !sig || sig.length > MAX_SIG) return res.status(400).json({ error: 'bad-request' });
      const minute = Math.floor(now / 60000);
      const [count] = await pipeline([['INCR', `mtg:rl:${rid}:${minute}`], ['EXPIRE', `mtg:rl:${rid}:${minute}`, 120]]);
      if (count > RATE_PER_MIN) return res.status(429).json({ error: 'rate' });
      await pipeline([['RPUSH', inboxKey(rid, to), JSON.stringify({ from: pid, sig })], ['EXPIRE', inboxKey(rid, to), ROOM_TTL_S]]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'leave') {
      await pipeline([['ZREM', key, pid], ['DEL', inboxKey(rid, pid)]]);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'bad-action' });
  } catch (err) {
    return res.status(502).json({ error: 'server' });
  }
};
