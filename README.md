# Bingo Online

Este proyecto utiliza Firebase para autenticar usuarios mediante Google y almacenar la información en Firestore.

## Inicializar usuarios especiales

Se incluyen dos cuentas con roles especiales:

- `jhoseph.q@gmail.com` como **Superadmin**
- `cyz513@gmail.com` como **Superadmin**

Para crear los documentos iniciales en Firestore ejecute:

```bash
npm install
node initUsers.js
node initBanks.js
```
Este segundo script poblará la colección `Bancos` con los bancos iniciales.

Debe disponer de un archivo `serviceAccountKey.json` con las credenciales de Firebase o definir la variable `GOOGLE_APPLICATION_CREDENTIALS` apuntando al archivo de claves.

Este script crea/actualiza las entradas en la colección `users` y, en la misma ejecución, sincroniza Firebase Auth:

- verifica cada correo con `getUserByEmail`
- si el usuario no existe en Auth, lo crea automáticamente (o reporta claramente el error)
- aplica `setCustomUserClaims` para cuentas **Superadmin** con:
  - `role: 'Superadmin'`
  - `roles: ['Superadmin']`
  - `admin: true`

De esta forma, la inicialización de usuarios especiales deja perfil (`users/{email}`) + *custom claims* sincronizados en una sola corrida.

## Subida de imágenes

Para almacenar las imágenes de los sorteos se utiliza **Firebase Cloud Storage**. El servicio auxiliar (`uploadServer.js`) guarda los archivos en el bucket configurado y devuelve la URL pública. Además expone el endpoint `/toggleUser` utilizado en la página de gestión de usuarios para habilitar o deshabilitar cuentas.

### Notificaciones por correo

Las notificaciones por correo electrónico se eliminaron del proyecto y ya no es necesario configurar SendGrid ni credenciales asociadas para operar la aplicación. En particular, `uploadServer.js` solo valida `GOOGLE_APPLICATION_CREDENTIALS` y `FIREBASE_STORAGE_BUCKET` al iniciar.

Antes de ejecutar los scripts asegúrese de:

- Definir la variable de entorno `GOOGLE_APPLICATION_CREDENTIALS` apuntando al archivo de claves del servicio.
- Definir la variable `FIREBASE_STORAGE_BUCKET` con el nombre del bucket de Storage del proyecto.

Puede cargar estas variables desde un archivo `.env` en la raíz del proyecto. Este archivo es local y debe mantenerse fuera del control de versiones.

Este servidor requiere privilegios de administrador de Firebase, por lo que es necesario definir las credenciales antes de iniciarlo. Luego inicie el servicio con:

```bash
npm start
```

El formulario de nuevo sorteo obtiene la URL de este servicio desde la
variable `UPLOAD_ENDPOINT` exportada en `config.js`. En navegadores que se
ejecutan bajo HTTPS la URL por defecto se deriva automáticamente del origen
actual (`${window.location.origin}/upload`) para evitar contenido mixto. En
otros escenarios el valor por defecto continúa siendo `http://localhost:3000/upload`.

Para despliegues productivos exponga el servicio auxiliar bajo HTTPS y
defina explícitamente la URL del endpoint, ya sea mediante la variable de
entorno `UPLOAD_ENDPOINT` (por ejemplo `UPLOAD_ENDPOINT=https://api.midominio.com/upload`)
o estableciendo `window.UPLOAD_ENDPOINT` antes de cargar los scripts del
frontend. Esto permite separar el hosting estático del backend de subida y
garantiza que las páginas servidas por HTTPS no disparen advertencias por
contenido inseguro.

### Matriz de configuración esperada por ambiente (`UPLOAD_ENDPOINT` y `ALLOWED_ORIGINS`)

| Ambiente | `UPLOAD_ENDPOINT` esperado | `ALLOWED_ORIGINS` esperado |
| --- | --- | --- |
| `dev` (local) | `http://localhost:3000/upload` (o endpoint HTTPS de desarrollo) | `http://localhost:3000,http://127.0.0.1:3000` (u orígenes de dev) |
| `stg` | **Obligatorio HTTPS no-local**, por ejemplo `https://api-stg.midominio.com/upload` | **Obligatorio no-local**, por ejemplo `https://bingo-online-stg.web.app,https://bingo-online-stg.firebaseapp.com` |
| `prod` / `main` | **Obligatorio HTTPS no-local**, por ejemplo `https://api.midominio.com/upload` | **Obligatorio no-local**, por ejemplo `https://bingo-online-231fd.web.app` |

`uploadServer.js` valida en arranque que, para entornos no-locales (`NODE_ENV`/`APP_ENV` en `production|prod|staging|stg|main`), no se mantenga el valor por defecto de localhost en `UPLOAD_ENDPOINT`. También emite advertencia si `ALLOWED_ORIGINS` sigue con localhost.

