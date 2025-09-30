const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const admin = require('firebase-admin');

// Verificar variables de entorno necesarias antes de inicializar Firebase
const requiredEnv = ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_STORAGE_BUCKET'];
for (const name of requiredEnv) {
  if (!process.env[name]) {
    console.error(`Falta la variable de entorno ${name}`);
    process.exit(1);
  }
}

// Inicializa Firebase Admin especificando el bucket de Storage
if (!admin.apps.length) {
  admin.initializeApp({
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

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

app.post('/upload', verificarToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
  try {
    const bucket = admin.storage().bucket();
    const fileName = `${Date.now()}${path.extname(req.file.originalname)}`;
    const file = bucket.file(fileName);
    await file.save(req.file.buffer, { contentType: req.file.mimetype });
    await file.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    res.json({ url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al subir archivo', message: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servicio de subida escuchando en puerto ${PORT}`);
});
