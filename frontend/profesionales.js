const profesionalesTableBody = document.getElementById('profesionales-table-body');
const profesionalesStatus = document.getElementById('profesionales-status');
const logoutBtn = document.getElementById('logout');
const newProfesionalBtn = document.getElementById('new-profesional-btn');

const profesionalDialogOverlay = document.getElementById('profesional-dialog');
const profesionalDialogTitle = document.getElementById('profesional-dialog-title');
const profesionalForm = document.getElementById('profesional-form');
const nombreInput = document.getElementById('profesional-nombre');
const especialidadInput = document.getElementById('profesional-especialidad');
const cargoInput = document.getElementById('profesional-cargo');
const telefonoInput = document.getElementById('profesional-telefono');
const emailInput = document.getElementById('profesional-email');
const descripcionInput = document.getElementById('profesional-descripcion');
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
    nombre,
    especialidad: especialidadInput.value.trim(),
    cargo: cargoInput.value.trim(),
    telefono: telefonoInput.value.trim(),
    email: emailInput.value.trim(),
    descripcion: descripcionInput.value.trim(),
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
    row.innerHTML = `
      <td>${escapeHTML(profesional.nombre)}</td>
      <td>${escapeHTML(profesional.especialidad || '—')}</td>
      <td>${escapeHTML(profesional.cargo || '—')}</td>
      <td>
        <div class="contact-stack">
          ${profesional.telefono ? `<div>${escapeHTML(profesional.telefono)}</div>` : '<div class="empty-value">Sin teléfono</div>'}
          ${profesional.email ? `<div>${escapeHTML(profesional.email)}</div>` : '<div class="empty-value">Sin email</div>'}
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

  profesionalesTableBody.querySelectorAll('button[data-delete]').forEach((button) => {
    const profesional = profesionales.find((item) => String(item.id) === button.dataset.delete);
    button.addEventListener('click', () => deleteProfesional(button.dataset.delete, profesional));
  });
}

function openProfesionalDialog(profesional) {
  editingProfesionalId = profesional ? profesional.id : null;
  profesionalDialogTitle.textContent = profesional ? 'Editar profesional' : 'Nuevo profesional';
  nombreInput.value = profesional ? profesional.nombre : '';
  especialidadInput.value = profesional ? profesional.especialidad || '' : '';
  cargoInput.value = profesional ? profesional.cargo || '' : '';
  telefonoInput.value = profesional ? profesional.telefono || '' : '';
  emailInput.value = profesional ? profesional.email || '' : '';
  descripcionInput.value = profesional ? profesional.descripcion || '' : '';
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

function escapeHTML(value = '') {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
