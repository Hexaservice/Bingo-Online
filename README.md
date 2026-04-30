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

Este script creará las entradas en la colección `users` y actualizará los roles en caso de que ya existan.

## Subida de imágenes

Para almacenar las imágenes de los sorteos se utiliza **Firebase Cloud Storage**. El servicio auxiliar (`uploadServer.js`) guarda los archivos en el bucket configurado y devuelve la URL pública. Además expone el endpoint `/toggleUser` utilizado en la página de gestión de usuarios para habilitar o deshabilitar cuentas.

### Notificaciones por correo

Las notificaciones por correo electrónico se eliminaron del proyecto y ya no es necesario configurar SendGrid ni credenciales asociadas para operar la aplicación.

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

Para utilizar el botón de habilitar/deshabilitar usuarios en `gestionarusuarios.html` este servicio debe estar activo y accesible desde la URL indicada. El cliente envía un *ID token* de Firebase y el middleware `verificarToken` comprueba la colección `users/{email}` en Firestore: solo los roles **Superadmin** y **Administrador** pueden invocar `/toggleUser`.

Para otorgar estos permisos puede asignarse el rol directamente desde la consola de Firebase editando el documento correspondiente en `users/{email}` (campo `role`) o incluyendo el correo en la colección `roles` (por ejemplo en `roles/Administrador.emails`). Los scripts `initUsers.js` e `initRoles.js` ofrecen ejemplos de cómo poblar estos datos de manera inicial.

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

El repositorio incluye la plantilla `public/firebase-config.template.js` y el generador `npm run generate:firebase-config` para crear `public/firebase-config.js` sin hardcodear credenciales en el código.

#### Entorno `dev` (Firebase project separado)

1. Cree un archivo local `.env.dev` (no versionado) con sus valores de Firebase:

```dotenv
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
# Opcionales
FIREBASE_DATABASE_URL=
FIREBASE_MEASUREMENT_ID=
```

2. Genere el archivo de configuración usado por el frontend:

```bash
FIREBASE_ENV_FILE=.env.dev npm run generate:firebase-config
```

3. Verifique que se creó `public/firebase-config.js` y luego levante la app.


Variables recomendadas para scripts/backend (aplican a `uploadServer.js`, `initUsers.js`, `initBanks.js`, `initRoles.js` y `cronActualizarEstadosSorteos.js`):

```dotenv
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.dev.json
FIREBASE_DATABASE_URL=https://<tu-proyecto-dev>-default-rtdb.firebaseio.com
# Guardas de seguridad para desarrollo
FIREBASE_DEV_PROJECT_ID=bingo-online-dev
FIREBASE_DEV_DATABASE_URL=https://<tu-proyecto-dev>-default-rtdb.firebaseio.com
# Solo uploadServer.js
FIREBASE_STORAGE_BUCKET=<tu-bucket-dev>
```


> `public/firebase-config.js` está excluido del control de versiones por `.gitignore`, por lo que cada entorno (dev/staging/prod) puede generar su propio archivo sin mezclar configuraciones.

> **Nota sobre Storage**: Si en la consola de Firebase el bucket aparece con el dominio `*.firebasestorage.app`, utilice ese valor sin modificarlo. La interfaz convierte automáticamente ese formato al identificador clásico (`*.appspot.com`) al inicializar el SDK para garantizar la compatibilidad con `firebase-storage-compat` y permitir la subida de los PDFs generados.


#### Entorno `stg` (staging)

Cree un archivo local `.env.stg` con los valores de staging y genere la configuración:

```dotenv
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_DATABASE_URL=https://<tu-proyecto-stg>-default-rtdb.firebaseio.com
FIREBASE_MEASUREMENT_ID=

# Backend/scripts en staging
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.stg.json
```

```bash
FIREBASE_ENV_FILE=.env.stg npm run generate:firebase-config
```

> Importante: para scripts/local dev nunca reutilice credenciales ni `FIREBASE_DATABASE_URL` de producción.

#### Guardas de arranque para desarrollo

Cuando `NODE_ENV=development`, los scripts backend validan que `projectId` y `FIREBASE_DATABASE_URL` coincidan con los valores dev esperados (`FIREBASE_DEV_PROJECT_ID` y `FIREBASE_DEV_DATABASE_URL`). Si no coinciden, el proceso termina con error explícito para evitar operar accidentalmente contra prod.

### Dominio y cookies

