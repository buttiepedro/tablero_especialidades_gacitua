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

  const ICONS = {
    chevronDown: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>',
    close: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>',
  };

  const openDropdowns = new Set();

  // Popover flotante (portal a <body>, position: fixed) para que un select o
  // multiselect abierto dentro de un dialog con overflow-y:auto no quede
  // recortado por ese scroll. Se cierra al hacer scroll para no arrastrar una
  // posición vieja.
  function createDropdown({ wrapper, trigger, popover, onOpen }) {
    document.body.appendChild(popover);
    let isOpen = false;

    function reposition() {
      const rect = trigger.getBoundingClientRect();
      popover.style.left = `${rect.left}px`;
      popover.style.width = `${rect.width}px`;
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 260 && rect.top > spaceBelow) {
        popover.style.top = 'auto';
        popover.style.bottom = `${window.innerHeight - rect.top + 6}px`;
      } else {
        popover.style.bottom = 'auto';
        popover.style.top = `${rect.bottom + 6}px`;
      }
    }

    function handleOutside(event) {
      if (!popover.contains(event.target) && !trigger.contains(event.target)) close();
    }

    function handleKey(event) {
      if (event.key === 'Escape') {
        close();
        trigger.focus();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const opts = Array.from(popover.querySelectorAll('[role="option"]'));
        if (!opts.length) return;
        event.preventDefault();
        const idx = opts.indexOf(document.activeElement);
        const next = event.key === 'ArrowDown' ? opts[idx + 1] || opts[0] : opts[idx - 1] || opts[opts.length - 1];
        next.focus();
      }
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      openDropdowns.delete(close);
      popover.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');
      wrapper.removeAttribute('data-open');
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', reposition);
    }

    function open() {
      if (isOpen) return;
      openDropdowns.forEach((closeOther) => closeOther());
      isOpen = true;
      openDropdowns.add(close);
      if (onOpen) onOpen();
      popover.classList.remove('hidden');
      trigger.setAttribute('aria-expanded', 'true');
      wrapper.setAttribute('data-open', '');
      reposition();
      document.addEventListener('mousedown', handleOutside, true);
      document.addEventListener('keydown', handleKey, true);
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', reposition);
      const first = popover.querySelector('[role="option"]');
      if (first) first.focus();
    }

    trigger.addEventListener('click', () => (isOpen ? close() : open()));
    return { open, close, isOpen: () => isOpen };
  }

  function buildOptionRow({ selected, label, checkbox }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = checkbox ? 'ms-option' : 'ui-select-option';
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', String(selected));
    const mark = document.createElement('span');
    mark.className = checkbox ? 'ms-checkbox' : 'ui-select-check';
    if (selected) mark.innerHTML = ICONS.check;
    const text = document.createElement('span');
    text.textContent = label;
    btn.append(mark, text);
    return btn;
  }

  // Select simple. root debe contener .ui-select-trigger > .ui-select-value
  // y .ui-select-popover. options: [{ value, label }]. value null = placeholder.
  function createSelect(root, { options = [], placeholder = 'Seleccionar...', onChange } = {}) {
    const trigger = root.querySelector('.ui-select-trigger');
    const valueEl = root.querySelector('.ui-select-value');
    const popover = root.querySelector('.ui-select-popover');
    const chevron = root.querySelector('.ui-select-chevron');
    if (chevron) chevron.innerHTML = ICONS.chevronDown;
    let opts = options;
    let value = null;

    function renderTrigger() {
      const found = opts.find((o) => o.value === value);
      valueEl.textContent = found ? found.label : placeholder;
      valueEl.classList.toggle('ui-select-placeholder', !found);
    }

    function renderOptions() {
      popover.innerHTML = '';
      opts.forEach((opt) => {
        const row = buildOptionRow({ selected: opt.value === value, label: opt.label, checkbox: false });
        row.addEventListener('click', () => {
          value = opt.value;
          renderTrigger();
          dropdown.close();
          if (onChange) onChange(value);
        });
        popover.appendChild(row);
      });
    }

    const dropdown = createDropdown({ wrapper: root, trigger, popover, onOpen: renderOptions });

    function setOptions(list) {
      opts = list;
      renderOptions();
      renderTrigger();
    }
    function setValue(v) {
      value = v;
      renderTrigger();
    }
    function getValue() {
      return value;
    }

    setOptions(opts);
    return { setOptions, setValue, getValue };
  }

  // Multiselect con chips. root debe contener .ms-trigger (div, no button: puede
  // alojar botones "quitar chip" y un button dentro de otro button es HTML
  // inválido) > .ms-chips, y .ms-popover. options: [{ id, nombre }].
  function createMultiSelect(root, { options = [], placeholder = 'Seleccionar...', onChange } = {}) {
    const trigger = root.querySelector('.ms-trigger');
    const chipsEl = root.querySelector('.ms-chips');
    const popover = root.querySelector('.ms-popover');
    const chevron = root.querySelector('.ms-chevron');
    if (chevron) chevron.innerHTML = ICONS.chevronDown;
    let opts = options;
    let selected = new Set();

    function renderChips() {
      chipsEl.innerHTML = '';
      const chosen = opts.filter((o) => selected.has(o.id));
      if (chosen.length === 0) {
        const span = document.createElement('span');
        span.className = 'ms-placeholder';
        span.textContent = placeholder;
        chipsEl.appendChild(span);
        return;
      }
      chosen.forEach((opt) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        const label = document.createElement('span');
        label.textContent = opt.nombre;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'chip-remove';
        remove.setAttribute('aria-label', `Quitar ${opt.nombre}`);
        remove.innerHTML = ICONS.close;
        remove.addEventListener('click', (event) => {
          event.stopPropagation();
          selected.delete(opt.id);
          renderOptions();
          renderChips();
          if (onChange) onChange(Array.from(selected));
        });
        chip.append(label, remove);
        chipsEl.appendChild(chip);
      });
    }

    function renderOptions() {
      popover.innerHTML = '';
      if (opts.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'ms-empty hint';
        empty.textContent = 'No hay especialidades cargadas.';
        popover.appendChild(empty);
        return;
      }
      opts.forEach((opt) => {
        const row = buildOptionRow({ selected: selected.has(opt.id), label: opt.nombre, checkbox: true });
        row.addEventListener('click', () => {
          if (selected.has(opt.id)) selected.delete(opt.id);
          else selected.add(opt.id);
          renderOptions();
          renderChips();
          if (onChange) onChange(Array.from(selected));
        });
        popover.appendChild(row);
      });
    }

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (dropdown.isOpen()) dropdown.close();
        else dropdown.open();
      }
    });

    const dropdown = createDropdown({ wrapper: root, trigger, popover, onOpen: renderOptions });

    function setOptions(list) {
      opts = list;
      selected = new Set(Array.from(selected).filter((id) => opts.some((o) => o.id === id)));
      renderOptions();
      renderChips();
    }
    function setValue(ids) {
      selected = new Set(ids || []);
      renderChips();
    }
    function getValue() {
      return Array.from(selected);
    }

    renderChips();
    return { setOptions, setValue, getValue };
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
    createSelect,
    createMultiSelect,
    createDropdown,
    buildOptionRow,
  };
})();
