const fs = require('fs');

test('auth.onAuthStateChanged espera cargarSorteosActivos', () => {
  const html = fs.readFileSync('jugarcartones.html', 'utf8');
  expect(html).toMatch(/auth\.onAuthStateChanged\(async user=>{[\s\S]*await cargarSorteosActivos\(\);/);
});

test('abrirSorteosModal carga sorteos si lista vacía', () => {
  const html = fs.readFileSync('jugarcartones.html', 'utf8');
  expect(html).toMatch(/async function abrirSorteosModal\(\)[\s\S]*if\(sorteosActivos.length===0\)[\s\S]*await cargarSorteosActivos\(\);/);
});
