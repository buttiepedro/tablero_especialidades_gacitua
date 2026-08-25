const tableBody = document.getElementById('table-body');
const tableStatus = document.getElementById('table-status');
const logoutLink = document.getElementById('logout-link');
const searchInput = document.getElementById('table-search');

const dialogOverlay = document.getElementById('profesional-dialog');
const dialogTitle = document.getElementById('profesional-dialog-title');
const form = document.getElementById('profesional-form');
const nombreInput = document.getElementById('profesional-nombre');
const edadMinInput = document.getElementById('profesional-edad-min');
const edadMaxInput = document.getElementById('profesional-edad-max');
const cancelBtn = document.getElementById('profesional-cancel');
const submitBtn = document.getElementById('profesional-submit');
const dialog = tablero.setupDialog(dialogOverlay);

const especialidadesSelect = tablero.createMultiSelect(
  document.getElementById('profesional-especialidades-select'),
  { placeholder: 'Seleccionar especialidades' }
);
const sexoSelect = tablero.createSelect(
  document.getElementById('profesional-sexo-select'),
  {
    placeholder: 'Sin especificar',
    options: [
      { value: '', label: 'Sin especificar' },
      { value: 'masculino', label: 'Masculino' },
      { value: 'femenino', label: 'Femenino' },
    ],
  }
);
const generoSelect = tablero.createSelect(
  document.getElementById('profesional-genero-select'),
  {
    placeholder: 'Sin restricción',
    options: [
      { value: '', label: 'Sin restricción' },
      { value: 'masculino', label: 'Masculino' },
      { value: 'femenino', label: 'Femenino' },
    ],
  }
);
const prioridadSelect = tablero.createSelect(
  document.getElementById('profesional-prioridad-select'),
  {
    placeholder: 'Sin prioridad',
    options: [
      { value: '', label: 'Sin prioridad' },
      { value: '1', label: '1 — más prioritario' },
      { value: '2', label: '2' },
      { value: '3', label: '3 — menos prioritario' },
    ],
  }
);

let editingId = null;
let currentItems = [];

