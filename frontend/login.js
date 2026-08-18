const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const iconEye = togglePasswordBtn.querySelector('.icon-eye');
const iconEyeOff = togglePasswordBtn.querySelector('.icon-eye-off');

togglePasswordBtn.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  iconEye.classList.toggle('hidden', isHidden);
  iconEyeOff.classList.toggle('hidden', !isHidden);
  togglePasswordBtn.setAttribute('aria-pressed', String(isHidden));
  togglePasswordBtn.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
});

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
