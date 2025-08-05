document.addEventListener('DOMContentLoaded', () => {
  fetch('users/bots.json')
    .then(r => r.json())
    .then(data => {
      const list = document.getElementById('bot-list');
      data.bots.forEach(bot => {
        const div = document.createElement('div');
        div.className = 'bot-item';
        div.innerHTML = `<img src="users/${bot.file}" alt="${bot.name}"><div>${bot.name}</div>`;
        div.addEventListener('click', () => showModes(bot));
        list.appendChild(div);
      });
    });

  function showModes(bot) {
    document.getElementById('bot-list').style.display = 'none';
    const modeList = document.getElementById('mode-list');
    modeList.innerHTML = '';
    for (let i = 2; i <= 6; i++) {
      const img = document.createElement('img');
      img.src = `selos%20modos%20de%20jogo/modo${i}.png`;
      img.alt = `Modo ${i}`;
      img.dataset.mode = i;
      img.addEventListener('click', () => {
        window.location.href = `play.html?mode=${i}&bot=${bot.name}`;
      });
      modeList.appendChild(img);
    }
    modeList.style.display = 'grid';
  }
});
