require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');
const EstadosPagoPremio = require('./public/js/estadoPagoPremio.js');
const { isSorteoEligibleForAutoPrize } = require('./public/js/sorteoAutoPrizeEligibility.js');

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

function getAuthTimeFromToken(decodedToken) {
  const iat = Number(decodedToken?.iat || 0);
  return Number.isFinite(iat) && iat > 0 ? iat * 1000 : Date.now();
}

async function deleteCollectionBySorteoId({ db, collectionName, sorteoId, pageSize = 200 }) {
  let deleted = 0;

  while (true) {
    const snapshot = await db
      .collection(collectionName)
      .where('sorteoId', '==', sorteoId)
      .limit(pageSize)
      .get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deleted += snapshot.size;
  }

  return deleted;
}

async function countCollectionBySorteoId({ db, collectionName, sorteoId, pageSize = 400 }) {
  let count = 0;
  let lastDoc = null;

  while (true) {
    let query = db
      .collection(collectionName)
      .where('sorteoId', '==', sorteoId)
      .orderBy('__name__')
      .limit(pageSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    count += snapshot.size;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.size < pageSize) {
      break;
    }
  }

  return count;
}

async function deleteDocumentById({ db, collectionName, docId }) {
  const ref = db.collection(collectionName).doc(docId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return 0;
  }

  await ref.delete();
  return 1;
}

async function countDocumentById({ db, collectionName, docId }) {
  const ref = db.collection(collectionName).doc(docId);
  const snapshot = await ref.get();
  return snapshot.exists ? 1 : 0;
}

async function getPurgeCounts({ db, sorteoId, dryRun }) {
  return {
    CartonJugado: dryRun
      ? await countCollectionBySorteoId({ db, collectionName: 'CartonJugado', sorteoId })
      : await deleteCollectionBySorteoId({ db, collectionName: 'CartonJugado', sorteoId }),
    ConsecutivosCarton: dryRun
      ? await countDocumentById({ db, collectionName: 'ConsecutivosCarton', docId: sorteoId })
      : await deleteDocumentById({ db, collectionName: 'ConsecutivosCarton', docId: sorteoId }),
    SorteosCentroPagos: dryRun
      ? await countDocumentById({ db, collectionName: 'SorteosCentroPagos', docId: sorteoId })
      : await deleteDocumentById({ db, collectionName: 'SorteosCentroPagos', docId: sorteoId }),
    cantos: dryRun
      ? await countDocumentById({ db, collectionName: 'cantos', docId: sorteoId })
      : await deleteDocumentById({ db, collectionName: 'cantos', docId: sorteoId }),
    cantarsorteos: dryRun
      ? await countDocumentById({ db, collectionName: 'cantarsorteos', docId: sorteoId })
      : await deleteDocumentById({ db, collectionName: 'cantarsorteos', docId: sorteoId }),
    formas: dryRun
      ? await countCollectionBySorteoId({ db, collectionName: 'formas', sorteoId })
      : await deleteCollectionBySorteoId({ db, collectionName: 'formas', sorteoId }),
    GanadoresSorteosTiempoReal: dryRun
      ? await countCollectionBySorteoId({ db, collectionName: 'GanadoresSorteosTiempoReal', sorteoId })
      : await deleteCollectionBySorteoId({ db, collectionName: 'GanadoresSorteosTiempoReal', sorteoId }),
    sorteos: dryRun
      ? await countDocumentById({ db, collectionName: 'sorteos', docId: sorteoId })
      : await deleteDocumentById({ db, collectionName: 'sorteos', docId: sorteoId })
  };
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
    req.user = { uid: decoded.uid, email, role };
    next();
  } catch (e) {
    console.error('Error obteniendo el rol del usuario', e);
    return res.status(500).json({ error: 'Error verificando permisos', message: e.message });
  }
}

async function verificarOperadorPrivilegiado(req, res, next) {
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
    if (!['Superadmin', 'Administrador', 'Colaborador'].includes(role)) {
      return res.status(403).json({ error: 'Acceso restringido a operadores autorizados' });
    }
    req.user = { uid: decoded.uid, email, role };
    next();
  } catch (e) {
    console.error('Error obteniendo el rol del usuario', e);
    return res.status(500).json({ error: 'Error verificando permisos', message: e.message });
  }
}

