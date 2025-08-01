let pastas = {};

function parsePastas(raw) {
  const result = {};
  for (const [key, texto] of Object.entries(raw)) {
    result[key] = texto.trim().split(/\n+/).filter(Boolean).map(l => l.split('#').map(s => s.trim()));
  }
  return result;
}

async function carregarPastas() {
  const resp = await fetch('data/pastas.json');
  const text = await resp.text();
  const obj = {};
  const regex = /(\d+):\s*`([\s\S]*?)`/g;
  let m;
  while ((m = regex.exec(text))) {
    obj[m[1]] = m[2];
  }
  pastas = parsePastas(obj);
}

function ehQuaseCorreto(res, esp) {
  let i = 0, j = 0, dif = 0;
  while (i < res.length && j < esp.length) {
    if (res[i] === esp[j]) {
      i++; j++; continue;
    }
    if (i + 1 < res.length && res[i+1] === esp[j] && j + 1 < esp.length && res[i] === esp[j+1]) {
      return false; // ordem incorreta
    }
    if (i + 1 < res.length && res[i+1] === esp[j]) {
      i++; dif++; // letra extra
    } else if (j + 1 < esp.length && res[i] === esp[j+1]) {
      j++; dif++; // letra faltando
    } else {
      return false;
    }
    if (dif > 2) return false;
  }
  dif += (res.length - i) + (esp.length - j);
  return dif <= 2;
}

function ehQuaseCorretoPalavras(resp, esp) {
  const normWord = w => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const rWords = resp.split(/\s+/).map(normWord).filter(Boolean);
  const eWords = esp.split(/\s+/).map(normWord).filter(Boolean);
  if (rWords.length < eWords.length || rWords.length - eWords.length > 3) return false;
  const rCounts = {};
  rWords.forEach(w => { rCounts[w] = (rCounts[w] || 0) + 1; });
  for (const w of eWords) {
    if (!rCounts[w]) return false;
    rCounts[w]--;
  }
  return true;
}


let reconhecimento;
let reconhecimentoAtivo = false;
let reconhecimentoRodando = false;
let listeningForCommand = true;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  reconhecimento = new SpeechRecognition();
  reconhecimento.lang = 'en-US';
  reconhecimento.continuous = true;
  reconhecimento.interimResults = false;

  reconhecimento.onstart = () => {
    reconhecimentoRodando = true;
  };

  reconhecimento.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim();
    const normCmd = transcript.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (ilifeActive) {
      if (normCmd.includes('play')) {
        ilifeActive = false;
        localStorage.setItem('ilifeDone', 'true');
        const screen = document.getElementById('ilife-screen');
        const menu = document.getElementById('menu');
        if (screen) screen.style.display = 'none';
        if (menu) menu.style.display = 'flex';
        if (!tutorialDone) {
          startTutorial();
        }
      }
      return;
    }
    if (awaitingNextLevel) {
      if (normCmd.includes('level') || normCmd.includes('next') || normCmd.includes('game')) {
        awaitingNextLevel = false;
        if (nextLevelCallback) {
          const cb = nextLevelCallback;
          nextLevelCallback = null;
          cb();
        }
      }
    } else if (awaitingRetry && (normCmd.includes('try again') || normCmd.includes('tentar de novo'))) {
      awaitingRetry = false;
      if (retryCallback) {
        const cb = retryCallback;
        retryCallback = null;
        cb();
      }
      } else if (normCmd.includes('next level') || normCmd.includes('proximo nivel')) {
        points += 25000;
        if (selectedMode === 6 && points >= COMPLETION_THRESHOLD && !nextLevelSoundPlayed) {
          const audio = document.getElementById('somNextLevel');
          if (audio) { audio.currentTime = 0; audio.play(); }
          nextLevelSoundPlayed = true;
        }
        atualizarBarraProgresso();
        if (points >= COMPLETION_THRESHOLD && !completedModes[selectedMode]) {
          finishMode();
        }
      } else if (listeningForCommand) {
      if (normCmd.includes('play')) {
        listeningForCommand = false;
        startGame(getHighestUnlockedMode());
      }
    } else {
      document.getElementById("pt").value = transcript;
      verificarResposta();
    }
  };

  reconhecimento.onerror = (event) => {
    console.error('Erro no reconhecimento de voz:', event.error);
    if (event.error === 'not-allowed') alert('Permissão do microfone negada.');
  };

  reconhecimento.onend = () => {
    reconhecimentoRodando = false;
    if (reconhecimentoAtivo) reconhecimento.start(); // reinicia se estiver ativo
  };
} else {
  alert('Reconhecimento de voz não é suportado neste navegador. Use o Chrome.');
}


