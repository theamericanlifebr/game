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

function createStatCircle(perc, label, valueText, extraText) {
  const wrapper = document.createElement('div');
  wrapper.className = 'stat-circle';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('class', 'circle-bg');
  bg.setAttribute('cx', '60');
  bg.setAttribute('cy', '60');
  bg.setAttribute('r', radius);
  svg.appendChild(bg);
  const prog = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  prog.setAttribute('class', 'circle-progress');
  prog.setAttribute('cx', '60');
  prog.setAttribute('cy', '60');
  prog.setAttribute('r', radius);
  prog.setAttribute('stroke-dasharray', circumference);
  const clamped = Math.max(0, Math.min(perc, 100));
  prog.setAttribute('stroke-dashoffset', circumference * (1 - clamped / 100));
  prog.style.stroke = colorFromPercent(perc);
  svg.appendChild(prog);
  wrapper.appendChild(svg);
  const value = document.createElement('div');
  value.className = 'circle-value';
  value.textContent = valueText;
  wrapper.appendChild(value);
  const labelEl = document.createElement('div');
  labelEl.className = 'circle-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);
  if (extraText) {
    const extra = document.createElement('div');
    extra.className = 'circle-extra';
    extra.textContent = extraText;
    wrapper.appendChild(extra);
  }
  return wrapper;
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('play-content');
  const statsData = JSON.parse(localStorage.getItem('modeStats') || '{}');
  const timeGoals = {1:1.8, 2:2.2, 3:2.2, 4:3.0, 5:3.5, 6:2.0};
  const MAX_TIME = 6.0;
  for (let i = 1; i <= 6; i++) {
    const stats = statsData[i] || {};
    const total = stats.totalPhrases || 0;
    const correct = stats.correct || 0;
    const report = stats.report || 0;
    const totalTime = stats.totalTime || 0;
    const accPerc = total ? (correct / total * 100) : 0;
    const avg = total ? (totalTime / total / 1000) : 0;
    const goal = timeGoals[i] || 6;
    let timePerc = total ? ((MAX_TIME - avg) / (MAX_TIME - goal) * 100) : 0;
    if (avg >= MAX_TIME) timePerc = 0;
    const notReportPerc = total ? (100 - (report / total * 100)) : 100;
    const section = document.createElement('div');
    section.className = 'mode-section';
    const img = document.createElement('img');
    img.src = `selos%20modos%20de%20jogo/modo${i}.png`;
    img.alt = `Modo ${i}`;
    img.className = 'mode-image';
    section.appendChild(img);
    const graphs = document.createElement('div');
    graphs.className = 'graphs-row';
    graphs.appendChild(createStatCircle(accPerc, 'Precisão', `${Math.round(accPerc)}%`));
    graphs.appendChild(createStatCircle(timePerc, 'Tempo', `${Math.round(timePerc)}%`, `(${avg.toFixed(2)})s`));
    graphs.appendChild(createStatCircle(notReportPerc, 'Report', `${Math.round(notReportPerc)}%`));
    section.appendChild(graphs);
    container.appendChild(section);
  }
});
