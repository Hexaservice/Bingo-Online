const { resolveRoleFromClaims, resolveRoleFromUserDoc } = require('../public/js/auth-role-utils');

describe('auth-role-utils', () => {
  test('resolveRoleFromClaims usa claim role cuando existe', () => {
    expect(resolveRoleFromClaims({ role: 'Administrador' })).toBe('Administrador');
  });

  test('resolveRoleFromClaims usa primer rol válido en roles[]', () => {
    expect(resolveRoleFromClaims({ roles: ['Colaborador', 'Jugador'] })).toBe('Colaborador');
  });

  test('resolveRoleFromClaims retorna null cuando no hay rol válido', () => {
    expect(resolveRoleFromClaims({ roles: [null, 1] })).toBeNull();
    expect(resolveRoleFromClaims({})).toBeNull();
  });

  test('resolveRoleFromUserDoc retorna role del documento o Jugador por defecto', () => {
    expect(resolveRoleFromUserDoc({ role: 'Superadmin' })).toBe('Superadmin');
    expect(resolveRoleFromUserDoc({})).toBe('Jugador');
  });
});
