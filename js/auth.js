let currentUser = null;

async function initAuth() {
  const nav = document.getElementById('top-nav');
  const menu = document.getElementById('menu');
  if (nav) nav.style.display = 'none';
  if (menu) menu.style.display = 'none';

  const stored = localStorage.getItem('currentUser');
  if (stored) {
    currentUser = JSON.parse(stored);
    localStorage.setItem('modeStats', JSON.stringify(currentUser.stats || {}));
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
  try {
    const usersRes = await fetch('users/users.json');
    if (!usersRes.ok) throw new Error('missing users');
    const data = await usersRes.json();
    const user = data.users.find(u => u.username === username && u.password === password);
    if (!user) {
      alert('Falha no login');
      return;
    }
    let stats = {};
    try {
      const statsRes = await fetch(`users/${username}/stats.json`);
      if (statsRes.ok) {
        stats = await statsRes.json();
      }
    } catch {}
    localStorage.setItem('modeStats', JSON.stringify(stats));
    modeStats = stats;
    currentUser = { username, stats };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    const screen = document.getElementById('login-screen');
    if (screen) screen.style.display = 'none';
    const nav = document.getElementById('top-nav');
    const menu = document.getElementById('menu');
    if (nav) nav.style.display = 'flex';
    if (menu) menu.style.display = 'flex';
    await initGame();
  } catch (err) {
    alert('Falha no login');
  }
}

function saveUserPerformance(stats) {
  if (!currentUser) return;
  currentUser.stats = stats;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  fetch('/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: currentUser.username, stats })
  }).catch(() => {});
}

function logout() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('modeStats');
  currentUser = null;
}
