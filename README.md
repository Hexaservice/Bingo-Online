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

### Dominio y cookies

A partir de las últimas versiones de los navegadores se bloquean las cookies de terceros por defecto. Si la aplicación se aloja en un dominio distinto al configurado en `authDomain` (por ejemplo GitHub Pages), Firebase no puede completar el inicio de sesión y la página queda cargando indefinidamente.

Para evitarlo, despliegue el sitio en Firebase Hosting utilizando el dominio del proyecto (`bingo-online-231fd.web.app` o un dominio personalizado asociado). Así las cookies son del mismo sitio y la autenticación funciona de forma correcta.

## Directrices de desarrollo

- Toda obtención o cálculo de fechas y horas debe realizarse empleando el huso horario definido para el despliegue del sistema.
- Evite depender de la fecha u hora del dispositivo cliente; utilice siempre fuentes sincronizadas con el huso horario seleccionado para garantizar coherencia entre servicios.
- Mantenga todas las credenciales y endpoints sensibles en variables de entorno (`GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_STORAGE_BUCKET`, `UPLOAD_ENDPOINT`, `PORT`). Nunca incluya archivos de claves en el repositorio; documente en despliegue dónde obtenerlos.
- Proteja cada nuevo endpoint o script de backend reutilizando el middleware `verificarToken` de `uploadServer.js` (o uno equivalente) para validar el ID token de Firebase antes de ejecutar acciones administrativas.
- Calcule fechas y horas apoyándose en `scripts/timezone.js` y en el desfase `serverTime.diferencia`; evite usar directamente `Date.now()` sin normalizar al huso horario configurado, tanto en el cliente como en los procesos automáticos.
- Cuando cree o actualice sorteos, guarde los campos `fecha`, `hora` y `horacierre` en formato `DD/MM/YYYY` y `HH:mm` (24 horas) para asegurar que `cronActualizarEstadosSorteos.js` pueda interpretar los datos sin errores.
- Documente cualquier ajuste en la colección `Variablesglobales/Parametros` (especialmente `ZonaHoraria`, `Pais` y `Aplicacion`) y coordínelo con los responsables del cron para mantener sincronizados el frontend y las tareas programadas.