function normalizeString(value, maxLength = 200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function buildPremioDocId({ sorteoId, formaIdx, cartonId, prefijo = '' }) {
  const sanitize = (value) => normalizeString(String(value || ''), 120).replace(/[^\w-]/g, '_');
  const baseId = `${sanitize(sorteoId)}__f${sanitize(formaIdx)}__${sanitize(cartonId)}`;
  return prefijo ? `${sanitize(prefijo)}__${baseId}` : baseId;
}

function extractEventoGanadorIdComponents(eventoGanadorId) {
  const normalized = normalizeString(eventoGanadorId, 220);
  if (!normalized) return null;

  const [, maybePrefijo = '', maybeSorteoId = '', maybeForma = '', maybeCartonId = ''] = normalized.match(/^(?:([^_]+?)__)?(.+?)__f([^_]+?)__(.+)$/) || [];
  const parsedFormaIdx = Number(maybeForma);

  if (!maybeSorteoId || !maybeCartonId || !Number.isFinite(parsedFormaIdx)) {
    return null;
  }

  return {
    prefijo: maybePrefijo,
    segundoLugar: maybePrefijo.toLowerCase() === 'segundo',
    sorteoId: maybeSorteoId,
    formaIdx: parsedFormaIdx,
    cartonId: maybeCartonId
  };
}


function getAcreditacionExecutionMode({ source, origen, manualApproval, userRole }) {
  const normalizedSource = normalizeString(source, 120).toLowerCase();
  const normalizedOrigen = normalizeString(origen, 80).toLowerCase();
  const explicitManualApproval = manualApproval === true;
  const sourceRequestsManual = normalizedSource === 'centropagos/manual' || normalizedOrigen === 'centropagos/manual';
  const manualRequested = explicitManualApproval || sourceRequestsManual;
  const hasPrivilegedRole = ['Superadmin', 'Administrador'].includes(normalizeString(userRole, 40));
  const manualAllowed = manualRequested && hasPrivilegedRole;

  return {
    mode: manualAllowed ? 'manual' : 'automatico',
    manualRequested,
    manualAllowed,
    hasPrivilegedRole
  };
}

function normalizePremioTransactionState(value) {
  return EstadosPagoPremio.normalizarLectura(value);
}

function getBilleteraCandidates({ userEmail, cartonData, payloadUserId }) {
  const values = [
    normalizeString(userEmail, 160).toLowerCase(),
    normalizeString(payloadUserId, 160).toLowerCase(),
    normalizeString(cartonData?.email, 160).toLowerCase(),
    normalizeString(cartonData?.gmail, 160).toLowerCase(),
    normalizeString(cartonData?.IDbilletera, 160)
  ].filter(Boolean);
  return Array.from(new Set(values));
}

function looksLikeEmail(value) {
  return typeof value === 'string' && /@/.test(value.trim());
}

async function resolveWinnerIdentity({
  normalizedEmail,
  normalizedUserId,
  cartonData,
  loadUserById,
  loadUserByUid
}) {
  const cartonUserId = normalizeString(cartonData?.userId || cartonData?.usuarioId, 160);
  const emailCandidates = [
    normalizeString(normalizedEmail, 160).toLowerCase(),
    normalizeString(cartonData?.email, 160).toLowerCase(),
    normalizeString(cartonData?.gmail, 160).toLowerCase(),
    looksLikeEmail(cartonData?.IDbilletera) ? normalizeString(cartonData?.IDbilletera, 160).toLowerCase() : ''
  ].filter(Boolean);
  const internalCandidates = [
    normalizeString(normalizedUserId, 160),
    cartonUserId,
    looksLikeEmail(cartonData?.IDbilletera) ? '' : normalizeString(cartonData?.IDbilletera, 160)
  ].filter(Boolean);

  const identities = [normalizeString(normalizedUserId, 160), cartonUserId].filter(Boolean);
  for (const identity of identities) {
    if (looksLikeEmail(identity)) {
      emailCandidates.push(normalizeString(identity, 160).toLowerCase());
      continue;
    }

    const directUser = await loadUserById(identity);
    if (directUser) {
      const emailByData = normalizeString(directUser.data?.email || directUser.data?.gmail, 160).toLowerCase();
      if (emailByData) emailCandidates.push(emailByData);
      if (looksLikeEmail(directUser.id)) {
        emailCandidates.push(directUser.id.toLowerCase());
      } else if (directUser.id) {
        internalCandidates.push(normalizeString(directUser.id, 160));
      }
      if (directUser.data?.uid) {
        internalCandidates.push(normalizeString(directUser.data.uid, 160));
      }
    }

    const uidUser = await loadUserByUid(identity);
    if (uidUser) {
      const emailByData = normalizeString(uidUser.data?.email || uidUser.data?.gmail, 160).toLowerCase();
      if (emailByData) emailCandidates.push(emailByData);
      if (looksLikeEmail(uidUser.id)) {
        emailCandidates.push(uidUser.id.toLowerCase());
      } else if (uidUser.id) {
        internalCandidates.push(normalizeString(uidUser.id, 160));
      }
      if (uidUser.data?.uid) {
        internalCandidates.push(normalizeString(uidUser.data.uid, 160));
      }
    }
  }

  const uniqueEmails = Array.from(new Set(emailCandidates.filter(Boolean)));
  const uniqueInternals = Array.from(new Set(internalCandidates.filter(Boolean)));
  const emailVisible = uniqueEmails[0] || '';
  const billeteraCandidates = Array.from(new Set([
    emailVisible,
    ...getBilleteraCandidates({ userEmail: normalizedEmail, payloadUserId: normalizedUserId, cartonData }),
    ...uniqueInternals
  ].filter(Boolean)));

  return {
    emailVisible,
    canonicalEmail: emailVisible,
    billeteraCandidates,
    internalCandidates: uniqueInternals
  };
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

  await admin.firestore().collection('adminAccessAudit').add({
    uid: decoded.uid,
    email: validation.email,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    motivo
  });

  return res.json({ status: 'ok' });
});