setInterval(() => {
  if (reconhecimentoAtivo && !reconhecimentoRodando) {
    try { reconhecimento.start(); } catch (e) {}
  }
}, 4000);

let frasesArr = [], fraseIndex = 0;
let acertosTotais = 0, errosTotais = 0, tentativasTotais = 0;
let pastaAtual = 1;
let bloqueado = false;
let mostrarTexto = 'pt';
let voz = 'en';
let esperadoLang = 'pt';
let timerInterval = null;
const TOTAL_FRASES = 25;
let selectedMode = 1;
// Removed difficulty selection; game always starts on easy mode
const INITIAL_POINTS = 3500;
const COMPLETION_THRESHOLD = 25000;
let completedModes = JSON.parse(localStorage.getItem('completedModes') || '{}');
let unlockedModes = JSON.parse(localStorage.getItem('unlockedModes') || '{}');
let modeIntroShown = JSON.parse(localStorage.getItem('modeIntroShown') || '{}');
let points = INITIAL_POINTS;
let premioBase = 4000;
let premioDec = 1;
let penaltyFactor = 0.5;
let prizeStart = 0;
let prizeTimer = null;
let awaitingNextLevel = false;
let nextLevelCallback = null;
let awaitingRetry = false;
let retryCallback = null;
let tryAgainColorInterval = null;
let levelUpReady = false;
let tutorialInProgress = false;
let tutorialDone = localStorage.getItem('tutorialDone') === 'true';
let ilifeDone = localStorage.getItem('ilifeDone') === 'true';
let ilifeActive = false;
let nextLevelSoundPlayed = false;

const modeImages = {
  1: 'selos%20modos%20de%20jogo/modo1.png',
  2: 'selos%20modos%20de%20jogo/modo2.png',
  3: 'selos%20modos%20de%20jogo/modo3.png',
  4: 'selos%20modos%20de%20jogo/modo4.png',
  5: 'selos%20modos%20de%20jogo/modo5.png',
  6: 'selos%20modos%20de%20jogo/modo6.png'
};

const modeTransitions = {
  1: { duration: 7500, img: modeImages[2], audio: 'somModo2Intro' },
  2: { duration: 7500, img: modeImages[3], audio: 'somModo3Intro' },
  3: { duration: 8250, img: modeImages[4], audio: 'somModo4Intro' },
  4: { duration: 6500, img: modeImages[5], audio: 'somModo5Intro' },
  5: { duration: 6000, img: modeImages[6], audio: 'somModo6Intro' }
};

const modeIntros = {
  2: { duration: 7500, img: modeImages[2], audio: 'somModo2Intro' },
  3: { duration: 7500, img: modeImages[3], audio: 'somModo3Intro' },
  4: { duration: 8250, img: modeImages[4], audio: 'somModo4Intro' },
  5: { duration: 6500, img: modeImages[5], audio: 'somModo5Intro' },
  6: { duration: 6000, img: modeImages[6], audio: 'somModo6Intro' }
};

function updateLevelIcon() {
  const icon = document.getElementById('nivel-indicador');
  if (icon) {
    icon.style.transition = 'opacity 500ms linear';
    icon.style.opacity = '0';
    setTimeout(() => {
      icon.src = `selos_niveis/level%20${pastaAtual}.png`;
      icon.style.opacity = '1';
    }, 500);
  }
  localStorage.setItem('pastaAtual', pastaAtual);
}

function unlockMode(mode, duration = 1000) {
  unlockedModes[mode] = true;
  localStorage.setItem('unlockedModes', JSON.stringify(unlockedModes));
  document.querySelectorAll(`#menu-modes img[data-mode="${mode}"], #mode-buttons img[data-mode="${mode}"]`).forEach(img => {
    img.style.transition = `opacity ${duration}ms linear`;
    img.style.opacity = '1';
  });
}

function updateModeIcons() {
  document.querySelectorAll('#mode-buttons img, #menu-modes img').forEach(img => {
    const mode = parseInt(img.dataset.mode, 10);
    if (unlockedModes[mode]) {
      img.style.opacity = '1';
    } else {
      img.style.opacity = '0.3';
    }
  });
  checkForMenuLevelUp();
}

function getHighestUnlockedMode() {
  const modes = Object.keys(unlockedModes).filter(m => unlockedModes[m]).map(Number);
  return modes.length ? Math.max(...modes) : 1;
}

function checkForMenuLevelUp() {
  // Level advancement is triggered only after finishing mode 6
}

