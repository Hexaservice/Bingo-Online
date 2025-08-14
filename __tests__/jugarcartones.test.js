const fs = require('fs');
const {JSDOM} = require('jsdom');

test('auth.onAuthStateChanged espera cargarSorteosActivos', () => {
  const html = fs.readFileSync('jugarcartones.html', 'utf8');
  expect(html).toMatch(/auth\.onAuthStateChanged\(async user=>{[\s\S]*await cargarSorteosActivos\(\);/);
});

test('existe un menú desplegable de sorteos', () => {
  const html = fs.readFileSync('jugarcartones.html', 'utf8');
  expect(html).toMatch(/<select id=\"sorteo-select\">/);
});

test('al seleccionar un sorteo se actualiza el menú', () => {
  const html = fs.readFileSync('jugarcartones.html', 'utf8');
  const dom = new JSDOM(html, {runScripts: 'outside-only'});
  const {window} = dom;
  const document = window.document;

  window.ensureAuth = () => {};
  window.auth = {onAuthStateChanged: () => {}};
  window.db = {};
  window.setInterval = () => {};
  window.alert = () => {};

  const script = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1];
  window.eval(script);

  window.resetForma = () => {};
  window.iniciarIntervalo = () => {};
  window.actualizarCartonesJugador = () => {};
  window.cargarFormasSorteo = () => {};
  window.formatearFecha = f => f;
  window.formatearHora = h => h;

  const select = document.getElementById('sorteo-select');
  const opt = document.createElement('option');
  opt.value='s1';
  select.appendChild(opt);

  window.seleccionarSorteo({id:'s1',nombre:'Sorteo Demo',fecha:'2024-01-01',hora:'12:00',tipo:'Sorteo Diario'});

  expect(select.value).toBe('s1');
});

test('cargarSorteosActivos carga opciones y permite seleccionar', async () => {
  const html = fs.readFileSync('jugarcartones.html', 'utf8');
  const dom = new JSDOM(html, {runScripts: 'outside-only'});
  const {window} = dom;
  const document = window.document;

  window.ensureAuth = () => {};
  window.auth = {onAuthStateChanged: () => {}};
  window.db = {
    collection: () => ({
      where: () => ({
        async get() {
          return {
            forEach(cb) {
              cb({id:'s1', data: () => ({nombre:'Sorteo Demo',fecha:'2024-01-01',hora:'12:00',tipo:'Sorteo Diario'})});
            }
          };
        }
      })
    })
  };
  window.setInterval = () => {};
  window.alert = () => {};

  const script = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1];
  window.eval(script);

  window.resetForma = () => {};
  window.iniciarIntervalo = () => {};
  window.actualizarCartonesJugador = () => {};
  window.cargarFormasSorteo = () => {};
  window.formatearFecha = f => f;
  window.formatearHora = h => h;

  await window.cargarSorteosActivos();
  const option = document.querySelector('#sorteo-select option[value="s1"]');
  expect(option).not.toBeNull();
  document.getElementById('sorteo-select').value='s1';
  document.getElementById('sorteo-select').dispatchEvent(new window.Event('change'));
  expect(document.getElementById('sorteo-select').value).toBe('s1');
});
