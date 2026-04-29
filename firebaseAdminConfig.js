const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function loadServiceAccountFromEnv() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
  const absolutePath = path.resolve(credentialsPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Service account credentials not found at ${absolutePath}`);
  }
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(absolutePath);
}

function validateDevelopmentProjectGuard({ projectId, databaseURL }) {
  if (process.env.NODE_ENV !== 'development') return;

  const expectedProjectId = process.env.FIREBASE_DEV_PROJECT_ID;
  const expectedDatabaseURL = process.env.FIREBASE_DEV_DATABASE_URL;

  if (!expectedProjectId || !expectedDatabaseURL) {
    throw new Error('En desarrollo debes definir FIREBASE_DEV_PROJECT_ID y FIREBASE_DEV_DATABASE_URL para validar el entorno.');
  }

  if (projectId !== expectedProjectId || databaseURL !== expectedDatabaseURL) {
    throw new Error(
      `Guard de entorno activado: NODE_ENV=development requiere projectId/databaseURL de dev. ` +
      `Actual=${projectId} | ${databaseURL}. Esperado=${expectedProjectId} | ${expectedDatabaseURL}`
    );
  }
}

function initializeFirebaseAdmin({ requireStorageBucket = false } = {}) {
  const serviceAccount = loadServiceAccountFromEnv();
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!databaseURL) {
    throw new Error('Falta la variable de entorno FIREBASE_DATABASE_URL');
  }

  if (requireStorageBucket && !process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error('Falta la variable de entorno FIREBASE_STORAGE_BUCKET');
  }

  validateDevelopmentProjectGuard({
    projectId: serviceAccount.project_id,
    databaseURL
  });

  if (!admin.apps.length) {
    const options = {
      credential: admin.credential.cert(serviceAccount),
      databaseURL
    };

    if (requireStorageBucket) {
      options.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
    }

    admin.initializeApp(options);
  }

  return admin;
}

module.exports = { initializeFirebaseAdmin };
