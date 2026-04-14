const tableBody = document.getElementById('table-body');
const tableStatus = document.getElementById('table-status');
const logoutLink = document.getElementById('logout-link');

logoutLink.addEventListener('click', () => {
  tablero.clearToken();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', () => {
  tablero.requireAuth();
  loadEspecialidades();
});

async function loadEspecialidades() {
  tableStatus.textContent = 'Cargando especialidades...';
  try {
    const response = await tablero.fetchWithAuth('/especialidades');
    if (!response.ok) {
      throw new Error('No se pudo cargar la lista');
    }
    const items = await response.json();
    renderTable(items);
    tableStatus.textContent = `Se cargaron ${items.length} especialidades.`;
  } catch (err) {
    tableStatus.textContent = err.message;
  }
}

function renderTable(items) {
  tableBody.innerHTML = '';
  items.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHTML(item.especialidad)}</td>
      <td class="checkbox-cell"><input type="checkbox" data-id="${item.id}" ${
      item.activo ? 'checked' : ''
    } /></td>
      <td><textarea data-desc="${item.id}">${escapeHTML(item.descripcion || '')}</textarea></td>
      <td><button data-save="${item.id}">Guardar</button></td>
    `;
    tableBody.appendChild(row);
  });
  tableBody.querySelectorAll('button[data-save]').forEach((button) => {
    button.addEventListener('click', () => saveEspecialidad(button.dataset.save));
  });
}

async function saveEspecialidad(id) {
  const checkbox = document.querySelector(`input[type='checkbox'][data-id='${id}']`);
  const textarea = document.querySelector(`textarea[data-desc='${id}']`);
  const payload = {
    activo: checkbox.checked,
    descripcion: textarea.value.trim(),
  };
  tableStatus.textContent = 'Guardando...';
  const response = await tablero.fetchWithAuth(`/especialidades/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    tableStatus.textContent = error.error || 'No se pudo guardar.';
    return;
  }
  tableStatus.textContent = 'Actualizado correctamente.';
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
