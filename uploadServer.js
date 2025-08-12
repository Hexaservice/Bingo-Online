const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

// Inicializa Firebase Admin sin silenciar errores
if (!admin.apps.length) {
  admin.initializeApp();
}

const app = express();
app.use(cors());

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: 'No autorizado' });
  try {
    await admin.auth().verifyIdToken(match[1]);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

app.post('/upload', verificarToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servicio de subida escuchando en puerto ${PORT}`);
});