// Sin orden elegido se respeta el que trae el backend (prioridad asc, nulls al
// final). Las restricciones se ordenan por edad mínima, que es lo comparable.
const controls = tablero.createTableControls({
  table: document.querySelector('.table-wrapper table'),
  searchInput,
  searchFields: (item) => [item.nombre, ...(item.especialidades || [])],
  columns: {
    nombre: (item) => item.nombre,
    sexo: (item) => item.sexo || '',
    especialidades: (item) => (item.especialidades || []).join(', '),
    restricciones: (item) => (item.edad_min != null ? item.edad_min : (item.edad_max != null ? 0 : '')),
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
  await Promise.all([loadEspecialidadesOptions(), loadProfesionales()]);
  abrirDesdeURL();
});

// Deep-link desde Especialidades: abre este panel con el dialog de edición ya
// abierto sobre el ítem indicado.
function abrirDesdeURL() {
  const id = new URLSearchParams(window.location.search).get('edit');
  if (!id) return;
  const item = currentItems.find((i) => String(i.id) === String(id));
  if (!item) {
    tablero.toast('No se encontró el profesional que se quería editar.', { variant: 'warning' });
    return;
  }
  openDialog(item);
}

cancelBtn.addEventListener('click', () => dialog.close());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const nombre = nombreInput.value.trim();
  if (!nombre) return;

  // Alta no: los profesionales entran por la importacion desde Gacitua, que es la
  // que trae el id_profesional. Desde acá solo se editan.
  if (editingId === null) return;

  const payload = {
    nombre,
    sexo: sexoSelect.getValue() || null,
    especialidad_ids: especialidadesSelect.getValue(),
    edad_min: edadMinInput.value === '' ? null : Number(edadMinInput.value),
    edad_max: edadMaxInput.value === '' ? null : Number(edadMaxInput.value),
    genero: generoSelect.getValue() || null,
    prioridad: prioridadSelect.getValue() ? Number(prioridadSelect.getValue()) : null,
  };
  const response = await tablero.fetchWithAuth(`/profesionales/${editingId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    tablero.toast(error.error || 'No se pudo guardar el profesional.', { variant: 'error' });
    return;
  }
  dialog.close();
  tablero.toast('Profesional actualizado', { description: nombre });
  loadProfesionales();
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

async function loadProfesionales() {
  tableStatus.textContent = 'Cargando profesionales...';
  try {
    const response = await tablero.fetchWithAuth('/profesionales');
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
      ? 'Ningún profesional coincide con la búsqueda.'
      : 'Todavía no hay profesionales importados desde Gacitua.';
    tableBody.innerHTML = `<tr><td colspan="6"><p class="hint">${vacio}</p></td></tr>`;
    return;
  }
  items.forEach((item) => {
    const row = document.createElement('tr');
    const sexoCell = item.sexo
      ? (item.sexo === 'masculino' ? 'Masculino' : 'Femenino')
      : '<p class="empty-value">Sin especificar</p>';
    const espCell = item.especialidades.length
      ? `<div class="chip-list">${item.especialidades.map((n) => `<span class="chip-static">${escapeHTML(n)}</span>`).join('')}</div>`
      : '<p class="empty-value">Sin especialidad</p>';
    const restrCell = formatRestricciones(item);
    const prioridadCell = item.prioridad
      ? `<span class="priority-badge">${item.prioridad}</span>`
      : '<p class="empty-value">Sin prioridad</p>';
    const idCell = item.id_profesional
      ? `<p class="empty-value">Gacitua #${item.id_profesional}</p>`
      : '<p class="empty-value">Sin vincular con Gacitua</p>';
    row.innerHTML = `
      <td>${escapeHTML(item.nombre)}${idCell}</td>
      <td>${sexoCell}</td>
      <td>${espCell}</td>
      <td>${restrCell}</td>
      <td>${prioridadCell}</td>
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
  tableBody.querySelectorAll('button[data-delete]').forEach((button) => {
    button.addEventListener('click', () => deleteProfesional(button.dataset.delete));
  });
}

// Con búsqueda activa el contador dice cuántos se están viendo del total.
function actualizarEstado(visibles) {
  const total = currentItems.length;
  tableStatus.textContent = controls.isFiltered()
    ? `${visibles.length} de ${total} profesionales.`
    : `${total} profesionales.`;
}

function formatRestricciones(item) {
  const parts = [];
  if (item.edad_min != null && item.edad_max != null) {
    parts.push(`${item.edad_min}–${item.edad_max} años`);
  } else if (item.edad_min != null) {
    parts.push(`Desde ${item.edad_min} años`);
  } else if (item.edad_max != null) {
    parts.push(`Hasta ${item.edad_max} años`);
  }
  if (item.genero) {
    parts.push(item.genero === 'masculino' ? 'Masculino' : 'Femenino');
  }
  if (parts.length === 0) {
    return '<p class="empty-value">Sin restricciones</p>';
  }
  return `<p class="desc-preview">${escapeHTML(parts.join(' · '))}</p>`;
}

function openDialog(item) {
  if (!item) return;
  editingId = item.id;
  dialogTitle.textContent = 'Editar profesional';
  submitBtn.textContent = 'Guardar';
  nombreInput.value = item ? item.nombre : '';
  sexoSelect.setValue(item && item.sexo ? item.sexo : '');
  especialidadesSelect.setValue(item ? item.especialidad_ids : []);
  edadMinInput.value = item && item.edad_min != null ? item.edad_min : '';
  edadMaxInput.value = item && item.edad_max != null ? item.edad_max : '';
  generoSelect.setValue(item && item.genero ? item.genero : '');
  prioridadSelect.setValue(item && item.prioridad ? String(item.prioridad) : '');
  dialog.open();
  nombreInput.focus();
}

async function deleteProfesional(id) {
  const item = currentItems.find((i) => String(i.id) === String(id));
  const confirmed = await tablero.confirm({
    title: 'Eliminar profesional',
    message: `Se va a eliminar "${item ? item.nombre : 'este profesional'}". Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    tone: 'danger',
  });
  if (!confirmed) return;
  const response = await tablero.fetchWithAuth(`/profesionales/${id}`, {
    method: 'DELETE',
  });
  if (response.ok) {
    tablero.toast('Profesional eliminado', {
      description: item ? item.nombre : '',
    });
    loadProfesionales();
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
