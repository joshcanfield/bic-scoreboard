import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  sanitizeHex,
  relLuminance,
  applyColor,
  updateColorChips,
  loadStoredTeamColors,
  renderPalette,
  bindColorInput,
} from './team-colors';

describe('team-colors', () => {
  describe('sanitizeHex', () => {
    it('accepts valid 6-character hex codes', () => {
      expect(sanitizeHex('#ff0000')).toBe('#ff0000');
      expect(sanitizeHex('#AABBCC')).toBe('#AABBCC');
    });

    it('accepts valid 3-character hex codes', () => {
      expect(sanitizeHex('#f00')).toBe('#f00');
      expect(sanitizeHex('#ABC')).toBe('#ABC');
    });

    it('returns empty string for invalid formats', () => {
      expect(sanitizeHex('ff0000')).toBe('');
      expect(sanitizeHex('#gg0000')).toBe('');
      expect(sanitizeHex('#ff00')).toBe('');
      expect(sanitizeHex('not-a-color')).toBe('');
      expect(sanitizeHex(null)).toBe('');
    });

    it('trims whitespace', () => {
      expect(sanitizeHex('  #ff0000  ')).toBe('#ff0000');
    });
  });

  describe('relLuminance', () => {
    it('calculates luminance for black as close to 0', () => {
      expect(relLuminance('#000000')).toBeCloseTo(0, 2);
    });

    it('calculates luminance for white as close to 1', () => {
      expect(relLuminance('#ffffff')).toBeCloseTo(1, 2);
    });

    it('calculates luminance for red', () => {
      const lum = relLuminance('#ff0000');
      expect(lum).toBeGreaterThan(0);
      expect(lum).toBeLessThan(0.5);
    });

    it('handles 3-character hex codes', () => {
      expect(relLuminance('#fff')).toBeCloseTo(1, 2);
      expect(relLuminance('#000')).toBeCloseTo(0, 2);
    });

    it('calculates correct luminance for mid-gray', () => {
      const lum = relLuminance('#808080');
      expect(lum).toBeGreaterThan(0.2);
      expect(lum).toBeLessThan(0.3);
    });
  });

  describe('applyColor', () => {
    let updateChipsMock: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
      updateChipsMock = vi.fn<() => void>();
      // Clear any style properties
      document.documentElement.style.removeProperty('--home-color');
      document.documentElement.style.removeProperty('--home-fg');
      document.documentElement.style.removeProperty('--away-color');
      document.documentElement.style.removeProperty('--away-fg');
      localStorage.clear();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('sets CSS custom property for valid color', () => {
      applyColor('--home-color', '#ff0000', updateChipsMock);
      expect(document.documentElement.style.getPropertyValue('--home-color')).toBe('#ff0000');
    });

    it('sets white foreground for dark colors', () => {
      applyColor('--home-color', '#000000', updateChipsMock);
      expect(document.documentElement.style.getPropertyValue('--home-fg')).toBe('#ffffff');
    });

    it('sets dark foreground for light colors', () => {
      applyColor('--home-color', '#ffffff', updateChipsMock);
      expect(document.documentElement.style.getPropertyValue('--home-fg')).toBe('#101218');
    });

    it('persists home color to localStorage', () => {
      applyColor('--home-color', '#ff0000', updateChipsMock);
      expect(localStorage.getItem('scoreboard.homeColor')).toBe('#ff0000');
    });

    it('persists away color to localStorage', () => {
      applyColor('--away-color', '#00ff00', updateChipsMock);
      expect(localStorage.getItem('scoreboard.awayColor')).toBe('#00ff00');
    });

    it('calls updateChips callback', () => {
      applyColor('--home-color', '#ff0000', updateChipsMock);
      expect(updateChipsMock).toHaveBeenCalledTimes(1);
    });

    it('does nothing for invalid color', () => {
      applyColor('--home-color', 'invalid', updateChipsMock);
      expect(document.documentElement.style.getPropertyValue('--home-color')).toBe('');
      expect(updateChipsMock).not.toHaveBeenCalled();
    });

    it('handles localStorage errors gracefully', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
      // Should not throw
      expect(() => applyColor('--home-color', '#ff0000', updateChipsMock)).not.toThrow();
      setItemSpy.mockRestore();
    });
  });

  describe('updateColorChips', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="home-color-chip"></div>
        <div id="away-color-chip"></div>
      `;
      document.documentElement.style.setProperty('--home-color', '#2e86de');
      document.documentElement.style.setProperty('--away-color', '#e74c3c');
    });

    afterEach(() => {
      document.body.innerHTML = '';
      document.documentElement.style.removeProperty('--home-color');
      document.documentElement.style.removeProperty('--away-color');
    });

    it('updates home chip background color', () => {
      updateColorChips();
      const chip = document.getElementById('home-color-chip') as HTMLElement;
      expect(chip.style.backgroundColor).toBeTruthy();
    });

    it('updates away chip background color', () => {
      updateColorChips();
      const chip = document.getElementById('away-color-chip') as HTMLElement;
      expect(chip.style.backgroundColor).toBeTruthy();
    });

    it('sets title attribute with color value', () => {
      updateColorChips();
      const homeChip = document.getElementById('home-color-chip') as HTMLElement;
      const awayChip = document.getElementById('away-color-chip') as HTMLElement;
      expect(homeChip.title).toContain('Home');
      expect(awayChip.title).toContain('Away');
    });

    it('handles missing elements gracefully', () => {
      document.body.innerHTML = '';
      expect(() => updateColorChips()).not.toThrow();
    });
  });

  describe('loadStoredTeamColors', () => {
    beforeEach(() => {
      localStorage.clear();
      document.documentElement.style.removeProperty('--home-color');
      document.documentElement.style.removeProperty('--away-color');
      document.body.innerHTML = `
        <div id="home-color-chip"></div>
        <div id="away-color-chip"></div>
      `;
    });

    afterEach(() => {
      localStorage.clear();
      document.body.innerHTML = '';
    });

    it('loads stored home color from localStorage', () => {
      localStorage.setItem('scoreboard.homeColor', '#123456');
      loadStoredTeamColors();
      expect(document.documentElement.style.getPropertyValue('--home-color')).toBe('#123456');
    });

    it('loads stored away color from localStorage', () => {
      localStorage.setItem('scoreboard.awayColor', '#654321');
      loadStoredTeamColors();
      expect(document.documentElement.style.getPropertyValue('--away-color')).toBe('#654321');
    });

    it('uses default colors when localStorage is empty', () => {
      loadStoredTeamColors();
      // Should apply some color (either from CSS var or default)
      expect(document.documentElement.style.getPropertyValue('--home-color')).toBeTruthy();
      expect(document.documentElement.style.getPropertyValue('--away-color')).toBeTruthy();
    });

    it('handles localStorage errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(() => loadStoredTeamColors()).not.toThrow();
    });
  });

  describe('renderPalette', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="test-palette"></div>
        <input type="color" id="test-input" />
      `;
      document.documentElement.style.setProperty('--test-color', '#ff0000');
      localStorage.clear();
    });

    afterEach(() => {
      document.body.innerHTML = '';
      localStorage.clear();
    });

    it('renders color swatches in container', () => {
      renderPalette('test-palette', '--test-color', 'test-input');
      const swatches = document.querySelectorAll('#test-palette .color-swatch');
      expect(swatches.length).toBeGreaterThan(0);
    });

    it('sets background color on each swatch', () => {
      renderPalette('test-palette', '--test-color', 'test-input');
      const swatch = document.querySelector('#test-palette .color-swatch') as HTMLElement;
      expect(swatch.style.backgroundColor).toBeTruthy();
    });

    it('marks current color as selected', () => {
      document.documentElement.style.setProperty('--test-color', '#000000');
      renderPalette('test-palette', '--test-color', 'test-input');
      const selected = document.querySelector('#test-palette .color-swatch.selected');
      expect(selected).toBeTruthy();
    });

    it('clicking swatch applies color', () => {
      renderPalette('test-palette', '--test-color', 'test-input');
      const swatch = document.querySelector('#test-palette .color-swatch') as HTMLButtonElement;
      swatch.click();
      expect(document.documentElement.style.getPropertyValue('--test-color')).toBeTruthy();
    });

    it('clicking swatch updates selection state', () => {
      renderPalette('test-palette', '--test-color', 'test-input');
      const swatches = document.querySelectorAll('#test-palette .color-swatch');
      (swatches[1] as HTMLButtonElement).click();
      expect(swatches[1].classList.contains('selected')).toBe(true);
    });

    it('clicking swatch syncs input value', () => {
      renderPalette('test-palette', '--test-color', 'test-input');
      const swatch = document.querySelector('#test-palette .color-swatch') as HTMLButtonElement;
      swatch.click();
      const input = document.getElementById('test-input') as HTMLInputElement;
      expect(input.value).toBeTruthy();
    });

    it('does nothing if container not found', () => {
      expect(() => renderPalette('nonexistent', '--test-color', null)).not.toThrow();
    });

    it('works without input id', () => {
      renderPalette('test-palette', '--test-color', null);
      const swatch = document.querySelector('#test-palette .color-swatch') as HTMLButtonElement;
      expect(() => swatch.click()).not.toThrow();
    });
  });

  describe('bindColorInput', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <input type="color" id="color-input" value="#ff0000" />
        <div id="color-palette">
          <button class="color-swatch selected"></button>
        </div>
        <div id="home-color-chip"></div>
        <div id="away-color-chip"></div>
      `;
      document.documentElement.style.removeProperty('--home-color');
      document.documentElement.style.removeProperty('--away-color');
      localStorage.clear();
    });

    afterEach(() => {
      document.body.innerHTML = '';
      document.documentElement.style.removeProperty('--home-color');
      document.documentElement.style.removeProperty('--away-color');
      localStorage.clear();
    });

    it('binds input event to apply color', () => {
      bindColorInput('color-input', '--home-color', 'color-palette');
      const input = document.getElementById('color-input') as HTMLInputElement;
      input.value = '#00ff00';
      input.dispatchEvent(new Event('input'));
      expect(document.documentElement.style.getPropertyValue('--home-color')).toBe('#00ff00');
    });

    it('clears selection when custom color chosen', () => {
      bindColorInput('color-input', '--home-color', 'color-palette');
      const input = document.getElementById('color-input') as HTMLInputElement;
      input.value = '#00ff00';
      input.dispatchEvent(new Event('input'));
      const selected = document.querySelector('#color-palette .color-swatch.selected');
      expect(selected).toBeFalsy();
    });

    it('applies default color when input is cleared (browser coerces to #000000)', () => {
      // Color inputs always have a value - browsers coerce empty to #000000
      bindColorInput('color-input', '--home-color', 'color-palette');
      const input = document.getElementById('color-input') as HTMLInputElement;
      input.value = ''; // Browser coerces this to #000000 for color inputs
      input.dispatchEvent(new Event('input'));
      // The coerced #000000 gets applied since color inputs always provide a valid hex
      expect(document.documentElement.style.getPropertyValue('--home-color')).toBe('#000000');
    });

    it('does nothing if input not found', () => {
      expect(() => bindColorInput('nonexistent', '--home-color', 'color-palette')).not.toThrow();
    });

    it('handles missing palette gracefully', () => {
      document.getElementById('color-palette')!.remove();
      bindColorInput('color-input', '--home-color', 'color-palette');
      const input = document.getElementById('color-input') as HTMLInputElement;
      input.value = '#00ff00';
      expect(() => input.dispatchEvent(new Event('input'))).not.toThrow();
    });
  });
});
