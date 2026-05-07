# Plan técnico: migración a sistema de audio tipo “emisora”

## Resumen corto
Se propone reemplazar el audio basado en eventos SFX por un canal de audio en vivo desde `cantarsorteos` hacia `juegoactivo` usando WebRTC (opción recomendada), manteniendo el frontend estático en `public/` y el backend Express en `uploadServer.js` como servicio de señalización. No se modifican contratos de Firestore ni reglas de seguridad.

---

## 1) Auditoría del audio actual

### 1.1 Archivos/componentes que hoy reproducen o controlan audio
- `public/js/audioManager.js`: motor principal Web Audio (contexto, ganancia master/music/sfx, decodificación, caché y reproducción de SFX/música).
- `public/js/audioManifest.js`: manifiesto de fuentes locales (`/sonidos/*.wav`) y metadatos por evento.
- `public/js/audioControls.js`: controles globales de volumen/mute, consentimiento/autoplay y registro de tracks/eventos.
- `public/js/gameAudioOrchestrator.js`: orquesta audio del juego (cola de cantos, validación de assets locales, debug `?audioDebug=1`).
- `public/js/audioManagerCompat.js`: compatibilidad/fallback cuando `audioManager` no está completamente disponible.
- `public/juegoactivo.html`: integra panel de audio, scripts de audio y lógica de interacción/autoplay + iframe de transmisión.

### 1.2 Dependencias/eventos actuales
- API Web Audio (`AudioContext`, `GainNode`, `decodeAudioData`) en `audioManager.js`.
- `navigator.mediaDevices.getUserMedia({ audio: true })` en `juegoactivo.html` para desbloqueo/permiso de audio de transmisión.
- Persistencia de preferencias de audio en `localStorage` (`audio:masterVolume`, `audio:sfxVolume`, `audio:muted`).
- Eventos SFX dinámicos por número cantado (`/sonidos/<n>.wav`) y efectos auxiliares.

### 1.3 Qué conservar vs. eliminar
**Conservar (fase de transición):**
- `audioManager.js` como mixer/reproductor local y fallback.
- `audioManifest.js` y `public/sonidos/` como biblioteca de cues locales.
- UI de mute/volumen en `juegoactivo.html` (adaptada para stream + fallback).

**Eliminar o desactivar gradualmente:**
- Reproducción secuencial de cantos en cliente jugador como mecanismo principal.
- Dependencia de que cada cliente reproduzca exactamente el mismo evento de canto para “simular vivo”.
- Código duplicado de orquestación embebido en `juegoactivo.html` si ya existe `gameAudioOrchestrator.js`.

---

## 2) Propuesta técnica para streaming (recomendada)

## Opción recomendada: WebRTC (audio-only) + señalización por `uploadServer.js`

### ¿Por qué WebRTC?
- Latencia baja (objetivo práctico: 150–800 ms en redes móviles razonables).
- Compatible con navegador móvil/desktop sin plugins.
- Permite upstream único desde `cantarsorteos` y downstream múltiple a jugadores.

### Diseño de alto nivel
1. **Emisor (`cantarsorteos`)**
   - Crea un `AudioContext`.
   - Construye mezcla con `MediaStreamDestination`.
   - Fuentes conectadas:
     - `AudioBufferSourceNode` (archivos locales `/sonidos`).
     - `MediaStreamAudioSourceNode` (micrófono).
     - `MediaElementAudioSourceNode` opcional (música de fondo).
   - Publica 1 track de audio mezclado por `RTCPeerConnection`.

2. **Señalización (`uploadServer.js`)**
   - Endpoints temporales para intercambiar SDP/ICE (sin secretos).
   - “roomId” por sorteo activo, con TTL corto y limpieza.
   - Token efímero de sesión (derivado de autenticación ya existente) para evitar suscripciones anónimas no deseadas.

3. **Receptor (`juegoactivo`)**
   - Crea `RTCPeerConnection` en modo receive-only.
   - Reproduce `remoteStream` en `<audio autoplay playsinline>`.
   - Si falla WebRTC/autoplay, fallback a SFX local existente.

### Mezcla de fuentes
- `GainNode` por fuente: `micGain`, `sfxGain`, `musicGain` + `masterGain`.
- `DynamicsCompressorNode` opcional para nivelar picos.
- “Duck automático”: cuando entra canto SFX, bajar música temporalmente.

### Sincronización/control desde `cantarsorteos`
- Panel “On Air”:
  - Botón iniciar/detener transmisión.
  - Toggles: micrófono, biblioteca de sonidos, música externa.
  - Medidores simples (nivel RMS aproximado) por fuente.
- Estado de emisión en memoria del servidor + heartbeat cada 10s.

