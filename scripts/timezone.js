async function initFechaHora(idElemento = "fecha-hora") {
  const el = document.getElementById(idElemento);
  if (!el) return;

  try {
    const doc = await db.collection('Variablesglobales').doc('Parametros').get();
    if (!doc.exists) throw new Error('Documento Parametros no existe');

    const { Pais = '', ZonaHoraria = '' } = doc.data();

    const locales = {
      Venezuela: 'es-VE',
      España: 'es-ES',
      Mexico: 'es-MX',
      Colombia: 'es-CO',
      Argentina: 'es-AR'
    };
    const locale = locales[Pais] || 'es-ES';

    let diferencia = 0;

    async function sincronizar() {
      if (!ZonaHoraria) {
        diferencia = 0;
        return;
      }
      try {
        const resp = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(ZonaHoraria)}`);
        if (!resp.ok) throw new Error('Respuesta no válida');
        const data = await resp.json();
        const serverDate = new Date(data.datetime);
        if (!isNaN(serverDate)) {
          diferencia = serverDate.getTime() - Date.now();
        } else {
          diferencia = 0;
        }
      } catch (err) {
        console.error('Error obteniendo hora del servidor', err);
        diferencia = 0;
      }
    }

    function mostrar() {
      const ahora = new Date(Date.now() + diferencia);
      const opcionesFecha = { year: 'numeric', month: 'long', day: 'numeric', timeZone: ZonaHoraria };
      const opcionesHora = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: ZonaHoraria };
      try {
        const fechaStr = ahora.toLocaleDateString(locale, opcionesFecha);
        const horaStr = ahora.toLocaleTimeString(locale, opcionesHora);
        el.textContent = `${Pais}${Pais ? ', ' : ''}${fechaStr}, ${horaStr}`;
      } catch (err) {
        console.error('Error formateando fecha/hora', err);
        el.textContent = Pais;
      }
    }

    await sincronizar();
    mostrar();
    setInterval(mostrar, 1000);
    setInterval(sincronizar, 3600000);
  } catch (e) {
    console.error('Error obteniendo parámetros', e);
    setTimeout(() => initFechaHora(idElemento), 60000);
  }
}
