const faqTableBody = document.getElementById('faq-table-body');
const faqStatus = document.getElementById('faq-status');
const logoutBtn = document.getElementById('logout');
const newFaqBtn = document.getElementById('new-faq-btn');

const faqDialogOverlay = document.getElementById('faq-dialog');
const faqDialogTitle = document.getElementById('faq-dialog-title');
const faqForm = document.getElementById('faq-form');
const faqQuestionInput = document.getElementById('faq-question');
const faqAnswerInput = document.getElementById('faq-answer');
const faqDialogCancel = document.getElementById('faq-dialog-cancel');
const faqDialog = tablero.setupDialog(faqDialogOverlay);

let editingFaqId = null;

logoutBtn.addEventListener('click', () => {
  tablero.clearToken();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', () => {
  tablero.requireAuth();
  loadFaqs();
});

newFaqBtn.addEventListener('click', () => openFaqDialog(null));
faqDialogCancel.addEventListener('click', () => faqDialog.close());

faqForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = faqQuestionInput.value.trim();
  const answer = faqAnswerInput.value.trim();
  if (!question || !answer) return;

  const isEditing = editingFaqId !== null;
  const response = await tablero.fetchWithAuth(
    isEditing ? `/faqs/${editingFaqId}` : '/faqs',
    {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify({ question, answer }),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    tablero.toast(error.error || 'No se pudo guardar la FAQ.', { variant: 'error' });
    return;
  }
  faqDialog.close();
  tablero.toast(isEditing ? 'FAQ actualizada' : 'FAQ creada', { description: question });
  loadFaqs();
});

async function loadFaqs() {
  try {
    const response = await tablero.fetchWithAuth('/faqs');
    if (!response.ok) {
      throw new Error('No se pudieron cargar las FAQs.');
    }
    const faqs = await response.json();
    renderFaqs(faqs);
    faqStatus.textContent = '';
  } catch (err) {
    faqStatus.textContent = '';
    tablero.toast(err.message, { variant: 'error' });
  }
}

function renderFaqs(faqs) {
  faqTableBody.innerHTML = '';
  if (faqs.length === 0) {
    faqTableBody.innerHTML = '<tr><td colspan="3"><p class="hint">Todavía no hay preguntas frecuentes.</p></td></tr>';
    return;
  }
  faqs.forEach((faq) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHTML(faq.question)}</td>
      <td><p class="desc-preview">${escapeHTML(faq.answer)}</p></td>
      <td>
        <div class="row-actions">
          <button type="button" class="link-button" data-edit="${faq.id}">Editar</button>
          <button type="button" class="danger" data-delete="${faq.id}">Eliminar</button>
        </div>
      </td>
    `;
    faqTableBody.appendChild(row);
  });
  faqTableBody.querySelectorAll('button[data-edit]').forEach((button) => {
    const faq = faqs.find((f) => String(f.id) === button.dataset.edit);
    button.addEventListener('click', () => openFaqDialog(faq));
  });
  faqTableBody.querySelectorAll('button[data-delete]').forEach((button) => {
    const faq = faqs.find((f) => String(f.id) === button.dataset.delete);
    button.addEventListener('click', () => deleteFaq(button.dataset.delete, faq));
  });
}

function openFaqDialog(faq) {
  editingFaqId = faq ? faq.id : null;
  faqDialogTitle.textContent = faq ? 'Editar FAQ' : 'Nueva FAQ';
  faqQuestionInput.value = faq ? faq.question : '';
  faqAnswerInput.value = faq ? faq.answer : '';
  faqDialog.open();
  faqQuestionInput.focus();
}

async function deleteFaq(id, faq) {
  const confirmed = await tablero.confirm({
    title: 'Eliminar FAQ',
    message: `Se va a eliminar "${faq ? faq.question : 'esta pregunta'}". Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    tone: 'danger',
  });
  if (!confirmed) return;
  const response = await tablero.fetchWithAuth(`/faqs/${id}`, {
    method: 'DELETE',
  });
  if (response.ok) {
    tablero.toast('FAQ eliminada', { description: faq ? faq.question : '' });
    loadFaqs();
  } else {
    tablero.toast('No se pudo eliminar la FAQ.', { variant: 'error' });
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
