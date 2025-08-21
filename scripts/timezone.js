async function initFechaHora(idElemento = "fecha-hora") {
  try {
    const doc = await db.collection('Variablesglobales').doc('Parametros').get();
    if (!doc.exists) return;

    const { Pais = '', ZonaHoraria } = doc.data();
    const el = document.getElementById(idElemento);
    if (!el) return;

    let diferencia = 0;

    async function sincronizar() {
      try {
        if (!ZonaHoraria) {
          diferencia = 0;
          return;
        }

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
      const opcionesFecha = { year: 'numeric', month: 'long', day: 'numeric' };
      const opcionesHora = { hour: '2-digit', minute: '2-digit', hour12: true };
      if (ZonaHoraria) {
        opcionesFecha.timeZone = ZonaHoraria;
        opcionesHora.timeZone = ZonaHoraria;
      }
      const fechaStr = ahora.toLocaleDateString('es-ES', opcionesFecha);
      const horaStr = ahora.toLocaleString('en-US', opcionesHora).toLowerCase();
      el.textContent = `${Pais}, ${fechaStr}, ${horaStr}`;
    }

    await sincronizar();
    mostrar();
    setInterval(mostrar, 1000);
    setInterval(sincronizar, 3600000);
  } catch (e) {
    console.error('Error obteniendo parámetros', e);
  }
}
