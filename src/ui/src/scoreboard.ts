/**
 * Spectator Scoreboard display page.
 * Connects to GameWebSocketV2 to display real-time clock, score, period, and penalties.
 */

import type { GameState, Penalty } from './api/v2-types';
import { websocketClient } from './websocket';

const digits2 = (n: number): [number, number] => [Math.floor(n / 10), n % 10];

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(sel);

const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll<T>(sel));

export class ScoreboardDisplay {
  private unsubConnection: (() => void) | null = null;
  private unsubState: (() => void) | null = null;

  // Cached DOM elements
  private overlay: HTMLElement | null = null;
  private overlayText: HTMLElement | null = null;
  private homeTens: HTMLElement | null = null;
  private homeOnes: HTMLElement | null = null;
  private guestTens: HTMLElement | null = null;
  private guestOnes: HTMLElement | null = null;
  private minTens: HTMLElement | null = null;
  private minOnes: HTMLElement | null = null;
  private secTens: HTMLElement | null = null;
  private secOnes: HTMLElement | null = null;
  private periodDigit: HTMLElement | null = null;

  constructor() {
    this.cacheElements();
    this.bindConnection();
    this.bindState();
  }

  private cacheElements(): void {
    this.overlay = $('#conn-overlay');
    this.overlayText = $('#conn-overlay-text');

    const scoreBox = $('#score_box');
    if (scoreBox) {
      this.homeTens = $('.score.home .digit.tens', scoreBox);
      this.homeOnes = $('.score.home .digit.ones', scoreBox);
      this.guestTens = $('.score.guest .digit.tens', scoreBox);
      this.guestOnes = $('.score.guest .digit.ones', scoreBox);
      this.minTens = $('.clock .digit.minutes.tens', scoreBox);
      this.minOnes = $('.clock .digit.minutes.ones', scoreBox);
      this.secTens = $('.clock .digit.seconds.tens', scoreBox);
      this.secOnes = $('.clock .digit.seconds.ones', scoreBox);
    }

    this.periodDigit = $('#penalty_box .period .digit');
  }

  private setText(el: HTMLElement | null, text: string): void {
    if (el && el.textContent !== text) {
      el.textContent = text;
    }
  }

  public bindConnection(): void {
    const overlay = this.overlay || $('#conn-overlay');
    const overlayText = this.overlayText || $('#conn-overlay-text');

    this.unsubConnection = websocketClient.subscribeConnection((state) => {
      if (!overlay) return;
      if (state === 'open') {
        overlay.style.display = 'none';
      } else {
        overlay.style.display = 'flex';
        if (overlayText) {
          overlayText.textContent = state === 'connecting' ? 'Connecting to scoreboard…' : 'Reconnecting…';
        }
      }
    });
  }

  public bindState(): void {
    this.unsubState = websocketClient.subscribe((state) => {
      this.render(state);
    });
  }

  /**
   * No-op retained for backwards compatibility.
   * Authoritative clock timing is streamed directly from GameEngine over WebSocket.
   */
  public updateTicker(_state?: GameState): void {}

  public render(state: GameState): void {
    // Scores
    const homeScore = state.home.goals ? state.home.goals.length : 0;
    const awayScore = state.away.goals ? state.away.goals.length : 0;
    const [ht, ho] = digits2(homeScore);
    const [at, ao] = digits2(awayScore);

    this.setText(this.homeTens || $('.score.home .digit.tens'), String(ht));
    this.setText(this.homeOnes || $('.score.home .digit.ones'), String(ho));
    this.setText(this.guestTens || $('.score.guest .digit.tens'), String(at));
    this.setText(this.guestOnes || $('.score.guest .digit.ones'), String(ao));

    // Clock
    this.renderClock(state.clock.timeRemainingMillis);

    // Period
    this.setText(this.periodDigit || $('#penalty_box .period .digit'), String(state.period));

    // Penalties
    this.renderPenalties(state);

    // Buzzer visual
    document.body.classList.toggle('buzzer', !!state.buzzerOn);
  }

  public renderClock(millis: number): void {
    // Use ceiling calculation to match hockey scoreboard convention (e.g. 65.4s -> 1:06)
    const totalSeconds = Math.max(0, Math.ceil(millis / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const [mt, mo] = digits2(minutes);
    const [st, so] = digits2(seconds);

    this.setText(this.minTens || $('.clock .digit.minutes.tens'), String(mt));
    this.setText(this.minOnes || $('.clock .digit.minutes.ones'), String(mo));
    this.setText(this.secTens || $('.clock .digit.seconds.tens'), String(st));
    this.setText(this.secOnes || $('.clock .digit.seconds.ones'), String(so));
  }

  public renderPenalties(state: GameState): void {
    this.renderTeamPenalties('home', state.home.penalties || []);
    this.renderTeamPenalties('guest', state.away.penalties || []);
  }

  private renderTeamPenalties(teamKey: 'home' | 'guest', penalties: Penalty[]): void {
    const teamBox = $(`#penalty_box .penalties.${teamKey}`);
    if (!teamBox) return;

    const playerDigitRows = $$('.player .digits', teamBox);
    const penaltyDigitRows = $$('.penalty .digits', teamBox);

    // Filter to active penalties
    const active = penalties.filter(p => p.timeRemainingMillis > 0);

    for (let i = 0; i < 2; i++) {
      const p = active[i];
      const playerRow = playerDigitRows[i];
      const penaltyRow = penaltyDigitRows[i];

      if (!playerRow || !penaltyRow) continue;

      if (!p || p.timeRemainingMillis <= 0) {
        this.clearDigits(playerRow, penaltyRow);
        continue;
      }

      // Player number digits
      const servingNumber = p.servingPlayerNumber > 0 ? p.servingPlayerNumber : p.playerNumber;
      const [pt, po] = digits2(servingNumber);
      this.setText($('.digit.tens', playerRow), String(pt));
      this.setText($('.digit.ones', playerRow), String(po));

      // Penalty time digits
      const totalSeconds = Math.max(0, Math.ceil(p.timeRemainingMillis / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const [st, so] = digits2(seconds);

      this.setText($('.digit.minutes', penaltyRow), String(minutes));
      this.setText($('.digit.seconds.tens', penaltyRow), String(st));
      this.setText($('.digit.seconds.ones', penaltyRow), String(so));
    }
  }

  private clearDigits(playerRow: HTMLElement, penaltyRow: HTMLElement): void {
    $$('.digit', playerRow).forEach(d => { this.setText(d, '0'); });
    $$('.digit', penaltyRow).forEach(d => { this.setText(d, '0'); });
  }

  public destroy(): void {
    if (this.unsubConnection) {
      this.unsubConnection();
      this.unsubConnection = null;
    }
    if (this.unsubState) {
      this.unsubState();
      this.unsubState = null;
    }
  }
}

// Automatically instantiate on page load when running in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const isTest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);
  if (!isTest) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        new ScoreboardDisplay();
      });
    } else {
      new ScoreboardDisplay();
    }
  }
}
