const hasWindow = typeof window !== 'undefined';
const REQUIRED_FIREBASE_CONFIG_FIELDS = [
  'apiKey',
  'authDomain',
  'databaseURL',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
];

const firebaseConfigFromWindow =
  hasWindow && window.__FIREBASE_CONFIG__ ? window.__FIREBASE_CONFIG__ : undefined;

export const firebaseConfig = firebaseConfigFromWindow || {};

if (hasWindow) {
  window.firebaseConfig = firebaseConfig;
}

export function getMissingFirebaseConfigFields(config = firebaseConfig) {
  return REQUIRED_FIREBASE_CONFIG_FIELDS.filter(
    (field) => typeof config[field] !== 'string' || config[field].trim() === ''
  );
}

export function assertFirebaseConfigOrThrow(config = firebaseConfig) {
  const missingFields = getMissingFirebaseConfigFields(config);
  if (missingFields.length === 0) {
    return config;
  }

  const message =
    `[config] Firebase config incompleta. Faltan campos requeridos: ${missingFields.join(', ')}. ` +
    'Genere public/firebase-config.js y verifique variables FIREBASE_<ENV>_* no vacías.';

  if (hasWindow) {
    window.__FIREBASE_CONFIG_ERROR__ = message;
    if (typeof window.alert === 'function') {
      window.alert(message);
    }
  }

  throw new Error(message);
}

if (hasWindow) {
  window.__FIREBASE_CONFIG_ERROR__ = '';
}

if (!firebaseConfigFromWindow) {
  console.error(
    '[config] No se encontró window.__FIREBASE_CONFIG__. Asegúrese de generar public/firebase-config.js antes de cargar los scripts.'
  );
}

try {
  assertFirebaseConfigOrThrow(firebaseConfig);
} catch (error) {
  console.error(error.message);
}

// Endpoint para la subida de imágenes. Se puede sobrescribir mediante la
// variable de entorno UPLOAD_ENDPOINT o definiendo window.UPLOAD_ENDPOINT
// antes de cargar los scripts. Cuando se ejecuta en un navegador bajo HTTPS
// se deriva automáticamente del origen actual para evitar contenido mixto.
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