### Valores mínimos obligatorios para despliegues en `stg` y `main`

Para evitar bloqueos por CORS o errores de contenido mixto, en `stg` y `main` deben definirse al menos:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `FIREBASE_STORAGE_BUCKET`
- `UPLOAD_ENDPOINT` (HTTPS, no localhost)
- `ALLOWED_ORIGINS` (dominios reales del frontend por ambiente, sin localhost)

Para utilizar el botón de habilitar/deshabilitar usuarios en `gestionarusuarios.html` este servicio debe estar activo y accesible desde la URL indicada. El cliente envía un *ID token* de Firebase y el middleware `verificarToken` comprueba la colección `users/{email}` en Firestore: solo los roles **Superadmin** y **Administrador** pueden invocar `/toggleUser`.

Para otorgar estos permisos use un proceso administrativo con Firebase Admin SDK (por ejemplo `npm run assign-role -- --email usuario@dominio.com --role Administrador`). Este flujo asigna el rol en *custom claims* y sincroniza el perfil en `users/{email}` desde backend, evitando depender de colecciones editables por cliente.


### Asignación de roles y custom claims (backend/admin)

Se incluye el script `scripts/assignRoleClaims.js` para administrar privilegios de forma segura desde backend:

```bash
npm run assign-role -- --email usuario@dominio.com --role Superadmin
```

Opcionalmente puede forzar el claim `admin`:

```bash
npm run assign-role -- --email usuario@dominio.com --role Administrador --admin true
```

Este proceso requiere credenciales de servicio (`GOOGLE_APPLICATION_CREDENTIALS` o `serviceAccountKey.json`) y nunca debe ejecutarse desde el navegador.

## Actualización automática de estados de sorteos

Para que los sorteos cambien de "Activo" a "Sellado" y luego a "Jugando" sin depender de una página abierta en el navegador, se incluye el script `cronActualizarEstadosSorteos.js`. Este proceso utiliza Firebase Admin para consultar y actualizar los documentos en Firestore.

Ejecute localmente con:

```bash
npm run cron
```

Puede programarse con `cron` del sistema o desplegarse como una Cloud Function con un disparador temporal.

## Despliegue estático

El archivo `index.html` contiene toda la lógica de la aplicación. Sólo es necesario servirlo desde cualquier servidor web estático. El inicio de sesión se realiza con cuentas de Google y se redirige automáticamente al menú correspondiente según el rol almacenado en Firestore.

### Configuración de `firebase-config`

El repositorio incluye el script `scripts/generateFirebaseConfig.js` para generar `public/firebase-config.js` por entorno sin versionar credenciales. Comando base:

```bash
npm run generate:firebase-config -- --env dev
```

Entornos soportados:

- `dev` → Proyecto Firebase `bingo-online-dev` (número `671201853237`), Hosting target `bingo-online-dev` y base de datos **default** (no `dev-db`)
- `stg` → Proyecto Firebase `bingo-online-stg` (número `651184549228`), Hosting target `bingo-online-stg` y base de datos **default** (no `stg-db`)
- `main` → Producción (Hosting target `bingo-online-231fd` y base de datos default)
  - Compatibilidad: también acepta `prod` y `production`, normalizados internamente como producción.

Variables requeridas por entorno (con fallback a versión global sin prefijo):

- `FIREBASE_<ENV>_API_KEY`
- `FIREBASE_<ENV>_AUTH_DOMAIN`
- `FIREBASE_<ENV>_DATABASE_URL`
- `FIREBASE_<ENV>_PROJECT_ID`
- `FIREBASE_<ENV>_STORAGE_BUCKET`
- `FIREBASE_<ENV>_MESSAGING_SENDER_ID`
- `FIREBASE_<ENV>_APP_ID`

> Ejemplo para staging (`<ENV>=STG`): `FIREBASE_STG_DATABASE_URL=https://bingo-online-stg-default-rtdb.firebaseio.com` (base de datos **default**).

> Para producción en `main` el script utiliza prefijo `FIREBASE_PROD_*` (compatibilidad actual).

> **Nota sobre Storage**: Si en la consola de Firebase el bucket aparece con el dominio `*.firebasestorage.app`, utilice ese valor sin modificarlo. La interfaz convierte automáticamente ese formato al identificador clásico (`*.appspot.com`) al inicializar el SDK para garantizar la compatibilidad con `firebase-storage-compat` y permitir la subida de los PDFs generados.

### Dominio y cookies

