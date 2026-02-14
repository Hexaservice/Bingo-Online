const fs = require('fs');

describe('billetera.html - render seguro de transacciones', () => {
  const html = fs.readFileSync('public/billetera.html', 'utf8');

  test('no usa innerHTML con datos dinámicos de transacciones para construir filas', () => {
    expect(html).not.toMatch(/tr\.innerHTML\s*=\s*`<td>\$\{n\}/);
  });

  test('construye celdas con createElement + textContent', () => {
    expect(html).toMatch(/const td = document\.createElement\('td'\);/);
    expect(html).toMatch(/td\.textContent = celda\.texto;/);
    expect(html).toMatch(/tr\.appendChild\(td\);/);
  });
});
