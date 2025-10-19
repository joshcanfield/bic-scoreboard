// Shared UI state tracking scoreboard values and hardware status
export const State = {
  time: 0,
  running: false,
  period: 0,
  periodLengthMillis: 0,
  home: { score: 0, shots: 0, penalties: [], goals: [] },
  away: { score: 0, shots: 0, penalties: [], goals: [] },
  scoreboardOn: false,
  buzzerOn: false,
  portNames: [],
  currentPort: "",
};
