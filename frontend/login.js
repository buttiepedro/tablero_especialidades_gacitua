const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  if (!username || !password) {
    loginError.textContent = 'Completá usuario y contraseña.';
    return;
  }
  const response = await fetch(`${tablero.API}/login`, {
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
  tablero.setToken(data.token);
  window.location.href = 'general.html';
});
