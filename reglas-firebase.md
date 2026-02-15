# Validación de reglas Firebase por rol

Este repositorio actualmente valida permisos por rol principalmente en `firestore.rules`.

## Cobertura funcional mínima recomendada

- **Jugador**: solo lectura/escritura sobre su propio perfil y recursos permitidos.
- **Colaborador**: acceso de lectura/escritura limitado a operaciones operativas autorizadas.
- **Administrador**: acceso ampliado para gestión de operaciones y usuarios.
- **Superadmin**: acceso total para soporte y administración global.

## Colección `Variablesglobales`

- El documento `Variablesglobales/Parametros` se considera **confidencial**.
- Solo puede leerse y escribirse con una sesión que cumpla `isStrongSuperadmin()`.
- El resto de documentos de `Variablesglobales` mantiene lectura para usuarios autenticados (`isSignedIn()`) y escritura administrativa (`isAdmin()`).

## Checklist de verificación manual (sin emulador)

1. Revisar condiciones de rol en reglas con helpers reutilizables (`isSignedIn`, `isAdminLike`, etc.).
2. Confirmar que las rutas sensibles (`users`, `billeteras`, `transacciones`) restringen por `request.auth` y rol.
3. Confirmar que no existen `allow read, write: if true;` en colecciones sensibles.
4. Verificar que una cuenta sin claim de rol administrativo no puede escribir datos de otros usuarios.
5. Verificar que `Variablesglobales/Parametros`:
   - carga correctamente en `public/parametros.html` con cuenta **Superadmin**,
   - y devuelve permiso denegado para cuentas autenticadas sin privilegio fuerte de Superadmin.

## Opción recomendada (si el equipo habilita Firebase Emulator)

Agregar pruebas automatizadas con `@firebase/rules-unit-testing` para casos por rol:

- `Jugador` intentando editar perfil de otro usuario → **denegado**.
- `Colaborador` intentando promover roles → **denegado**.
- `Administrador` gestionando transacciones permitidas → **autorizado**.
- `Superadmin` en ruta administrativa global → **autorizado**.