function performMenuLevelUp() {
  const icons = document.querySelectorAll('#menu-modes img');
  icons.forEach(img => {
    img.style.transition = 'opacity 1000ms linear';
    img.style.opacity = '0.3';
  });
  setTimeout(() => {
    pastaAtual++;
    completedModes = {};
    unlockedModes = { 1: true };
    localStorage.setItem('completedModes', JSON.stringify(completedModes));
    localStorage.setItem('unlockedModes', JSON.stringify(unlockedModes));
    updateLevelIcon();
    updateModeIcons();
    levelUpReady = false;
  }, 1000);
}

function menuLevelUpSequence() {
  goHome();
  const menu = document.getElementById('menu');
  const icons = menu.querySelectorAll('#menu-modes img');
  icons.forEach(img => {
    img.style.transition = 'opacity 1ms linear';
    img.style.opacity = '0.3';
  });
  const audio = document.getElementById('somNivelDesbloqueado');
  if (audio) { audio.currentTime = 0; audio.play(); }

  const msg = document.createElement('div');
  msg.id = 'next-level-msg';
  msg.textContent = 'diga next level para avançar';
  msg.style.display = 'none';
  menu.appendChild(msg);

  let idx = 0;
  const interval = setInterval(() => {
    if (idx < icons.length) {
      icons[idx].style.opacity = '1';
      idx++;
    } else {
      clearInterval(interval);
      msg.style.display = 'block';
      setTimeout(() => { msg.style.opacity = '1'; }, 10);
      awaitingNextLevel = true;
      nextLevelCallback = () => {
        msg.remove();
        performMenuLevelUp();
      };
      if (reconhecimento) {
        reconhecimentoAtivo = true;
        reconhecimento.lang = 'en-US';
        reconhecimento.start();
      }
    }
  }, 500);
}

let transitioning = false;

const levelUpTransition = {
  duration: 4000,
  img: 'https://cdn.dribbble.com/userupload/41814123/file/original-fb8a772ba8676fd28c528fd1259cabcb.gif',
  audio: 'somNextLevel'
};

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

let introProgressInterval = null;

function startIntroProgress(duration) {
  const filled = document.getElementById('intro-progress-filled');
  if (!filled) return;
  if (introProgressInterval) clearInterval(introProgressInterval);
  filled.style.transition = 'none';
  filled.style.width = '0%';
  filled.style.backgroundColor = calcularCor(0);
  const start = Date.now();
  introProgressInterval = setInterval(() => {
    const ratio = Math.min((Date.now() - start) / duration, 1);
    const pontos = ratio * 25000;
    filled.style.width = (ratio * 100) + '%';
    filled.style.backgroundColor = calcularCor(pontos);
    if (ratio >= 1) clearInterval(introProgressInterval);
  }, 50);
}

function resetIntroProgress() {
  const filled = document.getElementById('intro-progress-filled');
  if (!filled) return;
  if (introProgressInterval) clearInterval(introProgressInterval);
  filled.style.transition = 'none';
  filled.style.width = '0%';
  filled.style.backgroundColor = calcularCor(0);
}

function startTryAgainAnimation() {
  const msg = document.getElementById('nivel-mensagem');
  if (!msg) return;
  if (tryAgainColorInterval) clearInterval(tryAgainColorInterval);
  const duration = 30000;
  const maxPoints = 25000;
  const begin = Date.now();
  tryAgainColorInterval = setInterval(() => {
    const elapsed = (Date.now() - begin) % duration;
    const pts = (elapsed / duration) * maxPoints;
    msg.style.color = calcularCor(pts);
  }, 50);
}

function stopTryAgainAnimation() {
  if (tryAgainColorInterval) clearInterval(tryAgainColorInterval);
  tryAgainColorInterval = null;
}

function startGame(modo) {
  selectedMode = modo;
  updateModeIcons();
  listeningForCommand = false;
  document.getElementById('menu').style.display = 'none';
  document.getElementById('visor').style.display = 'none';
  const icon = document.getElementById('mode-icon');
  if (icon) icon.style.display = 'none';
  if (reconhecimento) {
    reconhecimentoAtivo = false;
    reconhecimento.stop();
  }
  const start = () => beginGame();
  if (!modeIntroShown[modo]) {
    if (modo === 1) {
      showMode1Intro(() => {
        modeIntroShown[1] = true;
        localStorage.setItem('modeIntroShown', JSON.stringify(modeIntroShown));
        start();
      });
    } else {
      const info = modeIntros[modo];
      if (info) {
        showModeIntro(info, () => {
          modeIntroShown[modo] = true;
          localStorage.setItem('modeIntroShown', JSON.stringify(modeIntroShown));
          start();
        });
      } else {
        start();
      }
    }
  } else {
    showShortModeIntro(modo, start);
  }
}

