(function () {
  const tokenKey = 'tablero-especialidades-token';
  const API = window.API_URL;

  function getToken() {
    return localStorage.getItem(tokenKey);
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(tokenKey, token);
    }
  }

  function clearToken() {
    localStorage.removeItem(tokenKey);
  }

  function requireAuth() {
    if (!getToken()) {
      window.location.href = 'login.html';
    }
  }

  function fetchWithAuth(path, options = {}) {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${API}${path}`, { ...options, headers });
  }

  function setupDialog(overlayEl) {
    function close() {
      overlayEl.classList.add('hidden');
      document.body.style.overflow = '';
    }
    function open() {
      overlayEl.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
    // Cierre por backdrop/Esc: avisa para que quien espere una respuesta la tome como cancelación.
    function dismiss() {
      close();
      overlayEl.dispatchEvent(new CustomEvent('dialog-dismissed'));
    }
    overlayEl.addEventListener('click', (event) => {
      if (event.target === overlayEl) dismiss();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlayEl.classList.contains('hidden')) dismiss();
    });
    return { open, close };
  }

  const TONE_ICONS = {
    danger: '<path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
    warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />',
    accent: '<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />',
  };

  let confirmEls = null;

  function buildConfirmDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay hidden';
    overlay.innerHTML = `
      <div class="dialog dialog-confirm" role="alertdialog" aria-modal="true">
        <div class="dialog-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg></div>
        <h3 class="dialog-title"></h3>
        <p class="dialog-message"></p>
        <div class="dialog-actions dialog-actions-split">
          <button type="button" class="secondary" data-confirm-cancel>Cancelar</button>
          <button type="button" data-confirm-ok>Confirmar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return {
      overlay,
      dialog: setupDialog(overlay),
      icon: overlay.querySelector('.dialog-icon'),
      svg: overlay.querySelector('.dialog-icon svg'),
      title: overlay.querySelector('.dialog-title'),
      message: overlay.querySelector('.dialog-message'),
      cancelBtn: overlay.querySelector('[data-confirm-cancel]'),
      okBtn: overlay.querySelector('[data-confirm-ok]'),
    };
  }

  function confirmDialog({ title, message, confirmLabel = 'Confirmar', tone = 'danger' }) {
    if (!confirmEls) confirmEls = buildConfirmDialog();
    const els = confirmEls;
    els.icon.dataset.tone = tone;
    els.svg.innerHTML = TONE_ICONS[tone] || TONE_ICONS.danger;
    els.title.textContent = title;
    els.message.textContent = message;
    els.okBtn.textContent = confirmLabel;
    els.okBtn.className = tone === 'danger' ? 'danger-solid' : '';

    return new Promise((resolve) => {
      function cleanup(result) {
        els.cancelBtn.removeEventListener('click', onCancel);
        els.okBtn.removeEventListener('click', onOk);
        els.overlay.removeEventListener('dialog-dismissed', onCancel);
        els.dialog.close();
        resolve(result);
      }
      function onCancel() { cleanup(false); }
      function onOk() { cleanup(true); }
      els.cancelBtn.addEventListener('click', onCancel);
      els.okBtn.addEventListener('click', onOk);
      els.overlay.addEventListener('dialog-dismissed', onCancel);
      els.dialog.open();
      els.cancelBtn.focus();
    });
  }

  const TOAST_ICONS = {
    success: '<path d="M20 6 9 17l-5-5" />',
    info: '<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />',
    warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" />',
    error: '<circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />',
  };

  let toastContainer = null;

  function getToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-stack';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function toast(title, options = {}) {
    const { variant = 'success', description = '' } = options;
    const el = document.createElement('div');
    el.className = 'toast';
    el.dataset.variant = variant;
    el.setAttribute('role', variant === 'error' ? 'alert' : 'status');
    el.innerHTML = `
      <span class="toast-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TOAST_ICONS[variant] || TOAST_ICONS.info}</svg></span>
      <div class="toast-body">
        <div class="toast-title"></div>
        ${description ? '<div class="toast-desc"></div>' : ''}
      </div>
      <button type="button" class="toast-close" aria-label="Cerrar">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>
    `;
    el.querySelector('.toast-title').textContent = title;
    if (description) el.querySelector('.toast-desc').textContent = description;

    let timer = null;
    function dismiss() {
      if (timer) clearTimeout(timer);
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
    el.querySelector('.toast-close').addEventListener('click', dismiss);
    getToastContainer().appendChild(el);
    timer = setTimeout(dismiss, 4200);
    return dismiss;
  }

  window.tablero = {
    API,
    getToken,
    setToken,
    clearToken,
    requireAuth,
    fetchWithAuth,
    setupDialog,
    confirm: confirmDialog,
    toast,
  };
})();
