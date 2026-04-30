# Scripts operativos del repositorio

Este documento inventaría los scripts operativos para facilitar su ejecución, mantenimiento y depuración.

## Clasificación usada

- **Crítico**: requerido para operación continua, despliegues o seguridad operativa.
- **Ocasional**: ejecución manual puntual (bootstrap, tareas administrativas o soporte).
- **Legado candidato**: script mantenido temporalmente para compatibilidad; antes de retirarlo debe mantenerse en estado **deprecated** y validarse que no tenga referencias en workflows/runbooks.

## Inventario de scripts

| Script | Propósito | Frecuencia | Owner sugerido | Clasificación | Comando |
| --- | --- | --- | --- | --- | --- |
| `uploadServer.js` | Backend Express para subida a Firebase Storage y endpoint administrativo `/toggleUser`. | Continua (servicio activo) | Backend / Operaciones | **Crítico** | `npm start` |
| `cronActualizarEstadosSorteos.js` | Actualiza estados de sorteos (`Activo` → `Sellado` → `Jugando`) sin depender del navegador. | Programada (cada minuto/intervalo operativo) | Backend / Operaciones | **Crítico** | `npm run cron` |
| `scripts/generateFirebaseConfig.js` | Genera `public/firebase-config.js` por ambiente para despliegues. | En cada build/deploy y cambios de configuración | DevOps / Release Manager | **Crítico** | `npm run generate:firebase-config -- --env <dev|stg|main>` |
| `scripts/assignRoleClaims.js` | Asigna rol y custom claims de Firebase Auth de forma segura desde backend. | Bajo demanda (altas/bajas/cambios de rol) | Seguridad / Backend | **Crítico** | `npm run assign-role -- --email usuario@dominio.com --role <Superadmin|Administrador|Colaborador>` |
| `scripts/reconciliarPremiosPendientes.js` | Reconciliación administrativa de premios pendientes. | Bajo demanda (soporte/incidencias) | Finanzas operativas / Backend | **Ocasional** | `npm run reconciliar-premios` |
| `scripts/applyFirestoreMutations.js` | Aplica mutaciones versionadas de Firestore usadas en flujo PR hacia `main`. | Por release de datos o mantenimiento | Data Ops / Backend | **Ocasional** | `npm run apply-firebase-mutations -- --files firebase/bingoanimalito/archivo.json` |
| `initUsers.js` | Bootstrap histórico de usuarios especiales + claims. | Sólo bootstrap legado | Backend / Seguridad | **Legado candidato** | `node initUsers.js` |
| `initBanks.js` | Bootstrap histórico de colección `Bancos`. | Sólo bootstrap legado | Operaciones de datos | **Legado candidato** | `node initBanks.js` |
| `initRoles.js` | Bootstrap histórico de colección `roles`. | Sólo bootstrap legado | Seguridad / Backend | **Legado candidato** | `node initRoles.js` |

## Política para scripts legado candidato

1. **Primero deprecación, luego retiro**.
   - Mantener advertencia explícita en consola al iniciar el script.
2. **Retiro en PR posterior**.
   - Eliminar sólo después de adjuntar evidencia de no uso en:
     - Workflows (`.github/workflows/*`)
     - Runbooks/documentación operativa (`README.md`, `docs/*`)
3. **Evidencia mínima sugerida para PR de retiro**:
   - Búsqueda sin coincidencias: `rg "initUsers|initBanks|initRoles" .github/workflows README.md docs`
   - Resultado de CI en verde tras retiro.
