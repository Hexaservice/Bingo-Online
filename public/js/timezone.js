// Datos globales de la hora del servidor
const serverTime = {
  Pais: '',
  locale: 'es-ES',
  zonaIana: '',
  diferencia: 0,
  offsetMinutos: null,
  baseEpochMs: null,
  baseMonotonicMs: null,
  ultimaSync: null,
  origen: 'desconocido'
};

const IANA_OVERRIDES = {
  Venezuela: 'America/Caracas',
  Colombia: 'America/Bogota',
  Mexico: 'America/Mexico_City',
  España: 'Europe/Madrid',
  Argentina: 'America/Argentina/Buenos_Aires'
};

function obtenerOffsetMinutos(zona) {
  if (typeof zona !== 'string') return null;
  const match = zona.match(/UTC([+-])(\d{2}):(\d{2})/i);
  if (!match) return null;
  const horas = parseInt(match[2], 10);
  const minutos = parseInt(match[3], 10);
  if (Number.isNaN(horas) || Number.isNaN(minutos)) return null;
  const signo = match[1] === '-' ? 1 : -1;
  return signo * (horas * 60 + minutos);
}

function diferenciaPorOffset(offsetMinutos) {
  if (typeof offsetMinutos !== 'number' || Number.isNaN(offsetMinutos)) return 0;
  const localOffset = new Date().getTimezoneOffset();
  return (localOffset - offsetMinutos) * 60000;
}

function monotonicNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function fijarBaseTemporal(epochMs) {
  if (typeof epochMs !== 'number' || Number.isNaN(epochMs)) return;
  serverTime.baseEpochMs = epochMs;
  serverTime.baseMonotonicMs = monotonicNow();
  serverTime.ultimaSync = Date.now();
  serverTime.diferencia = epochMs - Date.now();
}

function obtenerEpochActual() {
  if (typeof serverTime.baseEpochMs === 'number' && typeof serverTime.baseMonotonicMs === 'number') {
    const transcurrido = monotonicNow() - serverTime.baseMonotonicMs;
    return serverTime.baseEpochMs + transcurrido;
  }
  return Date.now() + (serverTime.diferencia || 0);
}

function obtenerFechaServidor() {
  const epoch = obtenerEpochActual();
  return new Date(epoch);
}

async function obtenerEpochDesdeFirestore(database) {
  if (typeof firebase === 'undefined') return null;
  const fieldValue = firebase?.firestore?.FieldValue;
  if (!fieldValue || typeof fieldValue.serverTimestamp !== 'function') return null;
  try {
    const ref = database.collection('Variablesglobales').doc('HoraServidor');
    await ref.set({ ultimaSync: fieldValue.serverTimestamp() }, { merge: true });
    const snap = await ref.get({ source: 'server' });
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const marca = data.ultimaSync;
    if (marca && typeof marca.toMillis === 'function') {
      return marca.toMillis();
    }
  } catch (err) {
    console.error('No se pudo obtener la hora del servidor desde Firestore', err);
  }
  return null;
}

async function obtenerEpochServidor(database) {
  const epochFirestore = await obtenerEpochDesdeFirestore(database);
  if (typeof epochFirestore === 'number' && !Number.isNaN(epochFirestore)) {
    serverTime.origen = 'firestore';
    return epochFirestore;
  }
  serverTime.origen = 'offset';
  return null;
}

function parseZona(zona) {
  const match = zona.match(/^UTC([+-])(\d{2}):(\d{2})$/);
  if (match) {
    const sign = match[1] === '-' ? '+' : '-';
    const h = String(parseInt(match[2], 10));
    return `Etc/GMT${sign}${h}`;
  }
  return zona;
}

function obtenerOffsetDesdeIana(zona) {
  if (typeof zona !== 'string' || !zona) return null;
  try {
    const formato = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    const partes = formato.formatToParts(new Date());
    const nombreZona = partes.find(p => p.type === 'timeZoneName')?.value || '';
    const coincidencia = nombreZona.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
    if (!coincidencia) return null;
    const signo = coincidencia[1] === '-' ? 1 : -1;
    const horas = parseInt(coincidencia[2], 10);
    const minutos = coincidencia[3] ? parseInt(coincidencia[3], 10) : 0;
    if (Number.isNaN(horas) || Number.isNaN(minutos)) return null;
    return signo * (horas * 60 + minutos);
  } catch (err) {
    console.error('No se pudo calcular el offset de la zona IANA', err);
    return null;
  }
}

