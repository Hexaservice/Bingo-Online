// Datos globales de la hora del servidor
const serverTime = {
  Pais: '',
  locale: 'es-ES',
  zonaIana: '',
  diferencia: 0
};

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
  if (serverTime.zonaIana) return; // ya inicializado
  try {
    const doc = await db.collection('Variablesglobales').doc('Parametros').get();
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
    serverTime.zonaIana = parseZona(ZonaHoraria);
    await sincronizarHora();
    setInterval(sincronizarHora, 3600000);
  } catch (e) {
    console.error('Error obteniendo parámetros', e);
  }
}

function obtenerFecha() {
  const d = new Date(Date.now() + serverTime.diferencia);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function limpiarMeridiano(valor = '') {
  return valor.replace(/\s*a\.?\s*m\.?/ig, ' AM').replace(/\s*p\.?\s*m\.?/ig, ' PM');
}

function obtenerHora() {
  const d = new Date(Date.now() + serverTime.diferencia);
  const hora = d.toLocaleTimeString(serverTime.locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: serverTime.zonaIana
  });
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
      fechaSpan.textContent = `📅 ${fechaStr}`;
      el.appendChild(fechaSpan);
      el.appendChild(document.createTextNode(' '));
      const horaSpan = document.createElement('span');
      horaSpan.className = 'hora-actual-icono';
      horaSpan.textContent = `⏰ ${horaStr}`;
      el.appendChild(horaSpan);
    } catch (err) {
      console.error('Error formateando fecha/hora', err);
      el.textContent = '';
    }
  }

  mostrar();
  setInterval(mostrar, 1000);
}

window.initServerTime = initServerTime;
window.fechaServidor = obtenerFecha;
window.horaServidor = obtenerHora;
window.initFechaHora = initFechaHora;
