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
// El item completo, no solo el id: el acceso a los horarios desde el dialog de edición
// necesita sus franjas y sus especialidades.
let editingItem = null;
let currentItems = [];

// Sin orden elegido se respeta el que trae el backend (prioridad asc, nulls al
// final). Las restricciones se ordenan por edad mínima, que es lo comparable.
const controls = tablero.createTableControls({
  table: document.querySelector('.table-wrapper table'),
  searchInput,
  // Los días entran a la búsqueda: "martes" filtra a los que atienden ese día.
  searchFields: (item) => [
    item.nombre,
    ...(item.especialidades || []),
    ...diasDeFranjas(item.horarios).map((d) => d.largo),
  ],
  columns: {
    nombre: (item) => item.nombre,
    sexo: (item) => item.sexo || '',
    especialidades: (item) => (item.especialidades || []).join(', '),
    horarios: (item) => (item.horarios || []).length,
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
    tableBody.innerHTML = `<tr><td colspan="7"><p class="hint">${vacio}</p></td></tr>`;
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
    const horariosCell = formatHorarios(item);
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
      <td>${horariosCell}</td>
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
  tableBody.querySelectorAll('button[data-horarios]').forEach((button) => {
    const item = items.find((i) => String(i.id) === button.dataset.horarios);
    button.addEventListener('click', () => openHorarios(item));
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
  editingItem = item;
  dialogTitle.textContent = 'Editar profesional';
  submitBtn.textContent = 'Guardar';
  nombreInput.value = item ? item.nombre : '';
  sexoSelect.setValue(item && item.sexo ? item.sexo : '');
  especialidadesSelect.setValue(item ? item.especialidad_ids : []);
  edadMinInput.value = item && item.edad_min != null ? item.edad_min : '';
  edadMaxInput.value = item && item.edad_max != null ? item.edad_max : '';
  generoSelect.setValue(item && item.genero ? item.genero : '');
  prioridadSelect.setValue(item && item.prioridad ? String(item.prioridad) : '');
  renderResumenHorarios();
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

/* ── Horarios de atención ───────────────────────────────────────────────────
 * Franjas en las que atiende cada profesional. Son informativas: alimentan la
 * respuesta del asistente cuando le preguntan por el horario de atención, pero
 * los turnos los sigue dando Gacitua y esto no los filtra.
 *
 * Cada alta/edición/borrado pega contra la API al toque (no hay un "guardar"
 * final): el dialog es una lista viva, y el backend devuelve la lista completa
 * ya ordenada, así que no hay que reconciliar nada a mano.
 */

const DIAS = [
  { id: 1, corto: 'Lun', largo: 'Lunes' },
  { id: 2, corto: 'Mar', largo: 'Martes' },
  { id: 3, corto: 'Mié', largo: 'Miércoles' },
  { id: 4, corto: 'Jue', largo: 'Jueves' },
  { id: 5, corto: 'Vie', largo: 'Viernes' },
  { id: 6, corto: 'Sáb', largo: 'Sábado' },
  { id: 7, corto: 'Dom', largo: 'Domingo' },
];

// 00:00 a 23:55 cada 5 minutos. Como 'HH:MM' con cero adelante, comparar dos
// horas con < alcanza: el orden alfabético es el orden cronológico.
const HORAS = (() => {
  const lista = [];
  for (let minutos = 0; minutos < 24 * 60; minutos += 5) {
    const valor = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
    lista.push({ value: valor, label: valor });
  }
  return lista;
})();

const horariosOverlay = document.getElementById('horarios-dialog');
const horariosDialog = tablero.setupDialog(horariosOverlay);
const horariosProfesionalEl = document.getElementById('horarios-profesional');
const horariosListEl = document.getElementById('horarios-list');
const horariosFooter = document.getElementById('horarios-footer');
const franjaForm = document.getElementById('franja-form');
const franjaFormTitle = document.getElementById('franja-form-title');
const franjaDiasEl = document.getElementById('franja-dias');
const franjaDiasHint = document.getElementById('franja-dias-hint');
const franjaNotaInput = document.getElementById('franja-nota');
const franjaErrorEl = document.getElementById('franja-error');
const franjaSubmit = document.getElementById('franja-submit');
const franjaAddBtn = document.getElementById('franja-add');

let horariosItem = null;
let franjas = [];
let editandoFranjaId = null;
const diasElegidos = new Set();

// El "hasta" sólo ofrece horas posteriores al "desde": el error se vuelve
// imposible de cometer en vez de tener que avisarlo después.
const desdeSelect = tablero.createSelect(document.getElementById('franja-desde-select'), {
  placeholder: 'Hora',
  options: HORAS.slice(0, -1),
  searchPlaceholder: 'Ej: 08:30',
  onChange: onDesdeChange,
});
const hastaSelect = tablero.createSelect(document.getElementById('franja-hasta-select'), {
  placeholder: 'Hora',
  options: HORAS.slice(1),
  searchPlaceholder: 'Ej: 13:00',
  onChange: validarFranja,
});
const franjaEspecialidadSelect = tablero.createSelect(
  document.getElementById('franja-especialidad-select'),
  { placeholder: 'Todas las especialidades', options: [], searchable: false }
);

DIAS.forEach((dia) => {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'day-toggle';
  boton.dataset.dia = String(dia.id);
  boton.textContent = dia.corto;
  boton.setAttribute('aria-pressed', 'false');
  boton.setAttribute('aria-label', dia.largo);
  boton.addEventListener('click', () => toggleDia(dia.id));
  franjaDiasEl.appendChild(boton);
});

franjaAddBtn.addEventListener('click', () => abrirFormularioFranja(null));
document.getElementById('franja-cancel').addEventListener('click', cerrarFormularioFranja);
document.getElementById('horarios-close').addEventListener('click', cerrarHorarios);
// dialog-dismissed lo dispara setupDialog al cerrar por Escape o por el fondo: mismo camino
// que el botón Cerrar, si no volver al dialog de edición dependería de cómo lo cerraste.
horariosOverlay.addEventListener('dialog-dismissed', cerrarHorarios);
franjaNotaInput.addEventListener('input', validarFranja);
franjaForm.addEventListener('submit', guardarFranja);

/* ── Acceso a los horarios desde el dialog de "Editar profesional" ──────────
 * El dialog de edición se esconde y el de horarios ocupa su lugar; al cerrar
 * este último se vuelve al de edición TAL COMO ESTABA. No se anidan overlays
 * (dos dialogs abiertos comparten el Escape) y no se toca el formulario, así
 * que lo que hubieras tipeado sin guardar sigue ahí cuando volvés.
 */
const horariosTrigger = document.getElementById('profesional-horarios');
const horariosResumen = document.getElementById('profesional-horarios-resumen');
let volverAEditarAlCerrar = false;

horariosTrigger.addEventListener('click', () => {
  if (!editingItem) return;
  volverAEditarAlCerrar = true;
  dialog.close();
  openHorarios(editingItem);
});

function renderResumenHorarios() {
  if (!horariosResumen) return;
  const lista = (editingItem && editingItem.horarios) || [];
  if (lista.length === 0) {
    // Mismo placeholder que los desplegables vacíos del formulario, no el itálico
    // de "sin dato" de la tabla: acá es un campo sin completar, no un dato ausente.
    horariosResumen.innerHTML = '<span class="ms-placeholder">Sin horarios cargados</span>';
    return;
  }
  const chips = diasDeFranjas(lista).map((d) => `<span class="day-chip">${d.corto}</span>`).join('');
  const cuenta = lista.length === 1 ? '1 franja' : `${lista.length} franjas`;
  horariosResumen.innerHTML = `${chips}<span class="horarios-count">${cuenta}</span>`;
}

function cerrarHorarios() {
  cerrarFormularioFranja();
  horariosDialog.close();
  if (!volverAEditarAlCerrar) return;
  volverAEditarAlCerrar = false;
  renderResumenHorarios();
  dialog.open();
}

function diasDeFranjas(lista) {
  const ids = new Set((lista || []).map((f) => f.dia_semana));
  return DIAS.filter((d) => ids.has(d.id));
}

// Celda de la tabla: los días cargados + cuántas franjas son.
function formatHorarios(item) {
  const lista = item.horarios || [];
  const etiqueta = `Horarios de atención de ${escapeHTML(item.nombre)}`;
  if (lista.length === 0) {
    return `
      <button type="button" class="horarios-cell" data-horarios="${item.id}" aria-label="${etiqueta}">
        <span class="empty-value">Sin horarios</span>
        <span class="horarios-cta" aria-hidden="true">Cargar</span>
      </button>`;
  }
  const chips = diasDeFranjas(lista)
    .map((d) => `<span class="day-chip">${d.corto}</span>`)
    .join('');
  const cuenta = lista.length === 1 ? '1 franja' : `${lista.length} franjas`;
  return `
    <button type="button" class="horarios-cell" data-horarios="${item.id}" aria-label="${etiqueta}">
      ${chips}<span class="horarios-count">${cuenta}</span>
    </button>`;
}

function openHorarios(item) {
  if (!item) return;
  horariosItem = item;
  franjas = (item.horarios || []).slice();
  horariosProfesionalEl.textContent = item.nombre;
  // Sólo las especialidades vinculadas al profesional: es lo mismo que valida
  // el backend, así que no se puede elegir algo que después rebote.
  franjaEspecialidadSelect.setOptions([
    { value: '', label: 'Todas las especialidades' },
    ...(item.especialidad_ids || []).map((id, i) => ({
      value: String(id),
      label: (item.especialidades || [])[i] || `Especialidad ${id}`,
    })),
  ]);
  cerrarFormularioFranja();
  renderFranjas();
  horariosDialog.open();
  franjaAddBtn.focus();
}

function renderFranjas() {
  horariosListEl.innerHTML = '';
  if (franjas.length === 0) {
    horariosListEl.innerHTML =
      '<p class="horarios-empty">Todavía no tiene horarios cargados.</p>';
    return;
  }
  DIAS.forEach((dia) => {
    const delDia = franjas
      .filter((f) => f.dia_semana === dia.id)
      .sort((a, b) => a.hora_desde.localeCompare(b.hora_desde));
    if (delDia.length === 0) return;

    const bloque = document.createElement('div');
    bloque.className = 'horarios-day';
    const titulo = document.createElement('p');
    titulo.className = 'horarios-day-label';
    titulo.textContent = dia.largo;
    bloque.appendChild(titulo);

    delDia.forEach((franja) => {
      const fila = document.createElement('div');
      fila.className = 'franja-row';
      if (franja.id === editandoFranjaId) fila.classList.add('is-editing');
      fila.innerHTML = `
        <div class="franja-main">
          <div class="franja-rango-line">
            <span class="franja-rango">${franja.hora_desde} – ${franja.hora_hasta}</span>
            ${franja.especialidad ? `<span class="chip-static">${escapeHTML(franja.especialidad)}</span>` : ''}
          </div>
          ${franja.nota ? `<p class="franja-nota">${escapeHTML(franja.nota)}</p>` : ''}
        </div>
        <div class="franja-actions">
          <button type="button" class="link-button" data-editar="${franja.id}">Editar</button>
          <button type="button" class="danger" data-borrar="${franja.id}">Eliminar</button>
        </div>
      `;
      bloque.appendChild(fila);
    });
    horariosListEl.appendChild(bloque);
  });

  horariosListEl.querySelectorAll('button[data-editar]').forEach((boton) => {
    boton.addEventListener('click', () => {
      abrirFormularioFranja(franjas.find((f) => String(f.id) === boton.dataset.editar));
    });
  });
  horariosListEl.querySelectorAll('button[data-borrar]').forEach((boton) => {
    boton.addEventListener('click', () => borrarFranja(boton.dataset.borrar));
  });
}

function abrirFormularioFranja(franja) {
  editandoFranjaId = franja ? franja.id : null;
  diasElegidos.clear();

  if (franja) {
    // Editar toca una franja concreta: un solo día, para no convertir sin querer
    // una edición en un alta múltiple.
    diasElegidos.add(franja.dia_semana);
    franjaFormTitle.textContent = 'Editar franja';
    franjaDiasHint.textContent = 'Al editar se mueve una sola franja: elegí un día.';
    desdeSelect.setValue(franja.hora_desde);
    sincronizarHasta(franja.hora_hasta);
    franjaEspecialidadSelect.setValue(franja.especialidad_id ? String(franja.especialidad_id) : '');
    franjaNotaInput.value = franja.nota || '';
  } else {
    franjaFormTitle.textContent = 'Nueva franja';
    franjaDiasHint.textContent = 'Podés marcar varios: se crea la misma franja en cada día.';
    desdeSelect.setValue('08:00');
    sincronizarHasta('13:00');
    franjaEspecialidadSelect.setValue('');
    franjaNotaInput.value = '';
  }

  franjaForm.classList.remove('hidden');
  horariosFooter.classList.add('hidden');
  renderDias();
  renderFranjas();
  validarFranja();
  const primero = franjaDiasEl.querySelector('.day-toggle');
  if (primero) primero.focus();
}

function cerrarFormularioFranja() {
  editandoFranjaId = null;
  diasElegidos.clear();
  franjaForm.classList.add('hidden');
  horariosFooter.classList.remove('hidden');
  franjaErrorEl.classList.add('hidden');
  renderFranjas();
}

function toggleDia(id) {
  if (editandoFranjaId !== null) {
    // En edición el grupo se comporta como un radio: siempre queda uno elegido.
    diasElegidos.clear();
    diasElegidos.add(id);
  } else if (diasElegidos.has(id)) {
    diasElegidos.delete(id);
  } else {
    diasElegidos.add(id);
  }
  renderDias();
  validarFranja();
}

function renderDias(conflictivos = new Set()) {
  franjaDiasEl.querySelectorAll('.day-toggle').forEach((boton) => {
    const id = Number(boton.dataset.dia);
    boton.setAttribute('aria-pressed', String(diasElegidos.has(id)));
    boton.classList.toggle('is-conflict', conflictivos.has(id));
  });
}

// Al mover el "desde" se recalculan las opciones del "hasta" y, si quedó en una
// hora que ya no existe, se lo empuja una hora más adelante.
function onDesdeChange() {
  sincronizarHasta(hastaSelect.getValue());
  validarFranja();
}

function sincronizarHasta(preferida) {
  const desde = desdeSelect.getValue() || '00:00';
  const posibles = HORAS.filter((h) => h.value > desde);
  hastaSelect.setOptions(posibles);
  const sirve = preferida && posibles.some((h) => h.value === preferida);
  if (sirve) {
    hastaSelect.setValue(preferida);
    return;
  }
  const [hh, mm] = desde.split(':').map(Number);
  const unaHoraDespues = `${String(Math.min(23, hh + 1)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const elegida = posibles.find((h) => h.value === unaHoraDespues) || posibles[posibles.length - 1];
  hastaSelect.setValue(elegida ? elegida.value : null);
}

// Mismo criterio que el backend: intervalos [desde, hasta), así dos franjas
// contiguas (7–13 y 13–15) no cuentan como pisadas. El choque se busca contra
// TODAS las franjas del profesional: no puede estar en dos lados a la vez,
// aunque sean especialidades distintas.
function conflictosDe(dias, desde, hasta) {
  return franjas.filter(
    (f) =>
      f.id !== editandoFranjaId &&
      dias.has(f.dia_semana) &&
      desde < f.hora_hasta &&
      f.hora_desde < hasta
  );
}

function validarFranja() {
  const desde = desdeSelect.getValue();
  const hasta = hastaSelect.getValue();

  if (diasElegidos.size === 0) {
    return mostrarEstadoFranja('Elegí al menos un día.', new Set(), true);
  }
  if (!desde || !hasta || hasta <= desde) {
    return mostrarEstadoFranja('La hora de fin tiene que ser posterior a la de inicio.', new Set(), true);
  }

  const choques = conflictosDe(diasElegidos, desde, hasta);
  if (choques.length > 0) {
    const detalle = choques
      .map((f) => {
        const dia = DIAS.find((d) => d.id === f.dia_semana);
        return `${dia ? dia.largo : ''} de ${f.hora_desde} a ${f.hora_hasta}`;
      })
      .join(', ');
    return mostrarEstadoFranja(
      `Se superpone con ${detalle}. Cambiá el horario o sacá ese día.`,
      new Set(choques.map((f) => f.dia_semana)),
      true
    );
  }
  return mostrarEstadoFranja('', new Set(), false);
}

function mostrarEstadoFranja(mensaje, conflictivos, bloqueado) {
  franjaErrorEl.textContent = mensaje;
  franjaErrorEl.classList.toggle('hidden', !mensaje);
  renderDias(conflictivos);
  franjaSubmit.disabled = bloqueado;
  franjaSubmit.textContent = editandoFranjaId !== null
    ? 'Guardar cambios'
    : (diasElegidos.size > 1 ? `Agregar ${diasElegidos.size} franjas` : 'Agregar franja');
  return !bloqueado;
}

async function guardarFranja(event) {
  event.preventDefault();
  if (!validarFranja() || !horariosItem) return;

  const especialidad = franjaEspecialidadSelect.getValue();
  const payload = {
    hora_desde: desdeSelect.getValue(),
    hora_hasta: hastaSelect.getValue(),
    especialidad_id: especialidad ? Number(especialidad) : null,
    nota: franjaNotaInput.value.trim(),
  };

  const editando = editandoFranjaId !== null;
  if (editando) payload.dia_semana = Array.from(diasElegidos)[0];
  else payload.dias = Array.from(diasElegidos);

  const cantidad = diasElegidos.size;
  franjaSubmit.disabled = true;
  const response = await tablero.fetchWithAuth(
    editando ? `/horarios/${editandoFranjaId}` : `/profesionales/${horariosItem.id}/horarios`,
    { method: editando ? 'PUT' : 'POST', body: JSON.stringify(payload) }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    franjaSubmit.disabled = false;
    // El 409 del backend es el mismo choque que valida el front: puede llegar si
    // otra pestaña cargó una franja mientras este formulario estaba abierto.
    franjaErrorEl.textContent = error.error || 'No se pudo guardar la franja.';
    franjaErrorEl.classList.remove('hidden');
    return;
  }

  aplicarFranjas(await response.json());
  cerrarFormularioFranja();
  tablero.toast(
    editando ? 'Franja actualizada' : (cantidad > 1 ? `${cantidad} franjas agregadas` : 'Franja agregada'),
    { description: horariosItem.nombre }
  );
}

async function borrarFranja(id) {
  const franja = franjas.find((f) => String(f.id) === String(id));
  if (!franja) return;
  const dia = DIAS.find((d) => d.id === franja.dia_semana);
  const confirmado = await tablero.confirm({
    title: 'Eliminar franja',
    message: `Se va a eliminar ${dia ? dia.largo : ''} de ${franja.hora_desde} a ${franja.hora_hasta}. Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    tone: 'danger',
  });
  // El confirm libera el scroll del body al cerrarse, pero este dialog sigue
  // abierto: hay que volver a bloquearlo o el fondo scrollea por detrás.
  document.body.style.overflow = 'hidden';
  if (!confirmado) return;

  const response = await tablero.fetchWithAuth(`/horarios/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    tablero.toast('No se pudo eliminar la franja.', { variant: 'error' });
    return;
  }
  if (editandoFranjaId === franja.id) cerrarFormularioFranja();
  aplicarFranjas(franjas.filter((f) => f.id !== franja.id));
  tablero.toast('Franja eliminada', { description: horariosItem ? horariosItem.nombre : '' });
}

// Deja la lista del dialog y la de la tabla mirando lo mismo, sin recargar todo.
function aplicarFranjas(lista) {
  franjas = lista;
  if (horariosItem) horariosItem.horarios = lista;
  renderFranjas();
  renderResumenHorarios();
  controls.setRows(currentItems);
}
