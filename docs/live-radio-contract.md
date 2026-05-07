# Contrato técnico: `global/liveRadio`

Este documento define el contrato de datos para la configuración de la emisora en vivo (`liveRadio`) en Firestore.

## Ruta

- Documento: `global/liveRadio`

## Objetivo

Centralizar la configuración del audio en vivo sin romper la compatibilidad con las claves existentes de live video (por ejemplo, las usadas hoy en `Variablesglobales/Parametros` como `transmitirEnVivo`, `linkLiveTiktok`, etc.).

## Esquema base (obligatorio)

```json
{
  "enabled": true,
  "status": "offline",
  "streamUrl": "",
  "title": "Emisora principal",
  "hostName": "Operador",
  "startedAt": "<Firestore Timestamp>",
  "updatedAt": "<Firestore Timestamp>",
  "requireAuth": true,
  "version": 1
}
```

## Definición de campos

- `enabled` (`boolean`): activa/desactiva la emisora.
- `status` (`string`): estado operativo de la emisora.
  - Enum permitido: `offline`, `starting`, `live`, `paused`, `ended`.
- `streamUrl` (`string`): URL del stream de audio.
  - Regla: **obligatorio no vacío** cuando `status = "live"`.
- `title` (`string`): título visible de la emisión.
- `hostName` (`string`): nombre del locutor/operador.
- `startedAt` (`timestamp`): inicio de la sesión activa o última sesión.
- `updatedAt` (`timestamp`): última modificación del documento.
- `requireAuth` (`boolean`): exige autenticación para consumo del stream.
- `version` (`number` entero): versión del contrato para migraciones futuras.

## Reglas de seguridad asociadas

En `firestore.rules` se aplica:

- Lectura para usuarios autenticados con rol de jugador/operación.
- Escritura solo para operadores privilegiados (`Administrador`, `Superadmin`, `Colaborador`) y cuentas de sistema admin.
- Validación de esquema, enum de `status` y regla condicional de `streamUrl`.

## Compatibilidad

- No reemplaza ni elimina claves existentes de live video.
- Permite adopción gradual del nuevo documento de live radio.
