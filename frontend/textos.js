const logoutBtn = document.getElementById('logout');
logoutBtn.addEventListener('click', () => {
  tablero.clearToken();
  location.href = 'index.html';
});

tablero.requireAuth();

const textoTableBody = document.getElementById('texto-table-body');
const statusEl = document.getElementById('texto-status');
const newTextoBtn = document.getElementById('new-texto-btn');

const textoDialogOverlay = document.getElementById('texto-dialog');
const textoDialogTitle = document.getElementById('texto-dialog-title');
const form = document.getElementById('texto-form');
const nombreInput = document.getElementById('texto-nombre');
const cuerpoInput = document.getElementById('texto-cuerpo');
const textoDialogCancel = document.getElementById('texto-dialog-cancel');
const textoDialog = tablero.setupDialog(textoDialogOverlay);

let editingTextoId = null;

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadTextos() {
  const response = await tablero.fetchWithAuth('/textos');
  if (!response.ok) return;
  const textos = await response.json();
  renderTextos(textos);
}

function renderTextos(textos) {
  textoTableBody.innerHTML = '';
  if (textos.length === 0) {
    textoTableBody.innerHTML = '<tr><td colspan="3"><p class="hint">Todavía no hay textos predefinidos.</p></td></tr>';
    return;
  }
  textos.forEach((t) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHTML(t.nombre)}</td>
      <td><p class="desc-preview">${escapeHTML(t.texto)}</p></td>
      <td>
        <div class="row-actions">
          <button type="button" class="link-button" data-edit="${t.id}">Editar</button>
          <button type="button" class="danger" data-delete="${t.id}">Eliminar</button>
        </div>
      </td>
    `;
    textoTableBody.appendChild(row);
  });
  textoTableBody.querySelectorAll('button[data-edit]').forEach((button) => {
    const t = textos.find((item) => String(item.id) === button.dataset.edit);
    button.addEventListener('click', () => openTextoDialog(t));
  });
  textoTableBody.querySelectorAll('button[data-delete]').forEach((button) => {
    const t = textos.find((item) => String(item.id) === button.dataset.delete);
    button.addEventListener('click', () => deleteTexto(button.dataset.delete, t));
  });
}

function openTextoDialog(texto) {
  editingTextoId = texto ? texto.id : null;
  textoDialogTitle.textContent = texto ? 'Editar texto' : 'Nuevo texto';
  nombreInput.value = texto ? texto.nombre : '';
  cuerpoInput.value = texto ? texto.texto : '';
  textoDialog.open();
  nombreInput.focus();
}

async function deleteTexto(id, texto) {
  const confirmed = await tablero.confirm({
    title: 'Eliminar texto',
    message: `Se va a eliminar "${texto ? texto.nombre : 'este texto'}". Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    tone: 'danger',
  });
  if (!confirmed) return;
  const response = await tablero.fetchWithAuth(`/textos/${id}`, { method: 'DELETE' });
  if (response.ok) {
    tablero.toast('Texto eliminado', { description: texto ? texto.nombre : '' });
    loadTextos();
  } else {
    tablero.toast('Error al eliminar.', { variant: 'error' });
  }
}

newTextoBtn.addEventListener('click', () => openTextoDialog(null));
textoDialogCancel.addEventListener('click', () => textoDialog.close());

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = nombreInput.value.trim();
  const texto = cuerpoInput.value.trim();
  if (!nombre || !texto) return;

  const isEditing = editingTextoId !== null;
  const response = await tablero.fetchWithAuth(
    isEditing ? `/textos/${editingTextoId}` : '/textos',
    {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify({ nombre, texto }),
    }
  );

  if (response.ok) {
    textoDialog.close();
    tablero.toast(isEditing ? 'Texto actualizado' : 'Texto creado', { description: nombre });
    loadTextos();
  } else {
    const data = await response.json().catch(() => ({}));
    tablero.toast(data.error || 'Error al guardar.', { variant: 'error' });
  }
});

loadTextos();
