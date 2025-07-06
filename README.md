# Bingo Online

Este proyecto utiliza Firebase para autenticar usuarios mediante Google y almacenar la información en Firestore.

## Inicializar usuarios especiales

Se incluyen dos cuentas con roles especiales:

- `jhoseph.q@gmail.com` como **Superadmin**
- `hexaservice.co@gmail.com` como **Colaborador**

Para crear los documentos iniciales en Firestore ejecute:

```bash
npm install
node initUsers.js
```

Debe disponer de un archivo `serviceAccountKey.json` con las credenciales de Firebase o definir la variable `GOOGLE_APPLICATION_CREDENTIALS` apuntando al archivo de claves.

Este script creará las entradas en la colección `users` y actualizará los roles en caso de que ya existan.

## Despliegue estático

El archivo `index.html` contiene toda la lógica de la aplicación. Sólo es necesario servirlo desde cualquier servidor web estático.
