const logoutBtn = document.getElementById('logout');
logoutBtn.addEventListener('click', () => {
  tablero.clearToken();
  location.href = 'index.html';
});

tablero.requireAuth();

const form = document.getElementById('texto-form');
const nombreInput = document.getElementById('texto-nombre');
const cuerpoInput = document.getElementById('texto-cuerpo');
const statusEl = document.getElementById('texto-status');
const listEl = document.getElementById('texto-list');

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
  listEl.innerHTML = '';
  textos.forEach(t => {
    const article = document.createElement('article');
    article.className = 'faq-item';
    article.innerHTML = `
      <div>
        <h3>${escapeHTML(t.nombre)}</h3>
        <p>${escapeHTML(t.texto)}</p>
      </div>
      <button class="danger" data-id="${t.id}">Eliminar</button>
    `;
    article.querySelector('button').addEventListener('click', () => deleteTexto(t.id));
    listEl.appendChild(article);
  });
}

async function deleteTexto(id) {
  const response = await tablero.fetchWithAuth(`/textos/${id}`, { method: 'DELETE' });
  if (response.ok) {
    statusEl.textContent = 'Texto eliminado.';
    loadTextos();
  } else {
    statusEl.textContent = 'Error al eliminar.';
  }
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const nombre = nombreInput.value.trim();
  const texto = cuerpoInput.value.trim();
  if (!nombre || !texto) return;

  const response = await tablero.fetchWithAuth('/textos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, texto }),
  });

  if (response.ok) {
    nombreInput.value = '';
    cuerpoInput.value = '';
    statusEl.textContent = 'Texto guardado.';
    loadTextos();
  } else {
    const data = await response.json().catch(() => ({}));
    statusEl.textContent = data.error || 'Error al guardar.';
  }
});

loadTextos();