A partir de las últimas versiones de los navegadores se bloquean las cookies de terceros por defecto. Si la aplicación se aloja en un dominio distinto al configurado en `authDomain`, Firebase no puede completar el inicio de sesión y la página queda cargando indefinidamente.

Para evitarlo, cada entorno debe usar su propio dominio Firebase Hosting como `authDomain`:

- Desarrollo: `bingo-online-dev.web.app` y `bingo-online-dev.firebaseapp.com`
- Pruebas: `bingo-online-stg.web.app` y `bingo-online-stg.firebaseapp.com`
- Producción: `bingo-online-231fd.web.app`

Además, en Firebase Authentication > Settings > Authorized domains agregue todos los dominios de cada ambiente (`*.web.app` y `*.firebaseapp.com`) para permitir login en cada entorno de manera aislada.

### Despliegues automáticos (GitHub Actions)

El flujo `.github/workflows/deploy-by-branch.yml` genera `public/firebase-config.js`, valida explícitamente el mapeo de rama y despliega con `firebase-tools` usando siempre `--only hosting:<target>`.

Tabla de mapeo exacta usada por el workflow:

| Rama Git | Entorno lógico | Hosting target | Proyecto Firebase |
| --- | --- | --- | --- |
| `dev` | `dev` | `dev` | `bingo-online-dev` |
| `staging` | `stg` | `stg` | `bingo-online-stg` |
| `main` | `prod` | `prod` | `bingo-online-231fd` |

Si llega una rama distinta de `dev`, `staging` o `main`, el job de validación falla con error. También falla si el target de Hosting queda vacío.

### Checklist predeploy (configuración)

