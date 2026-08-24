const profesionalesTableBody = document.getElementById('profesionales-table-body');
const profesionalesStatus = document.getElementById('profesionales-status');
const logoutBtn = document.getElementById('logout');
const newProfesionalBtn = document.getElementById('new-profesional-btn');

const profesionalDialogOverlay = document.getElementById('profesional-dialog');
const profesionalDialogTitle = document.getElementById('profesional-dialog-title');
const profesionalForm = document.getElementById('profesional-form');
const nombreInput = document.getElementById('profesional-nombre-completo');
const especialidadInput = document.getElementById('profesional-especialidad');
const especialidad2Input = document.getElementById('profesional-especialidad2');
const especialidad3Input = document.getElementById('profesional-especialidad3');
const idInput = document.getElementById('profesional-id');
const notawebInput = document.getElementById('profesional-notaweb');
const profesionalDialogCancel = document.getElementById('profesional-dialog-cancel');
const profesionalDialog = tablero.setupDialog(profesionalDialogOverlay);

let editingProfesionalId = null;

logoutBtn.addEventListener('click', () => {
  tablero.clearToken();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', () => {
  tablero.requireAuth();
  loadProfesionales();
});

newProfesionalBtn.addEventListener('click', () => openProfesionalDialog(null));
profesionalDialogCancel.addEventListener('click', () => profesionalDialog.close());

profesionalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const nombre = nombreInput.value.trim();
  if (!nombre) return;

  const isEditing = editingProfesionalId !== null;
  const payload = {
    nombreCompleto: nombre,
    nombreEspecialidad: especialidadInput.value.trim(),
    nombreEspecialidad2: especialidad2Input.value.trim(),
    nombreEspecialidad3: especialidad3Input.value.trim(),
    id_profesional: idInput.value ? Number(idInput.value) : null,
    notaweb: notawebInput.value.trim(),
  };

  const response = await tablero.fetchWithAuth(
    isEditing ? `/profesionales/${editingProfesionalId}` : '/profesionales',
    {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    tablero.toast(error.error || 'No se pudo guardar el profesional.', { variant: 'error' });
    return;
  }

  profesionalDialog.close();
  tablero.toast(isEditing ? 'Profesional actualizado' : 'Profesional creado', { description: nombre });
  loadProfesionales();
});

async function loadProfesionales() {
  try {
    const response = await tablero.fetchWithAuth('/profesionales');
    if (!response.ok) {
      throw new Error('No se pudieron cargar los profesionales.');
    }
    const profesionales = await response.json();
    renderProfesionales(profesionales);
    profesionalesStatus.textContent = profesionales.length ? `${profesionales.length} profesionales.` : '';
  } catch (err) {
    profesionalesStatus.textContent = '';
    tablero.toast(err.message, { variant: 'error' });
  }
}

