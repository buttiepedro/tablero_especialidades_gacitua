const clinicForm = document.getElementById('clinic-form');
const clinicStatus = document.getElementById('clinic-status');
const clinicFields = {
  descripcion: document.getElementById('clinic-description'),
  direccion: document.getElementById('clinic-address'),
  ubicacion_url: document.getElementById('clinic-location-url'),
  pagina_web: document.getElementById('clinic-website'),
};
const clinicView = {
  descripcion: document.getElementById('view-descripcion'),
  direccion: document.getElementById('view-direccion'),
  ubicacion_url: document.getElementById('view-ubicacion-url'),
  pagina_web: document.getElementById('view-pagina-web'),
};
const logoutButton = document.getElementById('logout');
const editClinicBtn = document.getElementById('edit-clinic-btn');
const clinicDialogOverlay = document.getElementById('clinic-dialog');
const clinicDialogCancel = document.getElementById('clinic-dialog-cancel');
const clinicDialog = tablero.setupDialog(clinicDialogOverlay);

logoutButton.addEventListener('click', () => {
  tablero.clearToken();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', () => {
  tablero.requireAuth();
  loadClinicInfo();
});

editClinicBtn.addEventListener('click', () => {
  clinicDialog.open();
  clinicFields.descripcion.focus();
});

clinicDialogCancel.addEventListener('click', () => clinicDialog.close());

clinicForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await saveClinicInfo();
});

async function loadClinicInfo() {
  try {
    const response = await tablero.fetchWithAuth('/clinic');
    if (!response.ok) {
      throw new Error('No se pudo cargar la información de la clínica');
    }
    const info = await response.json();
    clinicFields.descripcion.value = info.descripcion || '';
    clinicFields.direccion.value = info.direccion || '';
    clinicFields.ubicacion_url.value = info.ubicacion_url || '';
    clinicFields.pagina_web.value = info.pagina_web || '';
    renderClinicView(info);
    clinicStatus.textContent = '';
  } catch (err) {
    tablero.toast(err.message, { variant: 'error' });
  }
}

function renderClinicView(info) {
  setValue(clinicView.descripcion, info.descripcion, 'Sin descripción');
  setValue(clinicView.direccion, info.direccion, 'Sin dirección');
  setValue(clinicView.ubicacion_url, info.ubicacion_url, 'Sin URL');
  setValue(clinicView.pagina_web, info.pagina_web, 'Sin página web');
}

// Un valor vacío se muestra atenuado para no confundirse con un dato cargado.
function setValue(el, value, emptyLabel) {
  el.textContent = value || emptyLabel;
  el.classList.toggle('empty-value', !value);
}

async function saveClinicInfo() {
  const payload = {
    descripcion: clinicFields.descripcion.value.trim(),
    direccion: clinicFields.direccion.value.trim(),
    ubicacion_url: clinicFields.ubicacion_url.value.trim(),
    pagina_web: clinicFields.pagina_web.value.trim(),
  };
  const response = await tablero.fetchWithAuth('/clinic', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    tablero.toast(error.error || 'No se pudo guardar la información.', { variant: 'error' });
    return;
  }
  renderClinicView(payload);
  clinicDialog.close();
  tablero.toast('Datos guardados', { description: 'Información general de la clínica' });
}