function showMode1Intro(callback) {
  const overlay = document.getElementById('intro-overlay');
  const audio = document.getElementById('somModo1Intro');
  const img = document.getElementById('intro-image');
  points = 0;
  atualizarBarraProgresso();
  img.style.animation = 'none';
  img.style.transition = 'none';
  img.style.opacity = '1';
  img.style.transform = 'scale(0.8)';
  void img.offsetWidth;
  img.style.transition = 'transform 10000ms linear';
  overlay.style.display = 'flex';
  startIntroProgress(10000);
  audio.currentTime = 0;
  audio.play();
  img.style.transform = 'scale(1)';
  setTimeout(() => {
    img.style.transition = 'opacity 2000ms linear';
    img.style.opacity = '0';
  }, 8000);
  setTimeout(() => {
    overlay.style.display = 'none';
    img.style.transition = 'none';
    img.style.opacity = '1';
    img.style.transform = 'scale(1)';
    resetIntroProgress();
    callback();
  }, 10000);
}

function showModeIntro(info, callback) {
  const overlay = document.getElementById('intro-overlay');
  const img = document.getElementById('intro-image');
  const audio = document.getElementById(info.audio);
  points = INITIAL_POINTS;
  atualizarBarraProgresso();
  img.src = info.img;
  img.style.animation = 'none';
  img.style.transition = 'none';
  img.style.opacity = '1';
  img.style.transform = 'scale(0.8)';
  void img.offsetWidth;
  img.style.transition = `transform ${info.duration}ms linear`;
  overlay.style.display = 'flex';
  startIntroProgress(info.duration);
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
  img.style.transform = 'scale(1)';
  setTimeout(() => {
    img.style.transition = 'opacity 2000ms linear';
    img.style.opacity = '0';
  }, info.duration - 2000);
  setTimeout(() => {
    overlay.style.display = 'none';
    img.style.transition = 'none';
    img.style.opacity = '1';
    img.style.transform = 'scale(1)';
    resetIntroProgress();
    callback();
  }, info.duration);
}

function showModeTransition(info, callback) {
  const overlay = document.getElementById('intro-overlay');
  const img = document.getElementById('intro-image');
  const audio = document.getElementById(info.audio);
  points = INITIAL_POINTS;
  atualizarBarraProgresso();
  if (reconhecimento) {
    reconhecimentoAtivo = false;
    reconhecimento.stop();
  }
  img.src = info.img;
  img.style.animation = 'none';
  img.style.transition = 'none';
  img.style.opacity = '1';
  img.style.transform = 'scale(0.8)';
  void img.offsetWidth;
  img.style.transition = `transform ${info.duration}ms linear`;
  overlay.style.display = 'flex';
  startIntroProgress(info.duration);
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
  img.style.transform = 'scale(1)';
  setTimeout(() => {
    img.style.transition = 'opacity 2000ms linear';
    img.style.opacity = '0';
  }, info.duration - 2000);
  setTimeout(() => {
    overlay.style.display = 'none';
    img.style.transition = 'none';
    img.style.opacity = '1';
    img.style.transform = 'scale(1)';
    resetIntroProgress();
    callback();
  }, info.duration);
}

function showLevelUp(callback) {
  const overlay = document.getElementById('intro-overlay');
  const img = document.getElementById('intro-image');
  const audio = document.getElementById(levelUpTransition.audio);
  points = INITIAL_POINTS;
  atualizarBarraProgresso();
  img.src = levelUpTransition.img;
  img.style.animation = 'none';
  img.style.width = '397px';
  img.style.height = '304px';
  overlay.style.display = 'flex';
  startIntroProgress(levelUpTransition.duration);
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
  awaitingNextLevel = true;
  nextLevelCallback = () => {
    overlay.style.display = 'none';
    resetIntroProgress();
    img.style.width = '250px';
    img.style.height = '250px';
    callback();
  };
  if (reconhecimento) {
    reconhecimentoAtivo = true;
    reconhecimento.lang = 'en-US';
    reconhecimento.start();
  }
}

