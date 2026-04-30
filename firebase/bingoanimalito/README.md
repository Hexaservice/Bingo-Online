# Mutaciones de Firestore para Bingoanimalito

Esta carpeta define cambios de datos que se aplican automáticamente cuando un PR es **mergeado** a `main`.

## Flujo

1. Crear un archivo JSON en esta carpeta (ejemplo: `2026-03-27-actualizar-parametros.json`).
2. Abrir PR y solicitar revisión.
3. Al hacer merge, el workflow `.github/workflows/bingoanimalito-firebase-pr-sync.yml` aplica las mutaciones con Firebase Admin SDK.

## Formato de archivo

```json
{
  "author": "tu.usuario",
  "ticket": "BA-123",
  "mutations": [
    {
      "op": "set",
      "path": "Variablesglobales/Parametros",
      "merge": true,
      "data": {
        "Aplicacion": "Bingoanimalito",
        "Pais": "VE"
      }
    },
    {
      "op": "update",
      "path": "configuracion/general",
      "data": {
        "modo": "produccion"
      }
    },
    {
      "op": "delete",
      "path": "temporal/documento-demo"
    }
  ]
}
```

## Secretos requeridos en GitHub

- `FIREBASE_SERVICE_ACCOUNT_BINGOANIMALITO`

Debe contener el JSON completo de la cuenta de servicio con permisos de escritura en Firestore.
