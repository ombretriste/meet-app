# MeetCTRL

Versión 0.1.3 · by OmT Finance

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
   variables `TURN_URLS` (separadas por comas), `TURN_USER` y `TURN_PASS`. Sin él, algunas llamadas no Con Cloudflare (recomendado, 1000 GB al mes gratis): `CF_TURN_KEY_ID` y `CF_TURN_API_TOKEN`; el servidor pide claves temporales.
   conectarán.

## Límites conocidos

- Compartir la pantalla necesita un navegador de ordenador: iOS y iPadOS no lo permiten (allí sí se ve, y el botón explica el motivo).
- No se comparte el sonido del ordenador.
- Sin avisos de llamada: se entra con el enlace.