function beginGame() {
  const start = () => {
    document.getElementById('visor').style.display = 'flex';
    const icon = document.getElementById('mode-icon');
    if (icon) {
      icon.src = modeImages[selectedMode];
      const ratio = Math.max(0, Math.min(points, 25000)) / 25000;
      icon.style.opacity = ratio;
      icon.style.display = 'block';
    }
    const texto = document.getElementById('texto-exibicao');
    if (texto) texto.style.opacity = '1';
    nextLevelSoundPlayed = false;
    updateLevelIcon();
    updateModeIcons();
    switch (selectedMode) {
      case 1:
        mostrarTexto = 'pt';
        voz = 'en';
        esperadoLang = 'pt';
        break;
    case 2:
      mostrarTexto = 'pt';
      voz = 'en';
      esperadoLang = 'en';
      break;
    case 3:
      mostrarTexto = 'none';
      voz = 'en';
      esperadoLang = 'en';
      break;
    case 4:
      mostrarTexto = 'en';
      voz = null;
      esperadoLang = 'en';
      break;
    case 5:
      mostrarTexto = 'none';
      voz = 'en';
      esperadoLang = 'pt';
      break;
    case 6:
      mostrarTexto = 'pt';
      voz = null;
      esperadoLang = 'en';
      break;
    }
    if (reconhecimento) {
      if (selectedMode === 1) {
        reconhecimento.lang = 'en-US';
      } else {
        reconhecimento.lang = esperadoLang === 'pt' ? 'pt-BR' : 'en-US';
      }
      reconhecimentoAtivo = true;
      reconhecimento.start();
    }
    if (selectedMode === 1) {
      points = 0;
      premioBase = 1000;
      premioDec = 0;
      penaltyFactor = 0;
    } else {
      points = INITIAL_POINTS;
      premioBase = 4000;
      premioDec = 1;
      penaltyFactor = 0.5;
    }
    carregarFrases();
  };

  start();
}

