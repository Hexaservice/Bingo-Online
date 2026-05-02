## Resumen de cambios
- 

## Motivación / problema que resuelve
- 

## Riesgos / impacto
- 

## Matriz de impacto (alto riesgo si aplica a auth, premios, billetera o reglas)
| Dimensión | Validación requerida | Evidencia |
|---|---|---|
| Usuario | Inicio de sesión funciona por entorno (dev/main) | |
| Datos | Lecturas/escrituras se realizan en Firestore del proyecto correcto | |
| Seguridad | Reglas intactas, sin ampliar permisos | |
| Operación | Deploy por rama apunta al proyecto esperado | |

## Flujo de ramas y promoción
- [ ] Este PR se abre hacia `dev` (trabajo diario en `fix/*`, `feat/*`, `chore/*`, `docs/*`).
- [ ] Si es release, este PR promueve `dev` → `main`.

## Checklist operativo de Firebase por entorno
### 1) Firebase Auth por proyecto
- [ ] Se habilitó el dominio de Hosting del entorno en **Firebase Auth > Authorized domains**.
- [ ] Se validó que `authDomain` en `public/firebase-config.js` (generado por rama) coincide con el dominio del entorno.

### 2) Aislamiento de datos
- [ ] Se comprobó que `projectId` y `databaseURL` de la rama apuntan al proyecto correcto.
- [ ] Se confirmó que credenciales de Admin SDK (workflows/backend) no se mezclan entre entornos.

### 3) Matriz de impacto obligatoria
- [ ] Usuario: login aislado por entorno validado.
- [ ] Datos: lecturas/escrituras validadas en Firestore correcto.
- [ ] Seguridad: reglas revisadas sin ampliar permisos.
- [ ] Operación: despliegue por rama validado contra proyecto esperado.

### 4) Rollback específico
- [ ] Existe commit revertible para restaurar `.firebaserc`, `firebase.json` y workflow previo (si fueron modificados).
- [ ] Criterio explícito de abortar deploy definido: **si login falla o si proyecto destino no coincide con rama**.

## Plan de rollback
- Pasos concretos:
  1. `git revert <commit>` del cambio de configuración/deploy.
  2. Verificar restauración de `.firebaserc`, `firebase.json` y workflows asociados.
  3. Re-ejecutar deploy únicamente después de validar login y mapeo rama→proyecto.
- Criterio de abortar deploy:
  - [ ] Login falla.
  - [ ] El proyecto destino no coincide con la rama.

## Evidencia de pruebas
- [ ] `npm test` ejecutado y resultado adjunto.
- [ ] `npm run generate:firebase-config` ejecutado (cuando aplique) y resultado adjunto.
- [ ] `npm run generate:loterias-manifest` ejecutado (si hubo cambios de imágenes/manifiesto) y resultado adjunto.

### Resultado de comandos
```bash
npm test
npm run generate:firebase-config    # cuando aplique
npm run generate:loterias-manifest  # cuando aplique
```
- Resultado:
  - 

## Checklist de seguridad
- [ ] No se subieron secretos ni credenciales.
- [ ] No hay credenciales hardcodeadas.
- [ ] Sin cambios no deseados en `firestore.rules`/`storage.rules`.
- [ ] Verificación de entorno Firebase correcto (`dev` o `main`) antes de deploy.
- [ ] Se mantienen contratos de datos y reglas de seguridad (Firestore/Storage).
