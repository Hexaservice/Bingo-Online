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

> `public/firebase-config.js` está excluido del control de versiones por `.gitignore`, por lo que cada entorno (dev/staging/prod) puede generar su propio archivo sin mezclar configuraciones.

> **Nota sobre Storage**: Si en la consola de Firebase el bucket aparece con el dominio `*.firebasestorage.app`, utilice ese valor sin modificarlo. La interfaz convierte automáticamente ese formato al identificador clásico (`*.appspot.com`) al inicializar el SDK para garantizar la compatibilidad con `firebase-storage-compat` y permitir la subida de los PDFs generados.

### Dominio y cookies

A partir de las últimas versiones de los navegadores se bloquean las cookies de terceros por defecto. Si la aplicación se aloja en un dominio distinto al configurado en `authDomain` (por ejemplo GitHub Pages), Firebase no puede completar el inicio de sesión y la página queda cargando indefinidamente.

Para evitarlo, despliegue el sitio en Firebase Hosting utilizando el dominio del proyecto (`bingo-online-231fd.web.app` o un dominio personalizado asociado). Así las cookies son del mismo sitio y la autenticación funciona de forma correcta.

### Diagnóstico rápido: error al iniciar sesión con Google en `dev`

Si aparece el mensaje "Error al iniciar sesión con Google" en el dominio `https://bingo-online-dev.web.app/`, valide este checklist en orden:

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

Los flujos definidos en `.github/workflows/` generan `public/firebase-config.js` a partir de la plantilla antes de invocar a Firebase Hosting. Configure los siguientes secretos en el repositorio para que la sustitución se realice correctamente:

- `FIREBASE_WEB_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID` (opcional)

Cada secreto debe contener el valor correspondiente del proyecto de Firebase. Si utiliza otras herramientas de despliegue, replique el mismo proceso de copiado y reemplazo de marcadores antes de publicar los archivos.

## Directrices de desarrollo

- Toda obtención o cálculo de fechas y horas debe realizarse empleando el huso horario definido para el despliegue del sistema.
- Evite depender de la fecha u hora del dispositivo cliente; utilice siempre fuentes sincronizadas con el huso horario seleccionado para garantizar coherencia entre servicios.
- Mantenga todas las credenciales y endpoints sensibles en variables de entorno (`GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_STORAGE_BUCKET`, `UPLOAD_ENDPOINT`, `PORT`). Nunca incluya archivos de claves en el repositorio; documente en despliegue dónde obtenerlos.
- Proteja cada nuevo endpoint o script de backend reutilizando el middleware `verificarToken` de `uploadServer.js` (o uno equivalente) para validar el ID token de Firebase antes de ejecutar acciones administrativas.
- Calcule fechas y horas apoyándose en `public/js/timezone.js` (métodos `serverTime.now()`, `serverTime.nowMs()` y `serverTime.serverTimestamp()`) y evite usar directamente `Date.now()` sin normalizar al huso horario configurado, tanto en el cliente como en los procesos automáticos.
- Cuando cree o actualice sorteos, guarde los campos `fecha`, `hora` y `horacierre` en formato `DD/MM/YYYY` y `HH:mm` (24 horas) para asegurar que `cronActualizarEstadosSorteos.js` pueda interpretar los datos sin errores.
- Documente cualquier ajuste en la colección `Variablesglobales/Parametros` (especialmente `ZonaHoraria`, `Pais` y `Aplicacion`) y coordínelo con los responsables del cron para mantener sincronizados el frontend y las tareas programadas.





