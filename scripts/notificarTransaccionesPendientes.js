require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { enviarCorreo } = require('../services/email');

function resolverRutaCredenciales() {
  const rutaConfigurada = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'serviceAccountKey.json';
  const rutaResuelta = path.isAbsolute(rutaConfigurada)
    ? rutaConfigurada
    : path.resolve(process.cwd(), rutaConfigurada);
  if (!fs.existsSync(rutaResuelta)) {
    throw new Error(`No se encontró el archivo de credenciales en: ${rutaResuelta}`);
  }
  return rutaResuelta;
}

function inicializarFirebase() {
  if (admin.apps.length) {
    return;
  }
  const rutaCredenciales = resolverRutaCredenciales();
  const credenciales = require(rutaCredenciales);
  admin.initializeApp({
    credential: admin.credential.cert(credenciales),
  });
}

function formatearMonto(transaccion) {
  const { Monto, monto, valor, MontoSolicitado } = transaccion;
  const cantidad = Monto ?? monto ?? valor ?? MontoSolicitado;
  if (typeof cantidad === 'number') {
    return cantidad.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
  }
  if (cantidad == null) {
    return 'Monto no disponible';
  }
  return cantidad.toString();
}

function construirDetalle(titulo, transacciones) {
  if (!transacciones.length) {
    return { html: '', texto: '' };
  }
  const elementosHtml = transacciones
    .map(({ id, data }) => {
      const billetera = data.IDbilletera || data.billetera || 'Sin billetera';
      const monto = formatearMonto(data);
      return `<li><strong>${id}</strong> • ${billetera} • ${monto}</li>`;
    })
    .join('');

  const elementosTexto = transacciones
    .map(({ id, data }) => {
      const billetera = data.IDbilletera || data.billetera || 'Sin billetera';
      const monto = formatearMonto(data);
      return `- ${id} • ${billetera} • ${monto}`;
    })
    .join('\n');

  return {
    html: `<h3>${titulo}</h3><ul>${elementosHtml}</ul>`,
    texto: `${titulo}:\n${elementosTexto}`,
  };
}

async function obtenerTransaccionesPendientes(db) {
  const snapshot = await db
    .collection('transacciones')
    .where('estado', '==', 'PENDIENTE')
    .where('tipotrans', 'in', ['deposito', 'retiro'])
    .get();

  const depositos = [];
  const retiros = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const tipo = (data.tipotrans || '').toLowerCase();
    const agrupador = { id: doc.id, data };
    if (tipo === 'deposito') {
      depositos.push(agrupador);
    }
    if (tipo === 'retiro') {
      retiros.push(agrupador);
    }
  });

  return { depositos, retiros };
}

async function obtenerDestinatarios(db) {
  const snapshot = await db
    .collection('users')
    .where('role', 'in', ['Colaborador', 'Superadmin'])
    .get();

  const correos = new Set();
  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const correo = data.email || doc.id;
    if (correo) {
      correos.add(correo);
    }
  });

  return Array.from(correos);
}

async function enviarNotificacion({ depositos, retiros }, destinatarios) {
  const totalPendientes = depositos.length + retiros.length;
  if (!totalPendientes) {
    console.log('No hay depósitos o retiros pendientes. No se enviará ningún correo.');
    return;
  }

  if (!destinatarios.length) {
    console.warn('No se encontraron usuarios con rol Colaborador o Superadmin para notificar.');
    return;
  }

  const detalleDepositos = construirDetalle('Depósitos pendientes', depositos);
  const detalleRetiros = construirDetalle('Retiros pendientes', retiros);

  const resumenHtml = `
    <p>Se detectaron ${depositos.length} depósito(s) y ${retiros.length} retiro(s) en estado <strong>PENDIENTE</strong>.</p>
    ${detalleDepositos.html}
    ${detalleRetiros.html}
    <p>Ingresa al panel de administración para gestionarlos.</p>
  `;

  const resumenTexto = [
    `Se detectaron ${depositos.length} depósito(s) y ${retiros.length} retiro(s) en estado PENDIENTE.`,
    detalleDepositos.texto,
    detalleRetiros.texto,
    'Ingresa al panel de administración para gestionarlos.',
  ]
    .filter(Boolean)
    .join('\n\n');

  await enviarCorreo({
    to: destinatarios,
    subject: 'Transacciones pendientes por gestionar',
    html: resumenHtml,
    text: resumenTexto,
  });

  console.log(`Correo enviado a ${destinatarios.length} destinatario(s).`);
}

async function main() {
  try {
    inicializarFirebase();
    const db = admin.firestore();
    const [transacciones, destinatarios] = await Promise.all([
      obtenerTransaccionesPendientes(db),
      obtenerDestinatarios(db),
    ]);

    await enviarNotificacion(transacciones, destinatarios);
  } catch (error) {
    console.error('Error enviando la notificación de transacciones pendientes:', error);
    process.exitCode = 1;
  } finally {
    await admin.app().delete().catch(() => {});
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