function falar(texto, lang) {
  const utter = new SpeechSynthesisUtterance(texto);
  utter.lang = lang === 'pt' ? 'pt-BR' : 'en-US';
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

function togglePt() {
  mostrarTexto = mostrarTexto === 'pt' ? 'en' : 'pt';
  mostrarFrase();
}

function toggleEn() {
  voz = voz ? null : 'en';
  mostrarFrase();
}

function showShortModeIntro(modo, callback) {
  const overlay = document.getElementById('intro-overlay');
  const img = document.getElementById('intro-image');
  const audio = document.getElementById('somWoosh');
  img.src = modeImages[modo];
  img.style.animation = 'none';
  img.style.transition = 'none';
  img.style.opacity = '1';
  img.style.width = '200px';
  img.style.height = '200px';
  void img.offsetWidth;
  img.style.transition = 'width 3000ms linear, height 3000ms linear';
  overlay.style.display = 'flex';
  if (audio) { audio.currentTime = 0; audio.play(); }
  img.style.width = '350px';
  img.style.height = '350px';
  setTimeout(() => {
    overlay.style.display = 'none';
    img.style.transition = 'none';
    img.style.width = '';
    img.style.height = '';
    callback();
  }, 3000);
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
}

function falarFrase() {
  if (frasesArr[fraseIndex]) {
    const [, en] = frasesArr[fraseIndex];
    falar(en, 'en');
  }
}

function falarPt() {
  if (frasesArr[fraseIndex]) {
    const [pt] = frasesArr[fraseIndex];
    falar(pt, 'pt');
  }
}

function embaralhar(array) {
  return array.sort(() => Math.random() - 0.5);
}

function carregarFrases() {
  let principais = [], anteriores = [];
  if (pastas[pastaAtual]) {
	principais = pastas[pastaAtual];

  }
  if (pastaAtual > 1) {
    for (let i = 1; i < pastaAtual; i++) {
      if (pastas[i]) {
		const frases = pastas[i];

        anteriores = anteriores.concat(frases);
      }
    }
  }
  const qtdPrincipais = pastaAtual === 1 ? TOTAL_FRASES : Math.round(TOTAL_FRASES * 0.8);
  const qtdAnteriores = TOTAL_FRASES - qtdPrincipais;
  frasesArr = [].concat(
    embaralhar(principais).slice(0, qtdPrincipais),
    embaralhar(anteriores).slice(0, qtdAnteriores)
  );
  frasesArr = embaralhar(frasesArr);
  fraseIndex = 0;
  acertosTotais = 0;
  errosTotais = 0;
  tentativasTotais = 0;
  setTimeout(() => mostrarFrase(), 300);
  atualizarBarraProgresso();
}

function mostrarFrase() {
  if (fraseIndex >= frasesArr.length) fraseIndex = 0;
  const [pt, en] = frasesArr[fraseIndex];
  const texto = document.getElementById("texto-exibicao");
  if (mostrarTexto === 'pt') texto.textContent = pt;
  else if (mostrarTexto === 'en') texto.textContent = en;
  else texto.textContent = '';
  document.getElementById("pt").value = '';
  document.getElementById("pt").disabled = false;
  if (voz === 'en') falar(en, 'en');
  else if (voz === 'pt') falar(pt, 'pt');
  bloqueado = false;
  if (timerInterval) clearInterval(timerInterval);
  const timerEl = document.getElementById('timer');
  const start = Date.now();
  timerEl.textContent = 'Tempo: 0s';
  timerInterval = setInterval(() => {
    const secs = Math.floor((Date.now() - start) / 1000);
    timerEl.textContent = `Tempo: ${secs}s`;
  }, 1000);
  if (prizeTimer) clearInterval(prizeTimer);
  prizeStart = Date.now();
  prizeTimer = setInterval(atualizarBarraProgresso, 50);
  atualizarBarraProgresso();
}

function flashSuccess(callback) {
  const texto = document.getElementById('texto-exibicao');
  const color = calcularCor(points);
  texto.style.transition = 'color 500ms linear';
  texto.style.color = color;
  setTimeout(() => {
    texto.style.transition = 'color 500ms linear';
    texto.style.color = '#333';
    setTimeout(() => {
      document.getElementById('resultado').textContent = '';
      callback();
    }, 500);
  }, 500);
}

function flashError(expected, callback) {
  const texto = document.getElementById('texto-exibicao');
  const previous = texto.textContent;
  texto.textContent = expected;
  texto.style.transition = 'color 500ms linear';
  texto.style.color = 'red';
  setTimeout(() => {
    texto.style.transition = 'color 500ms linear';
    texto.style.color = '#333';
    setTimeout(() => {
      texto.textContent = previous;
      document.getElementById('resultado').textContent = '';
      callback();
    }, 500);
  }, 1500);
}

function verificarResposta() {
  if (bloqueado) return;
  if (timerInterval) clearInterval(timerInterval);
  const input = document.getElementById("pt");
  const resposta = input.value.trim();
  const cheat = /^GOTO(\d+)$/i.exec(resposta);
  if (cheat) {
    const nivel = parseInt(cheat[1], 10);
    if (pastas[nivel]) {
      pastaAtual = nivel;
      updateLevelIcon();
      carregarFrases();
    }
    input.value = "";
    return;
  }
  const bonusPhrase = resposta.toLowerCase().replace(/\s+/g, '');
  if (bonusPhrase === 'Justiça de Deus' || bonusPhrase === 'getpointslife') {
    points += 25000;
    if (selectedMode === 6 && points >= COMPLETION_THRESHOLD && !nextLevelSoundPlayed) {
      const audio = document.getElementById('somNextLevel');
      if (audio) { audio.currentTime = 0; audio.play(); }
      nextLevelSoundPlayed = true;
    }
    input.value = '';
    atualizarBarraProgresso();
    if (points >= COMPLETION_THRESHOLD && !completedModes[selectedMode]) {
      finishMode();
    }
    return;
  }
  const resultado = document.getElementById("resultado");
  tentativasTotais++;
  const elapsed = Date.now() - prizeStart;
  const premioAtual = premioBase - elapsed * premioDec;

  if (selectedMode === 1) {
    document.getElementById("somAcerto").play();
    acertosTotais++;
    resultado.textContent = '';
    points += 1000;
    const reached = points >= COMPLETION_THRESHOLD && !completedModes[selectedMode];
    flashSuccess(() => {
      if (reached) finishMode();
      else continuar();
    });
    atualizarBarraProgresso();
    return;
  }

  const [pt, en] = frasesArr[fraseIndex];

  const norm = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const esperado = esperadoLang === 'pt' ? pt : en;
  let normalizadoResp = norm(resposta);
  const normalizadoEsp = norm(esperado);
  if (normalizadoResp === 'justicanaterra') {
    normalizadoResp = normalizadoEsp;
  }
  const correto =
    normalizadoResp === normalizadoEsp ||
    ehQuaseCorreto(normalizadoResp, normalizadoEsp) ||
    ehQuaseCorretoPalavras(resposta, esperado);

  if (correto) {
    document.getElementById("somAcerto").play();
    acertosTotais++;
    resultado.textContent = '';
    points += premioAtual;
    if (selectedMode === 5) {
      points += 1000;
    }
    if (selectedMode === 6 && points >= COMPLETION_THRESHOLD && !nextLevelSoundPlayed) {
      const audio = document.getElementById('somNextLevel');
      if (audio) { audio.currentTime = 0; audio.play(); }
      nextLevelSoundPlayed = true;
    }
    const reached = points >= COMPLETION_THRESHOLD && !completedModes[selectedMode];
    flashSuccess(() => {
      if (reached) finishMode();
      else continuar();
    });
  } else {
    document.getElementById("somErro").play();
    errosTotais++;
    resultado.textContent = "";
    resultado.style.color = "red";
    input.value = '';
    input.disabled = true;
    bloqueado = true;
    falar(esperado, esperadoLang);
    flashError(esperado, () => {
      input.disabled = false;
      bloqueado = false;
      points = Math.max(0, points - elapsed * penaltyFactor);
      continuar();
    });
  }
  atualizarBarraProgresso();
  // Pontuação de acertos ocultada
}

function continuar() {
  if (transitioning) {
    return;
  }
  fraseIndex++;
  mostrarFrase();
}

function atualizarBarraProgresso() {
  const premioAtual = premioBase - (Date.now() - prizeStart) * premioDec;
  document.getElementById('score').textContent = `PREMIO (${Math.round(premioAtual)}) pontos: (${Math.round(points)})`;
  const filled = document.getElementById('barra-preenchida');
  const limite = 25000;
  const perc = Math.max(0, Math.min(points, limite)) / limite * 100;
  filled.style.width = perc + '%';
  filled.style.backgroundColor = calcularCor(points);
  const icon = document.getElementById('mode-icon');
  if (icon) {
    icon.style.opacity = perc / 100;
  }
}

function upgradeMode6Icon(animated = false) {
  const starSrc = 'selos%20modos%20de%20jogo/modostar.png';
  modeImages[6] = starSrc;
  if (modeTransitions[5]) modeTransitions[5].img = starSrc;
  document.querySelectorAll('img[data-mode="6"]').forEach(img => {
    if (animated && img.closest('#menu-modes')) {
      img.style.transition = 'opacity 1000ms linear';
      img.style.opacity = '0';
      setTimeout(() => {
        img.src = starSrc;
        img.style.opacity = '1';
      }, 1000);
    } else {
      img.src = starSrc;
    }
  });
  const menuImg = document.querySelector('#menu-modes img[data-mode="6"]');
  if (menuImg) menuImg.addEventListener('click', handleStarClick, { once: true });
}

function finishMode() {
  if (completedModes[selectedMode]) return;
  completedModes[selectedMode] = true;
  localStorage.setItem('completedModes', JSON.stringify(completedModes));
  const next = selectedMode + 1;

  if (selectedMode === 6) {
    goHome();
    setTimeout(() => upgradeMode6Icon(true), 500);
    return;
  }

  if (next <= 6) {
    unlockMode(next, 500);
    const audio = document.getElementById('somModoDesbloqueado');
    if (audio) { audio.currentTime = 0; audio.play(); }

    if (selectedMode === 5) {
      setTimeout(() => { continuar(); }, 500);
    }
  }

  updateModeIcons();
}

function handleStarClick() {
  const starImg = document.querySelector('#menu-modes img[data-mode="6"]');
  const icons = document.querySelectorAll('#menu-modes img');
  icons.forEach(img => {
    const mode = parseInt(img.dataset.mode, 10);
    if (mode >= 2 && mode <= 5) {
      img.style.transition = 'opacity 1000ms linear';
      img.style.opacity = '0.3';
    } else if (mode === 1) {
      img.style.opacity = '1';
    }
  });
  if (starImg) {
    starImg.style.transition = 'opacity 300ms linear';
    starImg.style.opacity = '0';
    setTimeout(() => {
      starImg.src = modeImages[6];
      starImg.style.opacity = '0';
      starImg.style.transition = 'opacity 700ms linear';
      starImg.style.opacity = '0.3';
    }, 300);
  }
  pastaAtual++;
  localStorage.setItem('pastaAtual', pastaAtual);
  completedModes = {};
  unlockedModes = { 1: true };
  localStorage.setItem('completedModes', JSON.stringify(completedModes));
  localStorage.setItem('unlockedModes', JSON.stringify(unlockedModes));
  updateLevelIcon();
  updateModeIcons();
}

function nextMode() {
  if (transitioning) return;
  transitioning = true;
  if (selectedMode < 6) {
    const current = selectedMode;
    const next = current + 1;
    const info = modeTransitions[current];
    selectedMode = next;
    const done = () => {
      startGame(next);
      transitioning = false;
    };
    if (info) {
      showModeTransition(info, done);
    } else {
      done();
    }
  } else {
    pastaAtual++;
    selectedMode = 1;
    const done = () => {
      updateLevelIcon();
      startGame(1);
      transitioning = false;
    };
    showModeTransition(levelUpTransition, done);
  }
}


function goHome() {
  document.getElementById('visor').style.display = 'none';
  document.getElementById('menu').style.display = 'flex';
  const icon = document.getElementById('mode-icon');
  if (icon) icon.style.display = 'none';
  if (reconhecimento) {
    reconhecimentoAtivo = true;
    reconhecimento.lang = 'en-US';
    reconhecimento.start();
  }
  listeningForCommand = true;
  updateModeIcons();
}

function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const now = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
  el.textContent = now;
}