A partir de las últimas versiones de los navegadores se bloquean las cookies de terceros por defecto. Si la aplicación se aloja en un dominio distinto al configurado en `authDomain` (por ejemplo GitHub Pages), Firebase no puede completar el inicio de sesión y la página queda cargando indefinidamente.

Para evitarlo, despliegue el sitio en Firebase Hosting utilizando el dominio del proyecto (`bingo-online-231fd.web.app` o un dominio personalizado asociado). Así las cookies son del mismo sitio y la autenticación funciona de forma correcta.

### Diagnóstico rápido: error al iniciar sesión con Google en `dev`

Si aparece el mensaje "Error al iniciar sesión con Google" en el dominio `https://bingo-online-dev.web.app/`, valide este checklist en orden:

0. **Hosting `dev` sin redirecciones externas**  
   En `firebase.json` el target `dev` debe resolver a `"/index.html"` (SPA) y no redirigir (`301`) a otros dominios como `www.juega-online.com`, porque eso rompe el flujo OAuth del proyecto `dev`.

1. **Dominio autorizado en Firebase Auth**  
   En Firebase Console > Authentication > Settings > Authorized domains, confirme que existe exactamente `bingo-online-dev.web.app`.

2. **Proveedor Google habilitado**  
   En Authentication > Sign-in method, confirme que el proveedor **Google** está en estado **Enabled** dentro del mismo proyecto `dev`.

3. **Config frontend coherente con `dev`**  
   Genere nuevamente `public/firebase-config.js` usando el `.env` del entorno dev:
   ```bash
   FIREBASE_ENV_FILE=.env.dev npm run generate:firebase-config
   ```
   Verifique que `authDomain` y `projectId` apunten al proyecto dev (no staging/prod).

4. **Deploy con archivo actualizado**  
   Verifique que el deploy de Hosting incluya el `public/firebase-config.js` recién generado y que no haya caché vieja del navegador (probar en incógnito).

5. **Cookies / almacenamiento del navegador**  
   Revise que el navegador no esté bloqueando almacenamiento para `*.web.app`, y que extensiones de privacidad no bloqueen `accounts.google.com`.

6. **Revisar código de error exacto**  
   Abra DevTools (Console) y capture el `error.code` devuelto por Firebase (`auth/unauthorized-domain`, `auth/operation-not-allowed`, etc.) para decidir la corrección puntual.

### Despliegues automáticos (GitHub Actions)

Los flujos definidos en `.github/workflows/` generan `public/firebase-config.js` a partir de la plantilla antes de invocar a Firebase Hosting.

#### Mapeo exacto rama → proyecto Firebase Hosting

- `dev` → proyecto `bingo-online-dev` (target hosting: `dev`)
- `staging` → proyecto `bingo-online-231fd` (target hosting: `stg`)
- `main` → proyecto `bingo-online-231fd` (target hosting: `prod`)

> Nota: aunque el target de Hosting se llame `stg`, la rama configurada en GitHub Actions actualmente es `staging`.

#### Aislamiento recomendado por entorno (evita afectar `main`)

Para que la rama `dev` despliegue únicamente al proyecto **bingo-online-dev** (ID `bingo-online-dev`, número `671201853237`) y no mezcle credenciales con `staging`/`main`, use secretos separados:

- `FIREBASE_SERVICE_ACCOUNT_BINGO_ONLINE_DEV`
- `FIREBASE_DEV_WEB_API_KEY`
- `FIREBASE_DEV_AUTH_DOMAIN` (`bingo-online-dev.firebaseapp.com`)
- `FIREBASE_DEV_DATABASE_URL` (Realtime Database `default`, si aplica)
- `FIREBASE_DEV_PROJECT_ID` (`bingo-online-dev`)
- `FIREBASE_DEV_STORAGE_BUCKET`
- `FIREBASE_DEV_MESSAGING_SENDER_ID` (`671201853237`)
- `FIREBASE_DEV_APP_ID`
- `FIREBASE_DEV_MEASUREMENT_ID` (opcional)

Para `staging` y `main` mantenga secretos independientes de sus respectivos proyectos (por ejemplo los actuales `FIREBASE_*` de producción), sin reutilizar los del entorno `dev`.

#### Paso a paso (nivel inicial) para configurar secretos en GitHub

