(function () {
  const STORAGE_KEYS = {
    dismissedUntil: 'installPromptDismissedUntil',
    installed: 'installPromptInstalled',
    accepted: 'installPromptAccepted'
  };

  const DISMISS_DAYS = 7;
  let deferredPrompt = null;
  let ctaContainer = null;
  let modal = null;
  let iosHint = null;

  function isStandalone() {
    return Boolean(
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone
    );
  }

  function isIosSafari() {
    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isWebkit = /WebKit/.test(ua);
    const isCriOS = /CriOS/.test(ua);
    const isFxiOS = /FxiOS/.test(ua);
    return isIOS && isWebkit && !isCriOS && !isFxiOS;
  }

  function shouldPausePrompt() {
    const dismissedUntil = Number(localStorage.getItem(STORAGE_KEYS.dismissedUntil) || 0);
    const installed = localStorage.getItem(STORAGE_KEYS.installed) === '1';
    const accepted = localStorage.getItem(STORAGE_KEYS.accepted) === '1';
    return installed || accepted || Date.now() < dismissedUntil;
  }

  function markDismissed() {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEYS.dismissedUntil, String(until));
  }

  function createUi() {
    if (ctaContainer) return;

    const style = document.createElement('style');
    style.textContent = `
      .install-cta-wrap{position:fixed;right:16px;bottom:16px;z-index:9999;display:none}
      .install-cta-btn{padding:10px 14px;border:none;border-radius:999px;background:#7a00cc;color:#fff;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2)}
      .install-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10000}
      .install-modal{width:min(92vw,420px);background:#fff;border-radius:12px;padding:16px;text-align:left;box-shadow:0 12px 40px rgba(0,0,0,.28)}
      .install-modal h3{margin:0 0 8px 0;font-size:1.1rem}
      .install-modal p{margin:0 0 14px 0;font-size:.95rem;line-height:1.4;color:#222}
      .install-modal-actions{display:flex;justify-content:flex-end;gap:8px}
      .install-modal-actions button{border:none;border-radius:8px;padding:8px 12px;cursor:pointer}
      .install-close{background:#ececec;color:#222}
      .install-confirm{background:#7a00cc;color:#fff}
      .install-ios-hint{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;background:#fff;border:1px solid #ddd;border-radius:10px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.18);display:none}
      .install-ios-hint strong{display:block;margin-bottom:6px}
      .install-ios-hint button{margin-top:8px;border:none;border-radius:8px;padding:6px 10px;background:#ececec;cursor:pointer}
    `;
    document.head.appendChild(style);

    ctaContainer = document.createElement('div');
    ctaContainer.className = 'install-cta-wrap';
    ctaContainer.innerHTML = '<button class="install-cta-btn" type="button">Instalar app</button>';
    document.body.appendChild(ctaContainer);

    modal = document.createElement('div');
    modal.className = 'install-modal-backdrop';
    modal.innerHTML = `
      <div class="install-modal" role="dialog" aria-modal="true" aria-label="Instalar aplicación">
        <h3>Instalar app</h3>
        <p>Instala Bingo Online para abrir más rápido y usar una experiencia similar a una app.</p>
        <div class="install-modal-actions">
          <button class="install-close" type="button">Ahora no</button>
          <button class="install-confirm" type="button">Instalar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    iosHint = document.createElement('div');
    iosHint.className = 'install-ios-hint';
    iosHint.innerHTML = `
      <strong>Instalar app en iPhone/iPad</strong>
      <div>Abre el menú <em>Compartir</em> y luego toca <em>Añadir a pantalla de inicio</em>.</div>
      <button type="button">Entendido</button>
    `;
    document.body.appendChild(iosHint);

    ctaContainer.querySelector('button').addEventListener('click', function () {
      if (!deferredPrompt) return;
      modal.style.display = 'flex';
    });

    modal.querySelector('.install-close').addEventListener('click', function () {
      modal.style.display = 'none';
      markDismissed();
      hideCta();
    });

    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        modal.style.display = 'none';
        markDismissed();
        hideCta();
      }
    });

    modal.querySelector('.install-confirm').addEventListener('click', async function () {
      if (!deferredPrompt) return;

      modal.style.display = 'none';
      deferredPrompt.prompt();

      const choiceResult = await deferredPrompt.userChoice;
      console.info('Resultado userChoice PWA:', choiceResult.outcome);

      if (choiceResult.outcome === 'accepted') {
        localStorage.setItem(STORAGE_KEYS.accepted, '1');
        hideCta();
      } else {
        markDismissed();
        hideCta();
      }

      deferredPrompt = null;
    });

    iosHint.querySelector('button').addEventListener('click', function () {
      markDismissed();
      iosHint.style.display = 'none';
    });
  }

  function showCta() {
    if (ctaContainer) {
      ctaContainer.style.display = 'block';
    }
  }

  function hideCta() {
    if (ctaContainer) {
      ctaContainer.style.display = 'none';
    }
  }

  function showIosHint() {
    if (iosHint) {
      iosHint.style.display = 'block';
    }
  }

  function hideAllInstallUi() {
    hideCta();
    if (modal) modal.style.display = 'none';
    if (iosHint) iosHint.style.display = 'none';
  }

  function init() {
    createUi();

    if (isStandalone()) {
      hideAllInstallUi();
      return;
    }

    if (shouldPausePrompt()) {
      hideAllInstallUi();
      return;
    }

    if (isIosSafari()) {
      showIosHint();
    }

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredPrompt = event;
      showCta();
    });

    window.addEventListener('appinstalled', function () {
      localStorage.setItem(STORAGE_KEYS.installed, '1');
      hideAllInstallUi();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
