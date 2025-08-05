const colorStops = [
  [0, '#ff0000'],
  [2000, '#ff3b00'],
  [4000, '#ff7f00'],
  [6000, '#ffb300'],
  [8000, '#ffe000'],
  [10000, '#ffff66'],
  [12000, '#ccff66'],
  [14000, '#99ff99'],
  [16000, '#00cc66'],
  [18000, '#00994d'],
  [20000, '#00ffff'],
  [22000, '#66ccff'],
  [24000, '#0099ff'],
  [25000, '#0099ff']
];

function hexToRgb(hex) {
  const int = parseInt(hex.slice(1), 16);
  return [int >> 16 & 255, int >> 8 & 255, int & 255];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function calcularCor(pontos) {
  const max = colorStops[colorStops.length - 1][0];
  const p = Math.max(0, Math.min(pontos, max));
  for (let i = 0; i < colorStops.length - 1; i++) {
    const [p1, c1] = colorStops[i];
    const [p2, c2] = colorStops[i + 1];
    if (p >= p1 && p <= p2) {
      const ratio = (p - p1) / (p2 - p1);
      const [r1, g1, b1] = hexToRgb(c1);
      const [r2, g2, b2] = hexToRgb(c2);
      const r = Math.round(r1 + ratio * (r2 - r1));
      const g = Math.round(g1 + ratio * (g2 - g1));
      const b = Math.round(b1 + ratio * (b2 - b1));
      return rgbToHex(r, g, b);
    }
  }
  return colorStops[colorStops.length - 1][1];
}

function colorFromPercent(perc) {
  const max = colorStops[colorStops.length - 1][0];
  return calcularCor((perc / 100) * max);
}

function parsePastas(raw) {
  const result = {};
  for (const [key, texto] of Object.entries(raw)) {
    result[key] = texto.trim().split(/\n+/).filter(Boolean).map(l => l.split('#').map(s => s.trim()));
  }
  return result;
}

async function carregarFrases() {
  const resp = await fetch('data/pastas.json');
  const text = await resp.text();
  const obj = {};
  const regex = /(\d+):\s*`([\s\S]*?)`/g;
  let m;
  while ((m = regex.exec(text))) {
    obj[m[1]] = m[2];
  }
  const pastas = parsePastas(obj);
  const todas = [];
  Object.values(pastas).forEach(arr => {
    arr.forEach(p => {
      if (p[1] && p[1].length <= 24) todas.push(p);
    });
  });
  return todas;
}

function setBar(id, perc) {
  const bar = document.getElementById(id);
  bar.style.opacity = 0;
  setTimeout(() => {
    bar.style.width = Math.min(perc, 100) + '%';
    bar.style.backgroundColor = colorFromPercent(perc);
    bar.style.opacity = 1;
  }, 50);
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const botName = params.get('bot');
  const mode = parseInt(params.get('mode'), 10) || 2;

  const botData = await fetch('users/bots.json').then(r => r.json());
  const bot = botData.bots.find(b => b.name === botName) || botData.bots[0];
  document.getElementById('opponent-name').textContent = bot.name;
  document.getElementById('opponent-avatar').src = 'users/' + bot.file;

  const frases = await carregarFrases();
  let atual = null;
  let inicio = 0;
  const entrada = document.getElementById('user-input');
  const fraseEl = document.getElementById('phrase');

  const stats = {
    user: { correct: 0, total: 0, time: 0 },
    bot: { correct: 0, total: 0, time: 0 }
  };

  function novaFrase() {
    atual = frases[Math.floor(Math.random() * frases.length)];
    fraseEl.textContent = atual[0];
    entrada.value = '';
    inicio = Date.now();
    entrada.focus();
  }

  function simularBot() {
    const base = bot.modes[String(mode)] || { precisao: 50, tempo: 50 };
    const correto = Math.random() < base.precisao / 100;
    const tempo = base.tempo / 20 + (Math.random() - 0.5) * 0.4;
    stats.bot.total++;
    stats.bot.time += tempo;
    if (correto) stats.bot.correct++;
  }

  entrada.addEventListener('keydown', e => {
    if (e.key === 'Enter' && atual) {
      const decorrido = (Date.now() - inicio) / 1000;
      stats.user.total++;
      stats.user.time += decorrido;
      if (entrada.value.trim().toLowerCase() === atual[1].toLowerCase()) {
        stats.user.correct++;
      }
      simularBot();
      novaFrase();
    }
  });

  function atualizarBarras() {
    const uAvg = stats.user.total ? stats.user.time / stats.user.total : 0;
    const uAcc = stats.user.total ? stats.user.correct / stats.user.total * 100 : 0;
    const bAvg = stats.bot.total ? stats.bot.time / stats.bot.total : 0;
    const bAcc = stats.bot.total ? stats.bot.correct / stats.bot.total * 100 : 0;
    setBar('user-time-bar', uAvg * 10);
    setBar('user-acc-bar', uAcc);
    setBar('bot-time-bar', bAvg * 10);
    setBar('bot-acc-bar', bAcc);
  }

  novaFrase();
  atualizarBarras();
  setInterval(atualizarBarras, 10000);

  const duracao = 120000;
  const inicioJogo = Date.now();
  const barra = document.getElementById('match-progress-fill');
  const timerEl = document.getElementById('match-timer');

  const timer = setInterval(() => {
    const decorrido = Date.now() - inicioJogo;
    const restante = duracao - decorrido;
    if (restante <= 0) {
      clearInterval(timer);
      barra.style.width = '100%';
      timerEl.textContent = '0s';
      entrada.disabled = true;
      fraseEl.textContent = 'Fim!';
      return;
    }
    const perc = decorrido / duracao * 100;
    barra.style.width = perc + '%';
    barra.style.backgroundColor = colorFromPercent(100 - perc);
    timerEl.textContent = Math.ceil(restante / 1000) + 's';
  }, 1000);
});
