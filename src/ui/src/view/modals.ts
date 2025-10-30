/**
 * Minimal modal management (Bootstrap-like) without external dependencies.
 * Supports showing/hiding modals and handling backdrop clicks.
 */

export interface ModalController {
  show: (modal: HTMLElement) => void;
  hide: (modal: HTMLElement) => void;
  showById: (id: string) => void;
  init: () => void;
}

export const createModalController = (): ModalController => {
  const show = (modal: HTMLElement) => {
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('in');
    document.body.classList.add('modal-open');
  };

  const hide = (modal: HTMLElement) => {
    modal.classList.remove('in');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  };

  const showById = (id: string) => {
    const selector = id.startsWith('#') ? id : `#${id}`;
    const modal = document.querySelector<HTMLElement>(selector);
    if (modal) show(modal);
  };

  const on = (
    el: HTMLElement | Document,
    type: string,
    selOrHandler: string | EventListener,
    handler?: (e: Event, t: HTMLElement) => void
  ) => {
    if (!handler) {
      el.addEventListener(type, selOrHandler as EventListener);
      return;
    }
    el.addEventListener(type, (e) => {
      const target = (e.target as HTMLElement).closest(selOrHandler as string);
      if (target && el.contains(target)) {
        handler(e, target as HTMLElement);
      }
    });
  };

  const init = () => {
    // Open via [data-toggle="modal"][href="#id"]
    on(document, 'click', '[data-toggle="modal"]', (e, t) => {
      e.preventDefault();
      const href = t.getAttribute('href');
      if (href) showById(href);
      // Store trigger for later access
      const modal = document.querySelector<HTMLElement & { __trigger?: HTMLElement }>(href);
      if (modal) modal.__trigger = t;
    });

    // Close via [data-dismiss="modal"]
    on(document, 'click', '[data-dismiss="modal"]', (e, t) => {
      e.preventDefault();
      const modal = t.closest<HTMLElement>('.modal');
      if (modal) hide(modal);
    });

    // Backdrop click
    on(document, 'click', '.modal', (e, t) => {
      if (e.target === t) hide(t);
    });
  };

  return { init, show, hide, showById };
};

export default createModalController();