function startTutorial() {
  tutorialInProgress = true;
  localStorage.setItem('tutorialDone', 'true');
  const welcome = document.getElementById('somWelcome');
  if (welcome) setTimeout(() => { welcome.currentTime = 0; welcome.play(); }, 1);

  const tutorialLogo = document.getElementById('tutorial-logo');
  const logoTop = document.getElementById('logo-top');
  const levelIcon = document.getElementById('nivel-indicador');
  const menuIcons = document.querySelectorAll('#menu-modes img');
  const menuLogo = document.getElementById('menu-logo');

  if (levelIcon) levelIcon.style.display = 'none';
  if (menuLogo) menuLogo.style.display = 'none';
  if (tutorialLogo) {
    tutorialLogo.style.display = 'block';
    tutorialLogo.style.width = '20%';
    setTimeout(() => { tutorialLogo.style.display = 'none'; }, 750);
  }

  menuIcons.forEach(img => { img.style.opacity = '0'; });

  setTimeout(() => {
    menuIcons.forEach(img => {
      img.style.transition = 'opacity 2000ms linear';
      img.style.opacity = '0.3';
    });
  }, 4000);

  const mode1 = document.querySelector('#menu-modes img[data-mode="1"]');

  setTimeout(() => { if (levelIcon) levelIcon.style.display = 'block'; }, 11420);
  setTimeout(() => {
    if (logoTop) logoTop.style.display = 'block';
    if (menuLogo) menuLogo.style.display = 'block';
    if (mode1) unlockMode(1, 1000);
    tutorialInProgress = false;
  }, 11421);
}


