/**
 * Tests for the Control UI module.
 * Tests DOM helpers, state management, rendering, and event handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameState, GoalEvent, Penalty, Command } from './api/v2-types';

// Helper to create mock game state
const createMockGameState = (overrides: Partial<GameState> = {}): GameState => ({
  gameId: 'test-game-1',
  config: {
    templateId: 'standard',
    warmupLengthMinutes: 5,
    warmupLengthMillis: 300000,
    periodLengthMinutes: 15,
    periodLengthMillis: 900000,
    intermissionLengthMinutes: 3,
    intermissionLengthMillis: 180000,
    periods: 3,
    clockType: 'STOP_TIME',
    shiftLengthSeconds: null,
  },
  status: 'PRE_GAME',
  period: 1,
  clock: {
    timeRemainingMillis: 900000,
    isRunning: false,
    startTimeWallClock: 0,
  },
  home: { goals: [], shots: 0, penalties: [] },
  away: { goals: [], shots: 0, penalties: [] },
  buzzerOn: false,
  eventHistory: [],
  ...overrides,
});

// Mutable state for the mock
let mockSubscribers: Array<(state: GameState) => void> = [];
let mockConnectionSubscribers: Array<(state: string) => void> = [];
let mockGameState: GameState | null = null;
let mockSentCommands: Command[] = [];

// Mock the websocket module
vi.mock('./websocket', () => {
  return {
    websocketClient: {
      subscribe: vi.fn((callback: (state: GameState) => void) => {
        mockSubscribers.push(callback);
        if (mockGameState) callback(mockGameState);
        return () => {
          const idx = mockSubscribers.indexOf(callback);
          if (idx >= 0) mockSubscribers.splice(idx, 1);
        };
      }),
      subscribeConnection: vi.fn((callback: (state: string) => void) => {
        mockConnectionSubscribers.push(callback);
        callback('connecting');
        return () => {
          const idx = mockConnectionSubscribers.indexOf(callback);
          if (idx >= 0) mockConnectionSubscribers.splice(idx, 1);
        };
      }),
      sendCommand: vi.fn((command: Command) => {
        mockSentCommands.push(command);
      }),
      getGameState: vi.fn(() => mockGameState),
    },
  };
});

// Mock all the view modules that control-ui imports
vi.mock('./view/clock-settings', () => ({
  initClockSettingsDialog: vi.fn(() => {}),
}));

vi.mock('./view/game-dialog', () => ({
  initGameDialog: vi.fn(() => {}),
}));

vi.mock('./view/goal-dialog', () => ({
  initGoalDialog: vi.fn(() => ({
    open: vi.fn(),
  })),
}));

vi.mock('./view/keyboard-shortcuts', () => ({
  initKeyboardShortcuts: vi.fn(() => {}),
}));

vi.mock('./view/modals', () => ({
  default: {
    init: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    showById: vi.fn(),
  },
}));

vi.mock('./view/penalty-dialog', () => ({
  initPenaltyDialog: vi.fn(() => {}),
  initPenaltyDetailsPopup: vi.fn(() => {}),
}));

vi.mock('./view/ports', () => ({
  setPortMessage: vi.fn(),
}));

vi.mock('./view/team-colors', () => ({
  initTeamColorPickers: vi.fn(() => {}),
}));

vi.mock('./view/team-layout', () => ({
  TeamLayout: {
    init: vi.fn(),
  },
}));

// Test helpers
const setMockGameState = (state: GameState) => {
  mockGameState = state;
  mockSubscribers.forEach((cb) => cb(state));
};

const setMockConnectionState = (state: string) => {
  mockConnectionSubscribers.forEach((cb) => cb(state));
};

const resetMockState = () => {
  mockGameState = null;
  mockSubscribers = [];
  mockConnectionSubscribers = [];
  mockSentCommands = [];
};

// Set up the DOM before each test
const setupDOM = () => {
  document.body.innerHTML = `
    <div id="conn-status"></div>
    <div id="conn-overlay" style="display: none;">
      <span id="conn-overlay-text"></span>
    </div>

    <div id="period">
      <span class="digit">1</span>
      <button class="period-up">+</button>
      <button class="period-down">-</button>
    </div>
    <div id="period-indicators">
      <div data-indicator="buzzer" data-state="idle"></div>
      <div data-indicator="intermission" data-state="idle"></div>
    </div>

    <div id="clock-text">15:00</div>
    <button id="clock-toggle">
      <span class="glyphicon glyphicon-play"></span>
      <span class="cta-text">Start</span>
    </button>
    <button id="clock-start">Start</button>
    <button id="clock-pause">Pause</button>

    <button id="buzzer">Buzzer</button>

    <div id="home">
      <span id="home-score">00</span>
      <span id="home-shots">0</span>
      <button class="score-up" data-team="home">+</button>
      <button class="score-down" data-team="home">-</button>
      <button class="shots-up" data-team="home">+</button>
      <button class="shots-down" data-team="home">-</button>
      <table>
        <tbody class="list"></tbody>
        <tbody class="placeholders"></tbody>
      </table>
      <table>
        <tbody class="goal-list"></tbody>
      </table>
    </div>

    <div id="away">
      <span id="away-score">00</span>
      <span id="away-shots">0</span>
      <button class="score-up" data-team="away">+</button>
      <button class="score-down" data-team="away">-</button>
      <button class="shots-up" data-team="away">+</button>
      <button class="shots-down" data-team="away">-</button>
      <table>
        <tbody class="list"></tbody>
        <tbody class="placeholders"></tbody>
      </table>
      <table>
        <tbody class="goal-list"></tbody>
      </table>
    </div>

    <button id="power-btn">Power</button>
    <span id="power-status" class="label label-danger">Scoreboard Off</span>
    <span id="connect-message"></span>

    <div id="scoreboard-connect" class="modal" style="display: none;">
      <button id="confirm-on">It's On!</button>
      <button id="not-on">Not On</button>
      <button id="retry-ports">Retry</button>
      <button id="giveUpButton">Give Up</button>
      <button id="give-up">Give Up</button>
    </div>
  `;
};

describe('control-ui', () => {
  beforeEach(async () => {
    vi.resetModules();
    resetMockState();
    setupDOM();

    // Clear any window test hooks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__test = undefined;

    vi.useFakeTimers();

    // Import the module to trigger DOMContentLoaded handler
    await import('./control-ui');

    // Trigger DOMContentLoaded
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.body.className = '';
  });

  describe('renderUpdate - clock display', () => {
    it('updates clock text when time changes', () => {
      const clockText = document.getElementById('clock-text');
      expect(clockText).toBeTruthy();

      const state = createMockGameState({
        clock: { timeRemainingMillis: 600000, isRunning: false, startTimeWallClock: 0 },
      });
      setMockGameState(state);

      expect(clockText!.textContent).toBe('10:00');
    });

    it('updates clock toggle button when running state changes', () => {
      const clockToggle = document.getElementById('clock-toggle');
      const icon = clockToggle?.querySelector('.glyphicon');
      const label = clockToggle?.querySelector('.cta-text');

      // Initially not running
      const state1 = createMockGameState({
        clock: { timeRemainingMillis: 900000, isRunning: false, startTimeWallClock: 0 },
      });
      setMockGameState(state1);

      expect(icon?.className).toContain('glyphicon-play');
      expect(label?.textContent).toBe('Start');

      // Now running
      const state2 = createMockGameState({
        clock: { timeRemainingMillis: 890000, isRunning: true, startTimeWallClock: 0 },
      });
      setMockGameState(state2);

      expect(icon?.className).toContain('glyphicon-pause');
      expect(label?.textContent).toBe('Pause');
    });

    it('formats clock time with zero padding', () => {
      const clockText = document.getElementById('clock-text');

      const state = createMockGameState({
        clock: { timeRemainingMillis: 65000, isRunning: false, startTimeWallClock: 0 }, // 1:05
      });
      setMockGameState(state);

      expect(clockText!.textContent).toBe('01:05');
    });
  });

  describe('renderUpdate - period display', () => {
    it('updates period digit when period changes', () => {
      const periodDigit = document.querySelector('#period .digit');

      const state = createMockGameState({ period: 2 });
      setMockGameState(state);

      expect(periodDigit?.textContent).toBe('2');
    });

    it('updates buzzer indicator when buzzer state changes', () => {
      const buzzerIndicator = document.querySelector<HTMLDivElement>(
        '#period-indicators [data-indicator="buzzer"]'
      );

      const state = createMockGameState({ buzzerOn: true });
      setMockGameState(state);

      expect(buzzerIndicator?.dataset.state).toBe('active');
    });

    it('updates intermission indicator when in intermission', () => {
      const intermissionIndicator = document.querySelector<HTMLDivElement>(
        '#period-indicators [data-indicator="intermission"]'
      );

      const state = createMockGameState({ status: 'INTERMISSION' });
      setMockGameState(state);

      expect(intermissionIndicator?.dataset.state).toBe('active');
    });

    it('disables period up button at max period', () => {
      const periodUpBtn = document.querySelector<HTMLButtonElement>('.period-up');

      const state = createMockGameState({ period: 3 }); // periods: 3 is the max
      setMockGameState(state);

      expect(periodUpBtn?.disabled).toBe(true);
    });

    it('enables period up button below max period', () => {
      const periodUpBtn = document.querySelector<HTMLButtonElement>('.period-up');

      const state = createMockGameState({ period: 1 });
      setMockGameState(state);

      expect(periodUpBtn?.disabled).toBe(false);
    });

    it('disables period down button at period 0', () => {
      const periodDownBtn = document.querySelector<HTMLButtonElement>('.period-down');

      const state = createMockGameState({ period: 0 });
      setMockGameState(state);

      expect(periodDownBtn?.disabled).toBe(true);
    });

    it('enables period down button above period 0', () => {
      const periodDownBtn = document.querySelector<HTMLButtonElement>('.period-down');

      const state = createMockGameState({ period: 2 });
      setMockGameState(state);

      expect(periodDownBtn?.disabled).toBe(false);
    });
  });

  describe('renderUpdate - score display', () => {
    it('updates home score when goals change', () => {
      const homeScore = document.getElementById('home-score');

      const goal: GoalEvent = {
        goalId: 'g1',
        teamId: 'home',
        period: 1,
        timeInPeriodMillis: 500000,
        scorerNumber: 10,
        assistNumbers: [20],
        isEmptyNet: false,
      };

      const state = createMockGameState({
        home: { goals: [goal], shots: 0, penalties: [] },
      });
      setMockGameState(state);

      expect(homeScore?.textContent).toBe('01');
    });

    it('updates away score when goals change', () => {
      const awayScore = document.getElementById('away-score');

      const goals: GoalEvent[] = [
        {
          goalId: 'g1',
          teamId: 'away',
          period: 1,
          timeInPeriodMillis: 500000,
          scorerNumber: 10,
          assistNumbers: [],
          isEmptyNet: false,
        },
        {
          goalId: 'g2',
          teamId: 'away',
          period: 1,
          timeInPeriodMillis: 400000,
          scorerNumber: 11,
          assistNumbers: [12],
          isEmptyNet: false,
        },
      ];

      const state = createMockGameState({
        away: { goals, shots: 0, penalties: [] },
      });
      setMockGameState(state);

      expect(awayScore?.textContent).toBe('02');
    });

    it('pads single-digit scores with leading zero', () => {
      const homeScore = document.getElementById('home-score');

      const goals: GoalEvent[] = Array.from({ length: 5 }, (_, i) => ({
        goalId: `g${i}`,
        teamId: 'home' as const,
        period: 1,
        timeInPeriodMillis: 500000 - i * 10000,
        scorerNumber: 10 + i,
        assistNumbers: [],
        isEmptyNet: false,
      }));

      const state = createMockGameState({
        home: { goals, shots: 0, penalties: [] },
      });
      setMockGameState(state);

      expect(homeScore?.textContent).toBe('05');
    });
  });

  describe('renderUpdate - shots display', () => {
    it('updates home shots when shots change', () => {
      const homeShots = document.getElementById('home-shots');

      const state = createMockGameState({
        home: { goals: [], shots: 15, penalties: [] },
      });
      setMockGameState(state);

      expect(homeShots?.textContent).toBe('15');
    });

    it('updates away shots when shots change', () => {
      const awayShots = document.getElementById('away-shots');

      const state = createMockGameState({
        away: { goals: [], shots: 22, penalties: [] },
      });
      setMockGameState(state);

      expect(awayShots?.textContent).toBe('22');
    });
  });

  describe('renderUpdate - penalty table', () => {
    it('renders penalty rows correctly', () => {
      const penalty: Penalty = {
        penaltyId: 'p1',
        teamId: 'home',
        playerNumber: 10,
        servingPlayerNumber: 10,
        durationMillis: 120000,
        timeRemainingMillis: 90000,
        startTimeWallClock: 0,
        period: 1,
      };

      const state = createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty] },
      });
      setMockGameState(state);

      const homeTeam = document.getElementById('home');
      const penaltyRows = homeTeam?.querySelectorAll('tbody.list tr');

      expect(penaltyRows?.length).toBe(1);

      const cells = penaltyRows?.[0].querySelectorAll('td');
      expect(cells?.[0].textContent).toBe('1'); // period
      expect(cells?.[1].querySelector('.pn')?.textContent).toBe('10'); // player number
      expect(cells?.[2].textContent).toBe('01:30'); // time remaining
    });

    it('renders placeholder rows when fewer than 2 penalties', () => {
      const state = createMockGameState({
        home: { goals: [], shots: 0, penalties: [] },
      });
      setMockGameState(state);

      const homeTeam = document.getElementById('home');
      const placeholderRows = homeTeam?.querySelectorAll('tbody.placeholders tr');

      expect(placeholderRows?.length).toBe(2);
    });

    it('shows serving player number when different from penalized player', () => {
      const penalty: Penalty = {
        penaltyId: 'p1',
        teamId: 'home',
        playerNumber: 10,
        servingPlayerNumber: 15, // Different from player
        durationMillis: 120000,
        timeRemainingMillis: 90000,
        startTimeWallClock: 0,
        period: 1,
      };

      const state = createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty] },
      });
      setMockGameState(state);

      const homeTeam = document.getElementById('home');
      const playerSpan = homeTeam?.querySelector('tbody.list .pn');

      expect(playerSpan?.getAttribute('data-serving')).toBe('15');
    });

    it('does not show serving attribute when same as player', () => {
      const penalty: Penalty = {
        penaltyId: 'p1',
        teamId: 'home',
        playerNumber: 10,
        servingPlayerNumber: 10,
        durationMillis: 120000,
        timeRemainingMillis: 90000,
        startTimeWallClock: 0,
        period: 1,
      };

      const state = createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty] },
      });
      setMockGameState(state);

      const homeTeam = document.getElementById('home');
      const playerSpan = homeTeam?.querySelector('tbody.list .pn');

      expect(playerSpan?.hasAttribute('data-serving')).toBe(false);
    });

    it('updates penalty times in-place when structure unchanged', () => {
      const penalty1: Penalty = {
        penaltyId: 'p1',
        teamId: 'home',
        playerNumber: 10,
        servingPlayerNumber: 10,
        durationMillis: 120000,
        timeRemainingMillis: 90000,
        startTimeWallClock: 0,
        period: 1,
      };

      const state1 = createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty1] },
      });
      setMockGameState(state1);

      // Update with same structure but different time
      const penalty2: Penalty = {
        ...penalty1,
        timeRemainingMillis: 60000, // Time decreased
      };

      const state2 = createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty2] },
      });
      setMockGameState(state2);

      const homeTeam = document.getElementById('home');
      const timeCell = homeTeam?.querySelector('tbody.list tr td:nth-child(3)');

      expect(timeCell?.textContent).toBe('01:00');
    });

    it('renders multiple penalties correctly', () => {
      const penalties: Penalty[] = [
        {
          penaltyId: 'p1',
          teamId: 'home',
          playerNumber: 10,
          servingPlayerNumber: 10,
          durationMillis: 120000,
          timeRemainingMillis: 90000,
          startTimeWallClock: 0,
          period: 1,
        },
        {
          penaltyId: 'p2',
          teamId: 'home',
          playerNumber: 20,
          servingPlayerNumber: 20,
          durationMillis: 300000,
          timeRemainingMillis: 240000,
          startTimeWallClock: 0,
          period: 1,
        },
      ];

      const state = createMockGameState({
        home: { goals: [], shots: 0, penalties },
      });
      setMockGameState(state);

      const homeTeam = document.getElementById('home');
      const penaltyRows = homeTeam?.querySelectorAll('tbody.list tr');

      expect(penaltyRows?.length).toBe(2);

      // No placeholder rows when 2+ penalties
      const placeholderRows = homeTeam?.querySelectorAll('tbody.placeholders tr');
      expect(placeholderRows?.length).toBe(0);
    });

    it('renders 1 placeholder row with 1 penalty', () => {
      const penalty: Penalty = {
        penaltyId: 'p1',
        teamId: 'away',
        playerNumber: 5,
        servingPlayerNumber: 5,
        durationMillis: 120000,
        timeRemainingMillis: 60000,
        startTimeWallClock: 0,
        period: 2,
      };

      const state = createMockGameState({
        away: { goals: [], shots: 0, penalties: [penalty] },
      });
      setMockGameState(state);

      const awayTeam = document.getElementById('away');
      const penaltyRows = awayTeam?.querySelectorAll('tbody.list tr');
      const placeholderRows = awayTeam?.querySelectorAll('tbody.placeholders tr');

      expect(penaltyRows?.length).toBe(1);
      expect(placeholderRows?.length).toBe(1);
    });

    it('renders penalty details link with correct data attributes', () => {
      const penalty: Penalty = {
        penaltyId: 'p123',
        teamId: 'home',
        playerNumber: 10,
        servingPlayerNumber: 10,
        durationMillis: 120000,
        timeRemainingMillis: 90000,
        startTimeWallClock: 0,
        period: 2,
      };

      const state = createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty] },
      });
      setMockGameState(state);

      const detailsLink = document.querySelector<HTMLAnchorElement>(
        'a[data-action="penalty-details"]'
      );

      expect(detailsLink?.dataset.team).toBe('home');
      expect(detailsLink?.dataset.pid).toBe('p123');
      expect(detailsLink?.dataset.player).toBe('10');
      expect(detailsLink?.dataset.period).toBe('2');
      expect(detailsLink?.dataset.duration).toBe('120000');
      expect(detailsLink?.dataset.remaining).toBe('90000');
    });

    it('renders delete penalty link with correct data attributes', () => {
      const penalty: Penalty = {
        penaltyId: 'p456',
        teamId: 'away',
        playerNumber: 7,
        servingPlayerNumber: 7,
        durationMillis: 300000,
        timeRemainingMillis: 200000,
        startTimeWallClock: 0,
        period: 1,
      };

      const state = createMockGameState({
        away: { goals: [], shots: 0, penalties: [penalty] },
      });
      setMockGameState(state);

      const deleteLink = document.querySelector<HTMLAnchorElement>(
        '#away a[data-action="delete-penalty"]'
      );

      expect(deleteLink?.dataset.team).toBe('away');
      expect(deleteLink?.dataset.pid).toBe('p456');
    });
  });

  describe('renderUpdate - goal table', () => {
    it('renders goal rows correctly', () => {
      const goal: GoalEvent = {
        goalId: 'g1',
        teamId: 'home',
        period: 2,
        timeInPeriodMillis: 480000, // 8:00
        scorerNumber: 10,
        assistNumbers: [20, 30],
        isEmptyNet: false,
      };

      const state = createMockGameState({
        home: { goals: [goal], shots: 5, penalties: [] },
      });
      setMockGameState(state);

      const homeTeam = document.getElementById('home');
      const goalRows = homeTeam?.querySelectorAll('tbody.goal-list tr');

      expect(goalRows?.length).toBe(1);

      const cells = goalRows?.[0].querySelectorAll('td');
      expect(cells?.[0].textContent).toBe('2'); // period
      expect(cells?.[1].textContent).toBe('08:00'); // time
      expect(cells?.[2].textContent).toBe('10'); // scorer
      expect(cells?.[3].textContent).toBe('20 / 30'); // assists
    });

    it('shows placeholder when no goals', () => {
      const state = createMockGameState({
        home: { goals: [], shots: 0, penalties: [] },
      });
      setMockGameState(state);

      const homeTeam = document.getElementById('home');
      const placeholderRow = homeTeam?.querySelector('tbody.goal-list tr.placeholder');

      expect(placeholderRow).toBeTruthy();
      expect(placeholderRow?.textContent).toContain('No goals yet');
    });

    it('handles goal with no assists', () => {
      const goal: GoalEvent = {
        goalId: 'g1',
        teamId: 'away',
        period: 1,
        timeInPeriodMillis: 300000,
        scorerNumber: 99,
        assistNumbers: [],
        isEmptyNet: false,
      };

      const state = createMockGameState({
        away: { goals: [goal], shots: 1, penalties: [] },
      });
      setMockGameState(state);

      const awayTeam = document.getElementById('away');
      const cells = awayTeam?.querySelectorAll('tbody.goal-list tr td');

      // Assists cell should show dash
      expect(cells?.[3].innerHTML).toContain('–');
    });

    it('handles goal with single assist', () => {
      const goal: GoalEvent = {
        goalId: 'g1',
        teamId: 'home',
        period: 1,
        timeInPeriodMillis: 300000,
        scorerNumber: 10,
        assistNumbers: [20],
        isEmptyNet: false,
      };

      const state = createMockGameState({
        home: { goals: [goal], shots: 1, penalties: [] },
      });
      setMockGameState(state);

      const cells = document.querySelectorAll('#home tbody.goal-list tr td');
      expect(cells?.[3].textContent).toBe('20');
    });

    it('handles zero timeInPeriodMillis', () => {
      const goal: GoalEvent = {
        goalId: 'g1',
        teamId: 'home',
        period: 1,
        timeInPeriodMillis: 0,
        scorerNumber: 10,
        assistNumbers: [],
        isEmptyNet: false,
      };

      const state = createMockGameState({
        home: { goals: [goal], shots: 1, penalties: [] },
      });
      setMockGameState(state);

      const timeCell = document.querySelector('#home tbody.goal-list tr td:nth-child(2)');
      expect(timeCell?.textContent).toBe('00:00');
    });

    it('handles negative timeInPeriodMillis', () => {
      const goal: GoalEvent = {
        goalId: 'g1',
        teamId: 'home',
        period: 1,
        timeInPeriodMillis: -5000, // Negative value
        scorerNumber: 10,
        assistNumbers: [],
        isEmptyNet: false,
      };

      const state = createMockGameState({
        home: { goals: [goal], shots: 1, penalties: [] },
      });
      setMockGameState(state);

      const timeCell = document.querySelector('#home tbody.goal-list tr td:nth-child(2)');
      // Should clamp to 00:00
      expect(timeCell?.textContent).toBe('00:00');
    });

    it('sets goal ID as data attribute', () => {
      const goal: GoalEvent = {
        goalId: 'unique-goal-id',
        teamId: 'home',
        period: 1,
        timeInPeriodMillis: 300000,
        scorerNumber: 10,
        assistNumbers: [],
        isEmptyNet: false,
      };

      const state = createMockGameState({
        home: { goals: [goal], shots: 1, penalties: [] },
      });
      setMockGameState(state);

      const goalRow = document.querySelector('#home tbody.goal-list tr');
      expect(goalRow?.getAttribute('data-goal-id')).toBe('unique-goal-id');
    });

    it('renders multiple goals in order', () => {
      const goals: GoalEvent[] = [
        {
          goalId: 'g1',
          teamId: 'home',
          period: 1,
          timeInPeriodMillis: 800000,
          scorerNumber: 10,
          assistNumbers: [],
          isEmptyNet: false,
        },
        {
          goalId: 'g2',
          teamId: 'home',
          period: 1,
          timeInPeriodMillis: 400000,
          scorerNumber: 20,
          assistNumbers: [30],
          isEmptyNet: false,
        },
      ];

      const state = createMockGameState({
        home: { goals, shots: 2, penalties: [] },
      });
      setMockGameState(state);

      const goalRows = document.querySelectorAll('#home tbody.goal-list tr');
      expect(goalRows.length).toBe(2);

      // First goal
      expect(goalRows[0].querySelectorAll('td')[2].textContent).toBe('10');
      // Second goal
      expect(goalRows[1].querySelectorAll('td')[2].textContent).toBe('20');
    });
  });

  describe('renderUpdate - buzzer state', () => {
    it('adds buzzer class to body when buzzer is on', () => {
      const state = createMockGameState({ buzzerOn: true });
      setMockGameState(state);

      expect(document.body.classList.contains('buzzer')).toBe(true);
    });

    it('removes buzzer class from body when buzzer is off', () => {
      // First turn on
      const stateOn = createMockGameState({ buzzerOn: true });
      setMockGameState(stateOn);

      // Then turn off
      const stateOff = createMockGameState({ buzzerOn: false });
      setMockGameState(stateOff);

      expect(document.body.classList.contains('buzzer')).toBe(false);
    });
  });

  describe('renderUpdate - test hooks', () => {
    it('sets window.__test with last update state', () => {
      const state = createMockGameState({ period: 2 });
      setMockGameState(state);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testHooks = (window as any).__test;
      expect(testHooks.lastUpdate).toEqual(state);
    });

    it('tracks DOM score values in test hooks', () => {
      const goal: GoalEvent = {
        goalId: 'g1',
        teamId: 'home',
        period: 1,
        timeInPeriodMillis: 500000,
        scorerNumber: 10,
        assistNumbers: [],
        isEmptyNet: false,
      };

      const state = createMockGameState({
        home: { goals: [goal], shots: 0, penalties: [] },
      });
      setMockGameState(state);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testHooks = (window as any).__test;
      expect(testHooks.domHomeScore).toBe('01');
    });
  });

  describe('initSocket - connection status', () => {
    it('updates status indicator on connecting', () => {
      setMockConnectionState('connecting');

      const status = document.getElementById('conn-status');
      expect(status?.dataset.state).toBe('connecting');
      expect(status?.textContent).toBe('Connecting...');
    });

    it('updates status indicator on open', () => {
      setMockConnectionState('open');

      const status = document.getElementById('conn-status');
      expect(status?.dataset.state).toBe('ok');
      expect(status?.textContent).toBe('Connected');
    });

    it('updates status indicator on closed', () => {
      setMockConnectionState('closed');

      const status = document.getElementById('conn-status');
      expect(status?.dataset.state).toBe('error');
      expect(status?.textContent).toBe('Disconnected');
    });

    it('shows overlay when disconnected', () => {
      setMockConnectionState('closed');

      const overlay = document.getElementById('conn-overlay');
      expect(overlay?.style.display).toBe('flex');
    });

    it('hides overlay when connected', () => {
      setMockConnectionState('open');

      const overlay = document.getElementById('conn-overlay');
      expect(overlay?.style.display).toBe('none');
    });

    it('shows overlay text when disconnected', () => {
      setMockConnectionState('closed');

      const overlayText = document.getElementById('conn-overlay-text');
      expect(overlayText?.textContent).toContain('Unable to reach');
    });
  });

  describe('getConfiguredPeriodLimit', () => {
    it('returns configured periods from game state', () => {
      // Test with config.periods = 4
      const state = createMockGameState({
        config: {
          templateId: 'standard',
          warmupLengthMinutes: 5,
          warmupLengthMillis: 300000,
          periodLengthMinutes: 15,
          periodLengthMillis: 900000,
          intermissionLengthMinutes: 3,
          intermissionLengthMillis: 180000,
          periods: 4, // Custom period count
          clockType: 'STOP_TIME',
          shiftLengthSeconds: null,
        },
        period: 4,
      });
      setMockGameState(state);

      // Period up should be disabled at period 4 (max)
      const periodUpBtn = document.querySelector<HTMLButtonElement>('.period-up');
      expect(periodUpBtn?.disabled).toBe(true);
    });

    it('defaults to 3 periods when config is missing', () => {
      // State with null config
      const state = createMockGameState({ period: 3 });
      state.config = null;
      setMockGameState(state);

      // Period up should be disabled at period 3 (default max)
      const periodUpBtn = document.querySelector<HTMLButtonElement>('.period-up');
      expect(periodUpBtn?.disabled).toBe(true);
    });

    it('defaults to 3 periods when periods is 0', () => {
      const state = createMockGameState({
        config: {
          templateId: 'standard',
          warmupLengthMinutes: 5,
          warmupLengthMillis: 300000,
          periodLengthMinutes: 15,
          periodLengthMillis: 900000,
          intermissionLengthMinutes: 3,
          intermissionLengthMillis: 180000,
          periods: 0, // Invalid - should default to 3
          clockType: 'STOP_TIME',
          shiftLengthSeconds: null,
        },
        period: 3,
      });
      setMockGameState(state);

      const periodUpBtn = document.querySelector<HTMLButtonElement>('.period-up');
      expect(periodUpBtn?.disabled).toBe(true);
    });
  });

  describe('resetGameState', () => {
    it('sends RESET_GAME command', async () => {
      const { resetGameState } = await import('./control-ui');

      resetGameState();

      expect(mockSentCommands).toContainEqual({ type: 'RESET_GAME', payload: {} });
    });
  });

  describe('element caching', () => {
    it('handles missing elements gracefully', async () => {
      // Remove some elements
      document.getElementById('clock-text')?.remove();
      document.getElementById('home-score')?.remove();

      vi.resetModules();
      resetMockState();
      await import('./control-ui');
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Should not throw
      const state = createMockGameState();
      expect(() => setMockGameState(state)).not.toThrow();
    });
  });

  describe('differential updates', () => {
    it('only updates score when goals change', () => {
      // Initial state
      const state1 = createMockGameState({
        home: { goals: [], shots: 5, penalties: [] },
      });
      setMockGameState(state1);

      const homeScore = document.getElementById('home-score');
      expect(homeScore?.textContent).toBe('00');

      // Add a goal
      const goal: GoalEvent = {
        goalId: 'g1',
        teamId: 'home',
        period: 1,
        timeInPeriodMillis: 500000,
        scorerNumber: 10,
        assistNumbers: [],
        isEmptyNet: false,
      };
      const state2 = createMockGameState({
        home: { goals: [goal], shots: 5, penalties: [] },
      });
      setMockGameState(state2);

      expect(homeScore?.textContent).toBe('01');
    });

    it('updates shots independently from goals', () => {
      // Initial state with 0 shots
      const state1 = createMockGameState({
        home: { goals: [], shots: 0, penalties: [] },
      });
      setMockGameState(state1);

      const homeShots = document.getElementById('home-shots');
      expect(homeShots?.textContent).toBe('0');

      // Update shots without changing goals
      const state2 = createMockGameState({
        home: { goals: [], shots: 10, penalties: [] },
      });
      setMockGameState(state2);

      expect(homeShots?.textContent).toBe('10');
    });
  });

  describe('penalty time updates', () => {
    it('updates penalty remaining time data attribute on in-place update', () => {
      const penalty: Penalty = {
        penaltyId: 'p1',
        teamId: 'home',
        playerNumber: 10,
        servingPlayerNumber: 10,
        durationMillis: 120000,
        timeRemainingMillis: 90000,
        startTimeWallClock: 0,
        period: 1,
      };

      const state = createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty] },
      });
      setMockGameState(state);

      const detailsLink = document.querySelector<HTMLAnchorElement>(
        'a[data-action="penalty-details"]'
      );
      expect(detailsLink?.dataset.remaining).toBe('90000');

      // Update time (same structure)
      const penalty2: Penalty = { ...penalty, timeRemainingMillis: 60000 };
      const state2 = createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty2] },
      });
      setMockGameState(state2);

      expect(detailsLink?.dataset.remaining).toBe('60000');
    });
  });

  describe('penaltiesStructureEqual behavior', () => {
    it('rebuilds table when penaltyId changes', () => {
      const penalty1: Penalty = {
        penaltyId: 'p1',
        teamId: 'home',
        playerNumber: 10,
        servingPlayerNumber: 10,
        durationMillis: 120000,
        timeRemainingMillis: 90000,
        startTimeWallClock: 0,
        period: 1,
      };

      setMockGameState(createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty1] },
      }));

      // Change penalty ID - should rebuild
      const penalty2: Penalty = {
        ...penalty1,
        penaltyId: 'p2', // Different ID
      };

      setMockGameState(createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty2] },
      }));

      const detailsLink = document.querySelector<HTMLAnchorElement>(
        'a[data-action="penalty-details"]'
      );
      expect(detailsLink?.dataset.pid).toBe('p2');
    });

    it('rebuilds table when playerNumber changes', () => {
      const penalty1: Penalty = {
        penaltyId: 'p1',
        teamId: 'home',
        playerNumber: 10,
        servingPlayerNumber: 10,
        durationMillis: 120000,
        timeRemainingMillis: 90000,
        startTimeWallClock: 0,
        period: 1,
      };

      setMockGameState(createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty1] },
      }));

      // Change player number - should rebuild
      const penalty2: Penalty = {
        ...penalty1,
        playerNumber: 20,
        servingPlayerNumber: 20,
      };

      setMockGameState(createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty2] },
      }));

      const playerSpan = document.querySelector('#home tbody.list .pn');
      expect(playerSpan?.textContent).toBe('20');
    });

    it('rebuilds table when penalty count changes', () => {
      const penalty1: Penalty = {
        penaltyId: 'p1',
        teamId: 'home',
        playerNumber: 10,
        servingPlayerNumber: 10,
        durationMillis: 120000,
        timeRemainingMillis: 90000,
        startTimeWallClock: 0,
        period: 1,
      };

      setMockGameState(createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty1] },
      }));

      let penaltyRows = document.querySelectorAll('#home tbody.list tr');
      expect(penaltyRows.length).toBe(1);

      // Add second penalty - should rebuild
      const penalty2: Penalty = {
        penaltyId: 'p2',
        teamId: 'home',
        playerNumber: 20,
        servingPlayerNumber: 20,
        durationMillis: 120000,
        timeRemainingMillis: 100000,
        startTimeWallClock: 0,
        period: 1,
      };

      setMockGameState(createMockGameState({
        home: { goals: [], shots: 0, penalties: [penalty1, penalty2] },
      }));

      penaltyRows = document.querySelectorAll('#home tbody.list tr');
      expect(penaltyRows.length).toBe(2);
    });
  });

  describe('initialization', () => {
    it('subscribes to websocket state updates', async () => {
      const { websocketClient } = await import('./websocket');
      expect(websocketClient.subscribe).toHaveBeenCalled();
    });

    it('subscribes to websocket connection updates', async () => {
      const { websocketClient } = await import('./websocket');
      expect(websocketClient.subscribeConnection).toHaveBeenCalled();
    });
  });
});
