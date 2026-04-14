(function () {
  const tokenKey = 'tablero-especialidades-token';
  const API = window.API_URL || 'http://localhost:5000';

  function getToken() {
    return localStorage.getItem(tokenKey);
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(tokenKey, token);
    }
  }

  function clearToken() {
    localStorage.removeItem(tokenKey);
  }

  function requireAuth() {
    if (!getToken()) {
      window.location.href = 'login.html';
    }
  }

  function fetchWithAuth(path, options = {}) {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${API}${path}`, { ...options, headers });
  }

  window.tablero = {
    API,
    getToken,
    setToken,
    clearToken,
    requireAuth,
    fetchWithAuth,
  };
})();
