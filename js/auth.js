let currentUser = null;

async function initAuth() {
  const nav = document.getElementById('top-nav');
  const menu = document.getElementById('menu');
  if (nav) nav.style.display = 'none';
  if (menu) menu.style.display = 'none';

  const stored = localStorage.getItem('currentUser');
  if (stored) {
    currentUser = JSON.parse(stored);
    if (nav) nav.style.display = 'flex';
    if (menu) menu.style.display = 'flex';
    await initGame();
  } else {
    const screen = document.getElementById('login-screen');
    if (screen) screen.style.display = 'flex';
    const form = document.getElementById('login-form');
    if (form) form.addEventListener('submit', handleLogin);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  if (!username || !password) return;
  let res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (res.status === 404) {
    res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  }
  if (!res.ok) {
    alert('Falha no login');
    return;
  }
  currentUser = await res.json();
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  const screen = document.getElementById('login-screen');
  if (screen) screen.style.display = 'none';
  const nav = document.getElementById('top-nav');
  const menu = document.getElementById('menu');
  if (nav) nav.style.display = 'flex';
  if (menu) menu.style.display = 'flex';
  await initGame();
}

function saveUserPerformance(stats) {
  if (!currentUser) return;
  fetch('/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser.username, stats })
  });
}
