const fs = require('fs');
const {JSDOM} = require('jsdom');

test('auth.onAuthStateChanged espera cargarSorteosActivos', () => {
  const html = fs.readFileSync('jugarcartones.html', 'utf8');
  expect(html).toMatch(/auth\.onAuthStateChanged\(async user=>{[\s\S]*await cargarSorteosActivos\(\);/);
});

test('abrirSorteosModal carga sorteos si lista vacía', () => {
  const html = fs.readFileSync('jugarcartones.html', 'utf8');
  expect(html).toMatch(/async function abrirSorteosModal\(\)[\s\S]*const list=document.getElementById\('sorteos-list'\);[\s\S]*if\(list.children.length===0\)[\s\S]*await cargarSorteosActivos\(\);/);
});

test('al seleccionar un sorteo se actualiza el botón', () => {
  const html = fs.readFileSync('jugarcartones.html', 'utf8');
  const dom = new JSDOM(html, {runScripts: 'outside-only'});
  const {window} = dom;
  const document = window.document;

  window.ensureAuth = () => {};
  window.auth = {onAuthStateChanged: () => {}};
  window.db = {};
  window.sorteosModal = {close: () => {}, showModal: () => {}};
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

  window.seleccionarSorteo({id:'s1',nombre:'Sorteo Demo',fecha:'2024-01-01',hora:'12:00',tipo:'Sorteo Diario'});

  expect(document.getElementById('sorteo-btn').textContent).toBe('Sorteo Demo');
});

test('cargarSorteosActivos crea botones que actualizan el sorteo', async () => {
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
  window.sorteosModal = {close: () => {}, showModal: () => {}};
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
  const item = document.querySelector('#sorteos-list .sorteo-item');
  item.click();
  expect(document.getElementById('sorteo-btn').textContent).toBe('Sorteo Demo');
});
