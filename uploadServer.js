require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const admin = require('firebase-admin');

const requiredEnv = ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_STORAGE_BUCKET'];

function getMissingRequiredEnv(env = process.env) {
  return requiredEnv.filter((name) => !env[name]);
}

function validateRequiredEnv(env = process.env) {
  const missingRequiredEnv = getMissingRequiredEnv(env);
  if (missingRequiredEnv.length > 0) {
    console.error(
      `Faltan variables de entorno requeridas para uploadServer: ${missingRequiredEnv.join(', ')}`
    );
    process.exit(1);
  }
}

function initializeFirebase() {
  if (!admin.apps.length) {
    admin.initializeApp({
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  }
}

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes, intenta más tarde' }
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origen no permitido por CORS'));
    }
  })
);
app.use(express.json());

const ALLOWED_FILE_TYPES = {
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.pdf': ['application/pdf']
};
const dangerousNamePattern = /(^\.+$|\.\.|[\\/]|[\x00-\x1F\x7F])/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_FILE_SIZE_BYTES || 5 * 1024 * 1024),
    files: 1
  },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedMimeTypes = ALLOWED_FILE_TYPES[extension];

    if (!allowedMimeTypes || !allowedMimeTypes.includes(file.mimetype)) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
    }

    if (dangerousNamePattern.test(file.originalname) || path.basename(file.originalname) !== file.originalname) {
      return callback(new Error('Nombre de archivo inválido'));
    }

    return callback(null, true);
  }
});

function registrarAuditoria({ email, fileType, result, reason }) {
  console.info(
    JSON.stringify({
      event: 'upload_audit',
      userEmail: email || 'desconocido',
      timestamp: new Date().toISOString(),
      fileType: fileType || 'desconocido',
      result,
      reason: reason || null
    })
  );
}

async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch (e) {
    console.error('Error verificando token', e);
    return res.status(401).json({ error: 'Token inválido' });
  }

  const email = decoded.email;
  if (!email) {
    return res.status(401).json({ error: 'Token sin correo asociado' });
  }

  try {
    const doc = await admin.firestore().collection('users').doc(email).get();
    const role = doc.exists ? doc.data().role : undefined;
    if (!['Superadmin', 'Administrador'].includes(role)) {
      return res.status(403).json({ error: 'Acceso restringido a roles administrativos' });
    }
    req.user = { email, role };
    next();
  } catch (e) {
    console.error('Error obteniendo el rol del usuario', e);
    return res.status(500).json({ error: 'Error verificando permisos', message: e.message });
  }
}

app.post('/toggleUser', verificarToken, async (req, res) => {
  const { email, disabled } = req.body || {};
  if (!email || typeof disabled !== 'boolean') {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { disabled });
    await admin.firestore().collection('users').doc(email).set({ disabled }, { merge: true });
    res.json({ status: 'ok' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error actualizando usuario', message: e.message });
    }
  }
});

app.post('/syncClaims', verificarToken, async (req, res) => {
  const email = req.user?.email;
  if (!email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const [profileDoc, userRecord] = await Promise.all([
      admin.firestore().collection('users').doc(email).get(),
      admin.auth().getUserByEmail(email)
    ]);

    const role = profileDoc.exists ? profileDoc.data()?.role : undefined;
    if (!role) {
      return res.status(400).json({ error: 'Rol no encontrado en el perfil del usuario' });
    }

    const nextClaims = {
      ...(userRecord.customClaims || {}),
      role,
      roles: [role],
      admin: role === 'Superadmin' || role === 'Administrador'
    };

    await admin.auth().setCustomUserClaims(userRecord.uid, nextClaims);

    return res.json({ status: 'ok', role });
  } catch (e) {
    console.error('Error sincronizando custom claims', e);
    return res.status(500).json({ error: 'Error sincronizando custom claims', message: e.message });
  }
});

app.post('/upload', verificarToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    registrarAuditoria({ email: req.user?.email, result: 'rechazado', reason: 'Archivo requerido' });
    return res.status(400).json({ error: 'Archivo requerido' });
  }
  try {
    const bucket = admin.storage().bucket();
    const extension = path.extname(req.file.originalname).toLowerCase();
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    const file = bucket.file(fileName);
    await file.save(req.file.buffer, { contentType: req.file.mimetype });
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + Number(process.env.SIGNED_URL_EXPIRATION_MS || 15 * 60 * 1000)
    });
    registrarAuditoria({ email: req.user?.email, fileType: req.file.mimetype, result: 'exitoso' });
    res.json({ url, expiresInMs: Number(process.env.SIGNED_URL_EXPIRATION_MS || 15 * 60 * 1000) });
  } catch (e) {
    console.error(e);
    registrarAuditoria({
      email: req.user?.email,
      fileType: req.file?.mimetype,
      result: 'fallido',
      reason: e.message
    });
    res.status(500).json({ error: 'Error al subir archivo', message: e.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Archivo excede el tamaño permitido' : 'Archivo no permitido';
    registrarAuditoria({
      email: req.user?.email,
      fileType: req.file?.mimetype,
      result: 'rechazado',
      reason: message
    });
    return res.status(400).json({ error: message });
  }

  if (err && err.message === 'Nombre de archivo inválido') {
    registrarAuditoria({
      email: req.user?.email,
      result: 'rechazado',
      reason: err.message
    });
    return res.status(400).json({ error: err.message });
  }

  if (err && err.message === 'Origen no permitido por CORS') {
    return res.status(403).json({ error: err.message });
  }

  return next(err);
});

function startServer() {
  validateRequiredEnv();
  initializeFirebase();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servicio de subida escuchando en puerto ${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  requiredEnv,
  getMissingRequiredEnv,
  validateRequiredEnv,
  initializeFirebase,
  startServer
};
