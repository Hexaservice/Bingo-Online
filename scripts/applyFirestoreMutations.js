#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function loadMutationFile(filePath) {
  const absPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`No existe el archivo de mutaciones: ${filePath}`);
  }

  const raw = fs.readFileSync(absPath, 'utf8');
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON inválido en ${filePath}: ${error.message}`);
  }

  if (!Array.isArray(payload.mutations) || payload.mutations.length === 0) {
    throw new Error(`El archivo ${filePath} debe incluir un arreglo "mutations" con al menos 1 elemento.`);
  }

  return payload;
}

function initializeFirebase() {
  if (admin.apps.length > 0) return;
  admin.initializeApp();
}

function validateMutation(mutation, index, sourceFile) {
  if (!mutation || typeof mutation !== 'object') {
    throw new Error(`[${sourceFile}] mutations[${index}] no es un objeto válido.`);
  }

  const { op, path: docPath } = mutation;
  if (!docPath || typeof docPath !== 'string' || !docPath.includes('/')) {
    throw new Error(`[${sourceFile}] mutations[${index}] requiere "path" con formato collection/document.`);
  }

  if (!['set', 'update', 'delete'].includes(op)) {
    throw new Error(`[${sourceFile}] mutations[${index}] op inválido. Usa set, update o delete.`);
  }

  if ((op === 'set' || op === 'update') && (typeof mutation.data !== 'object' || mutation.data === null || Array.isArray(mutation.data))) {
    throw new Error(`[${sourceFile}] mutations[${index}] requiere "data" objeto para op=${op}.`);
  }
}

async function applyMutation(db, mutation) {
  const ref = db.doc(mutation.path);
  if (mutation.op === 'delete') {
    await ref.delete();
    return { op: 'delete', path: mutation.path };
  }

  if (mutation.op === 'set') {
    const merge = mutation.merge !== false;
    await ref.set(mutation.data, { merge });
    return { op: 'set', path: mutation.path, merge };
  }

  await ref.update(mutation.data);
  return { op: 'update', path: mutation.path };
}

async function run() {
  const args = parseArgs(process.argv);
  const filesArg = args.files || args.file;

  if (!filesArg) {
    throw new Error('Debes indicar --files con rutas separadas por coma.');
  }

  const files = filesArg
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  initializeFirebase();
  const db = admin.firestore();

  for (const filePath of files) {
    const payload = loadMutationFile(filePath);
    const author = payload.author || 'desconocido';
    const ticket = payload.ticket || 'sin-ticket';
    console.log(`Procesando ${filePath} (author=${author}, ticket=${ticket})`);

    for (let i = 0; i < payload.mutations.length; i += 1) {
      const mutation = payload.mutations[i];
      validateMutation(mutation, i, filePath);
      const result = await applyMutation(db, mutation);
      console.log(`✔ ${result.op} ${result.path}`);
    }
  }
}

run().catch((error) => {
  console.error(`Error aplicando mutaciones de Firestore: ${error.message}`);
  process.exit(1);
});
