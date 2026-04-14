const clinicForm = document.getElementById('clinic-form');
const clinicStatus = document.getElementById('clinic-status');
const clinicFields = {
  descripcion: document.getElementById('clinic-description'),
  direccion: document.getElementById('clinic-address'),
  ubicacion_url: document.getElementById('clinic-location-url'),
  pagina_web: document.getElementById('clinic-website'),
};
const logoutButton = document.getElementById('logout');

logoutButton.addEventListener('click', () => {
  tablero.clearToken();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', () => {
  tablero.requireAuth();
  loadClinicInfo();
});

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
    clinicStatus.textContent = '';
  } catch (err) {
    clinicStatus.textContent = err.message;
  }
}

async function saveClinicInfo() {
  const payload = {
    descripcion: clinicFields.descripcion.value.trim(),
    direccion: clinicFields.direccion.value.trim(),
    ubicacion_url: clinicFields.ubicacion_url.value.trim(),
    pagina_web: clinicFields.pagina_web.value.trim(),
  };
  clinicStatus.textContent = 'Guardando información...';
  const response = await tablero.fetchWithAuth('/clinic', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    clinicStatus.textContent = error.error || 'No se pudo guardar la información.';
    return;
  }
  clinicStatus.textContent = 'Datos guardados correctamente.';
}