window.onload = async () => {
  const saved = parseInt(localStorage.getItem('pastaAtual'), 10);
  if (saved) pastaAtual = saved;
  await carregarPastas();
  updateLevelIcon();
  updateModeIcons();
  if (completedModes[6]) upgradeMode6Icon();
  if (!ilifeDone) {
    const menu = document.getElementById('menu');
    const screen = document.getElementById('ilife-screen');
    if (menu) menu.style.display = 'none';
    if (screen) screen.style.display = 'flex';
    ilifeActive = true;
  } else if (!tutorialDone) {
    startTutorial();
  } else {
    const logoTop = document.getElementById('logo-top');
    const levelIcon = document.getElementById('nivel-indicador');
    const menuLogo = document.getElementById('menu-logo');
    if (logoTop) logoTop.style.display = 'block';
    if (levelIcon) levelIcon.style.display = 'block';
    if (menuLogo) menuLogo.style.display = 'block';
  }

  document.querySelectorAll('#mode-buttons img, #menu-modes img').forEach(img => {
    img.addEventListener('click', () => {
      const modo = parseInt(img.dataset.mode, 10);
      if (!unlockedModes[modo]) {
        const lock = document.getElementById('somLock');
        if (lock) { lock.currentTime = 0; lock.play(); }
        return;
      }
      startGame(modo);
    });
  });

  if (reconhecimento) {
    reconhecimento.lang = 'en-US';
    reconhecimentoAtivo = true;
    reconhecimento.start();
  }


  document.addEventListener('keydown', e => {
    if (ilifeActive && e.code === 'Space') {
      const lock = document.getElementById('somLock');
      if (lock) { lock.currentTime = 0; lock.play(); }
      return;
    }
    if (e.key === 'r') falarFrase();
    if (e.key.toLowerCase() === 'h') toggleDarkMode();
    if (e.key.toLowerCase() === 'i') {
      const [pt, en] = frasesArr[fraseIndex] || ['',''];
      const esperado = esperadoLang === 'pt' ? pt : en;
      document.getElementById('pt').value = esperado;
      verificarResposta();
      return;
    }
    if (e.key.toLowerCase() === 'l') {
      if (reconhecimento) {
        reconhecimentoAtivo = false;
        reconhecimento.stop();
      }
      clearInterval(timerInterval);
      clearInterval(prizeTimer);
      pastaAtual++;
      points = selectedMode === 1 ? 0 : INITIAL_POINTS;
      updateLevelIcon();
      beginGame();
    }
  });
};
