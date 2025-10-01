const fs = require('fs');

test('player page should not call ensureAuth with specific role', () => {
  const html = fs.readFileSync('public/player.html', 'utf8');
  const match = html.match(/ensureAuth\(([^)]*)\)/);
  expect(match).not.toBeNull();
  const args = match[1].replace(/\s+/g, '');
  expect(args).toBe('');
});
