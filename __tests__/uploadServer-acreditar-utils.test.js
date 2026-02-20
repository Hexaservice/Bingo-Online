jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn()
}));

describe('uploadServer utilidades de acreditación', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('canAccreditForSorteoState permite solo Jugando y Finalizado', () => {
    const { canAccreditForSorteoState } = require('../uploadServer.js');

    expect(canAccreditForSorteoState('Jugando')).toBe(true);
    expect(canAccreditForSorteoState('FINALIZADO')).toBe(true);
    expect(canAccreditForSorteoState('Activo')).toBe(false);
    expect(canAccreditForSorteoState('Sellado')).toBe(false);
  });

  test('buildPremioDocId genera id sanitizado y estable', () => {
    const { buildPremioDocId } = require('../uploadServer.js');

    const id = buildPremioDocId({
      sorteoId: 'sorteo 1',
      formaIdx: 2,
      cartonId: 'carton/abc',
      prefijo: 'auto premio'
    });

    expect(id).toBe('auto_premio__sorteo_1__f2__carton_abc');
  });
});
