(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (error) {
      console.warn('No se pudo registrar el service worker.', error);
    }
  });
})();
