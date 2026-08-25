const tableBody = document.getElementById('table-body');
const tableStatus = document.getElementById('table-status');
const logoutLink = document.getElementById('logout-link');
const searchInput = document.getElementById('table-search');

const newBtn = document.getElementById('new-practica-btn');
const dialogOverlay = document.getElementById('practica-dialog');
const dialogTitle = document.getElementById('practica-dialog-title');
const form = document.getElementById('practica-form');
const nombreInput = document.getElementById('practica-nombre');
const descripcionInput = document.getElementById('practica-descripcion');
const botInput = document.getElementById('practica-bot');
const cancelBtn = document.getElementById('practica-cancel');
const submitBtn = document.getElementById('practica-submit');
const dialog = tablero.setupDialog(dialogOverlay);

const especialidadesSelect = tablero.createMultiSelect(
  document.getElementById('practica-especialidades-select'),
  { placeholder: 'Seleccionar especialidades' }
);

let editingId = null;
let currentItems = [];

const controls = tablero.createTableControls({
  table: document.querySelector('.table-wrapper table'),
  searchInput,
  searchFields: (item) => [item.nombre, item.descripcion, ...(item.especialidades || [])],
  columns: {
    nombre: (item) => item.nombre,
    especialidades: (item) => (item.especialidades || []).join(', '),
    descripcion: (item) => item.descripcion || '',
  },
  onChange: renderTable,
});

logoutLink.addEventListener('click', () => {
  tablero.clearToken();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', async () => {
  tablero.requireAuth();
  // Se esperan las dos cargas antes de atender un ?edit=: el multiselect sólo
  // pinta chips de opciones que ya tiene seteadas.
  await Promise.all([loadEspecialidadesOptions(), loadPracticas()]);
  abrirDesdeURL();
});

// Deep-link desde Especialidades: abre este panel con el dialog de edición ya
// abierto sobre el ítem indicado.
function abrirDesdeURL() {
  const id = new URLSearchParams(window.location.search).get('edit');
  if (!id) return;
  const item = currentItems.find((i) => String(i.id) === String(id));
  if (!item) {
    tablero.toast('No se encontró la práctica que se quería editar.', { variant: 'warning' });
    return;
  }
  openDialog(item);
}

newBtn.addEventListener('click', () => openDialog(null));
cancelBtn.addEventListener('click', () => dialog.close());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const nombre = nombreInput.value.trim();
  if (!nombre) return;

  const isEditing = editingId !== null;
  const payload = {
    nombre,
    especialidad_ids: especialidadesSelect.getValue(),
    descripcion: descripcionInput.value.trim(),
    atendido_por_bot: botInput.checked,
  };
  const response = await tablero.fetchWithAuth(
    isEditing ? `/practicas/${editingId}` : '/practicas',
    {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    tablero.toast(error.error || 'No se pudo guardar la práctica.', { variant: 'error' });
    return;
  }
  dialog.close();
  tablero.toast(
    isEditing ? 'Práctica actualizada' : 'Práctica creada',
    { description: nombre }
  );
  loadPracticas();
});

async function loadEspecialidadesOptions() {
  try {
    const response = await tablero.fetchWithAuth('/especialidades');
    if (!response.ok) return;
    const items = await response.json();
    especialidadesSelect.setOptions(items.map((e) => ({ id: e.id, nombre: e.especialidad })));
  } catch (err) {
    // Si falla, el multiselect queda vacío; el usuario puede reintentar recargando la página.
  }
}

async function loadPracticas() {
  tableStatus.textContent = 'Cargando prácticas...';
  try {
    const response = await tablero.fetchWithAuth('/practicas');
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
  tableBody.innerHTML = '';
  actualizarEstado(items);
  if (items.length === 0) {
    const vacio = controls.isFiltered()
      ? 'Ninguna práctica coincide con la búsqueda.'
      : 'Todavía no hay prácticas cargadas.';
    tableBody.innerHTML = `<tr><td colspan="5"><p class="hint">${vacio}</p></td></tr>`;
    return;
  }
  items.forEach((item) => {
    const row = document.createElement('tr');
    const espCell = item.especialidades.length
      ? `<div class="chip-list">${item.especialidades.map((n) => `<span class="chip-static">${escapeHTML(n)}</span>`).join('')}</div>`
      : '<p class="empty-value">Sin especialidad</p>';
    const descCell = item.descripcion
      ? `<p class="desc-preview">${escapeHTML(item.descripcion)}</p>`
      : '<p class="empty-value">Sin descripción</p>';
    row.innerHTML = `
      <td>${escapeHTML(item.nombre)}</td>
      <td>${espCell}</td>
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
  tableBody.querySelectorAll('button[data-edit]').forEach((button) => {
    const item = items.find((i) => String(i.id) === button.dataset.edit);
    button.addEventListener('click', () => openDialog(item));
  });
  tableBody.querySelectorAll('input[data-bot]').forEach((input) => {
    input.addEventListener('change', () => saveAtendidoPorBot(input.dataset.bot, input.checked));
  });
  tableBody.querySelectorAll('button[data-delete]').forEach((button) => {
    button.addEventListener('click', () => deletePractica(button.dataset.delete));
  });
}

// Con búsqueda activa el contador dice cuántas se están viendo del total.
function actualizarEstado(visibles) {
  const total = currentItems.length;
  tableStatus.textContent = controls.isFiltered()
    ? `${visibles.length} de ${total} prácticas.`
    : `${total} prácticas.`;
}

function openDialog(item) {
  editingId = item ? item.id : null;
  dialogTitle.textContent = item ? 'Editar práctica' : 'Nueva práctica';
  submitBtn.textContent = item ? 'Guardar' : 'Crear';
  nombreInput.value = item ? item.nombre : '';
  especialidadesSelect.setValue(item ? item.especialidad_ids : []);
  descripcionInput.value = item ? item.descripcion || '' : '';
  botInput.checked = item ? item.atendido_por_bot : true;
  dialog.open();
  nombreInput.focus();
}

async function saveAtendidoPorBot(id, checked) {
  const item = currentItems.find((i) => String(i.id) === String(id));
  const response = await tablero.fetchWithAuth(`/practicas/${id}`, {
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
    description: item ? item.nombre : '',
  });
}

async function deletePractica(id) {
  const item = currentItems.find((i) => String(i.id) === String(id));
  const confirmed = await tablero.confirm({
    title: 'Eliminar práctica',
    message: `Se va a eliminar "${item ? item.nombre : 'esta práctica'}". Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    tone: 'danger',
  });
  if (!confirmed) return;
  const response = await tablero.fetchWithAuth(`/practicas/${id}`, {
    method: 'DELETE',
  });
  if (response.ok) {
    tablero.toast('Práctica eliminada', {
      description: item ? item.nombre : '',
    });
    loadPracticas();
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
