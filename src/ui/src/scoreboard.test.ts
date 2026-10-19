import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameState } from './api/v2-types';
import { ScoreboardDisplay } from './scoreboard';

let mockConnectionCallback: ((state: string) => void) | null = null;
let mockStateCallback: ((state: GameState) => void) | null = null;

vi.mock('./websocket', () => ({
  websocketClient: {
    subscribe: vi.fn((callback: (state: GameState) => void) => {
      mockStateCallback = callback;
      return () => {
        mockStateCallback = null;
      };
    }),
    subscribeConnection: vi.fn((callback: (state: string) => void) => {
      mockConnectionCallback = callback;
      callback('connecting');
      return () => {
        mockConnectionCallback = null;
      };
    }),
  },
}));

describe('ScoreboardDisplay', () => {
  let display: ScoreboardDisplay;

  beforeEach(() => {
    mockConnectionCallback = null;
    mockStateCallback = null;

    document.body.innerHTML = `
      <div id="conn-overlay" style="display:flex">
        <div id="conn-overlay-text">Connecting…</div>
      </div>
      <div id="scoreboard">
        <div id="score_box">
          <div class="score home">
            <div class="digit tens">0</div>
            <div class="digit ones">0</div>
          </div>
          <div class="clock">
            <div class="digit minutes tens">0</div>
            <div class="digit minutes ones">0</div>
            <div class="digit seconds tens">0</div>
            <div class="digit seconds ones">0</div>
          </div>
          <div class="score guest">
            <div class="digit tens">0</div>
            <div class="digit ones">0</div>
          </div>
        </div>
        <div id="penalty_box">
          <div class="penalties home">
            <div class="player">
              <div class="digits"><div class="digit tens">0</div><div class="digit ones">0</div></div>
              <div class="digits"><div class="digit tens">0</div><div class="digit ones">0</div></div>
            </div>
            <div class="penalty">
              <div class="digits"><div class="digit minutes">0</div><div class="digit seconds tens">0</div><div class="digit seconds ones">0</div></div>
              <div class="digits"><div class="digit minutes">0</div><div class="digit seconds tens">0</div><div class="digit seconds ones">0</div></div>
            </div>
          </div>
          <div class="period">
            <div class="digits"><div class="digit">0</div></div>
          </div>
          <div class="penalties guest">
            <div class="player">
              <div class="digits"><div class="digit tens">0</div><div class="digit ones">0</div></div>
              <div class="digits"><div class="digit tens">0</div><div class="digit ones">0</div></div>
            </div>
            <div class="penalty">
              <div class="digits"><div class="digit minutes">0</div><div class="digit seconds tens">0</div><div class="digit seconds ones">0</div></div>
              <div class="digits"><div class="digit minutes">0</div><div class="digit seconds tens">0</div><div class="digit seconds ones">0</div></div>
            </div>
          </div>
        </div>
      </div>
    `;

    display = new ScoreboardDisplay();
  });

  afterEach(() => {
    display.destroy();
  });

  it('updates connection overlay on connection events', () => {
    const overlay = document.getElementById('conn-overlay');
    const overlayText = document.getElementById('conn-overlay-text');

    expect(overlay?.style.display).toBe('flex');
    expect(overlayText?.textContent).toBe('Connecting to scoreboard…');

    mockConnectionCallback?.('open');
    expect(overlay?.style.display).toBe('none');

    mockConnectionCallback?.('closed');
    expect(overlay?.style.display).toBe('flex');
    expect(overlayText?.textContent).toBe('Reconnecting…');
  });

  it('updates display on websocket game state message', () => {
    const mockState = {
      gameId: '1',
      config: null,
      status: 'PLAYING',
      period: 2,
      clock: { timeRemainingMillis: 1200000, isRunning: false, startTimeWallClock: 0 },
      home: {
        goals: [{ goalId: 'g1', teamId: 'home', period: 1, timeInPeriodMillis: 1000, scorerNumber: 10, assistNumbers: [], isEmptyNet: false }],
        shots: 5,
        penalties: [],
      },
      away: { goals: [], shots: 0, penalties: [] },
      buzzerOn: false,
      eventHistory: [],
    } as unknown as GameState;

    mockStateCallback?.(mockState);

    expect(document.querySelector('.score.home .digit.tens')?.textContent).toBe('0');
    expect(document.querySelector('.score.home .digit.ones')?.textContent).toBe('1');
    expect(document.querySelector('#penalty_box .period .digit')?.textContent).toBe('2');
  });

  it('renders scores correctly', () => {
    const mockState = {
      gameId: '1',
      config: null,
      status: 'PLAYING',
      period: 2,
      clock: { timeRemainingMillis: 1200000, isRunning: false, startTimeWallClock: 0 },
      home: {
        goals: [{ goalId: 'g1', teamId: 'home', period: 1, timeInPeriodMillis: 1000, scorerNumber: 10, assistNumbers: [], isEmptyNet: false }],
        shots: 5,
        penalties: [],
      },
      away: {
        goals: [
          { goalId: 'g2', teamId: 'away', period: 1, timeInPeriodMillis: 2000, scorerNumber: 20, assistNumbers: [], isEmptyNet: false },
          { goalId: 'g3', teamId: 'away', period: 2, timeInPeriodMillis: 3000, scorerNumber: 21, assistNumbers: [], isEmptyNet: false },
        ],
        shots: 8,
        penalties: [],
      },
      buzzerOn: false,
      eventHistory: [],
    } as unknown as GameState;

    display.render(mockState);

    expect(document.querySelector('.score.home .digit.tens')?.textContent).toBe('0');
    expect(document.querySelector('.score.home .digit.ones')?.textContent).toBe('1');
    expect(document.querySelector('.score.guest .digit.tens')?.textContent).toBe('0');
    expect(document.querySelector('.score.guest .digit.ones')?.textContent).toBe('2');
  });

  it('renders clock digits with ceiling rounding', () => {
    // 65.4 seconds = 65400 ms -> should round up to 66 seconds (01:06)
    display.renderClock(65400);

    expect(document.querySelector('.clock .digit.minutes.tens')?.textContent).toBe('0');
    expect(document.querySelector('.clock .digit.minutes.ones')?.textContent).toBe('1');
    expect(document.querySelector('.clock .digit.seconds.tens')?.textContent).toBe('0');
    expect(document.querySelector('.clock .digit.seconds.ones')?.textContent).toBe('6');
  });

  it('renders period and buzzer state', () => {
    const mockState = {
      gameId: '1',
      config: null,
      status: 'PLAYING',
      period: 3,
      clock: { timeRemainingMillis: 0, isRunning: false, startTimeWallClock: 0 },
      home: { goals: [], shots: 0, penalties: [] },
      away: { goals: [], shots: 0, penalties: [] },
      buzzerOn: true,
      eventHistory: [],
    } as unknown as GameState;

    display.render(mockState);

    expect(document.querySelector('#penalty_box .period .digit')?.textContent).toBe('3');
    expect(document.body.classList.contains('buzzer')).toBe(true);
  });

  it('renders active penalties for home and guest', () => {
    const mockState = {
      gameId: '1',
      config: null,
      status: 'PLAYING',
      period: 1,
      clock: { timeRemainingMillis: 600000, isRunning: false, startTimeWallClock: 0 },
      home: {
        goals: [],
        shots: 0,
        penalties: [
          {
            penaltyId: 'p1',
            teamId: 'home',
            playerNumber: 44,
            servingPlayerNumber: 44,
            durationMillis: 120000,
            timeRemainingMillis: 115000,
            startTimeWallClock: 0,
            period: 1,
          },
        ],
      },
      away: {
        goals: [],
        shots: 0,
        penalties: [
          {
            penaltyId: 'p2',
            teamId: 'away',
            playerNumber: 7,
            servingPlayerNumber: 7,
            durationMillis: 120000,
            timeRemainingMillis: 60000,
            startTimeWallClock: 0,
            period: 1,
          },
        ],
      },
      buzzerOn: false,
      eventHistory: [],
    } as unknown as GameState;

    display.render(mockState);

    // Home player 44, time 115000ms = 1:55
    const homePlayerRows = document.querySelectorAll('.penalties.home .player .digits');
    expect(homePlayerRows[0].querySelector('.digit.tens')?.textContent).toBe('4');
    expect(homePlayerRows[0].querySelector('.digit.ones')?.textContent).toBe('4');

    const homePenaltyRows = document.querySelectorAll('.penalties.home .penalty .digits');
    expect(homePenaltyRows[0].querySelector('.digit.minutes')?.textContent).toBe('1');
    expect(homePenaltyRows[0].querySelector('.digit.seconds.tens')?.textContent).toBe('5');
    expect(homePenaltyRows[0].querySelector('.digit.seconds.ones')?.textContent).toBe('5');

    // Guest player 7 (07), time 60000ms = 1:00
    const guestPlayerRows = document.querySelectorAll('.penalties.guest .player .digits');
    expect(guestPlayerRows[0].querySelector('.digit.tens')?.textContent).toBe('0');
    expect(guestPlayerRows[0].querySelector('.digit.ones')?.textContent).toBe('7');

    const guestPenaltyRows = document.querySelectorAll('.penalties.guest .penalty .digits');
    expect(guestPenaltyRows[0].querySelector('.digit.minutes')?.textContent).toBe('1');
    expect(guestPenaltyRows[0].querySelector('.digit.seconds.tens')?.textContent).toBe('0');
    expect(guestPenaltyRows[0].querySelector('.digit.seconds.ones')?.textContent).toBe('0');
  });
});
