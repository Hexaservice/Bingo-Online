require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');
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

function hashValue(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const salt = process.env.ADMIN_SESSION_HASH_SALT || 'bingo-admin-session';
  return crypto.createHash('sha256').update(`${salt}:${normalized}`).digest('hex');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}


function approximateIp(ip) {
  const rawIp = typeof ip === 'string' ? ip.trim() : '';
  if (!rawIp) return 'unknown';

  if (rawIp.includes('.')) {
    const parts = rawIp.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
  }

  if (rawIp.includes(':')) {
    const compact = rawIp.replace(/^::ffff:/, '');
    const parts = compact.split(':').filter(Boolean);
    if (parts.length >= 3) {
      return `${parts.slice(0, 3).join(':')}::`;
    }
  }

  return rawIp;
}

function getAuthTimeFromToken(decodedToken) {
  const iat = Number(decodedToken?.iat || 0);
  return Number.isFinite(iat) && iat > 0 ? iat * 1000 : Date.now();
}

async function validarUsuarioSuperadmin(decodedToken) {
  const email = decodedToken?.email;
  if (!email) {
    return { ok: false, status: 401, body: { error: 'Token sin correo asociado' } };
  }

  try {
    const doc = await admin.firestore().collection('users').doc(email).get();
    const role = doc.exists ? doc.data().role : undefined;
    if (role !== 'Superadmin') {
      return { ok: false, status: 403, body: { error: 'Acceso restringido a Superadmin' } };
    }
    return { ok: true, email, role };
  } catch (error) {
    console.error('Error validando usuario superadmin', error);
    return { ok: false, status: 500, body: { error: 'Error verificando permisos', message: error.message } };
  }
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

app.post('/admin/session/register', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1], true);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const validation = await validarUsuarioSuperadmin(decoded);
  if (!validation.ok) {
    return res.status(validation.status).json(validation.body);
  }

  const uid = decoded.uid;
  const userAgent = req.headers['user-agent'] || '';
  const ip = getClientIp(req);
  const deviceId = typeof req.body?.deviceId === 'string' && req.body.deviceId.trim()
    ? req.body.deviceId.trim().slice(0, 120)
    : null;

  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId requerido' });
  }

  const sessionRef = admin.firestore().collection('adminSessions').doc(uid);
  const lastIssuedAt = getAuthTimeFromToken(decoded);
  const now = Date.now();

  let replaced = false;
  let invalidateBefore = null;
  let previousDeviceId = null;

  await admin.firestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(sessionRef);
    const previous = snapshot.exists ? snapshot.data() : null;
    previousDeviceId = previous?.deviceId || null;
    replaced = Boolean(previous && previous.deviceId && previous.deviceId !== deviceId);
    invalidateBefore = replaced ? now : Number(previous?.invalidateBefore || 0);

    tx.set(sessionRef, {
      uid,
      lastIssuedAt,
      deviceId,
      ipHash: hashValue(ip),
      userAgentHash: hashValue(userAgent),
      invalidateBefore: invalidateBefore || 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });

  if (replaced && process.env.ADMIN_SINGLE_DEVICE_MODE !== 'false') {
    try {
      await admin.auth().revokeRefreshTokens(uid);
    } catch (error) {
      console.error('No se pudieron revocar refresh tokens para superadmin', error);
    }
  }

  await admin.firestore().collection('adminAccessAudit').add({
    uid,
    email: validation.email,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    motivo: replaced ? 'new_session_replaced_previous' : 'new_session_registered',
    previousDeviceId,
    currentDeviceId: deviceId
  });

  return res.json({
    status: 'ok',
    replaced,
    invalidateBefore: invalidateBefore || 0
  });
});

app.post('/admin/session/status', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1], true);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const validation = await validarUsuarioSuperadmin(decoded);
  if (!validation.ok) {
    return res.status(validation.status).json(validation.body);
  }

  const uid = decoded.uid;
  const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId.trim() : '';
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId requerido' });
  }

  const snapshot = await admin.firestore().collection('adminSessions').doc(uid).get();
  if (!snapshot.exists) {
    return res.json({ valid: false, reason: 'SESSION_NOT_FOUND' });
  }

  const session = snapshot.data() || {};
  const tokenIssuedAt = getAuthTimeFromToken(decoded);
  const invalidateBefore = Number(session.invalidateBefore || 0);
  const valid = session.deviceId === deviceId && tokenIssuedAt >= invalidateBefore;
  return res.json({ valid, reason: valid ? null : 'SESSION_REPLACED' });
});

app.post('/admin/audit/parametros', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1], true);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const validation = await validarUsuarioSuperadmin(decoded);
  if (!validation.ok) {
    return res.status(validation.status).json(validation.body);
  }

  const motivo = typeof req.body?.motivo === 'string' && req.body.motivo.trim()
    ? req.body.motivo.trim().slice(0, 160)
    : 'acceso_parametros';
  const estado = typeof req.body?.estado === 'string' && req.body.estado.trim()
    ? req.body.estado.trim().slice(0, 40)
    : 'exitoso';
  const detalle = typeof req.body?.detalle === 'string' && req.body.detalle.trim()
    ? req.body.detalle.trim().slice(0, 240)
    : null;
  const contexto = typeof req.body?.contexto === 'string' && req.body.contexto.trim()
    ? req.body.contexto.trim().slice(0, 120)
    : null;
  const ruta = typeof req.body?.ruta === 'string' && req.body.ruta.trim()
    ? req.body.ruta.trim().slice(0, 200)
    : null;

  const ip = getClientIp(req);
  const ipAproximada = approximateIp(ip);

  await admin.firestore().collection('adminAccessAudit').add({
    uid: decoded.uid,
    email: validation.email,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    motivo,
    estado,
    detalle,
    contexto,
    ruta,
    ipHash: hashValue(ip),
    ipAproximada
  });

  return res.json({ status: 'ok' });
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
  startServer,
  hashValue,
  getClientIp,
  getAuthTimeFromToken,
  approximateIp
};
