function getUsers() {
  return JSON.parse(localStorage.getItem('users') || '[]');
}

function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

function getUser(username) {
  return getUsers().find(u => u.username === username);
}

function addUser(user) {
  const users = getUsers();
  users.push({ name: user.name, username: user.username, password: user.password, totalTime: 0 });
  saveUsers(users);
}

function getCurrentUser() {
  const username = localStorage.getItem('currentUser');
  if (!username) return null;
  return getUser(username);
}

function updateCurrentUser(user) {
  const users = getUsers();
  const idx = users.findIndex(u => u.username === user.username);
  if (idx !== -1) {
    users[idx] = user;
    saveUsers(users);
  }
}
