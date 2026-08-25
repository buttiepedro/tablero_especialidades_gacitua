const tableBody = document.getElementById('table-body');
const tableStatus = document.getElementById('table-status');
const logoutLink = document.getElementById('logout-link');
const searchInput = document.getElementById('table-search');

const dialogOverlay = document.getElementById('especialidad-dialog');
const dialogTitle = document.getElementById('especialidad-dialog-title');
const form = document.getElementById('especialidad-form');
const nombreInput = document.getElementById('especialidad-nombre');
const descripcionInput = document.getElementById('especialidad-descripcion');
const botInput = document.getElementById('especialidad-bot');
const cancelBtn = document.getElementById('especialidad-cancel');
const submitBtn = document.getElementById('especialidad-submit');
const dialog = tablero.setupDialog(dialogOverlay);

const COLUMNAS = 5;

// Config de las dos secciones del panel de vínculos. Comparten toda la lógica:
// sólo cambian el endpoint, la página destino y de dónde sale el catálogo.
const SECCIONES = [
  {
    key: 'profesionales',
    titulo: 'Profesionales',
    singular: 'profesional',
    idKey: 'profesional_id',
    pagina: 'profesionales.html',
    vacio: 'Sin profesionales vinculados.',
    sinCatalogo: 'No hay profesionales cargados.',
    todoVinculado: 'Ya están todos vinculados.',
  },
  {
    key: 'practicas',
    titulo: 'Prácticas',
    singular: 'práctica',
    idKey: 'practica_id',
    pagina: 'practicas.html',
    vacio: 'Sin prácticas vinculadas.',
    sinCatalogo: 'No hay prácticas cargadas.',
    todoVinculado: 'Ya están todas vinculadas.',
  },
];

const ICON_CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>';
const ICON_CLOSE = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>';
const ICON_EXTERNAL = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>';

let editingId = null;
let currentItems = [];
let catalogos = { profesionales: [], practicas: [] };
// id de especialidad -> { tr, cleanups } de la fila de vínculos desplegada.
const expandidas = new Map();

const controls = tablero.createTableControls({
  table: document.querySelector('.table-wrapper table'),
  searchInput,
  searchFields: (item) => [item.especialidad, item.descripcion],
  columns: {
    especialidad: (item) => item.especialidad,
    descripcion: (item) => item.descripcion || '',
  },
  onChange: renderTable,
});

logoutLink.addEventListener('click', () => {
  tablero.clearToken();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', () => {
  tablero.requireAuth();
  loadCatalogos();
  loadEspecialidades();
});

