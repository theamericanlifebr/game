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
    const regForm = document.getElementById('register-form');
    if (regForm) regForm.addEventListener('submit', handleRegister);
    const showReg = document.getElementById('show-register');
    const showLog = document.getElementById('show-login');
    if (showReg && showLog) {
      showReg.addEventListener('click', () => {
        form.style.display = 'none';
        regForm.style.display = 'flex';
        showReg.style.display = 'none';
        showLog.style.display = 'block';
      });
      showLog.addEventListener('click', () => {
        form.style.display = 'flex';
        regForm.style.display = 'none';
        showReg.style.display = 'block';
        showLog.style.display = 'none';
      });
    }
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  if (!username || !password) return;
  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      if (res.status === 403) alert('Confirme seu email antes de entrar');
      else alert('Falha no login');
      return;
    }
    const { stats } = await res.json();
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

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value.trim();
  if (!username || !email || !password) return;
  try {
    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    if (!res.ok) throw new Error('fail');
    alert('Registro realizado. Confirme seu email.');
    const showLog = document.getElementById('show-login');
    if (showLog) showLog.click();
  } catch (err) {
    alert('Falha no registro');
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
