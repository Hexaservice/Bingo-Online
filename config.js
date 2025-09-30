export const firebaseConfig = {
  apiKey: "AIzaSyBztIl46s-vOOxrUVDilJNSN6zuzldeUWI",
  authDomain: "bingo-online-231fd.firebaseapp.com",
  databaseURL: "https://bingo-online-231fd-default-rtdb.firebaseio.com",
  projectId: "bingo-online-231fd",
  storageBucket: "bingo-online-231fd.appspot.com",
  messagingSenderId: "455917034653",
  appId: "1:455917034653:web:ef3f7a1d14be86a1580874"
};

// Endpoint para la subida de imágenes. Se puede sobrescribir mediante la
// variable de entorno UPLOAD_ENDPOINT o definiendo window.UPLOAD_ENDPOINT
// antes de cargar los scripts. Cuando se ejecuta en un navegador bajo HTTPS
// se deriva automáticamente del origen actual para evitar contenido mixto.
const hasWindow = typeof window !== 'undefined';
const hasProcess = typeof process !== 'undefined';

let resolvedUploadEndpoint =
  (hasWindow && window.UPLOAD_ENDPOINT) ||
  (hasProcess && process.env && process.env.UPLOAD_ENDPOINT) ||
  undefined;

if (!resolvedUploadEndpoint && hasWindow && window.location) {
  if (window.location.protocol === 'https:') {
    resolvedUploadEndpoint = `${window.location.origin}/upload`;
  }
}

if (!resolvedUploadEndpoint) {
  resolvedUploadEndpoint = 'http://localhost:3000/upload';
}

if (
  hasWindow &&
  window.location &&
  window.location.protocol === 'https:' &&
  /^http:\/\//i.test(resolvedUploadEndpoint)
) {
  console.warn(
    '[config] Se está utilizando un UPLOAD_ENDPOINT no seguro (http) desde un contexto HTTPS. ' +
      'Actualice la configuración para exponer el servicio por HTTPS y evitar contenido mixto.'
  );
}

export const UPLOAD_ENDPOINT = resolvedUploadEndpoint;