function renderProfesionales(profesionales) {
  profesionalesTableBody.innerHTML = '';
  if (profesionales.length === 0) {
    profesionalesTableBody.innerHTML = '<tr><td colspan="5"><p class="hint">Todavía no hay profesionales cargados.</p></td></tr>';
    return;
  }

  profesionales.forEach((profesional) => {
    const row = document.createElement('tr');
    const specialties = [profesional.nombreEspecialidad, profesional.nombreEspecialidad2, profesional.nombreEspecialidad3]
      .filter(Boolean).map(escapeHTML).join('<br>') || '—';
    row.innerHTML = `
      <td>
        <strong>${escapeHTML(profesional.nombreCompleto || profesional.nombre || '')}</strong>
        ${profesional.id_profesional ? `<small>ID: ${escapeHTML(String(profesional.id_profesional))}</small>` : ''}
      </td>
      <td>${specialties}</td>
      <td>${escapeHTML(profesional.notaweb_efectiva || '—')}</td>
      <td>
        <div class="manual-criteria" data-profesional-id="${profesional.id}">
          ${criteriaSelect('genero', profesional.criterio_genero, [['', 'Género'], ['femenino', 'Femenino'], ['masculino', 'Masculino'], ['otro', 'Otro']])}
          ${criteriaSelect('edad-desde', profesional.criterio_edad_desde, [['', 'Edad desde'], ...ageOptions()])}
          ${criteriaSelect('edad-hasta', profesional.criterio_edad_hasta, [['', 'Edad hasta'], ...ageOptions()])}
          <button type="button" class="save-criteria" data-save-criteria="${profesional.id}">Guardar</button>
        </div>
      </td>
      <td>
        <div class="row-actions">
          <button type="button" class="link-button" data-edit="${profesional.id}">Editar</button>
          <button type="button" class="danger" data-delete="${profesional.id}">Eliminar</button>
        </div>
      </td>
    `;
    profesionalesTableBody.appendChild(row);
  });

  profesionalesTableBody.querySelectorAll('button[data-edit]').forEach((button) => {
    const profesional = profesionales.find((item) => String(item.id) === button.dataset.edit);
    button.addEventListener('click', () => openProfesionalDialog(profesional));
  });

  profesionalesTableBody.querySelectorAll('button[data-save-criteria]').forEach((button) => {
    button.addEventListener('click', () => saveCriteria(button.dataset.saveCriteria, button.closest('.manual-criteria')));
  });

  profesionalesTableBody.querySelectorAll('button[data-delete]').forEach((button) => {
    const profesional = profesionales.find((item) => String(item.id) === button.dataset.delete);
    button.addEventListener('click', () => deleteProfesional(button.dataset.delete, profesional));
  });
}

function openProfesionalDialog(profesional) {
  editingProfesionalId = profesional ? profesional.id : null;
  profesionalDialogTitle.textContent = profesional ? 'Editar profesional' : 'Nuevo profesional';
  nombreInput.value = profesional ? profesional.nombreCompleto || profesional.nombre || '' : '';
  especialidadInput.value = profesional ? profesional.nombreEspecialidad || profesional.especialidad || '' : '';
  especialidad2Input.value = profesional ? profesional.nombreEspecialidad2 || '' : '';
  especialidad3Input.value = profesional ? profesional.nombreEspecialidad3 || '' : '';
  idInput.value = profesional && profesional.id_profesional ? profesional.id_profesional : '';
  notawebInput.value = profesional ? profesional.notaweb || '' : '';
  profesionalDialog.open();
  nombreInput.focus();
}

async function deleteProfesional(id, profesional) {
  const confirmed = await tablero.confirm({
    title: 'Eliminar profesional',
    message: `Se va a eliminar "${profesional ? profesional.nombre : 'este profesional'}". Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    tone: 'danger',
  });
  if (!confirmed) return;

  const response = await tablero.fetchWithAuth(`/profesionales/${id}`, { method: 'DELETE' });
  if (response.ok) {
    tablero.toast('Profesional eliminado', { description: profesional ? profesional.nombre : '' });
    loadProfesionales();
  } else {
    tablero.toast('No se pudo eliminar el profesional.', { variant: 'error' });
  }
}

function criteriaSelect(name, value, options) {
  return `<select data-criteria="${name}">${options.map(([optionValue, label]) =>
    `<option value="${escapeHTML(String(optionValue))}" ${String(value ?? '') === String(optionValue) ? 'selected' : ''}>${escapeHTML(label)}</option>`
  ).join('')}</select>`;
}

function ageOptions() {
  return Array.from({ length: 121 }, (_, age) => [String(age), String(age)]);
}

async function saveCriteria(id, container) {
  const selects = container.querySelectorAll('select[data-criteria]');
  const payload = {};
  selects.forEach((select) => {
    payload[`criterio_${select.dataset.criteria.replace('-', '_')}`] = select.value ? Number(select.value) || select.value : null;
  });
  const response = await tablero.fetchWithAuth(`/profesionales/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (response.ok) {
    tablero.toast('Criterio manual guardado');
    loadProfesionales();
  } else {
    tablero.toast('No se pudo guardar el criterio manual.', { variant: 'error' });
  }
}

function escapeHTML(value = '') {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
