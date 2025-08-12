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
// antes de cargar los scripts.
export const UPLOAD_ENDPOINT =
  (typeof window !== 'undefined' && window.UPLOAD_ENDPOINT) ||
  (typeof process !== 'undefined' && process.env && process.env.UPLOAD_ENDPOINT) ||
  'http://localhost:3000/upload';