async function sincronizarHora() {
  let offsetUsado = serverTime.offsetMinutos;
  if (serverTime.zonaIana) {
    const offsetZona = obtenerOffsetDesdeIana(serverTime.zonaIana);
    if (offsetZona !== null) {
      offsetUsado = offsetZona;
      serverTime.offsetMinutos = offsetZona;
    }
  }
  const fallback = diferenciaPorOffset(offsetUsado);

  try {
    const database = await asegurarDb();
    const epochServidor = await obtenerEpochServidor(database);
    if (typeof epochServidor === 'number' && !Number.isNaN(epochServidor)) {
      fijarBaseTemporal(epochServidor);
      return;
    }
  } catch (err) {
    console.error('No se pudo sincronizar la hora con el servidor', err);
  }

  serverTime.diferencia = fallback;
  fijarBaseTemporal(Date.now() + fallback);
}

async function asegurarDb() {
  if (typeof db !== 'undefined' && db) {
    return db;
  }
  if (typeof initFirebase === 'function') {
    try {
      await initFirebase();
    } catch (err) {
      console.error('No se pudo inicializar Firebase antes de obtener la hora del servidor', err);
      throw err;
    }
  }
  if (typeof db === 'undefined' || !db) {
    throw new Error('Firestore no está disponible para obtener la hora del servidor');
  }
  return db;
}

async function initServerTime() {
  if (serverTime.zonaIana) return; // ya inicializado
  try {
    const database = await asegurarDb();
    const doc = await database.collection('Variablesglobales').doc('Parametros').get();
    if (!doc.exists) throw new Error('Documento Parametros no existe');
    const { Pais = '', ZonaHoraria = '' } = doc.data();
    serverTime.Pais = Pais;
    const locales = {
      Venezuela: 'es-VE',
      España: 'es-ES',
      Mexico: 'es-MX',
      Colombia: 'es-CO',
      Argentina: 'es-AR'
    };
    serverTime.locale = locales[Pais] || 'es-ES';
    serverTime.offsetMinutos = obtenerOffsetMinutos(ZonaHoraria);
    const override = IANA_OVERRIDES[Pais];
    const zonaNormalizada = override || parseZona(ZonaHoraria);
    serverTime.zonaIana = typeof zonaNormalizada === 'string' ? zonaNormalizada : '';
    await sincronizarHora();
    setInterval(sincronizarHora, 300000);
  } catch (e) {
    console.error('Error obteniendo parámetros', e);
  }
}

function obtenerFecha() {
  const opciones = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  const fechaBase = obtenerFechaServidor();
  const formatter = new Intl.DateTimeFormat(serverTime.locale || 'es-ES', {
    ...opciones,
    ...(serverTime.zonaIana ? { timeZone: serverTime.zonaIana } : {})
  });
  return formatter.format(fechaBase);
}

function limpiarMeridiano(valor = '') {
  return valor.replace(/\s*a\.?\s*m\.?/ig, ' AM').replace(/\s*p\.?\s*m\.?/ig, ' PM');
}

function obtenerHora() {
  const opciones = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  if (serverTime.zonaIana) opciones.timeZone = serverTime.zonaIana;
  const d = obtenerFechaServidor();
  const hora = d.toLocaleTimeString(serverTime.locale, opciones);
  return limpiarMeridiano(hora);
}

async function initFechaHora(idElemento = "fecha-hora") {
  await initServerTime();
  const el = document.getElementById(idElemento);
  if (!el) return;

  function mostrar() {
    try {
      const fechaStr = obtenerFecha();
      const horaStr = obtenerHora();
      el.textContent = '';
      if (serverTime.Pais) {
        const paisSpan = document.createElement('span');
        paisSpan.className = 'pais-actual';
        paisSpan.textContent = `${serverTime.Pais} |`;
        el.appendChild(paisSpan);
        el.appendChild(document.createTextNode(' '));
      }
      const fechaSpan = document.createElement('span');
      fechaSpan.className = 'fecha-actual-icono';
      fechaSpan.textContent = fechaStr;
      el.appendChild(fechaSpan);
      el.appendChild(document.createTextNode(' '));
      const horaSpan = document.createElement('span');
      horaSpan.className = 'hora-actual-icono';
      horaSpan.textContent = horaStr;
      el.appendChild(horaSpan);
    } catch (err) {
      console.error('Error formateando fecha/hora', err);
      el.textContent = '';
    }
  }

  mostrar();
  setInterval(mostrar, 1000);
}

if (typeof window !== 'undefined') {
  window.serverTime = serverTime;
}

window.initServerTime = initServerTime;
window.fechaServidor = obtenerFecha;
window.horaServidor = obtenerHora;
window.initFechaHora = initFechaHora;
serverTime.now = function () {
  return obtenerFechaServidor();
};
serverTime.nowMs = function () {
  return obtenerEpochActual();
};
serverTime.serverTimestamp = function () {
  if (typeof firebase === 'undefined') return null;
  const fieldValue = firebase?.firestore?.FieldValue;
  if (fieldValue && typeof fieldValue.serverTimestamp === 'function') {
    return fieldValue.serverTimestamp();
  }
  return null;
};
