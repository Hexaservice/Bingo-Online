// Copie este archivo desde public/firebase-app-check.template.js y reemplace
// los valores con la configuración emitida por Firebase App Check.
// Mientras no reemplace el siteKey la inicialización fallará de forma
// controlada para evitar solicitudes sin protección.
window.__FIREBASE_APP_CHECK_CONFIG__ = {
  provider: 'recaptcha_v3',
  // TODO: Reemplace el valor por el site key real generado en la consola
  // de Firebase (se recomienda mantener el archivo fuera del control de
  // versiones público una vez configurado).
  siteKey: 'REEMPLAZA_CON_TU_SITE_KEY',
  isTokenAutoRefreshEnabled: true,
  debugToken: undefined,
  enableDebug: false
};
