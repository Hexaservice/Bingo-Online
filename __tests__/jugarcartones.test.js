const fs = require('fs');

test('auth.onAuthStateChanged espera cargarSorteosActivos', () => {
  const html = fs.readFileSync('jugarcartones.html', 'utf8');
  expect(html).toMatch(/auth\.onAuthStateChanged\(async user=>{[\s\S]*await cargarSorteosActivos\(\);/);
});

test('abrirSorteosModal carga sorteos si lista vacía', () => {
  const html = fs.readFileSync('jugarcartones.html', 'utf8');
  expect(html).toMatch(/async function abrirSorteosModal\(\)[\s\S]*const list=document.getElementById\('sorteos-list'\);[\s\S]*if\(!list.querySelector\('input\[type="radio"\]'\)\)[\s\S]*await cargarSorteosActivos\(\);/);
});
