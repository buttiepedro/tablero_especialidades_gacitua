const tableBody = document.getElementById('table-body');
const tableStatus = document.getElementById('table-status');
const logoutLink = document.getElementById('logout-link');

const newBtn = document.getElementById('new-especialidad-btn');
const dialogOverlay = document.getElementById('especialidad-dialog');
const dialogTitle = document.getElementById('especialidad-dialog-title');
const form = document.getElementById('especialidad-form');
const nombreInput = document.getElementById('especialidad-nombre');
const descripcionInput = document.getElementById('especialidad-descripcion');
const botInput = document.getElementById('especialidad-bot');
const cancelBtn = document.getElementById('especialidad-cancel');
const submitBtn = document.getElementById('especialidad-submit');
const dialog = tablero.setupDialog(dialogOverlay);

let editingId = null;
let currentItems = [];

logoutLink.addEventListener('click', () => {
  tablero.clearToken();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', () => {
  tablero.requireAuth();
  loadEspecialidades();
});

newBtn.addEventListener('click', () => openDialog(null));
cancelBtn.addEventListener('click', () => dialog.close());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const especialidad = nombreInput.value.trim();
  if (!especialidad) return;

  const isEditing = editingId !== null;
  const payload = {
    especialidad,
    descripcion: descripcionInput.value.trim(),
    atendido_por_bot: botInput.checked,
  };
  const response = await tablero.fetchWithAuth(
    isEditing ? `/especialidades/${editingId}` : '/especialidades',
    {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    tablero.toast(error.error || 'No se pudo guardar la especialidad.', { variant: 'error' });
    return;
  }
  dialog.close();
  tablero.toast(
    isEditing ? 'Especialidad actualizada' : 'Especialidad creada',
    { description: especialidad }
  );
  loadEspecialidades();
});

async function loadEspecialidades() {
  tableStatus.textContent = 'Cargando especialidades...';
  try {
    const response = await tablero.fetchWithAuth('/especialidades');
    if (!response.ok) {
      throw new Error('No se pudo cargar la lista');
    }
    currentItems = await response.json();
    renderTable(currentItems);
    tableStatus.textContent = `${currentItems.length} especialidades.`;
  } catch (err) {
    tableStatus.textContent = '';
    tablero.toast(err.message, { variant: 'error' });
  }
}

function renderTable(items) {
  tableBody.innerHTML = '';
  if (items.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4"><p class="hint">Todavía no hay especialidades cargadas.</p></td></tr>';
    return;
  }
  items.forEach((item) => {
    const row = document.createElement('tr');
    const descCell = item.descripcion
      ? `<p class="desc-preview">${escapeHTML(item.descripcion)}</p>`
      : '<p class="empty-value">Sin descripción</p>';
    row.innerHTML = `
      <td>${escapeHTML(item.especialidad)}</td>
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
    button.addEventListener('click', () => deleteEspecialidad(button.dataset.delete));
  });
}

function openDialog(item) {
  editingId = item ? item.id : null;
  dialogTitle.textContent = item ? 'Editar especialidad' : 'Nueva especialidad';
  submitBtn.textContent = item ? 'Guardar' : 'Crear';
  nombreInput.value = item ? item.especialidad : '';
  descripcionInput.value = item ? item.descripcion || '' : '';
  botInput.checked = item ? item.atendido_por_bot : true;
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
