# Reforma del sistema de audio (solo archivos del repositorio)

## Diagnóstico técnico
1. El manifiesto de audio tenía múltiples fuentes externas (Mixkit/Pixabay) con fallback remoto.
2. El motor aceptaba cualquier URL y podía intentar descargar audios desde internet.
3. Existía fallback por síntesis (`generator`) cuando fallaba la descarga.

Esto producía fallas típicas:
- CORS/bloqueo de red.
- Latencia de primer sonido.
- Autoplay bloqueado y arranque inconsistente.
- Diferencias de volumen entre fuentes heterogéneas.

## Nuevo diseño aplicado
- Política estricta: solo rutas locales bajo `/sonidos/`.
- Manifiesto reducido a archivos WAV locales versionados.
- Motor endurecido con validación de origen (`isLocalAudioUrl`) y rechazo explícito de URLs externas.
- Eliminación del fallback por síntesis para cumplir la política de “solo archivos del repositorio”.

## Opciones para asegurar que el sonido funcione sin problemas
### Opción A (aplicada): WebAudio + assets locales
- Mantener `audioManager` actual.
- Beneficio: control fino de volumen, ducking, preload y concurrencia.

### Opción B: HTMLAudioElement por evento
- Menor complejidad, útil para apps pequeñas.
- Menor control de mezcla/ducking.

### Opción C: Híbrida
- Música con `HTMLAudioElement` en loop y SFX con WebAudio.
- Equilibrio entre simplicidad y control.

## Lista de verificación operativa
- Verificar que existan `/sonidos/1.wav` ... `/sonidos/75.wav`.
- Confirmar interacción de usuario antes del primer `play`.
- Revisar estado de mute/volumen en UI.
- Ejecutar pruebas manuales en móviles (iOS/Android) y desktop.
