const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'data', 'users.json');

function readUsers() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw).users || [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users }, null, 2));
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'missing fields' });
  const users = readUsers();
  let user = users.find(u => u.username === username);
  if (user) {
    if (user.password !== password) return res.status(401).json({ error: 'invalid password' });
  } else {
    user = { username, password, totalTime: 0, level: 1 };
    users.push(user);
    writeUsers(users);
  }
  res.json({ username: user.username, totalTime: user.totalTime, level: user.level });
});

app.get('/api/user/:username', (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json({ username: user.username, totalTime: user.totalTime, level: user.level });
});

app.post('/api/save', (req, res) => {
  const { username, totalTime, level } = req.body;
  if (!username) return res.status(400).json({ error: 'missing username' });
  const users = readUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  users[idx] = { ...users[idx], totalTime, level };
  writeUsers(users);
  res.json({ status: 'ok' });
});

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

