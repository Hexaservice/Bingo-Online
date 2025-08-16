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
variable `UPLOAD_ENDPOINT` exportada en `config.js`. Por defecto apunta a
`http://localhost:3000/upload`. Para entornos distintos a localhost puede
definirse la variable de entorno `UPLOAD_ENDPOINT` o asignarse
`window.UPLOAD_ENDPOINT` antes de cargar los scripts.

Para utilizar el botón de habilitar/deshabilitar usuarios en `gestionarusuarios.html` este servicio debe estar activo y accesible desde la URL indicada. El cliente envía un *ID token* de Firebase, por lo que se debe iniciar sesión con un usuario con rol **Superadmin** para realizar estos cambios.

## Despliegue estático

El archivo `index.html` contiene toda la lógica de la aplicación. Sólo es necesario servirlo desde cualquier servidor web estático. El inicio de sesión se realiza con cuentas de Google y se redirige automáticamente al menú correspondiente según el rol almacenado en Firestore.

### Dominio y cookies

A partir de las últimas versiones de los navegadores se bloquean las cookies de terceros por defecto. Si la aplicación se aloja en un dominio distinto al configurado en `authDomain` (por ejemplo GitHub Pages), Firebase no puede completar el inicio de sesión y la página queda cargando indefinidamente.

Para evitarlo, despliegue el sitio en Firebase Hosting utilizando el dominio del proyecto (`bingo-online-231fd.web.app` o un dominio personalizado asociado). Así las cookies son del mismo sitio y la autenticación funciona de forma correcta.
