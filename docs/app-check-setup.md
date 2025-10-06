# Guía para habilitar Firebase App Check en Bingo Online

Esta guía describe los pasos necesarios para habilitar Firebase App Check en la
aplicación web y reforzar las reglas de seguridad de Cloud Firestore y Cloud
Storage para que únicamente las solicitudes emitidas desde la app validada
puedan leer o escribir datos.

## 1. Prerrequisitos

1. Asegúrate de tener acceso de **Owner** o **Firebase Admin** al proyecto de
   Firebase correspondiente.
2. Instala la [Firebase CLI](https://firebase.google.com/docs/cli) y autentícate
   con `firebase login`.
3. Actualiza tus dependencias locales ejecutando `npm install` si todavía no lo
   has hecho.

## 2. Registrar el proveedor de App Check

1. Ingresa a la [consola de Firebase](https://console.firebase.google.com/).
2. Selecciona el proyecto vinculado a la aplicación (por ejemplo
   `bingo-online-231fd`).
3. En el menú lateral, navega a **App Check**.
4. Elige la app web correspondiente y haz clic en **Registrar app** (o **Agregar
   proveedor** si la app ya está registrada).
5. Selecciona el proveedor **reCAPTCHA v3** o **reCAPTCHA Enterprise** y sigue
   el asistente para generar la clave del sitio (site key).
6. Copia y guarda el valor del site key. Se utilizará en los siguientes pasos.

> **Nota:** Si necesitas ejecutar la app desde `localhost`, habilita el modo
> debug y registra el token en la consola de Firebase. Esto permitirá aceptar las
> solicitudes provenientes de tu equipo de desarrollo.

## 3. Configurar `public/firebase-app-check.js`

1. Copia el archivo de plantilla (si necesitas regenerarlo) o utiliza el ya
   incluido en el repositorio:
   ```bash
   cp public/firebase-app-check.template.js public/firebase-app-check.js
   ```
2. Edita `public/firebase-app-check.js` y reemplaza `REEMPLAZA_CON_TU_SITE_KEY`
   por el site key emitido en la consola de Firebase.
3. (Opcional) Si necesitas un token de depuración, establece `debugToken` con el
   valor que se mostrará en la consola al cargar la app en modo debug o cambia
   `enableDebug` a `true` únicamente en entornos locales.
4. Guarda el archivo. Durante la inicialización, `auth.js` cargará este script y
   activará App Check automáticamente antes de que Firestore o Storage se utilicen.

> **Sugerencia:** Si el repositorio es público, considera excluir
> `public/firebase-app-check.js` del control de versiones una vez configurado, o
> utiliza variables de entorno en tu sistema de despliegue para generar el
> archivo a partir de la plantilla.

## 4. Desplegar las reglas de seguridad

1. Revisa las reglas propuestas en [`firestore.rules`](../firestore.rules) y
   [`storage.rules`](../storage.rules). Ambas verifican que la solicitud esté
   autenticada y que incluya un token válido de App Check.
2. Ejecuta los siguientes comandos para desplegar únicamente las reglas:
   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```
3. Verifica en la consola de Firebase que las reglas se hayan actualizado.

## 5. Habilitar el enforcement de App Check

1. En la consola de Firebase, dentro de **App Check**, selecciona la app web.
2. En la sección **Enforcement** activa la aplicación de App Check para **Cloud
   Firestore** y **Cloud Storage**.
3. Confirma la operación. A partir de este momento, todas las solicitudes que no
   presenten un token válido de App Check serán bloqueadas automáticamente por
   Firebase.

## 6. Validar la integración

1. Abre la aplicación en el navegador y verifica la consola de desarrollo. Si el
   site key no fue configurado correctamente, `auth.js` mostrará un error
   indicando que App Check no pudo inicializarse.
2. Realiza operaciones de lectura/escritura en Firestore y subida/bajada de
   archivos en Storage. Las solicitudes deberían completarse correctamente.
3. (Opcional) Intenta consumir las APIs directamente con herramientas externas
   sin un token de App Check. Las solicitudes deberán ser rechazadas.

Con estos pasos, App Check quedará activo y la app web únicamente podrá acceder a
Firestore y Storage cuando se ejecute desde un entorno autorizado.