cancelBtn.addEventListener('click', () => dialog.close());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const especialidad = nombreInput.value.trim();
  if (!especialidad) return;

  // Alta no: las especialidades entran por la importacion desde Gacitua, que es la que
  // define su id. Desde acá sólo se editan.
  if (editingId === null) return;

  const payload = {
    especialidad,
    descripcion: descripcionInput.value.trim(),
    atendido_por_bot: botInput.checked,
  };
  const response = await tablero.fetchWithAuth(`/especialidades/${editingId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    tablero.toast(error.error || 'No se pudo guardar la especialidad.', { variant: 'error' });
    return;
  }
  dialog.close();
  tablero.toast('Especialidad actualizada', { description: especialidad });
  loadEspecialidades();
});

// Catálogo completo para el selector de "+ Vincular". Si falla, el selector
// muestra el mensaje de lista vacía y el resto de la página sigue andando.
async function loadCatalogos() {
  const [profesionales, practicas] = await Promise.all([
    fetchLista('/profesionales'),
    fetchLista('/practicas'),
  ]);
  catalogos = { profesionales, practicas };
}

async function fetchLista(path) {
  try {
    const response = await tablero.fetchWithAuth(path);
    if (!response.ok) return [];
    return await response.json();
  } catch (err) {
    return [];
  }
}

async function loadEspecialidades() {
  tableStatus.textContent = 'Cargando especialidades...';
  try {
    const response = await tablero.fetchWithAuth('/especialidades');
    if (!response.ok) {
      throw new Error('No se pudo cargar la lista');
    }
    currentItems = await response.json();
    controls.setRows(currentItems);
  } catch (err) {
    tableStatus.textContent = '';
    tablero.toast(err.message, { variant: 'error' });
  }
}

function renderTable(items) {
  colapsarTodas();
  tableBody.innerHTML = '';
  actualizarEstado(items);
  if (items.length === 0) {
    const vacio = controls.isFiltered()
      ? 'Ninguna especialidad coincide con la búsqueda.'
      : 'Todavía no hay especialidades cargadas.';
    tableBody.innerHTML = `<tr><td colspan="${COLUMNAS}"><p class="hint">${vacio}</p></td></tr>`;
    return;
  }
  items.forEach((item) => {
    const row = document.createElement('tr');
    const descCell = item.descripcion
      ? `<p class="desc-preview">${escapeHTML(item.descripcion)}</p>`
      : '<p class="empty-value">Sin descripción</p>';
    const total = contarVinculos(item);
    row.innerHTML = `
      <td class="col-expand">
        <button type="button" class="expand-toggle" data-expand="${item.id}"
                aria-expanded="false" aria-label="Ver profesionales y prácticas de ${escapeHTML(item.especialidad)}">
          ${ICON_CHEVRON}
        </button>
      </td>
      <td>
        <div class="cell-title">
          <span class="cell-name">${escapeHTML(item.especialidad)}</span>
          ${total ? `<span class="link-count" title="${tituloContador(item)}">${total}</span>` : ''}
        </div>
      </td>
      <td>${descCell}</td>
      <td>
        <label class="switch">
          <input type="checkbox" data-bot="${item.id}" ${item.atendido_por_bot ? 'checked' : ''} />
          <span class="switch-track"></span>
        </label>
      </td>
      <td>
        <div class="row-actions">
          <button type="button" class="link-button" data-edit="${item.id}">Editar</button>
          <button type="button" class="danger" data-delete="${item.id}">Eliminar</button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
  tableBody.querySelectorAll('button[data-expand]').forEach((button) => {
    button.addEventListener('click', () => toggleVinculos(Number(button.dataset.expand)));
  });
  tableBody.querySelectorAll('button[data-edit]').forEach((button) => {
    const item = items.find((i) => String(i.id) === button.dataset.edit);
    button.addEventListener('click', () => openDialog(item));
  });
  tableBody.querySelectorAll('input[data-bot]').forEach((input) => {
    input.addEventListener('change', () => saveAtendidoPorBot(input.dataset.bot, input.checked));
  });
  tableBody.querySelectorAll('button[data-delete]').forEach((button) => {
    button.addEventListener('click', () => deleteEspecialidad(button.dataset.delete));
  });
}

// Con búsqueda activa el contador dice cuántas se están viendo del total.
function actualizarEstado(visibles) {
  const total = currentItems.length;
  if (controls.isFiltered()) {
    tableStatus.textContent = `${visibles.length} de ${total} especialidades.`;
    return;
  }
  tableStatus.textContent = `${total} especialidades.`;
}

function contarVinculos(item) {
  return (item.profesionales || []).length + (item.practicas || []).length;
}

// "11" solo no dice de qué: el desglose va como tooltip del badge.
function tituloContador(item) {
  const prof = (item.profesionales || []).length;
  const prac = (item.practicas || []).length;
  return `${prof} ${prof === 1 ? 'profesional' : 'profesionales'} · ${prac} ${prac === 1 ? 'práctica' : 'prácticas'}`;
}

/* ── Panel de vínculos ─────────────────────────────────────────────────── */

function toggleVinculos(id) {
  if (expandidas.has(id)) colapsar(id);
  else expandir(id);
}

function colapsarTodas() {
  Array.from(expandidas.keys()).forEach(colapsar);
}

function colapsar(id) {
  const abierta = expandidas.get(id);
  if (!abierta) return;
  // Los popovers viven en <body> (portal): hay que sacarlos a mano.
  abierta.cleanups.forEach((fn) => fn());
  abierta.tr.remove();
  expandidas.delete(id);
  const toggle = tableBody.querySelector(`button[data-expand='${id}']`);
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.classList.remove('is-open');
  }
}

