const admin = require('firebase-admin');

// Verificar variable de entorno para credenciales
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Falta la variable de entorno GOOGLE_APPLICATION_CREDENTIALS');
  process.exit(1);
}

// Inicializa Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const rawDatabaseId = (process.env.FIRESTORE_DATABASE_ID || '').trim();
const databaseId = /^(default|\(default\))$/i.test(rawDatabaseId) ? '' : rawDatabaseId;
const app = admin.app();
const db = databaseId ? admin.firestore(app, databaseId) : admin.firestore(app);

// ----- Lógica de sincronización de hora (adaptado de public/js/timezone.js) -----
const serverTime = { zonaIana: '', diferencia: 0 };

function parseZona(zona) {
  const match = zona.match(/^UTC([+-])(\d{2}):(\d{2})$/);
  if (match) {
    const sign = match[1] === '-' ? '+' : '-';
    const h = String(parseInt(match[2], 10));
    return `Etc/GMT${sign}${h}`;
  }
  return zona;
}

async function sincronizarHora() {
  if (!serverTime.zonaIana) {
    serverTime.diferencia = 0;
    return;
  }
  try {
    const resp = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(serverTime.zonaIana)}`);
    if (!resp.ok) throw new Error('Respuesta no válida');
    const data = await resp.json();
    const serverDate = new Date(data.datetime);
    if (!isNaN(serverDate)) {
      serverTime.diferencia = serverDate.getTime() - Date.now();
    } else {
      serverTime.diferencia = 0;
    }
  } catch (err) {
    console.error('Error obteniendo hora del servidor', err);
    serverTime.diferencia = 0;
  }
}

async function initServerTime() {
  try {
    const doc = await db.collection('Variablesglobales').doc('Parametros').get();
    if (!doc.exists) throw new Error('Documento Parametros no existe');
    const { ZonaHoraria = '' } = doc.data();
    serverTime.zonaIana = parseZona(ZonaHoraria);
    await sincronizarHora();
    setInterval(sincronizarHora, 3600000);
  } catch (e) {
    console.error('Error obteniendo parámetros', e);
  }
}

function obtenerHoraDesdeTexto(valor) {
  if (!valor) return null;
  if (typeof valor === 'number' && !isNaN(valor)) return null;
  if (typeof valor === 'object') {
    if (valor instanceof Date) {
      return { hora: valor.getHours(), minuto: valor.getMinutes() };
    }
    if (typeof valor.seconds === 'number') {
      const fecha = new Date(valor.seconds * 1000);
      return { hora: fecha.getHours(), minuto: fecha.getMinutes() };
    }
    if (typeof valor.toDate === 'function') {
      const fecha = valor.toDate();
      return { hora: fecha.getHours(), minuto: fecha.getMinutes() };
    }
  }
  const original = valor.toString().trim();
  if (!original) return null;
  if (!/[0-9]:/.test(original) && !/[ap]\.?m\.?/i.test(original) && /^\d+$/.test(original)) {
    return null;
  }
  const texto = original.toLowerCase();
  let sufijo = null;
  if (/p\s*\.?m\.?/.test(texto)) sufijo = 'pm';
  if (/a\s*\.?m\.?/.test(texto)) sufijo = 'am';
  const limpio = texto.replace(/[^0-9:]/g, '');
  if (!limpio) return null;
  const partes = limpio.split(':');
  let horas = parseInt(partes[0] || '0', 10);
  const minutos = parseInt((partes[1] || '0').slice(0, 2), 10);
  if (isNaN(horas) || isNaN(minutos)) return null;
  if (sufijo === 'pm' && horas < 12) horas += 12;
  if (sufijo === 'am' && horas === 12) horas = 0;
  return { hora: horas, minuto: minutos };
}

function obtenerFechaHoraCierre(d, sorteoDate) {
  if (!(sorteoDate instanceof Date) || isNaN(sorteoDate.getTime())) return null;
  const posibles = ['horacierre', 'horaCierre', 'hora_cierre', 'cierre', 'cierreHora', 'cierrehora'];
  for (const clave of posibles) {
    const valor = d?.[clave];
    if (valor !== undefined && valor !== null && valor !== '') {
      const info = obtenerHoraDesdeTexto(valor);
      if (info) {
        const fecha = new Date(sorteoDate.getFullYear(), sorteoDate.getMonth(), sorteoDate.getDate(), info.hora, info.minuto, 0, 0);
        if (!isNaN(fecha.getTime())) return fecha;
      }
    }
  }
  const cierreMin = parseInt(d?.cierreMinutos || 0, 10);
  if (!isNaN(cierreMin) && cierreMin > 0) {
    return new Date(sorteoDate.getTime() - cierreMin * 60000);
  }
  return null;
}

// ----- Lógica de actualización de estados -----
async function actualizarEstadosSorteos() {
  if (!serverTime.zonaIana) await initServerTime();
  const ahora = new Date(Date.now() + serverTime.diferencia);
  try {
    const snap = await db.collection('sorteos').where('estado', 'in', ['Activo', 'Sellado']).get();
    const updates = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (!d.fecha || !d.hora) return;
      const [dia, mes, anio] = d.fecha.split('/').map(n => parseInt(n, 10));
      const [hor, min] = d.hora.split(':').map(n => parseInt(n, 10));
      const sorteoDate = new Date(anio, mes - 1, dia, hor, min);
      if (isNaN(sorteoDate.getTime())) return;
      const cierreDate = obtenerFechaHoraCierre(d, sorteoDate);
      if (d.estado === 'Activo') {
        if (ahora >= sorteoDate) {
          updates.push(doc.ref.update({ estado: 'Jugando' }));
        } else if (cierreDate && ahora >= cierreDate) {
          updates.push(doc.ref.update({ estado: 'Sellado' }));
        }
      } else if (d.estado === 'Sellado' && ahora >= sorteoDate) {
        updates.push(doc.ref.update({ estado: 'Jugando' }));
      }
    });
    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`Actualizados ${updates.length} sorteos a las ${ahora.toISOString()}`);
    }
  } catch (e) {
    console.error('Error actualizando estados de sorteos', e);
  }
}

async function main() {
  await initServerTime();
  await actualizarEstadosSorteos();
  setInterval(actualizarEstadosSorteos, 60000);
}

main().catch(e => {
  console.error('Error en el proceso de actualización', e);
  process.exit(1);
});

