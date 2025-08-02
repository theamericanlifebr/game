let currentUser = null;

async function loadCurrentUser() {
  const username = localStorage.getItem('currentUser');
  if (!username) return null;
  try {
    const res = await fetch(`/api/user/${encodeURIComponent(username)}`);
    if (!res.ok) return null;
    currentUser = await res.json();
    return currentUser;
  } catch (e) {
    console.error('Erro ao carregar usuário', e);
    return null;
  }
}

async function login(username, password) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      currentUser = data;
      localStorage.setItem('currentUser', username);
      return currentUser;
    }
    return null;
  } catch (e) {
    console.error('Erro de login', e);
    return null;
  }
}

function getCurrentUser() {
  return currentUser;
}

async function updateCurrentUser(data) {
  if (!currentUser) return;
  currentUser = { ...currentUser, ...data };
  try {
    await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentUser)
    });
  } catch (e) {
    console.error('Erro ao salvar usuário', e);
  }
}