function expandir(id) {
  const item = currentItems.find((i) => i.id === id);
  const toggle = tableBody.querySelector(`button[data-expand='${id}']`);
  if (!item || !toggle) return;

  const tr = document.createElement('tr');
  tr.className = 'links-row';
  const td = document.createElement('td');
  td.colSpan = COLUMNAS;
  const panel = document.createElement('div');
  panel.className = 'links-panel';
  td.appendChild(panel);
  tr.appendChild(td);
  toggle.closest('tr').after(tr);

  const abierta = { tr, cleanups: [] };
  expandidas.set(id, abierta);
  toggle.setAttribute('aria-expanded', 'true');
  toggle.classList.add('is-open');
  renderPanel(id, panel, abierta);
}

function renderPanel(id, panel, abierta) {
  abierta.cleanups.forEach((fn) => fn());
  abierta.cleanups = [];
  panel.innerHTML = '';
  const item = currentItems.find((i) => i.id === id);
  if (!item) return;
  SECCIONES.forEach((seccion) => {
    panel.appendChild(renderSeccion(item, seccion, panel, abierta));
  });
}

function renderSeccion(item, seccion, panel, abierta) {
  const vinculados = item[seccion.key] || [];
  const wrapper = document.createElement('section');
  wrapper.className = 'links-section';

  const head = document.createElement('div');
  head.className = 'links-head';
  const titulo = document.createElement('h4');
  titulo.className = 'links-title';
  titulo.textContent = `${seccion.titulo} (${vinculados.length})`;
  head.appendChild(titulo);
  head.appendChild(buildPicker(item, seccion, panel, abierta));
  wrapper.appendChild(head);

  const lista = document.createElement('div');
  lista.className = 'chip-list';
  if (vinculados.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'empty-value';
    vacio.textContent = seccion.vacio;
    lista.appendChild(vacio);
  } else {
    vinculados.forEach((vinculado) => {
      lista.appendChild(buildChip(item, seccion, vinculado, panel, abierta));
    });
  }
  wrapper.appendChild(lista);
  return wrapper;
}