1. Entre al repositorio en GitHub y abra **Settings**.
2. En el menú lateral, entre a **Secrets and variables > Actions**.
3. Presione **New repository secret**.
4. Cree cada secreto de la lista anterior, uno por uno, copiando exactamente el nombre.
5. Pegue el valor correspondiente del proyecto Firebase `bingo-online-dev` y guarde.
6. Repita hasta completar todos los secretos de `dev`.
7. Verifique que **no** reemplazó secretos usados por `main` (si tiene duda, compare nombres: los de `dev` empiezan con `FIREBASE_DEV_` o `FIREBASE_SERVICE_ACCOUNT_BINGO_ONLINE_DEV`).
8. Haga un push a la rama `dev` y revise el workflow **Deploy by branch to Firebase Hosting** en la pestaña **Actions**.
9. Confirme en los logs que el paso de deploy use `projectId: bingo-online-dev` y `target: dev`.
10. Abra `https://bingo-online-dev.web.app` y valide login con Google en ese dominio.

#### Cómo obtener la cuenta de servicio para el secreto `FIREBASE_SERVICE_ACCOUNT_BINGO_ONLINE_DEV`

1. Abra Firebase Console en el proyecto `bingo-online-dev`.
2. Entre a **Project settings > Service accounts**.
3. Presione **Generate new private key** y descargue el JSON.
4. Abra el archivo JSON con un editor de texto.
5. Copie **todo el contenido** (desde `{` hasta `}`) y péguelo como valor del secreto `FIREBASE_SERVICE_ACCOUNT_BINGO_ONLINE_DEV`.
6. Elimine el archivo JSON de su computador si no lo necesita (buena práctica de seguridad).

> Recomendación: use también **GitHub Environments** (`dev`, `staging`, `prod`) con aprobaciones y secretos por entorno para reducir aún más el riesgo de despliegues cruzados.

## Directrices de desarrollo

- Toda obtención o cálculo de fechas y horas debe realizarse empleando el huso horario definido para el despliegue del sistema.
- Evite depender de la fecha u hora del dispositivo cliente; utilice siempre fuentes sincronizadas con el huso horario seleccionado para garantizar coherencia entre servicios.
- Mantenga todas las credenciales y endpoints sensibles en variables de entorno (`GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_STORAGE_BUCKET`, `UPLOAD_ENDPOINT`, `PORT`). Nunca incluya archivos de claves en el repositorio; documente en despliegue dónde obtenerlos.
- Proteja cada nuevo endpoint o script de backend reutilizando el middleware `verificarToken` de `uploadServer.js` (o uno equivalente) para validar el ID token de Firebase antes de ejecutar acciones administrativas.
- Calcule fechas y horas apoyándose en `public/js/timezone.js` (métodos `serverTime.now()`, `serverTime.nowMs()` y `serverTime.serverTimestamp()`) y evite usar directamente `Date.now()` sin normalizar al huso horario configurado, tanto en el cliente como en los procesos automáticos.
- Cuando cree o actualice sorteos, guarde los campos `fecha`, `hora` y `horacierre` en formato `DD/MM/YYYY` y `HH:mm` (24 horas) para asegurar que `cronActualizarEstadosSorteos.js` pueda interpretar los datos sin errores.
- Documente cualquier ajuste en la colección `Variablesglobales/Parametros` (especialmente `ZonaHoraria`, `Pais` y `Aplicacion`) y coordínelo con los responsables del cron para mantener sincronizados el frontend y las tareas programadas.






#### Validación temprana de entorno en frontend (`auth.js`)

Las vistas sensibles (`accederusuario.html`, `admin.html`, `super.html`) ejecutan `validateFirebaseConfigForEnv()` antes de iniciar autenticación.

- Si el host corresponde a `dev` (por ejemplo `bingo-online-dev.web.app` o `localhost`) y `projectId`/`authDomain` no son de `bingo-online-dev`, se detiene la inicialización y se muestra un mensaje accionable.
- Mensaje esperado:

```text
Configuración Firebase inválida para entorno DEV.
Detectado host: <host>.
projectId actual: <valor>. Esperado: bingo-online-dev.
authDomain actual: <valor>. Esperado: bingo-online-dev.firebaseapp.com o bingo-online-dev.web.app.
Acción: regenera public/firebase-config.js con FIREBASE_ENV_FILE=.env.dev npm run generate:firebase-config y redepliega.
```

- Si la validación falla, no se ejecuta `ensureAuth(...)` ni `firebase.initializeApp(...)` para evitar autenticación cruzada entre entornos.

Para regenerar la configuración del frontend en dev:

```bash
FIREBASE_ENV_FILE=.env.dev npm run generate:firebase-config
```
