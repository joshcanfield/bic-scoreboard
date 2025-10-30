import { describe, it, expect, beforeEach } from 'vitest';

import { createModalController } from './modals';

describe('modals', () => {
  let modal: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="test-modal" class="modal">
        <div class="modal-content">
          <button data-dismiss="modal">Close</button>
        </div>
      </div>
      <button data-toggle="modal" href="#test-modal">Open</button>
    `;
    modal = document.getElementById('test-modal')!;
  });

  describe('show', () => {
    it('displays the modal and sets aria attributes', () => {
      const controller = createModalController();
      controller.show(modal);

      expect(modal.style.display).toBe('block');
      expect(modal.getAttribute('aria-hidden')).toBe('false');
      expect(modal.classList.contains('in')).toBe(true);
      expect(document.body.classList.contains('modal-open')).toBe(true);
    });
  });

  describe('hide', () => {
    it('hides the modal and removes classes', () => {
      const controller = createModalController();
      controller.show(modal);
      controller.hide(modal);

      expect(modal.style.display).toBe('none');
      expect(modal.getAttribute('aria-hidden')).toBe('true');
      expect(modal.classList.contains('in')).toBe(false);
      expect(document.body.classList.contains('modal-open')).toBe(false);
    });
  });

  describe('showById', () => {
    it('shows modal by id with # prefix', () => {
      const controller = createModalController();
      controller.showById('#test-modal');
      expect(modal.style.display).toBe('block');
    });

    it('shows modal by id without # prefix', () => {
      const controller = createModalController();
      controller.showById('test-modal');
      expect(modal.style.display).toBe('block');
    });
  });

  describe('init', () => {
    it('sets up event delegation for data-toggle', () => {
      const controller = createModalController();
      controller.init();

      const button = document.querySelector<HTMLElement>('[data-toggle="modal"]')!;
      button.click();

      expect(modal.style.display).toBe('block');
    });

    it('sets up event delegation for data-dismiss', () => {
      const controller = createModalController();
      controller.init();
      controller.show(modal);

      const closeButton = modal.querySelector<HTMLElement>('[data-dismiss="modal"]')!;
      closeButton.click();

      expect(modal.style.display).toBe('none');
    });
  });
});