app.post('/admin/purge-sorteo', verificarToken, async (req, res) => {
  const { sorteoId, sorteoNombre, dryRun } = req.body || {};
  const normalizedDryRun = dryRun === true;
  const PREVIEW_VALID_WINDOW_MS = 10 * 60 * 1000;

  if (!['Superadmin', 'Administrador'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Acceso restringido a roles administrativos' });
  }

  if (typeof sorteoId !== 'string' || !sorteoId.trim()) {
    return res.status(400).json({ error: 'sorteoId es obligatorio' });
  }

  const normalizedSorteoId = sorteoId.trim();
  const normalizedSorteoNombre = typeof sorteoNombre === 'string' && sorteoNombre.trim()
    ? sorteoNombre.trim().slice(0, 200)
    : null;

  const db = admin.firestore();

  try {
    if (!normalizedDryRun) {
      const recentPreviewSnapshot = await db
        .collection('adminAccessAudit')
        .where('uid', '==', req.user?.uid || null)
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();

      const recentPreview = recentPreviewSnapshot.docs.find((doc) => {
        const data = doc.data() || {};
        return data.motivo === 'purge_sorteo_preview' && data.sorteoId === normalizedSorteoId;
      });

      if (!recentPreview) {
        return res.status(409).json({
          error: 'Debes hacer una previsualización antes de depurar este sorteo.'
        });
      }

      const previewData = recentPreview.data() || {};
      const previewAtMs = previewData.timestamp?.toMillis ? previewData.timestamp.toMillis() : 0;
      if (!previewAtMs || Date.now() - previewAtMs > PREVIEW_VALID_WINDOW_MS) {
        return res.status(409).json({
          error: 'La previsualización expiró. Genera una nueva antes de depurar.',
          previewValidWindowMs: PREVIEW_VALID_WINDOW_MS
        });
      }
    }

    const deletedCounts = await getPurgeCounts({
      db,
      sorteoId: normalizedSorteoId,
      dryRun: normalizedDryRun
    });

    await db.collection('adminAccessAudit').add({
      uid: req.user?.uid || null,
      email: req.user?.email || 'desconocido',
      role: req.user?.role || 'desconocido',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      motivo: normalizedDryRun ? 'purge_sorteo_preview' : 'purge_sorteo',
      sorteoId: normalizedSorteoId,
      sorteoNombre: normalizedSorteoNombre,
      dryRun: normalizedDryRun,
      deletedCounts
    });

    return res.json({
      status: 'ok',
      sorteoId: normalizedSorteoId,
      dryRun: normalizedDryRun,
      previewValidWindowMs: PREVIEW_VALID_WINDOW_MS,
      deletedCounts
    });
  } catch (error) {
    console.error('Error purgando sorteo', error);
    return res.status(500).json({ error: 'Error purgando sorteo', message: error.message });
  }
});

async function acreditarPremioEventoHandler(req, res) {
  const {
    sorteoId,
    formaIdx,
    cartonId,
    userId,
    email,
    monto,
    cartonesGratis,
    eventoGanadorId,
    prefijoTransaccion,
    origen,
    referencia,
    tipoRegistro,
    segundoLugar,
    alias,
    requestId,
    source,
    manualApproval
  } = req.body || {};

  const normalizedSorteoId = normalizeString(sorteoId, 120);
  const normalizedCartonId = normalizeString(cartonId, 120);
  const normalizedFormaIdx = Number.isFinite(Number(formaIdx)) ? Number(formaIdx) : null;
  const normalizedMonto = Math.max(0, Math.floor(normalizeNumber(monto)));
  const normalizedCartonesGratis = Math.max(0, Math.floor(normalizeNumber(cartonesGratis)));
  const normalizedUserId = normalizeString(userId, 160);
  const normalizedEmail = normalizeString(email, 160).toLowerCase();
  const normalizedAlias = normalizeString(alias, 160);
  const normalizedPrefijoTransaccion = normalizeString(prefijoTransaccion, 40).replace(/[^\w-]/g, '') || 'premio';
  const normalizedOrigen = normalizeString(origen, 80) || 'premios_jugadores';
  const normalizedReferencia = normalizeString(referencia, 80) || 'PREMIO';
  const normalizedTipoRegistro = normalizeString(tipoRegistro, 80) || 'GANADOR_SORTEO';
  const normalizedSegundoLugar = Boolean(segundoLugar);
  const normalizedEventoGanadorId = normalizeString(eventoGanadorId, 220);
  const normalizedRequestId = normalizeString(
    requestId || req.headers['x-request-id'] || req.headers['x-correlation-id'] || '',
    120
  ) || `acred-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizedSource = normalizeString(source, 120) || 'backend/acreditarPremioEvento';
  const executionMode = getAcreditacionExecutionMode({
    source: normalizedSource,
    origen: normalizedOrigen,
    manualApproval,
    userRole: req.user?.role
  });

  if (!normalizedSorteoId || !normalizedCartonId || normalizedFormaIdx === null || !normalizedEventoGanadorId) {
    return res.status(400).json({
      error: 'Entradas inválidas. Se requiere sorteoId, formaIdx, cartonId y eventoGanadorId.'
    });
  }

  const parsedEventoGanadorId = extractEventoGanadorIdComponents(normalizedEventoGanadorId);
  const segundoLugarEfectivo = normalizedSegundoLugar || Boolean(parsedEventoGanadorId?.segundoLugar);
  const expectedEventoGanadorId = buildPremioDocId({
    sorteoId: normalizedSorteoId,
    formaIdx: normalizedFormaIdx,
    cartonId: normalizedCartonId,
    prefijo: segundoLugarEfectivo ? 'segundo' : ''
  });

  if (normalizedEventoGanadorId !== expectedEventoGanadorId) {
    return res.status(409).json({
      error: 'eventoGanadorId no coincide con sorteoId, formaIdx y cartonId.'
    });
  }

  if (!normalizedMonto && !normalizedCartonesGratis) {
    return res.status(400).json({ error: 'Debe existir monto o cartonesGratis mayor que cero.' });
  }

  if (!normalizedEmail && !normalizedUserId) {
    return res.status(400).json({ error: 'Se requiere userId o email.' });
  }

  const db = admin.firestore();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  try {
    const result = await db.runTransaction(async (tx) => {
      const sorteoRef = db.collection('sorteos').doc(normalizedSorteoId);
      const cartonRef = db.collection('CartonJugado').doc(normalizedCartonId);
      const premioRef = db.collection('PremiosSorteos').doc(normalizedEventoGanadorId);
      const transaccionRef = db.collection('transacciones').doc(`${normalizedPrefijoTransaccion}_${normalizedEventoGanadorId}`);

      const [sorteoSnap, cartonSnap, premioSnap, transaccionSnap] = await Promise.all([
        tx.get(sorteoRef),
        tx.get(cartonRef),
        tx.get(premioRef),
        tx.get(transaccionRef)
      ]);

      if (!sorteoSnap.exists) {
        throw new Error('SORTEO_NO_EXISTE');
      }

      const sorteoData = sorteoSnap.data() || {};
      // Estados compatibles con acreditación automática: etapas activas/finales del flujo
      // (Sellado/Jugando/Finalizando/Finalizado) siempre que el corte de premios siga abierto.
      // Se rechaza solamente cuando el estado es incompatible con premiación (p.ej. Activo/Inactivo/Archivado)
      // o cuando el corte ya fue cerrado explícitamente.
      const premiosCorteCerrado = Boolean(sorteoData?.premiosCorteCerrado);
      if (!isSorteoEligibleForAutoPrize({
        estado: sorteoData.estado,
        premiosCorteCerrado: executionMode.manualAllowed ? false : premiosCorteCerrado
      })) {
        if (premiosCorteCerrado && !executionMode.manualAllowed) {
          throw new Error('SORTEO_CORTE_CERRADO');
        }
        throw new Error('SORTEO_ESTADO_INVALIDO');
      }

      if (!cartonSnap.exists) {
        throw new Error('CARTON_NO_EXISTE');
      }

      const cartonData = cartonSnap.data() || {};
      const cartonSorteoId = normalizeString(cartonData.sorteoId, 120);
      if (cartonSorteoId !== normalizedSorteoId) {
        throw new Error('CARTON_NO_PERTENECE_SORTEO');
      }

      const premioActual = premioSnap.exists ? premioSnap.data() || {} : null;
      const estadoPremio = normalizePremioTransactionState(premioActual?.estado);
      if (estadoPremio === EstadosPagoPremio.ESTADOS_CANONICOS.REALIZADO) {
        return { status: 'ok', idempotent: true, premioId: normalizedEventoGanadorId, requestId: normalizedRequestId };
      }

      const identityResolution = await resolveWinnerIdentity({
        normalizedEmail,
        normalizedUserId,
        cartonData,
        loadUserById: async (identity) => {
          const directUserSnap = await tx.get(db.collection('users').doc(identity));
          if (!directUserSnap.exists) return null;
          return { id: directUserSnap.id, data: directUserSnap.data() || {} };
        },
        loadUserByUid: async (identity) => {
          const byUidSnap = await tx.get(db.collection('users').where('uid', '==', identity).limit(1));
          if (byUidSnap.empty) return null;
          const doc = byUidSnap.docs[0];
          return { id: doc.id, data: doc.data() || {} };
        }
      });
      const emailVisible = identityResolution.emailVisible;
      const billeteraSearchCandidates = identityResolution.billeteraCandidates;

      if (!billeteraSearchCandidates.length) {
        throw new Error('BILLETERA_NO_IDENTIFICABLE');
      }

      let billeteraRef = db.collection('Billetera').doc(billeteraSearchCandidates[0]);
      let billeteraSnap = null;
      for (const billeteraId of billeteraSearchCandidates) {
        const candidateRef = db.collection('Billetera').doc(billeteraId);
        const candidateSnap = await tx.get(candidateRef);
        if (candidateSnap.exists) {
          billeteraRef = candidateRef;
          billeteraSnap = candidateSnap;
          break;
        }
      }
      if (!billeteraSnap) {
        billeteraSnap = await tx.get(billeteraRef);
      }

      const billeteraActual = billeteraSnap.exists ? billeteraSnap.data() || {} : {};
      const nuevosCreditos = normalizeNumber(billeteraActual.creditos) + normalizedMonto;
      const nuevosCartones = normalizeNumber(billeteraActual.CartonesGratis) + normalizedCartonesGratis;
      const sorteoNombre = normalizeString(sorteoData.nombre, 200);
      const fecha = new Date();
      const fechaGestion = fecha.toISOString().slice(0, 10).split('-').reverse().join('/');
      const horaGestion = fecha.toTimeString().slice(0, 5);
      if (!emailVisible) {
        const eventoTecnicoRef = db.collection('AcreditacionEventosTecnicos').doc(`${normalizedEventoGanadorId}__${normalizedRequestId}`);
        const reconciliacionRef = db.collection('AcreditacionReconciliacionPendiente').doc(normalizedEventoGanadorId);
        tx.set(eventoTecnicoRef, {
          tipo: 'EMAIL_CANONICO_NO_RESUELTO',
          severidad: 'warning',
          sorteoId: normalizedSorteoId,
          cartonId: normalizedCartonId,
          formaIdx: normalizedFormaIdx,
          eventoGanadorId: normalizedEventoGanadorId,
          requestId: normalizedRequestId,
          userId: normalizedUserId || cartonData.userId || null,
          idBilleteraInterna: billeteraRef.id,
          source: normalizedSource,
          processedBy: req.user?.email || '',
          executionMode: executionMode.mode,
          processedAt: timestamp,
          estado: 'PENDIENTE_RECONCILIACION'
        }, { merge: true });
        tx.set(reconciliacionRef, {
          eventoGanadorId: normalizedEventoGanadorId,
          sorteoId: normalizedSorteoId,
          cartonId: normalizedCartonId,
          formaIdx: normalizedFormaIdx,
          requestId: normalizedRequestId,
          source: normalizedSource,
          processedBy: req.user?.email || '',
          executionMode: executionMode.mode,
          motivo: 'EMAIL_CANONICO_NO_RESUELTO',
          estado: 'PENDIENTE',
          userId: normalizedUserId || cartonData.userId || null,
          idBilleteraInterna: billeteraRef.id,
          creadoEn: timestamp,
          actualizadoEn: timestamp
        }, { merge: true });

        return {
          status: 'pending_reconciliation',
          idempotent: false,
          premioId: normalizedEventoGanadorId,
          billeteraInternaId: billeteraRef.id,
          requestId: normalizedRequestId
        };
      }

      const premioProyeccionRef = db.collection('users').doc(emailVisible).collection('premios').doc(normalizedEventoGanadorId);
      const resumenProyeccionRef = db.collection('users').doc(emailVisible).collection('billeteraProyeccion').doc('resumen');
      const ganadorTiempoRealRef = db.collection('GanadoresSorteosTiempoReal').doc(normalizedEventoGanadorId);

      tx.set(
        premioRef,
        {
          sorteoId: normalizedSorteoId,
          sorteoNombre,
          email: emailVisible,
          gmail: emailVisible,
          emailVisible,
          alias: normalizedAlias || cartonData.alias || '',
          aliasJugador: normalizedAlias || cartonData.alias || '',
          aliasGanador: normalizedAlias || cartonData.alias || '',
          userId: normalizedUserId || cartonData.userId || null,
          cartonId: normalizedCartonId,
          formaIdx: normalizedFormaIdx,
          creditos: normalizedMonto,
          creditosGanados: normalizedMonto,
          cartonesGratis: normalizedCartonesGratis,
          eventoGanadorId: normalizedEventoGanadorId,
          winnerKey: normalizedEventoGanadorId,
          version: normalizeNumber(premioActual?.version) + 1,
          processedAt: timestamp,
          tipoRegistro: normalizedTipoRegistro,
          segundoLugar: segundoLugarEfectivo,
          idBilletera: billeteraRef.id,
          idBilleteraInterna: billeteraRef.id,
          estado: 'REALIZADO',
          actualizadoEn: timestamp,
          fechaRegistro: premioActual?.fechaRegistro || timestamp,
          creadoEn: premioActual?.creadoEn || timestamp,
          fechaGanado: timestamp,
          source: normalizedSource,
          requestId: normalizedRequestId,
          processedBy: req.user?.email || '',
          generadoDesde: normalizedSource,
          gestionadoPor: req.user?.email || '',
          rolGestor: req.user?.role || '',
          fechaGestion,
          horaGestion
        },
        { merge: true }
      );

      tx.set(
        ganadorTiempoRealRef,
        {
          sorteoId: normalizedSorteoId,
          sorteoNombre,
          eventoGanadorId: normalizedEventoGanadorId,
          winnerKey: normalizedEventoGanadorId,
          formaIdx: normalizedFormaIdx,
          cartonId: normalizedCartonId,
          idBilletera: billeteraRef.id,
          email: emailVisible,
          gmail: emailVisible,
          emailVisible,
          alias: normalizedAlias || cartonData.alias || '',
          userId: normalizedUserId || cartonData.userId || null,
          creditos: normalizedMonto,
          cartonesGratis: normalizedCartonesGratis,
          segundoLugar: segundoLugarEfectivo,
          tipoRegistro: normalizedTipoRegistro,
          estado: 'REALIZADO',
          referencia: normalizedReferencia,
          origen: normalizedOrigen,
          source: normalizedSource,
          requestId: normalizedRequestId,
          procesadoPor: req.user?.email || '',
          procesadoEn: timestamp,
          fechaGestion,
          horaGestion,
          creadoEn: premioActual?.creadoEn || timestamp,
          actualizadoEn: timestamp
        },
        { merge: true }
      );

      tx.set(
        billeteraRef,
        {
          creditos: nuevosCreditos,
          CartonesGratis: nuevosCartones,
          actualizadoEn: timestamp
        },
        { merge: true }
      );

      if (emailVisible && emailVisible !== billeteraRef.id) {
        tx.set(
          db.collection('Billetera').doc(emailVisible),
          {
            creditos: nuevosCreditos,
            CartonesGratis: nuevosCartones,
            actualizadoEn: timestamp
          },
          { merge: true }
        );
      }

      tx.set(
        transaccionRef,
        {
          tipotrans: 'premio',
          origen: normalizedOrigen,
          Monto: normalizedMonto > 0 ? normalizedMonto : normalizedCartonesGratis,
          cartonesGratis: normalizedCartonesGratis,
          estado: 'REALIZADO',
          IDbilletera: emailVisible,
          emailVisible,
          fechasolicitud: '',
          horasolicitud: '',
          fechagestion: fechaGestion,
          horagestion: horaGestion,
          usuariogestor: req.user?.email || '',
          rolusuario: req.user?.role || '',
          referencia: normalizedReferencia,
          sorteoId: normalizedSorteoId,
          sorteoNombre,
          eventoGanadorId: normalizedEventoGanadorId,
          winnerKey: normalizedEventoGanadorId,
          tipoRegistro: normalizedTipoRegistro,
          segundoLugar: segundoLugarEfectivo,
          idBilleteraInterna: billeteraRef.id,
          source: normalizedSource,
          requestId: normalizedRequestId,
          processedBy: req.user?.email || '',
          executionMode: executionMode.mode,
          processedAt: timestamp,
          creadoEn: transaccionSnap.exists ? (transaccionSnap.data()?.creadoEn || timestamp) : timestamp,
          actualizadoEn: timestamp
        },
        { merge: true }
      );

      tx.set(
        premioProyeccionRef,
        {
          tipotrans: 'premio',
          estado: 'REALIZADO',
          IDbilletera: emailVisible,
          emailVisible,
          Monto: normalizedMonto > 0 ? normalizedMonto : normalizedCartonesGratis,
          cartonesGratis: normalizedCartonesGratis,
          sorteoId: normalizedSorteoId,
          sorteoNombre,
          eventoGanadorId: normalizedEventoGanadorId,
          winnerKey: normalizedEventoGanadorId,
          tipoRegistro: normalizedTipoRegistro,
          segundoLugar: segundoLugarEfectivo,
          idBilleteraInterna: billeteraRef.id,
          referencia: normalizedReferencia,
          origen: normalizedOrigen,
          source: normalizedSource,
          requestId: normalizedRequestId,
          processedBy: req.user?.email || '',
          executionMode: executionMode.mode,
          processedAt: timestamp,
          fechagestion: fechaGestion,
          horagestion: horaGestion,
          creadoEn: premioActual?.creadoEn || timestamp,
          actualizadoEn: timestamp
        },
        { merge: true }
      );

      tx.set(
        resumenProyeccionRef,
        {
          creditos: nuevosCreditos,
          CartonesGratis: nuevosCartones,
          creditostransito: normalizeNumber(billeteraActual.creditostransito),
          ultimoPremio: {
            eventoGanadorId: normalizedEventoGanadorId,
            monto: normalizedMonto,
            cartonesGratis: normalizedCartonesGratis,
            fechaGestion,
            horaGestion
          },
          actualizadoEn: timestamp
        },
        { merge: true }
      );

      const auditoriaRef = db.collection('AcreditacionAuditoriaTecnica').doc(`${normalizedEventoGanadorId}__${normalizedRequestId}`);
      tx.set(
        auditoriaRef,
        {
          eventoGanadorId: normalizedEventoGanadorId,
          winnerKey: normalizedEventoGanadorId,
          sorteoId: normalizedSorteoId,
          cartonId: normalizedCartonId,
          formaIdx: normalizedFormaIdx,
          requestId: normalizedRequestId,
          source: normalizedSource,
          processedBy: req.user?.email || '',
          executionMode: executionMode.mode,
          role: req.user?.role || '',
          billeteraId: emailVisible,
          emailVisible,
          billeteraInternaId: billeteraRef.id,
          monto: normalizedMonto,
          cartonesGratis: normalizedCartonesGratis,
          processedAt: timestamp
        },
        { merge: true }
      );

      return {
        status: 'ok',
        idempotent: false,
        premioId: normalizedEventoGanadorId,
        billeteraId: emailVisible,
        billeteraInternaId: billeteraRef.id,
        emailVisible,
        requestId: normalizedRequestId,
        executionMode: executionMode.mode
      };
    });

    return res.json(result);
  } catch (error) {
    if (error.message === 'SORTEO_NO_EXISTE') {
      return res.status(404).json({ error: 'No existe el sorteo indicado.' });
    }
    if (error.message === 'SORTEO_ESTADO_INVALIDO') {
      return res.status(409).json({ error: 'El sorteo no está en estado elegible para acreditar premios.' });
    }
    if (error.message === 'SORTEO_CORTE_CERRADO') {
      return res.status(409).json({ error: 'El sorteo ya tiene corte de premios cerrado.' });
    }
    if (error.message === 'CARTON_NO_EXISTE' || error.message === 'CARTON_NO_PERTENECE_SORTEO') {
      return res.status(409).json({ error: 'El cartón no es elegible para el sorteo indicado.' });
    }
    if (error.message === 'BILLETERA_NO_IDENTIFICABLE') {
      return res.status(409).json({ error: 'No se pudo resolver la billetera destino del premio.' });
    }

    console.error('Error acreditando premio por evento', error);
    return res.status(500).json({ error: 'Error acreditando premio', message: error.message });
  }
}

app.post('/acreditarPremioEvento', verificarOperadorPrivilegiado, acreditarPremioEventoHandler);

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
  deleteCollectionBySorteoId,
  deleteDocumentById,
  countCollectionBySorteoId,
  countDocumentById,
  getPurgeCounts,
  isSorteoEligibleForAutoPrize,
  buildPremioDocId,
  extractEventoGanadorIdComponents,
  resolveWinnerIdentity,
  getAcreditacionExecutionMode,
  acreditarPremioEventoHandler
};
