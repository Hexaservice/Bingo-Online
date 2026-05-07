# Guía de soporte: Emisora en vivo

## Incidencias comunes

### 1) Autoplay bloqueado
- **Síntoma:** al presionar Play no arranca y aparece mensaje de reproducción.
- **Acción:** solicitar al usuario que interactúe primero con la página (tap/click), desactive modo ahorro de batería del navegador y vuelva a intentar.
- **Verificación:** confirmar que el botón cambia a `Pause` y el estado muestra `En vivo`.

### 2) Pérdida de audio durante la transmisión
- **Síntoma:** la radio entra en `Conectando...` o `Error`.
- **Acción:** el cliente intenta reconexión automática con backoff exponencial (1s, 2s, 4s, 8s, 16s, 30s).
- **Verificación:** revisar en consola advertencias de reconexión y validar retorno a `En vivo`.

### 3) URL inválida o stream caído
- **Síntoma:** estado en panel operativo indica caída o `error` sostenido.
- **Acción:** validar `streamUrl` en `global/liveRadio`, probar acceso directo a `.m3u8` y confirmar respuesta con `#EXTM3U`.
- **Verificación:** transición a `live` debe completar health-check sin rollback.

## Alertas operativas definidas
- **Caída de stream:** estado `live` sin `streamUrl` válido.
- **Estado error sostenido:** `error` por más de 60 segundos.

## Métricas mínimas monitoreadas
- Usuarios conectados (estimado): `listenersEstimate`.
- Errores de reproducción: `playbackErrors`.
- Tiempo en estado live: cálculo por `startedAt`.
