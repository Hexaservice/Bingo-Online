const EstadosPagoPremio = require('../public/js/estadoPagoPremio.js');

describe('EstadosPagoPremio normalización e interpretación', () => {
  test('normaliza APROBADO como REALIZADO en lectura', () => {
    expect(EstadosPagoPremio.normalizarLectura('APROBADO')).toBe('REALIZADO');
    expect(EstadosPagoPremio.normalizarLectura('realizado')).toBe('REALIZADO');
  });

  test('estaFinalizado reconoce APROBADO y REALIZADO', () => {
    expect(EstadosPagoPremio.estaFinalizado('APROBADO')).toBe(true);
    expect(EstadosPagoPremio.estaFinalizado('REALIZADO')).toBe(true);
    expect(EstadosPagoPremio.estaFinalizado('PENDIENTE')).toBe(false);
  });

  test('validarParaGuardar solo permite estados canónicos', () => {
    expect(EstadosPagoPremio.validarParaGuardar('REALIZADO')).toBe('REALIZADO');
    expect(() => EstadosPagoPremio.validarParaGuardar('APROBADO')).toThrow(/Estado no reconocido/);
  });
});
