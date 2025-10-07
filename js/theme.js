const THEME_CLASSES = ['theme-black', 'theme-white', 'theme-blue'];
const THEME_NAMES = ['black', 'white', 'blue'];

function applyTheme(themeName, persist = true) {
  const normalized = THEME_NAMES.includes(themeName) ? themeName : 'black';
  const body = document.body;
  if (!body) return;
  THEME_CLASSES.forEach(cls => body.classList.remove(cls));
  body.classList.add(`theme-${normalized}`);
  if (persist) {
    try {
      localStorage.setItem('selectedTheme', normalized);
    } catch (err) {
      console.warn('Unable to persist theme preference', err);
    }
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: normalized }));
}

function getSelectedTheme() {
  try {
    return localStorage.getItem('selectedTheme') || 'black';
  } catch (err) {
    console.warn('Unable to read theme preference', err);
    return 'black';
  }
}

(function initTheme() {
  const saved = getSelectedTheme();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTheme(saved, false));
  } else {
    applyTheme(saved, false);
  }
})();

window.applyTheme = applyTheme;
window.getSelectedTheme = getSelectedTheme;
window.getAvailableThemes = () => [...THEME_NAMES];
