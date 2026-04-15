const faqForm = document.getElementById('faq-form');
const faqStatus = document.getElementById('faq-status');
const faqList = document.getElementById('faq-list');
const logoutBtn = document.getElementById('logout');

logoutBtn.addEventListener('click', () => {
  tablero.clearToken();
  window.location.href = 'login.html';
});

document.addEventListener('DOMContentLoaded', () => {
  tablero.requireAuth();
  loadFaqs();
});

faqForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  faqStatus.textContent = '';
  const question = document.getElementById('faq-question').value.trim();
  const answer = document.getElementById('faq-answer').value.trim();
  if (!question || !answer) {
    faqStatus.textContent = 'Completá pregunta y respuesta.';
    return;
  }
  const response = await tablero.fetchWithAuth('/faqs', {
    method: 'POST',
    body: JSON.stringify({ question, answer }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    faqStatus.textContent = error.error || 'No se pudo guardar la FAQ.';
    return;
  }
  document.getElementById('faq-question').value = '';
  document.getElementById('faq-answer').value = '';
  faqStatus.textContent = 'FAQ guardada correctamente.';
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
  } catch (err) {
    faqStatus.textContent = err.message;
  }
}

function renderFaqs(faqs) {
  faqList.innerHTML = '';
  if (faqs.length === 0) {
    faqList.innerHTML = '<p class="hint">Todavía no hay preguntas frecuentes.</p>';
    return;
  }
  faqs.forEach((faq) => {
    const card = document.createElement('article');
    card.className = 'faq-item';
    card.innerHTML = `
      <div>
        <h3>${escapeHTML(faq.question)}</h3>
        <p>${escapeHTML(faq.answer)}</p>
      </div>
      <button class="danger" data-id="${faq.id}">Eliminar</button>
    `;
    faqList.appendChild(card);
  });
  faqList.querySelectorAll('button[data-id]').forEach((button) => {
    button.addEventListener('click', () => deleteFaq(button.dataset.id));
  });
}

async function deleteFaq(id) {
  const response = await tablero.fetchWithAuth(`/faqs/${id}`, {
    method: 'DELETE',
  });
  if (response.ok) {
    faqStatus.textContent = 'FAQ eliminada.';
    loadFaqs();
  } else {
    faqStatus.textContent = 'No se pudo eliminar la FAQ.';
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