// El nombre abre su panel con el dialog de edición ya abierto, en otra pestaña
// para no perder el lugar en esta tabla. La × sólo rompe el vínculo.
function buildChip(item, seccion, vinculado, panel, abierta) {
  const chip = document.createElement('span');
  chip.className = 'chip chip-interactive';

  const link = document.createElement('a');
  link.className = 'chip-link';
  link.href = `${seccion.pagina}?edit=${vinculado.id}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.title = `Editar ${vinculado.nombre} en ${seccion.titulo}`;
  const label = document.createElement('span');
  label.textContent = vinculado.nombre;
  const externo = document.createElement('span');
  externo.className = 'chip-external';
  externo.innerHTML = ICON_EXTERNAL;
  link.append(label, externo);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'chip-remove';
  remove.setAttribute('aria-label', `Desvincular ${vinculado.nombre}`);
  remove.title = `Desvincular ${vinculado.nombre}`;
  remove.innerHTML = ICON_CLOSE;
  remove.addEventListener('click', () =>
    aplicarVinculo({
      item,
      seccion,
      panel,
      abierta,
      path: `/especialidades/${item.id}/${seccion.key}/${vinculado.id}`,
      options: { method: 'DELETE' },
      okMsg: `${vinculado.nombre} ya no está en ${item.especialidad}`,
      errMsg: 'No se pudo desvincular',
    })
  );

  chip.append(link, remove);
  return chip;
}

function buildPicker(item, seccion, panel, abierta) {
  const root = document.createElement('div');
  root.className = 'ui-select links-add';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'link-button';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.textContent = '+ Vincular';
  root.appendChild(trigger);

  const popover = document.createElement('div');
  popover.className = 'ui-select-popover links-popover hidden';
  popover.setAttribute('role', 'listbox');

  const yaVinculados = new Set((item[seccion.key] || []).map((v) => v.id));
  const catalogo = catalogos[seccion.key] || [];

  function renderOpciones(query = '') {
    const host = dropdown ? dropdown.optionsHost : popover;
    host.innerHTML = '';
    const disponibles = catalogo.filter((c) => !yaVinculados.has(c.id));
    if (disponibles.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'ms-empty hint';
      vacio.textContent = catalogo.length === 0 ? seccion.sinCatalogo : seccion.todoVinculado;
      host.appendChild(vacio);
      return;
    }
    const visibles = disponibles.filter((c) => tablero.matchesQuery(c.nombre, query));
    if (visibles.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'ms-empty hint';
      vacio.textContent = 'Sin resultados.';
      host.appendChild(vacio);
      return;
    }
    visibles.forEach((opcion) => {
      const row = tablero.buildOptionRow({ selected: false, label: opcion.nombre, checkbox: false });
      row.addEventListener('click', () => {
        dropdown.close();
        aplicarVinculo({
          item,
          seccion,
          panel,
          abierta,
          path: `/especialidades/${item.id}/${seccion.key}`,
          options: { method: 'POST', body: JSON.stringify({ [seccion.idKey]: opcion.id }) },
          okMsg: `${opcion.nombre} vinculado a ${item.especialidad}`,
          errMsg: 'No se pudo vincular',
        });
      });
      host.appendChild(row);
    });
  }

  const dropdown = tablero.createDropdown({
    wrapper: root,
    trigger,
    popover,
    onOpen: renderOpciones,
    matchTriggerWidth: false,
    searchable: true,
    searchPlaceholder: `Buscar ${seccion.titulo.toLowerCase()}`,
  });
  // createDropdown hace portal del popover a <body>: al colapsar la fila hay
  // que cerrarlo (saca los listeners globales) y sacarlo del DOM.
  abierta.cleanups.push(() => {
    dropdown.close();
    popover.remove();
  });
  return root;
}

// Aplica un vínculo y repinta sólo esta fila con lo que devolvió el server, en
// vez de recargar la tabla: recargar colapsaría el panel recién usado.
async function aplicarVinculo({ item, panel, abierta, path, options, okMsg, errMsg }) {
  const response = await tablero.fetchWithAuth(path, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    tablero.toast(error.error || errMsg, { variant: 'error' });
    return;
  }
  const actualizado = await response.json();
  const index = currentItems.findIndex((i) => i.id === item.id);
  if (index !== -1) currentItems[index] = actualizado;
  actualizarContador(actualizado);
  renderPanel(actualizado.id, panel, abierta);
  tablero.toast(okMsg);
}

function actualizarContador(item) {
  const toggle = tableBody.querySelector(`button[data-expand='${item.id}']`);
  const fila = toggle && toggle.closest('tr');
  if (!fila) return;
  const titulo = fila.querySelector('.cell-title');
  if (!titulo) return;
  let badge = titulo.querySelector('.link-count');
  const total = contarVinculos(item);
  if (total === 0) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'link-count';
    titulo.appendChild(badge);
  }
  badge.textContent = total;
  badge.title = tituloContador(item);
}

/* ── Especialidad ──────────────────────────────────────────────────────── */

function openDialog(item) {
  if (!item) return;
  editingId = item.id;
  dialogTitle.textContent = 'Editar especialidad';
  submitBtn.textContent = 'Guardar';
  nombreInput.value = item.especialidad;
  descripcionInput.value = item.descripcion || '';
  botInput.checked = item.atendido_por_bot;
  dialog.open();
  nombreInput.focus();
}

async function saveAtendidoPorBot(id, checked) {
  const item = currentItems.find((i) => String(i.id) === String(id));
  const response = await tablero.fetchWithAuth(`/especialidades/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ atendido_por_bot: checked }),
  });
  if (!response.ok) {
    tablero.toast('No se pudo actualizar', { variant: 'error' });
    // Revierte el switch: el estado visual no debe mentir sobre lo guardado.
    const input = tableBody.querySelector(`input[data-bot='${id}']`);
    if (input) input.checked = !checked;
    return;
  }
  if (item) item.atendido_por_bot = checked;
  tablero.toast(checked ? 'Atendido por bot activado' : 'Atendido por bot desactivado', {
    description: item ? item.especialidad : '',
  });
}

async function deleteEspecialidad(id) {
  const item = currentItems.find((i) => String(i.id) === String(id));
  const confirmed = await tablero.confirm({
    title: 'Eliminar especialidad',
    message: `Se va a eliminar "${item ? item.especialidad : 'esta especialidad'}". Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    tone: 'danger',
  });
  if (!confirmed) return;
  const response = await tablero.fetchWithAuth(`/especialidades/${id}`, {
    method: 'DELETE',
  });
  if (response.ok) {
    tablero.toast('Especialidad eliminada', {
      description: item ? item.especialidad : '',
    });
    loadEspecialidades();
  } else {
    tablero.toast('No se pudo eliminar', { variant: 'error' });
  }
}

function escapeHTML(value = '') {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