### Consumo en `juegoactivo` con latencia razonable
- Suscripción automática al detectar sorteo “en vivo”.
- Reconexión exponencial (1s, 2s, 4s, 8s, tope 20s).
- Indicador de estado: `Conectando | En vivo | Reintentando | Fallback local`.

---

## 3) Plan por fases (PRs pequeños)

## PR1 — `chore(audio): preparar feature flag y apagar legado sin romper UI`
- Agregar flags:
  - `window.__AUDIO_STREAMING_ENABLED__` (default `false`).
  - `window.__AUDIO_STREAMING_FORCE_FALLBACK__`.
- Centralizar decisión de ruta de audio (stream vs legado).
- Mantener UI actual, pero con routing interno por flag.

**Tamaño objetivo:** ~200–300 líneas netas.

## PR2 — `feat(audio): canal base WebRTC (sin mezcla avanzada)`
- `uploadServer.js`: endpoints de señalización mínimos.
- `cantarsorteos.html/js`: publicar track de micrófono simple.
- `juegoactivo.html/js`: consumir stream remoto en `<audio>`.
- Logs mínimos de conexión/errores.

**Tamaño objetivo:** ~300–400 líneas netas.

## PR3 — `feat(audio): mezcla de fuentes y controles de emisora`
- Agregar mixer Web Audio en emisor.
- Conectar sonidos locales `/sonidos`, micrófono y música opcional.
- Controles de ganancia y mute por fuente.

**Tamaño objetivo:** ~300–400 líneas netas.

## PR4 — `feat(audio): integración completa en juegoactivo + fallback robusto`
- Estado visual de transmisión.
- Reconexión, watchdog de silencio y fallback automático.
- Telemetría cliente de diagnóstico.

**Tamaño objetivo:** ~250–350 líneas netas.

---

## 4) Implementación (cambios concretos por archivo)

### Frontend
- `public/cantarsorteos.html`
  - Nuevo panel “Emisora” (start/stop, mic, música, nivel, latencia estimada).
- `public/juegoactivo.html`
  - Reproductor `<audio id="live-radio-audio">` y estados de conexión.
- `public/js/audioManager.js`
  - Reutilizar utilidades de ganancia/fallback; no romper API existente.
- `public/js/gameAudioOrchestrator.js`
  - Entrypoint único para decidir `stream` o `legacy` por feature flag.
- **Nuevos archivos sugeridos**
  - `public/js/liveAudioPublisher.js`
  - `public/js/liveAudioSubscriber.js`
  - `public/js/liveAudioFeatureFlags.js`

### Backend
- `uploadServer.js`
  - Endpoints `/api/live-audio/*` para offer/answer/ice y heartbeat.
  - Estructura en memoria para sesiones activas por `sorteoId`.

### Firestore/Rules
- Sin cambios en `firestore.rules` ni `storage.rules` en esta estrategia.

---

## 5) Logs/telemetría mínima
- Cliente emisor:
  - `live_audio_publish_started`, `live_audio_publish_stopped`, `live_audio_source_changed`.
- Cliente receptor:
  - `live_audio_subscribe_attempt`, `live_audio_subscribed`, `live_audio_reconnect`, `live_audio_fallback_legacy`.
- Servidor:
  - `live_audio_offer_received`, `live_audio_answer_sent`, `live_audio_room_gc`.

Se recomienda formato JSON en `console.info/warn/error` para facilitar soporte.

---

## 6) Riesgos y mitigaciones
- **Permisos de micrófono:** UX clara de consentimiento + fallback inmediato.
- **Compatibilidad móvil (iOS/autoplay):** botón explícito “Activar audio” + `playsinline`.
- **Ancho de banda:** Opus mono 24–32 kbps por defecto.
- **Reconexión:** backoff exponencial + watchdog de pista remota.
- **Escalabilidad:** para alta concurrencia, migrar luego a SFU administrado.

---

## 7) Pruebas
Comandos base por PR:
- `npm test`
- (si hay cambios de config Firebase) `npm run generate:firebase-config`

Evidencia esperada:
- PASS: tests existentes + nuevos tests unitarios de flags/estado.
- FAIL: bloquear merge si rompe flujo de `juegoactivo` o `cantarsorteos`.

---

## 8) Rollback claro
1. Desactivar `window.__AUDIO_STREAMING_ENABLED__ = false`.
2. Redeploy estático de `public/`.
3. Ignorar endpoints `/api/live-audio/*` (dejar inactivos sin impacto).

Tiempo objetivo de reversión: minutos, sin tocar reglas de Firestore.

---

## 9) Seguridad y operación
Este cambio **no** toca autenticación, premios, billetera ni reglas Firestore en la fase propuesta.
- Clasificación de riesgo: **medio** (operación de audio en vivo).
- Checklist:
  - Sin secretos nuevos.
  - Sin credenciales hardcodeadas.
  - Sin cambios de contratos de datos Firestore.
