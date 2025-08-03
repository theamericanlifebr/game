const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_DIR = path.join(__dirname, 'users');
const USERS_FILE = path.join(USERS_DIR, 'users.json');

app.use(express.json());
app.use(express.static(__dirname));

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return { users: [] };
  }
}

function writeUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function readStats(username) {
  try {
    return JSON.parse(fs.readFileSync(path.join(USERS_DIR, username, 'stats.json'), 'utf8'));
  } catch {
    return {};
  }
}

function writeStats(username, stats) {
  const dir = path.join(USERS_DIR, username);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify(stats, null, 2));
}

function sendConfirmationEmail(email, token) {
  const link = `http://localhost:${PORT}/confirm/${token}`;
  console.log(`Confirmation email to ${email}: ${link}`);
}

app.post('/register', (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) {
    return res.status(400).json({ error: 'missing fields' });
  }
  const data = readUsers();
  if (data.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'user exists' });
  }
  const token = Math.random().toString(36).slice(2);
  const newUser = { username, password, email, confirmed: false, token };
  data.users.push(newUser);
  writeUsers(data);
  writeStats(username, {});
  sendConfirmationEmail(email, token);
  res.json({ status: 'registered' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const data = readUsers();
  const user = data.users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(404).json({ error: 'not found' });
  }
  if (!user.confirmed) {
    return res.status(403).json({ error: 'unconfirmed' });
  }
  const stats = readStats(username);
  res.json({ username, stats });
});

app.post('/stats', (req, res) => {
  const { username, stats } = req.body;
  if (!username || !stats) {
    return res.status(400).json({ error: 'missing fields' });
  }
  const data = readUsers();
  const user = data.users.find(u => u.username === username);
  if (!user) {
    return res.status(404).json({ error: 'not found' });
  }
  writeStats(username, stats);
  res.json({ status: 'ok' });
});

app.get('/confirm/:token', (req, res) => {
  const { token } = req.params;
  const data = readUsers();
  const user = data.users.find(u => u.token === token);
  if (!user) {
    return res.status(400).send('invalid token');
  }
  user.confirmed = true;
  delete user.token;
  writeUsers(data);
  res.send('email confirmado');
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
