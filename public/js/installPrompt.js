(function () {
  const STORAGE_KEYS = {
    installed: 'installPromptInstalled'
  };
  const STYLE_ID = 'bo-install-prompt-style';

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
    const installed = localStorage.getItem(STORAGE_KEYS.installed) === '1';
    return installed;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .bo-install-prompt{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:9800;display:none;font-family:'Poppins',sans-serif}
      .bo-install-prompt__banner{display:flex;align-items:center;gap:8px;background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-radius:999px;padding:8px 10px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
      .bo-install-prompt__banner button{border:none;border-radius:999px;padding:7px 12px;cursor:pointer;font-weight:600}
      .bo-install-prompt__banner .bo-install-open{background:#7a00cc;color:#fff}
      .bo-install-prompt__banner .bo-install-dismiss{background:#ececec;color:#222}
      .bo-install-prompt__backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10000}
      .bo-install-prompt__modal{width:min(92vw,420px);background:#fff;border-radius:12px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.28)}
      .bo-install-prompt__modal h3{margin:0 0 8px 0;font-size:1.1rem}
      .bo-install-prompt__modal p{margin:0 0 14px 0;font-size:.95rem;line-height:1.4;color:#222}
      .bo-install-prompt__actions{display:flex;justify-content:flex-end;gap:8px}
      .bo-install-prompt__actions button{border:none;border-radius:8px;padding:8px 12px;cursor:pointer}
      .bo-install-prompt__actions .bo-install-close{background:#ececec;color:#222}
      .bo-install-prompt__actions .bo-install-confirm{background:#7a00cc;color:#fff}
      .bo-install-prompt__ios{position:fixed;left:16px;right:16px;bottom:16px;z-index:9800;background:#fff;border:1px solid #ddd;border-radius:10px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.18);display:none;font-family:'Poppins',sans-serif}
      .bo-install-prompt__ios strong{display:block;margin-bottom:6px}
      .bo-install-prompt__ios button{margin-top:8px;border:none;border-radius:8px;padding:6px 10px;background:#ececec;cursor:pointer}
    `;
    document.head.appendChild(style);
  }

  function initInstallPrompt(options) {
    const settings = {
      containerId: options?.containerId || 'install-prompt-root',
      mode: options?.mode === 'modal' ? 'modal' : 'banner'
    };

    let deferredPrompt = null;
    let root = document.getElementById(settings.containerId);
    if (!root) {
      root = document.createElement('div');
      root.id = settings.containerId;
      document.body.appendChild(root);
    }

    ensureStyles();

    const bannerWrap = document.createElement('div');
    bannerWrap.className = 'bo-install-prompt';
    bannerWrap.innerHTML = `
      <div class="bo-install-prompt__banner">
                <button type="button" class="bo-install-open">Instalar</button>
        <button type="button" class="bo-install-dismiss">Ahora no</button>
      </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'bo-install-prompt__backdrop';
    modal.innerHTML = `
      <div class="bo-install-prompt__modal" role="dialog" aria-modal="true" aria-label="Instalar aplicación">
        <h3>Instalar app</h3>
        <p>Instala Bingo Online para abrir más rápido y usar una experiencia similar a una app.</p>
        <div class="bo-install-prompt__actions">
          <button class="bo-install-close" type="button">Ahora no</button>
          <button class="bo-install-confirm" type="button">Instalar</button>
        </div>
      </div>
    `;

    const iosHint = document.createElement('div');
    iosHint.className = 'bo-install-prompt__ios';
    iosHint.innerHTML = `
      <strong>Instalar app en iPhone/iPad</strong>
      <div>Abre el menú <em>Compartir</em> y luego toca <em>Añadir a pantalla de inicio</em>.</div>
      <button type="button">Entendido</button>
    `;

    root.replaceChildren(bannerWrap, modal, iosHint);

    function hasPriorityOverlay() {
      return Boolean(document.querySelector('.global-dialog-overlay[style*="display: flex"], .modal-whatsapp.activa, .modal-referidos.activa, #tutorial-overlay.activo'));
    }

    function hideAll() {
      bannerWrap.style.display = 'none';
      modal.style.display = 'none';
      iosHint.style.display = 'none';
    }

    function showEntry() {
      if (hasPriorityOverlay()) return;
      if (settings.mode === 'modal') {
        modal.style.display = 'flex';
      } else {
        bannerWrap.style.display = 'block';
      }
    }

    function mostrarAyudaInstalacionManual() {
      modal.style.display = 'flex';
      modal.querySelector('h3').textContent = 'Instalar app';
      modal.querySelector('p').textContent = 'Si no aparece la instalación automática, usa el menú del navegador y elige "Instalar aplicación" o "Añadir a pantalla de inicio".';
    }

    if (isStandalone() || shouldPausePrompt()) {
      hideAll();
      return { destroy: hideAll };
    }

    if (isIosSafari()) {
      if (!hasPriorityOverlay()) {
        bannerWrap.style.display = 'block';
      }
      iosHint.querySelector('button').addEventListener('click', function () {
        iosHint.style.display = 'none';
      });
    } else {
      showEntry();
    }

    bannerWrap.querySelector('.bo-install-open').addEventListener('click', function () {
      if (deferredPrompt) {
        modal.style.display = 'flex';
        return;
      }
      if (isIosSafari()) {
        iosHint.style.display = 'block';
        return;
      }
      mostrarAyudaInstalacionManual();
    });

    bannerWrap.querySelector('.bo-install-dismiss').addEventListener('click', function () {
      hideAll();
    });

    modal.querySelector('.bo-install-close').addEventListener('click', function () {
      hideAll();
    });

    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        hideAll();
      }
    });

    modal.querySelector('.bo-install-confirm').addEventListener('click', async function () {
      if (!deferredPrompt) {
        mostrarAyudaInstalacionManual();
        return;
      }
      modal.style.display = 'none';
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome !== 'accepted') {
        showEntry();
        return;
      }
      hideAll();
      deferredPrompt = null;
    });

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredPrompt = event;
      showEntry();
    });

    window.addEventListener('appinstalled', function () {
      localStorage.setItem(STORAGE_KEYS.installed, '1');
      hideAll();
    });

    return {
      destroy() {
        hideAll();
        root.replaceChildren();
      }
    };
  }

  window.initInstallPrompt = initInstallPrompt;
})();
