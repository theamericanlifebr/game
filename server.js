const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

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

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'missing fields' });
  }
  const data = readUsers();
  if (data.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'user exists' });
  }
  const newUser = { username, password, stats: {} };
  data.users.push(newUser);
  writeUsers(data);
  res.json(newUser);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const data = readUsers();
  const user = data.users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(404).json({ error: 'not found' });
  }
  res.json(user);
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
  user.stats = stats;
  writeUsers(data);
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
