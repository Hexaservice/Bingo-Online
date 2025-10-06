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

Antes de ejecutarlo asegúrese de:

- Definir la variable de entorno `GOOGLE_APPLICATION_CREDENTIALS` apuntando al archivo de claves del servicio.
- Definir la variable `FIREBASE_STORAGE_BUCKET` con el nombre del bucket de Storage del proyecto.

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

El repositorio incluye la plantilla `public/firebase-config.template.js`. Antes de ejecutar el sitio debe copiarse a `public/firebase-config.js` y reemplazar los marcadores `__FIREBASE_*__` por los valores reales de Firebase:

```bash
cp public/firebase-config.template.js public/firebase-config.js
```

Luego edite el archivo resultante y actualice cada propiedad (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, `firestoreDatabaseId`). Este archivo contiene credenciales sensibles y está excluido del control de versiones mediante `.gitignore`.

### Dominio y cookies

A partir de las últimas versiones de los navegadores se bloquean las cookies de terceros por defecto. Si la aplicación se aloja en un dominio distinto al configurado en `authDomain` (por ejemplo GitHub Pages), Firebase no puede completar el inicio de sesión y la página queda cargando indefinidamente.

Para evitarlo, despliegue el sitio en Firebase Hosting utilizando el dominio del proyecto (`bingo-online-231fd.web.app` o un dominio personalizado asociado). Así las cookies son del mismo sitio y la autenticación funciona de forma correcta.

### Despliegues automáticos (GitHub Actions)

Los flujos definidos en `.github/workflows/` generan `public/firebase-config.js` a partir de la plantilla antes de invocar a Firebase Hosting. Configure los siguientes secretos en el repositorio para que la sustitución se realice correctamente:

- `FIREBASE_WEB_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

Además, cada entorno despliega contra una instancia distinta de Cloud Firestore mediante el campo `firestoreDatabaseId`. Defina secretos individuales por entorno con los valores adecuados del ID de base de datos:

- `FIREBASE_FIRESTORE_DB_DEV`
- `FIREBASE_FIRESTORE_DB_STG`
- `FIREBASE_FIRESTORE_DB_PROD`

En los workflows se inserta automáticamente el secreto correspondiente en `public/firebase-config.js` según la rama (`dev`, `staging` o `main`). Si utiliza otras herramientas de despliegue, replique el mismo proceso de copiado y reemplazo de marcadores antes de publicar los archivos.

### Promover cambios de `dev` a `staging`

1. **Confirmar que el despliegue en `dev` fue exitoso.** Cada vez que se hace `push` a la rama `dev`, el workflow `deploy-by-branch.yml` publica automáticamente el sitio en el objetivo `dev` de Firebase Hosting y utiliza el secreto `FIREBASE_FIRESTORE_DB_DEV` para generar la configuración del entorno.【F:.github/workflows/deploy-by-branch.yml†L1-L41】【F:README.md†L94-L103】 Verifique en GitHub Actions que la ejecución finalizó sin errores.
2. **Actualizar la rama `staging` con los cambios de `dev`.** Cree un Pull Request desde `dev` hacia `staging`, revise los cambios y apruebe la integración. También puede hacer `git checkout staging`, `git merge dev` y `git push origin staging` si prefiere una promoción directa desde la línea de comandos.
3. **Esperar el despliegue automático en `staging`.** Al recibir un `push` en `staging`, el mismo workflow vuelve a generar `public/firebase-config.js`, esta vez usando el secreto `FIREBASE_FIRESTORE_DB_STG`, y despliega contra el objetivo `stg` de Firebase Hosting.【F:.github/workflows/deploy-by-branch.yml†L43-L83】 Cuando la acción termine, el entorno `staging` tendrá los mismos cambios que fueron validados en `dev`.
4. **Sincronizar servicios auxiliares si aplica.** Si necesita ejecutar scripts o servicios Node que interactúan con Firestore (`initBanks.js`, `initRoles.js`, `initUsers.js`, `cronActualizarEstadosSorteos.js`, `uploadServer.js`), recuerde establecer la variable de entorno `FIRESTORE_DATABASE_ID` con el identificador correspondiente a `stg` antes de correrlos para que apunten a la misma base que el frontend.【F:README.md†L107-L118】

### Selección de base de datos de Firestore por entorno

El proyecto utiliza el campo `firestoreDatabaseId` definido en `public/firebase-config.js` para elegir la instancia de Cloud Firestore que debe consumir cada despliegue. Para los entornos que usan la base `(default)` puede dejar el valor tal cual o una cadena vacía; para bases alternativas indique el ID configurado en Firebase (`devdb`, `stgdb`, etc.).

Los scripts de Node que interactúan con Firestore (`initBanks.js`, `initRoles.js`, `initUsers.js`, `cronActualizarEstadosSorteos.js` y `uploadServer.js`) leen la variable de entorno `FIRESTORE_DATABASE_ID`. Ajuste su valor antes de ejecutar cada tarea o pipeline para que la escritura se realice en la base correspondiente al entorno (`dev`, `stg`, `prod`).

## Directrices de desarrollo

- Toda obtención o cálculo de fechas y horas debe realizarse empleando el huso horario definido para el despliegue del sistema.
- Evite depender de la fecha u hora del dispositivo cliente; utilice siempre fuentes sincronizadas con el huso horario seleccionado para garantizar coherencia entre servicios.
- Mantenga todas las credenciales y endpoints sensibles en variables de entorno (`GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_STORAGE_BUCKET`, `UPLOAD_ENDPOINT`, `PORT`). Nunca incluya archivos de claves en el repositorio; documente en despliegue dónde obtenerlos.
- Proteja cada nuevo endpoint o script de backend reutilizando el middleware `verificarToken` de `uploadServer.js` (o uno equivalente) para validar el ID token de Firebase antes de ejecutar acciones administrativas.
- Calcule fechas y horas apoyándose en `public/js/timezone.js` y en el desfase `serverTime.diferencia`; evite usar directamente `Date.now()` sin normalizar al huso horario configurado, tanto en el cliente como en los procesos automáticos.
- Cuando cree o actualice sorteos, guarde los campos `fecha`, `hora` y `horacierre` en formato `DD/MM/YYYY` y `HH:mm` (24 horas) para asegurar que `cronActualizarEstadosSorteos.js` pueda interpretar los datos sin errores.
- Documente cualquier ajuste en la colección `Variablesglobales/Parametros` (especialmente `ZonaHoraria`, `Pais` y `Aplicacion`) y coordínelo con los responsables del cron para mantener sincronizados el frontend y las tareas programadas.