- [ ] Ejecutar `npm run generate:firebase-config -- --env <dev|stg|main>` para generar `public/firebase-config.js` del entorno objetivo.
- [ ] Verificar que los campos de Firebase config no estén vacíos (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

Configure los siguientes secretos por entorno en GitHub:

- Dev: `FIREBASE_DEV_API_KEY`, `FIREBASE_DEV_AUTH_DOMAIN`, `FIREBASE_DEV_DATABASE_URL`, `FIREBASE_DEV_PROJECT_ID`, `FIREBASE_DEV_STORAGE_BUCKET`, `FIREBASE_DEV_MESSAGING_SENDER_ID`, `FIREBASE_DEV_APP_ID`
- Staging: `FIREBASE_STG_API_KEY`, `FIREBASE_STG_AUTH_DOMAIN`, `FIREBASE_STG_DATABASE_URL`, `FIREBASE_STG_PROJECT_ID`, `FIREBASE_STG_STORAGE_BUCKET`, `FIREBASE_STG_MESSAGING_SENDER_ID`, `FIREBASE_STG_APP_ID`
- Producción: `FIREBASE_PROD_API_KEY`, `FIREBASE_PROD_AUTH_DOMAIN`, `FIREBASE_PROD_DATABASE_URL`, `FIREBASE_PROD_PROJECT_ID`, `FIREBASE_PROD_STORAGE_BUCKET`, `FIREBASE_PROD_MESSAGING_SENDER_ID`, `FIREBASE_PROD_APP_ID`

Además se mantiene el secreto de cuenta de servicio `FIREBASE_SERVICE_ACCOUNT_BINGO_ONLINE_231FD` para publicar en Hosting.

## Mutaciones de Firestore por Pull Request (Bingoanimalito)

Para replicar el flujo de cambios auditables vía PR en una base de Firebase, este repositorio incluye:

- Workflow: `.github/workflows/bingoanimalito-firebase-pr-sync.yml`
- Script: `scripts/applyFirestoreMutations.js`
- Carpeta de cambios: `firebase/bingoanimalito/`

### Cómo usarlo

1. Cree un archivo JSON dentro de `firebase/bingoanimalito/` con las mutaciones (`set`, `update`, `delete`).
2. Abra un PR hacia `main`.
3. Al hacer merge, el workflow detecta los archivos JSON modificados y ejecuta las mutaciones con Firebase Admin SDK.

También puede ejecutarse manualmente con `workflow_dispatch` pasando `files` (coma-separado) o localmente:

```bash
npm run apply-firebase-mutations -- --files firebase/bingoanimalito/mi-cambio.json
```

> Requisito: configurar el secreto `FIREBASE_SERVICE_ACCOUNT_BINGOANIMALITO` en GitHub con la cuenta de servicio JSON.

## Directrices de desarrollo

- Toda obtención o cálculo de fechas y horas debe realizarse empleando el huso horario definido para el despliegue del sistema.
- Evite depender de la fecha u hora del dispositivo cliente; utilice siempre fuentes sincronizadas con el huso horario seleccionado para garantizar coherencia entre servicios.
- Mantenga todas las credenciales y endpoints sensibles en variables de entorno (`GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_STORAGE_BUCKET`, `UPLOAD_ENDPOINT`, `PORT`). Nunca incluya archivos de claves en el repositorio; documente en despliegue dónde obtenerlos.
- Proteja cada nuevo endpoint o script de backend reutilizando el middleware `verificarToken` de `uploadServer.js` (o uno equivalente) para validar el ID token de Firebase antes de ejecutar acciones administrativas.
- Calcule fechas y horas apoyándose en `public/js/timezone.js` (métodos `serverTime.now()`, `serverTime.nowMs()` y `serverTime.serverTimestamp()`) y evite usar directamente `Date.now()` sin normalizar al huso horario configurado, tanto en el cliente como en los procesos automáticos.
- Cuando cree o actualice sorteos, guarde los campos `fecha`, `hora` y `horacierre` en formato `DD/MM/YYYY` y `HH:mm` (24 horas) para asegurar que `cronActualizarEstadosSorteos.js` pueda interpretar los datos sin errores.
- Documente cualquier ajuste en la colección `Variablesglobales/Parametros` (especialmente `ZonaHoraria`, `Pais` y `Aplicacion`) y coordínelo con los responsables del cron para mantener sincronizados el frontend y las tareas programadas.

## Seguridad de `Variablesglobales/Parametros`

- El documento `Variablesglobales/Parametros` contiene configuración sensible y se trata como **confidencial**.
- En `firestore.rules`, su lectura y escritura requieren privilegio fuerte de **Superadmin** (`isStrongSuperadmin()`).
- La página `public/parametros.html` está diseñada para este mismo nivel de privilegio; usuarios autenticados sin rol fuerte de Superadmin deben recibir denegación de acceso al intentar leer ese documento.


## Inventario y adaptación de `Variablesglobales/Parametros`

### Puntos de lectura/escritura identificados

Se identificaron y clasificaron los accesos al documento `Variablesglobales/Parametros` con:

```bash
rg -n "Variablesglobales|Parametros|ZonaHoraria|Pais|Aplicacion"
```

Resumen operativo por capa:

- **Frontend (lectura/escritura)**: páginas administrativas y operativas bajo `public/*.html` (por ejemplo `public/parametros.html`, `public/configuraciones.html`, `public/billetera.html`, `public/nuevosorteo.html`, `public/editarsorte.html`, `public/cantarsorteos.html`, `public/juegoactivo.html`, etc.).
- **Frontend base (lectura global normalizada)**:
  - `public/js/auth.js` (campo `Aplicacion` para nombre de app).
  - `public/js/timezone.js` (campos `ZonaHoraria` y `Pais` para reloj y zona del despliegue).
- **Scripts/backend (lectura)**:
  - `cronActualizarEstadosSorteos.js` (campos `ZonaHoraria` y `Pais` para cálculo horario de transiciones de sorteos).

> Nota: la detección completa de referencias queda trazable y repetible con el comando `rg` anterior.

### Adaptador único de configuración global

Se incorporó `public/js/globalConfigAdapter.js` como fuente única para:

- Normalizar lectura de `Pais`, `ZonaHoraria` y `Aplicacion`.
- Validar esquema mínimo (campos requeridos no vacíos).
- Retornar un resultado uniforme `fromSnapshot(...)` con:
  - `normalized`
  - `validation`
  - `source`

Uso actual integrado en:

- `public/js/auth.js`
- `public/js/timezone.js`
- `cronActualizarEstadosSorteos.js`

### Política de fallback segura

Se define la siguiente política:

- **Solo lectura**: si el documento no existe o el esquema es inválido, se aplican valores por defecto para continuidad operativa:
  - `Pais: Venezuela`
  - `ZonaHoraria: UTC-04:00`
  - `Aplicacion: BingOnline`
- **Nunca escritura automática**: el adaptador **no** escribe en Firestore, ni corrige ni persiste defaults de forma implícita.
- **Administración explícita**: cualquier cambio persistente del documento debe realizarse por usuarios autorizados desde los flujos administrativos existentes.

### Inicialización por ambiente y responsables

- Este documento (`Variablesglobales/Parametros`) se inicializa y mantiene mediante usuarios con privilegio fuerte de **Superadmin** (según `firestore.rules`).
- Para cada ambiente (`dev`, `stg`, `main`) la carga y actualización de valores debe ejecutarse con credenciales administrativas del ambiente correspondiente y dentro de los flujos operativos del proyecto.
- Se recomienda mantener un responsable explícito por ambiente (equipo de plataforma/operaciones) y registrar en PR cualquier cambio de `ZonaHoraria`, `Pais` o `Aplicacion` para sincronización con cron y frontend.
