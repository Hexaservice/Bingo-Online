# Operación de emisora HLS audio-only (`global/liveRadio`)

## 1) Proveedor definido y flujo de ingesta

### Proveedor recomendado: **MediaMTX autogestionado**

Se define **MediaMTX** como proveedor base por estas razones:
- Baja complejidad operativa para audio-only en HLS.
- Permite ingesta RTMP/SRT/WebRTC y salida HLS estable.
- Costo predecible frente a servicios cloud cuando la concurrencia es media.

> Alternativa futura: migrar a servicio cloud (Wowza Cloud/Nimble Streamer cloud administrado) si la concurrencia supera el objetivo del punto 5.

### Flujo de ingesta desde `cantarsorteos`

1. Operador inicia emisión desde `public/cantarsorteos.html`.
2. Cabina (OBS o codificador equivalente) envía audio a MediaMTX vía RTMP.
3. MediaMTX publica HLS audio-only en una URL estable.
4. Se configura `global/liveRadio.streamUrl` con esa URL.
5. Frontend de jugador (`public/jugarcartones.html`) consume `streamUrl` cuando `status=live`.

---

## 2) Salida HLS audio-only y URL estable

### Perfil técnico sugerido
- Codec: AAC-LC
- Bitrate: 64 kbps (rango aceptable 48–96 kbps)
- Sample rate: 44.1 kHz
- Canales: mono (prioridad eficiencia) o estéreo si se requiere música

### Convención de URL estable

Usar una ruta fija por ambiente:
- Producción: `https://stream.tudominio.com/live/bingo-audio/index.m3u8`
- Staging: `https://stream-stg.tudominio.com/live/bingo-audio/index.m3u8`

`streamUrl` debe apuntar siempre a `index.m3u8` y **no** a segmentos temporales.

---

## 3) Proceso operacional cabina (iniciar/detener)

### Manual (recomendado para fase inicial)
1. Verificar señal de entrada en cabina (micrófono/mixer).
2. Iniciar codificador (OBS) al endpoint RTMP de MediaMTX.
3. En `cantarsorteos`, pulsar **Iniciar Emisora**.
4. El sistema ejecuta health-check del `m3u8`; solo si pasa conserva `status=live`.
5. Para detener: parar codificador y pulsar **Detener Emisora**.

### Automatizado (fase posterior)
- Webhook desde cabina a backend (`uploadServer.js`) para marcar `starting` al abrir upstream.
- `cron` de watchdog para retornar a `offline` si no hay playlist o si hay silencio prolongado.

---

## 4) Health-check mínimo antes de `status=live`

Se implementa validación básica del `m3u8` en `cantarsorteos`:
- `GET streamUrl` con `cache: no-store`.
- Verifica `HTTP 200`.
- Verifica firma HLS (`#EXTM3U`) en el cuerpo.
- Si falla, se revierte el documento a `status=offline`.

Con esto se evita publicar `live` cuando la URL no está disponible.

---

## 5) SLO operativos: latencia, concurrencia y contingencia

### Latencia esperada (HLS audio-only)
- Objetivo típico: **6–12 s** extremo a extremo.
- Modo low-latency HLS (si se habilita): **3–6 s**.

### Concurrencia objetivo inicial
- Objetivo operativo: **300 oyentes concurrentes** en un nodo.
- Umbral de revisión: >300 concurrentes sostenidos por 3 sorteos.
- Acción al superar umbral: CDN delante de HLS o migración a servicio cloud administrado.

### Procedimiento de contingencia
1. Si falla HLS, mantener `status=offline` (no anunciar en vivo).
2. Activar fallback de audio local existente en clientes.
3. Reiniciar upstream desde cabina y repetir health-check.
4. Si falla por >10 min, cambiar a plan B:
   - emitir por stream alterno preconfigurado (`streamUrl` secundario), o
   - operar solo con cantos locales temporalmente.
5. Registrar incidente (hora inicio/fin, causa raíz, impacto en usuarios).
