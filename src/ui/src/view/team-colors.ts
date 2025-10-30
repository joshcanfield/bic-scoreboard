/**
 * Team color management with persistent storage and palette rendering.
 * Supports preset colors and custom color picker integration.
 */

const DEFAULT_COLORS = [
  '#000000',
  '#ffffff',
  '#e74c3c',
  '#f39c12',
  '#f1c40f',
  '#2ecc71',
  '#3498db',
  '#3f51b5',
  '#9b59b6',
];

const LS_HOME = 'scoreboard.homeColor';
const LS_AWAY = 'scoreboard.awayColor';

export const sanitizeHex = (val: string | null): string => {
  if (typeof val === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val.trim())) {
    return val.trim();
  }
  return '';
};

const getCssVar = (name: string, fallback: string): string => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v && v.trim()) || fallback || '';
};

export const relLuminance = (hex: string): number => {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const R = toLin(r);
  const G = toLin(g);
  const B = toLin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const colorKeyForVar = (cssVarName: string): string => {
  return cssVarName === '--home-color' ? LS_HOME : LS_AWAY;
};

export const applyColor = (cssVarName: string, color: string, updateChips: () => void) => {
  const c = sanitizeHex(color);
  if (!c) return;
  document.documentElement.style.setProperty(cssVarName, c);
  // Set contrasting foreground var
  const fg = relLuminance(c) < 0.5 ? '#ffffff' : '#101218';
  const fgVar = cssVarName === '--home-color' ? '--home-fg' : '--away-fg';
  document.documentElement.style.setProperty(fgVar, fg);
  // Persist
  try {
    localStorage.setItem(colorKeyForVar(cssVarName), c);
  } catch (_) {
    // Ignore storage errors
  }
  // Refresh chips
  updateChips();
};

export const updateColorChips = () => {
  const hc = document.getElementById('home-color-chip');
  const ac = document.getElementById('away-color-chip');
  const hCol = getCssVar('--home-color', '#2e86de');
  const aCol = getCssVar('--away-color', '#e74c3c');
  if (hc) {
    hc.style.background = hCol;
    hc.style.backgroundColor = hCol;
    hc.title = `Home ${hCol}`;
  }
  if (ac) {
    ac.style.background = aCol;
    ac.style.backgroundColor = aCol;
    ac.title = `Away ${aCol}`;
  }
};

export const loadStoredTeamColors = () => {
  try {
    const h = sanitizeHex(localStorage.getItem(LS_HOME));
    const a = sanitizeHex(localStorage.getItem(LS_AWAY));
    if (h) {
      applyColor('--home-color', h, updateColorChips);
    } else {
      applyColor('--home-color', getCssVar('--home-color', '#2e86de'), updateColorChips);
    }
    if (a) {
      applyColor('--away-color', a, updateColorChips);
    } else {
      applyColor('--away-color', getCssVar('--away-color', '#e74c3c'), updateColorChips);
    }
  } catch (_) {
    // Ignore storage errors
  }
};

export const renderPalette = (
  containerId: string,
  cssVarName: string,
  inputId: string | null
) => {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  const current = getCssVar(cssVarName, '');

  DEFAULT_COLORS.forEach((color) => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className =
      'color-swatch' + (color.toLowerCase() === (current || '').toLowerCase() ? ' selected' : '');
    sw.style.backgroundColor = color;
    sw.title = color;
    sw.setAttribute('aria-label', color);
    sw.addEventListener('click', () => {
      applyColor(cssVarName, color, updateColorChips);
      // Update selection state
      Array.from(el.querySelectorAll('.color-swatch')).forEach((n) =>
        n.classList.remove('selected')
      );
      sw.classList.add('selected');
      // Sync input
      if (inputId) {
        const input = document.getElementById(inputId) as HTMLInputElement | null;
        if (input) input.value = color;
      }
    });
    el.appendChild(sw);
  });
};

export const bindColorInput = (inputId: string, cssVarName: string, paletteId: string) => {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) return;
  input.addEventListener('input', () => {
    const val = input.value;
    if (val) applyColor(cssVarName, val, updateColorChips);
    // Clear selection highlight when picking custom
    const pal = document.getElementById(paletteId);
    if (pal) {
      Array.from(pal.querySelectorAll('.color-swatch')).forEach((n) =>
        n.classList.remove('selected')
      );
    }
  });
};

export const initTeamColorPickers = () => {
  const on = (
    el: HTMLElement | Document,
    type: string,
    selector: string,
    handler: (e: Event, t: HTMLElement) => void
  ) => {
    el.addEventListener(type, (e) => {
      const target = (e.target as HTMLElement).closest(selector);
      if (target && el.contains(target)) {
        handler(e, target as HTMLElement);
      }
    });
  };

  // Open Team Colors modal and render palettes
  on(document, 'click', '[data-toggle="modal"][href="#team-colors"]', (e, t) => {
    const hc = document.getElementById('home-color-input') as HTMLInputElement | null;
    const ac = document.getElementById('away-color-input') as HTMLInputElement | null;
    if (hc) {
      hc.value =
        getCssVar('--home-color', sanitizeHex(localStorage.getItem(LS_HOME)) || '#2e86de');
    }
    if (ac) {
      ac.value =
        getCssVar('--away-color', sanitizeHex(localStorage.getItem(LS_AWAY)) || '#e74c3c');
    }
    // Render swatches
    renderPalette('home-color-palette', '--home-color', 'home-color-input');
    renderPalette('away-color-palette', '--away-color', 'away-color-input');
    // Focus the relevant input if chip used
    const team =
      t && t.id && t.id.indexOf('home') >= 0
        ? 'home'
        : t && t.id && t.id.indexOf('away') >= 0
          ? 'away'
          : '';
    setTimeout(() => {
      if (team === 'home' && hc) hc.focus();
      if (team === 'away' && ac) ac.focus();
    }, 0);
  });

  // Bind native color inputs to CSS vars and chips
  bindColorInput('home-color-input', '--home-color', 'home-color-palette');
  bindColorInput('away-color-input', '--away-color', 'away-color-palette');

  // Load stored colors then paint chips
  loadStoredTeamColors();
  updateColorChips();
};
