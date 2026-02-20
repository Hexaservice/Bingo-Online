jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn()
}));

describe('uploadServer utilidades de acreditación', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('isSorteoEligibleForAutoPrize permite estados operativos y transicionales válidos', () => {
    const { isSorteoEligibleForAutoPrize } = require('../uploadServer.js');

    expect(isSorteoEligibleForAutoPrize({ estado: 'Jugando', premiosCorteCerrado: false })).toBe(true);
    expect(isSorteoEligibleForAutoPrize({ estado: 'FINALIZADO', premiosCorteCerrado: false })).toBe(true);
    expect(isSorteoEligibleForAutoPrize({ estado: 'sellado', premiosCorteCerrado: false })).toBe(true);
    expect(isSorteoEligibleForAutoPrize({ estado: 'Finalizando', premiosCorteCerrado: false })).toBe(true);
  });

  test('isSorteoEligibleForAutoPrize rechaza estados incompatibles y corte cerrado', () => {
    const { isSorteoEligibleForAutoPrize } = require('../uploadServer.js');

    expect(isSorteoEligibleForAutoPrize({ estado: 'Activo', premiosCorteCerrado: false })).toBe(false);
    expect(isSorteoEligibleForAutoPrize({ estado: 'Inactivo', premiosCorteCerrado: false })).toBe(false);
    expect(isSorteoEligibleForAutoPrize({ estado: 'Archivado', premiosCorteCerrado: false })).toBe(false);
    expect(isSorteoEligibleForAutoPrize({ estado: 'Jugando', premiosCorteCerrado: true })).toBe(false);
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

  test('extractEventoGanadorIdComponents obtiene sorteo, forma y carton', () => {
    const { extractEventoGanadorIdComponents } = require('../uploadServer.js');

    expect(extractEventoGanadorIdComponents('segundo__sorteo_a__f3__carton_77')).toEqual({
      sorteoId: 'sorteo_a',
      formaIdx: 3,
      cartonId: 'carton_77'
    });
    expect(extractEventoGanadorIdComponents('invalido')).toBeNull();
  });
});
