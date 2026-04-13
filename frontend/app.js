const tokenKey = 'tablero-especialidades-token';
const API = window.API_URL || 'http://localhost:5000';
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const tableBody = document.getElementById('table-body');
const logoutBtn = document.getElementById('logout');
const tableStatus = document.getElementById('table-status');
const clinicForm = document.getElementById('clinic-form');
const clinicStatus = document.getElementById('clinic-status');
const tabButtons = document.querySelectorAll('[data-target]');
const panels = document.querySelectorAll('.panel');
const clinicFields = {
  descripcion: document.getElementById('clinic-description'),
  direccion: document.getElementById('clinic-address'),
  ubicacion_url: document.getElementById('clinic-location-url'),
  pagina_web: document.getElementById('clinic-website'),
};

let token = localStorage.getItem(tokenKey);
const escapeHTML = (value = '') =>
  value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

const showPanel = (target) => {
  panels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== `${target}-panel`);
  });
  tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.target === target);
  });
};

if (token) {
  showApp();
  loadEspecialidades();
  loadClinic();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!username || !password) {
    loginError.textContent = 'Completá usuario y contraseña.';
    return;
  }
  const response = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    loginError.textContent = payload.error || 'Credenciales inválidas';
    return;
  }
  const data = await response.json();
  token = data.token;
  localStorage.setItem(tokenKey, token);
  showApp();
  loadEspecialidades();
  loadClinic();
});

logoutBtn.addEventListener('click', () => {
  token = null;
  localStorage.removeItem(tokenKey);
  showLogin();
});

tabButtons.forEach((button) => {
  button.addEventListener('click', () => showPanel(button.dataset.target));
});

clinicForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await saveClinic();
});

function showApp() {
  loginSection.classList.add('hidden');
  appSection.classList.remove('hidden');
}

function showLogin() {
  loginSection.classList.remove('hidden');
  appSection.classList.add('hidden');
}

async function loadEspecialidades() {
  if (!token) {
    showLogin();
    return;
  }
  tableStatus.textContent = 'Cargando especialidades...';
  try {
    const response = await fetch(`${API}/especialidades`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 401) {
        loginError.textContent = 'Sesión expirada. Volvé a iniciar sesión.';
        showLogin();
        return;
      }
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
  const response = await fetch(`${API}/especialidades/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    tableStatus.textContent = error.error || 'No se pudo guardar.';
    return;
  }
  tableStatus.textContent = 'Actualizado correctamente.';
}

async function loadClinic() {
  if (!token) {
    showLogin();
    return;
  }
  try {
    const response = await fetch(`${API}/clinic`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error('No se pudo cargar la información de la clínica');
    }
    const info = await response.json();
    clinicFields.descripcion.value = info.descripcion || '';
    clinicFields.direccion.value = info.direccion || '';
    clinicFields.ubicacion_url.value = info.ubicacion_url || '';
    clinicFields.pagina_web.value = info.pagina_web || '';
    clinicStatus.textContent = '';
  } catch (err) {
    clinicStatus.textContent = err.message;
  }
}

async function saveClinic() {
  if (!token) {
    showLogin();
    return;
  }
  const payload = {
    descripcion: clinicFields.descripcion.value.trim(),
    direccion: clinicFields.direccion.value.trim(),
    ubicacion_url: clinicFields.ubicacion_url.value.trim(),
    pagina_web: clinicFields.pagina_web.value.trim(),
  };
  clinicStatus.textContent = 'Guardando información...';
  const response = await fetch(`${API}/clinic`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    clinicStatus.textContent = error.error || 'No se pudo guardar la información.';
    return;
  }
  clinicStatus.textContent = 'Datos guardados correctamente.';
}
