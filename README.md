# MeetCTRL

Versión 0.2.1 · by OmT Finance

App web (PWA) de videollamadas con pantalla compartida. Se crea una sala, se envía el enlace y listo:
sin cuentas. Mismo estilo que las demás apps de OmT Finance, en cian.

## Cómo funciona

- **Salas:** cada sala tiene un código secreto de 16 caracteres, que va en el enlace (`#s=…`) y nunca
  llega al servidor. Del código salen el identificador de la sala (SHA-256) y la clave AES-GCM (PBKDF2).
- **Conexión:** WebRTC directo entre cada par de participantes, hasta 6 personas. Cada conexión tiene
  siempre tres pistas (voz, cámara, pantalla) y un canal de datos con el estado (nombre, micro, cámara,
  pantalla): encender o apagar algo cambia la pista con `replaceTrack`, sin volver a negociar.
- **Señales:** `api/meet.js` guarda quién está en cada sala y pasa ofertas y respuestas cifradas, con
  claves `mtg:` en Upstash Redis que caducan solas. No se guarda vídeo ni audio.

## Puesta en marcha (Vercel)

1. Conectar Upstash Redis al proyecto (la misma base de datos de las otras apps vale).
2. Activar Web Analytics.
3. `GET /api/meet` debe responder `{ "configured": true }`.
4. Para redes móviles o de empresa que no permiten conexión directa, añadir un servidor TURN con las
   variables `TURN_URLS` (separadas por comas), `TURN_USER` y `TURN_PASS`. Sin él, algunas llamadas no Con Cloudflare (recomendado, 1000 GB al mes gratis): `CF_TURN_KEY_ID` y `CF_TURN_API_TOKEN`; el servidor pide claves temporales. El TURN solo se da a quien envía la clave de administrador (la misma que la clave de registro de UnderCTRL; se cambia con `ADMIN_CODE`), que se pone en ⋯ → Llamadas sin wifi; sin ella solo STUN (la llamada funciona con wifi).
   conectarán.

## Límites conocidos

- Compartir la pantalla necesita un navegador de ordenador: iOS y iPadOS no lo permiten (allí sí se ve, y el botón explica el motivo).
- No se comparte el sonido del ordenador.
- Sin avisos de llamada: se entra con el enlace.

## Seguridad

- **Política de seguridad (CSP) y cabeceras** en `vercel.json`, como en las otras apps de OmT: solo se
  ejecuta código de la propia app (nada en línea: lo que iba en `index.html` está en `boot.js`), solo se
  conecta a su propio servidor, no se puede incrustar en otra web (`frame-ancestors 'none'`), `nosniff` y
  `no-referrer`. `Permissions-Policy` deja cámara, micrófono y pantalla solo a la propia app y bloquea la
  ubicación. Las conexiones WebRTC entre participantes no dependen de la CSP.
- Lo que llega de los demás (nombre y estado) se escapa siempre antes de mostrarse.
