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
    search: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>',
    sort: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" /></svg>',
    sortAsc: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 14 5-5 5 5" /></svg>',
    sortDesc: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 10 5 5 5-5" /></svg>',
  };

  // Normaliza para buscar: sin acentos, sin mayúsculas. "cardiología" matchea
  // escribiendo "cardiologia" y viceversa, que es como la gente tipea acá.
  function normalize(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // Match por términos sueltos: "gonz ped" encuentra "González, Pedro".
  function matchesQuery(haystack, query) {
    const q = normalize(query);
    if (!q) return true;
    const target = normalize(haystack);
    return q.split(/\s+/).every((term) => target.includes(term));
  }

  const openDropdowns = new Set();

  // Popover flotante (portal a <body>, position: fixed) para que un select o
  // multiselect abierto dentro de un dialog con overflow-y:auto no quede
  // recortado por ese scroll. Se cierra al hacer scroll para no arrastrar una
  // posición vieja.
  // searchable: agrega un buscador fijo arriba del popover. onOpen recibe el
  // texto tipeado, y quien lo pasa decide qué opciones pintar con él; el
  // dropdown sólo se ocupa del input, el foco y el reset al cerrar.
  function createDropdown({ wrapper, trigger, popover, onOpen, matchTriggerWidth = true, searchable = false, searchPlaceholder = 'Buscar...' }) {
    document.body.appendChild(popover);
    let isOpen = false;

    // Lista y buscador van en contenedores separados: el buscador queda fijo y
    // sólo scrollea la lista, si no al tipear se pierde de vista.
    let searchInput = null;
    let optionsHost = popover;
    if (searchable) {
      popover.classList.add('has-search');
      const searchBox = document.createElement('div');
      searchBox.className = 'dd-search';
      const icon = document.createElement('span');
      icon.className = 'dd-search-icon';
      icon.innerHTML = ICONS.search;
      searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'dd-search-input';
      searchInput.placeholder = searchPlaceholder;
      searchInput.setAttribute('aria-label', searchPlaceholder);
      // El popover está portado a <body>, fuera del <form>: aún así, Enter no
      // debe disparar nada raro ni cerrar el dialog.
      searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') event.preventDefault();
      });
      searchInput.addEventListener('input', () => {
        if (onOpen) onOpen(searchInput.value);
        reposition();
      });
      searchBox.append(icon, searchInput);
      optionsHost = document.createElement('div');
      optionsHost.className = 'dd-options';
      popover.append(searchBox, optionsHost);
    }

    function reposition() {
      const rect = trigger.getBoundingClientRect();
      // matchTriggerWidth: true para un select que ocupa todo el ancho. Con un
      // trigger angosto conviene false, si no el popover hereda ese ancho y
      // recorta las opciones.
      if (matchTriggerWidth) {
        popover.style.width = `${rect.width}px`;
        popover.style.left = `${rect.left}px`;
      } else {
        // Se ancla al trigger, pero se corre para no salirse de la ventana.
        const ancho = popover.offsetWidth;
        let left = rect.left;
        if (left + ancho > window.innerWidth - 8) left = rect.right - ancho;
        popover.style.left = `${Math.max(8, left)}px`;
      }
      const MARGEN = 8;
      const spaceBelow = window.innerHeight - rect.bottom - 6 - MARGEN;
      const spaceAbove = rect.top - 6 - MARGEN;
      // El max-height se ajusta al espacio real disponible (topeado en 260px)
      // para que la lista se pueda scrollear entera en vez de quedar cortada.
      if (spaceBelow < 260 && spaceAbove > spaceBelow) {
        popover.style.top = 'auto';
        popover.style.bottom = `${window.innerHeight - rect.top + 6}px`;
        popover.style.maxHeight = `${Math.max(120, Math.min(260, spaceAbove))}px`;
      } else {
        popover.style.bottom = 'auto';
        popover.style.top = `${rect.bottom + 6}px`;
        popover.style.maxHeight = `${Math.max(120, Math.min(260, spaceBelow))}px`;
      }
    }

    // El scroll propio del popover (lista larga de opciones) no debe cerrarlo ni
    // reposicionarlo; solo el scroll de un contenedor externo mueve el trigger.
    function handleScroll(event) {
      if (popover.contains(event.target)) return;
      reposition();
    }

    function handleOutside(event) {
      if (!popover.contains(event.target) && !trigger.contains(event.target)) close();
    }

    function handleKey(event) {
      if (event.key === 'Escape') {
        // Este listener va en capture sobre document y el de setupDialog en bubble:
        // sin cortar acá, un Escape para cerrar el desplegable cerraba tambien el
        // dialog que lo contiene y se perdia lo cargado en el formulario.
        event.stopPropagation();
        close();
        trigger.focus();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const opts = Array.from(popover.querySelectorAll('[role="option"]'));
        if (!opts.length) return;
        event.preventDefault();
        // Desde el buscador, ArrowDown entra a la lista por el primero (y
        // ArrowUp por el último): indexOf da -1 y esa es la rama que aplica.
        const idx = opts.indexOf(document.activeElement);
        const next = event.key === 'ArrowDown'
          ? opts[idx + 1] || opts[0]
          : (idx === -1 ? opts[opts.length - 1] : opts[idx - 1] || opts[opts.length - 1]);
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
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', reposition);
    }

    function open() {
      if (isOpen) return;
      openDropdowns.forEach((closeOther) => closeOther());
      isOpen = true;
      openDropdowns.add(close);
      if (searchInput) searchInput.value = '';
      if (onOpen) onOpen(searchInput ? '' : undefined);
      popover.classList.remove('hidden');
      trigger.setAttribute('aria-expanded', 'true');
      wrapper.setAttribute('data-open', '');
      reposition();
      document.addEventListener('mousedown', handleOutside, true);
      document.addEventListener('keydown', handleKey, true);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', reposition);
      // Con buscador el foco va al input: se abre y se tipea de una. Va en el
      // frame siguiente porque el mousedown del trigger todavía no terminó de
      // resolver su foco por defecto y se lo llevaría puesto.
      if (searchInput) {
        requestAnimationFrame(() => {
          if (isOpen) searchInput.focus();
        });
        return;
      }
      const first = popover.querySelector('[role="option"]');
      if (first) first.focus();
    }

    trigger.addEventListener('click', () => (isOpen ? close() : open()));
    // optionsHost: dónde pintar las opciones. Sin buscador es el popover mismo;
    // con buscador, el contenedor scrolleable de abajo.
    return { open, close, isOpen: () => isOpen, optionsHost, reposition };
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
  // searchable: umbral por defecto: con pocas opciones el buscador estorba más
  // de lo que ayuda, así que sólo aparece cuando la lista es larga.
  const SEARCH_THRESHOLD = 8;

  function createSelect(root, { options = [], placeholder = 'Seleccionar...', onChange, searchable, searchPlaceholder = 'Buscar...' } = {}) {
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

    function renderOptions(query = '') {
      const host = dropdown ? dropdown.optionsHost : popover;
      host.innerHTML = '';
      const visibles = opts.filter((opt) => matchesQuery(opt.label, query));
      if (visibles.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'ms-empty hint';
        empty.textContent = 'Sin resultados.';
        host.appendChild(empty);
        return;
      }
      visibles.forEach((opt) => {
        const row = buildOptionRow({ selected: opt.value === value, label: opt.label, checkbox: false });
        row.addEventListener('click', () => {
          value = opt.value;
          renderTrigger();
          dropdown.close();
          if (onChange) onChange(value);
        });
        host.appendChild(row);
      });
    }

    // Si no se pide explícitamente, el buscador aparece según el largo de la lista.
    const useSearch = searchable === undefined ? options.length >= SEARCH_THRESHOLD : searchable;
    const dropdown = createDropdown({
      wrapper: root,
      trigger,
      popover,
      onOpen: renderOptions,
      searchable: useSearch,
      searchPlaceholder,
    });

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
  function createMultiSelect(root, { options = [], placeholder = 'Seleccionar...', onChange, emptyText = 'No hay opciones cargadas.', searchPlaceholder = 'Buscar...' } = {}) {
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

    // query la pasa el buscador del dropdown. Al tildar/destildar se repinta
    // conservando el texto tipeado, para poder marcar varias de una búsqueda.
    let lastQuery = '';

    function renderOptions(query = '') {
      lastQuery = query;
      const host = dropdown ? dropdown.optionsHost : popover;
      host.innerHTML = '';
      if (opts.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'ms-empty hint';
        empty.textContent = emptyText;
        host.appendChild(empty);
        return;
      }
      const visibles = opts.filter((opt) => matchesQuery(opt.nombre, query));
      if (visibles.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'ms-empty hint';
        empty.textContent = 'Sin resultados.';
        host.appendChild(empty);
        return;
      }
      visibles.forEach((opt) => {
        const row = buildOptionRow({ selected: selected.has(opt.id), label: opt.nombre, checkbox: true });
        row.addEventListener('click', () => {
          if (selected.has(opt.id)) selected.delete(opt.id);
          else selected.add(opt.id);
          renderOptions(lastQuery);
          renderChips();
          if (onChange) onChange(Array.from(selected));
        });
        host.appendChild(row);
      });
    }

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (dropdown.isOpen()) dropdown.close();
        else dropdown.open();
      }
    });

    // Siempre con buscador: las opciones se cargan async (fetch), así que al
    // construirlo la lista está vacía y un umbral por largo nunca daría true.
    const dropdown = createDropdown({
      wrapper: root,
      trigger,
      popover,
      onOpen: renderOptions,
      searchable: true,
      searchPlaceholder,
    });

    function setOptions(list) {
      opts = list;
      selected = new Set(Array.from(selected).filter((id) => opts.some((o) => o.id === id)));
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

  /* ── Controles de tabla: buscador + orden por columna ─────────────────── */

  // Monta un buscador en el toolbar y hace clickeables los <th> marcados con
  // data-sort, y devuelve { apply, getRows }: la página le pasa los datos
  // crudos y recibe la lista ya filtrada y ordenada para pintar.
  //
  //   columns: { <clave data-sort>: (item) => valor comparable }
  //   searchFields: (item) => string | string[]  — sobre qué se busca
  //   onChange: se llama con las filas resultantes cada vez que cambia algo
  function createTableControls({
    table,
    searchInput,
    columns = {},
    searchFields,
    defaultSort = null,
    onChange,
  }) {
    let rows = [];
    let query = '';
    // { key, dir } — dir: 'asc' | 'desc'
    let sort = defaultSort ? { ...defaultSort } : null;

    const headers = table ? Array.from(table.querySelectorAll('th[data-sort]')) : [];

    function textOf(item) {
      const value = searchFields ? searchFields(item) : '';
      return Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value || '');
    }

    function isEmpty(value) {
      return value === null || value === undefined || value === '';
    }

    // Compara dos valores presentes. Números y booleanos por resta; texto por
    // localeCompare con numeric, para que "Sala 2" venga antes que "Sala 10".
    function compareValues(va, vb) {
      if (typeof va === 'number' && typeof vb === 'number') return va - vb;
      if (typeof va === 'boolean' && typeof vb === 'boolean') return (va ? 1 : 0) - (vb ? 1 : 0);
      return String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
    }

    function computeRows() {
      const result = rows.filter((item) => matchesQuery(textOf(item), query));
      if (!sort || !columns[sort.key]) return result;
      const get = columns[sort.key];
      const factor = sort.dir === 'desc' ? -1 : 1;
      // Sort estable (ES2019+): los empates conservan el orden que trajo el backend.
      return result.slice().sort((a, b) => {
        const va = get(a);
        const vb = get(b);
        // "Sin dato" va siempre al final, ordene asc o desc: no es un valor
        // chico, es la ausencia de valor. Por eso queda afuera del factor.
        if (isEmpty(va) && isEmpty(vb)) return 0;
        if (isEmpty(va)) return 1;
        if (isEmpty(vb)) return -1;
        return compareValues(va, vb) * factor;
      });
    }

    function renderHeaders() {
      headers.forEach((th) => {
        const key = th.dataset.sort;
        const active = sort && sort.key === key;
        const dir = active ? sort.dir : null;
        th.classList.toggle('is-sorted', Boolean(active));
        th.setAttribute('aria-sort', active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
        const indicator = th.querySelector('.th-sort-icon');
        if (indicator) {
          indicator.innerHTML = active ? (dir === 'asc' ? ICONS.sortAsc : ICONS.sortDesc) : ICONS.sort;
        }
      });
    }

    function emit() {
      renderHeaders();
      if (onChange) onChange(computeRows());
    }

    headers.forEach((th) => {
      const key = th.dataset.sort;
      // El <th> se envuelve en un botón para que sea operable con teclado.
      const label = th.innerHTML;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'th-sort';
      btn.innerHTML = `<span class="th-sort-label">${label}</span><span class="th-sort-icon" aria-hidden="true">${ICONS.sort}</span>`;
      th.innerHTML = '';
      th.appendChild(btn);
      btn.addEventListener('click', () => {
        // Mismo header: alterna asc/desc. Otro header: arranca en asc.
        if (sort && sort.key === key) sort = { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
        else sort = { key, dir: 'asc' };
        emit();
      });
    });

    if (searchInput) {
      // El <span> del icono va vacío en el HTML: lo llena el JS para no repetir
      // el SVG en cada página.
      const iconHost = searchInput.parentElement
        && searchInput.parentElement.querySelector('.table-search-icon');
      if (iconHost && !iconHost.innerHTML.trim()) iconHost.innerHTML = ICONS.search;

      searchInput.addEventListener('input', () => {
        query = searchInput.value;
        emit();
      });
      // Esc limpia el buscador, que es lo que espera cualquiera que tipeó de más.
      searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && searchInput.value) {
          event.stopPropagation();
          searchInput.value = '';
          query = '';
          emit();
        }
      });
    }

    renderHeaders();

    return {
      // La página llama a setRows() con lo que trajo el backend; el resultado
      // filtrado llega por onChange.
      setRows(list) {
        rows = list || [];
        emit();
      },
      getRows: computeRows,
      getQuery: () => query,
      isFiltered: () => normalize(query) !== '',
    };
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
    createTableControls,
    normalize,
    matchesQuery,
  };
})();
