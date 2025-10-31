package canfield.bia.hockey;

import canfield.bia.config.AppConfig;
import canfield.bia.hockey.scoreboard.Clock;
import canfield.bia.hockey.scoreboard.ScoreBoard;
import canfield.bia.hockey.scoreboard.io.ScoreboardAdapter;

import javax.inject.Inject;
import javax.inject.Singleton;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;

/**
 * SimpleGameManager keeps track of more penalties than will fit on the scoreboard.
 * TODO: Re-design with a better domain model.
 * TODO: The clock tracking is really cumbersome. Track elapsed time instead of time remaining!
 */
@Singleton
public class SimpleGameManager {
  private final ScoreBoard scoreBoard;
  private final ScoreboardAdapter scoreboardAdapter;
  private final AppConfig appConfig;
  private GameConfig gameConfig;

  private final List<Penalty> homePenalties = new CopyOnWriteArrayList<>();
  private final List<Penalty> awayPenalties = new CopyOnWriteArrayList<>();
  private final List<GoalEvent> goalEvents = new CopyOnWriteArrayList<>();
  private Integer shiftLengthSeconds;
  private int lastShiftBuzzer = 0;
  private int homeShots = 0;
  private int awayShots = 0;


  @Inject
  public SimpleGameManager(ScoreBoard scoreBoard, ScoreboardAdapter scoreboardAdapter, AppConfig appConfig, GameConfig gameConfig) {
    this.scoreBoard = scoreBoard;
    this.scoreboardAdapter = scoreboardAdapter;
    this.appConfig = appConfig;
    this.gameConfig = gameConfig;

    scoreBoard.addListener(
        event -> {
          switch (event.getType()) {
            case tick:
              if (scoreBoard.getGameState() == ScoreBoard.GameState.IN_PROGRESS) {
                updatePenalties();
                handleShiftBuzzer();
              }
              break;
            case end_of_period:
              if (scoreBoard.getGameState() == ScoreBoard.GameState.IN_PROGRESS) {
                int currentPeriod = scoreBoard.getPeriod();
                if (currentPeriod >= scoreBoard.getLastPeriodNumber()) {
                  // Game is over
                  scoreBoard.setGameState(ScoreBoard.GameState.GAME_OVER);
                } else if (currentPeriod > 0) {
                  // Start intermission if configured (> 0 minutes); otherwise advance directly
                  Integer intermission = gameConfig.getIntermissionDurationMinutes();
                  if (intermission != null && intermission > 0) {
                    scoreBoard.setGameState(ScoreBoard.GameState.INTERMISSION);
                    scoreBoard.getGameClock().setTime(intermission, 0);
                    scoreBoard.getGameClock().start();
                  } else {
                    // No intermission: advance to next period and pause in READY state
                    scoreBoard.advancePeriod();
                    scoreBoard.setGameState(ScoreBoard.GameState.READY_FOR_PERIOD);
                  }
                } else { // currentPeriod == 0
                  // Warmup ended
                  scoreBoard.advancePeriod();
                  scoreBoard.setGameState(ScoreBoard.GameState.READY_FOR_PERIOD);
                }
              } else if (scoreBoard.getGameState() == ScoreBoard.GameState.INTERMISSION) {
                // Intermission ended
                scoreBoard.setGameState(ScoreBoard.GameState.READY_FOR_PERIOD);
                scoreBoard.advancePeriod();
              }
              break;
          }
        }
    );
    reset();
  }

  // Convenience constructor for tests and simple wiring
  public SimpleGameManager(ScoreBoard scoreBoard, ScoreboardAdapter scoreboardAdapter) {
    this(scoreBoard, scoreboardAdapter, new AppConfig(), new GameConfig());
  }

  private void handleShiftBuzzer() {
    if (shiftLengthSeconds == null) {
      return;
    }

    final Clock.ClockTime time = scoreBoard.getGameClock().getTime();
    final int currentShift = getShift(time);
    if (currentShift != lastShiftBuzzer) {
      lastShiftBuzzer = currentShift;
      playBuzzer(1000);
    }
  }

  /**
   * Given the clock time, which shift are we in?
   */
  private int getShift(Clock.ClockTime time) {
    if (shiftLengthSeconds == null) {
      return 0;
    }
    final int periodLengthSeconds = scoreBoard.getPeriodLengthMinutes() * 60;
    final int remainingSeconds = time.getMinutes() * 60 + time.getSeconds();
    final int elapsedSeconds = periodLengthSeconds - remainingSeconds;

    return elapsedSeconds / shiftLengthSeconds;
  }

  public int getPeriod() {
    return scoreBoard.getPeriod();
  }

  public void setPeriod(Integer period) {
    scoreBoard.setPeriod(period);
    setTime((int) TimeUnit.MINUTES.toMillis(getPeriodLength()));
  }

  public int getPeriodLength() {
    return scoreBoard.getPeriodLengthMinutes();
  }

  public int getIntermissionDurationMinutes() {
    return gameConfig.getIntermissionDurationMinutes();
  }

  public int getRemainingTimeMillis() {
    final Clock.ClockTime time = scoreBoard.getGameClock().getTime();
    return (time.getMinutes() * 60 + time.getSeconds()) * 1000;
  }

  /**
   * Change API to talk minutes/seconds
   */
  public void setTime(int millis) {
    if (scoreBoard.getGameState() == ScoreBoard.GameState.GAME_OVER && millis > 0) {
      scoreBoard.setGameState(ScoreBoard.GameState.IN_PROGRESS);
    }

    final Clock gameClock = scoreBoard.getGameClock();

    final int minutes = Clock.getMinutes(millis);
    final int seconds = Clock.getSeconds(millis);
    if (minutes <= getPeriodLength()) {
      gameClock.setTime(minutes, seconds);
    } else {
      // respect the game configuration
      gameClock.setTime(getPeriodLength(), 0);
    }
    // reset last shift buzzer to the previous buzzer interval
    lastShiftBuzzer = getShift(gameClock.getTime());
  }

  public boolean isClockRunning() {
    return scoreBoard.getGameClock().isRunning();
  }

  public void startClock() {
    ScoreBoard.GameState state = scoreBoard.getGameState();
    if (state == ScoreBoard.GameState.PRE_GAME || state == ScoreBoard.GameState.READY_FOR_PERIOD) {
      scoreBoard.setGameState(ScoreBoard.GameState.IN_PROGRESS);
    }

    if (state != ScoreBoard.GameState.GAME_OVER) {
      scoreBoard.getGameClock().start();
    }
  }

  public void stopClock() {
    scoreBoard.getGameClock().stop();
  }

  public int getScore(Team team) {
    if (team == Team.home) {
      return scoreBoard.getHomeScore();
    } else {
      return scoreBoard.getAwayScore();
    }
  }

  public void setScore(Team team, int score) {
    switch (team) {
      case home:
        scoreBoard.setHomeScore(score);
        break;
      case away:
        scoreBoard.setAwayScore(score);
        break;
    }
  }

  public int getShots(Team team) {
    return team == Team.home ? homeShots : awayShots;
  }

  public void addShot(Team team) {
    switch (team) {
      case home:
        homeShots += 1;
        break;
      case away:
        awayShots += 1;
        break;
    }
  }

  public void removeShot(Team team) {
    switch (team) {
      case home:
        if (homeShots > 0) homeShots -= 1;
        break;
      case away:
        if (awayShots > 0) awayShots -= 1;
        break;
    }
  }

  public void deletePenalty(Team team, Penalty penalty) {
    switch (team) {
      case home:
        for (int i = 0; i < 2; ++i) {
          if (penalty.equals(scoreBoard.getHomePenalty(i))) {
            scoreBoard.setHomePenalty(i, null);
          }
        }
        homePenalties.remove(penalty);
        break;
      case away:
        for (int i = 0; i < 2; ++i) {
          if (penalty.equals(scoreBoard.getAwayPenalty(i))) {
            scoreBoard.setAwayPenalty(i, null);
          }
        }
        awayPenalties.remove(penalty);
        break;
    }

  }

  public void updateElapsed(Penalty penalty) {
    // if a penalty started in the previous period elapsed time is the rest of that period + whatever has elapsed this period.
    int timeRemainingInCurrentPeriodMillis = getRemainingTimeMillis();

    int elapsed;
    if (penalty.getPeriod() < getPeriod()) {
      final int periodLengthMillis = (int) TimeUnit.MINUTES.toMillis(getScoreBoard().getPeriodLengthMinutes());
      final int periodTimeRemainingAtPenaltyStartMillis = penalty.getStartTime();

      // penalty started at period with clock remaining
      int timeElapsedInCurrentPeriodMillis = periodLengthMillis - timeRemainingInCurrentPeriodMillis;

      elapsed = periodTimeRemainingAtPenaltyStartMillis + timeElapsedInCurrentPeriodMillis;

    } else {
      final int periodTimeRemainingAtPenaltyStartMillis = penalty.getStartTime();
      elapsed = periodTimeRemainingAtPenaltyStartMillis - timeRemainingInCurrentPeriodMillis;
    }

    if (elapsed > penalty.getTime()) {
      elapsed = penalty.getTime();
    }
    penalty.setElapsed(elapsed);
  }

  private void updatePenalties() {
    final Queue<Integer> availableHomePenaltyIndex = new ArrayDeque<>();
    final Queue<Integer> availableAwayPenaltyIndex = new ArrayDeque<>();
    for (Penalty p : homePenalties) {
      updateElapsed(p);
    }

    for (Penalty p : awayPenalties) {
      updateElapsed(p);
    }

    // Clear expired penalties from the scoreboard
    for (int i = 0; i < 2; ++i) {
      Penalty p = scoreBoard.getHomePenalty(i);

      if (p != null && p.isExpired()) {
        scoreBoard.setHomePenalty(i, null);
        p = null;
      }
      if (p == null) {
        availableHomePenaltyIndex.add(i);
      }

      p = scoreBoard.getAwayPenalty(i);
      if (p != null && p.isExpired()) {
        scoreBoard.setAwayPenalty(i, null);
        p = null;
      }
      if (p == null) {
        availableAwayPenaltyIndex.add(i);
      }
    }
    // Do we need to put some penalties on the board?
    final int startTime = roundToSecond(getRemainingTimeMillis());

    if (!homePenalties.isEmpty()) {
      while (!availableHomePenaltyIndex.isEmpty()) {
        int index = availableHomePenaltyIndex.remove();

        for (Penalty penalty : homePenalties) {
          if (penalty.getStartTime() > 0) {
            continue; // already started
          }
          if (scoreBoard.getHomePenalty(0) == penalty || scoreBoard.getHomePenalty(1) == penalty) {
            continue; // already on the board
          }
          penalty.setStartTime(startTime);
          scoreBoard.setHomePenalty(index, penalty);
          break;
        }
      }
    }

    if (!awayPenalties.isEmpty()) {
      while (!availableAwayPenaltyIndex.isEmpty()) {
        int index = availableAwayPenaltyIndex.remove();

        for (Penalty penalty : awayPenalties) {
          if (penalty.getStartTime() > 0) {
            continue; // already started
          }
          if (scoreBoard.getAwayPenalty(0) == penalty || scoreBoard.getAwayPenalty(1) == penalty) {
            continue; // already on the board
          }
          penalty.setStartTime(startTime);
          scoreBoard.setAwayPenalty(index, penalty);
          break;
        }
      }
    }
  }

  private int roundToSecond(int millis) {
    return ((millis + 999) / 1000) * 1000;
  }

  public ScoreBoard getScoreBoard() {
    return scoreBoard;
  }

  public List<Penalty> getPenalties(Team team) {
    return team == Team.home ? homePenalties : awayPenalties;
  }

  public List<Goal> getGoals(Team team) {
    List<Goal> result = new ArrayList<>();
    for (GoalEvent event : goalEvents) {
      if (event.getTeam() == team) {
        result.add(event.getGoal());
      }
    }
    return Collections.unmodifiableList(result);
  }

  public List<GoalEvent> getGoalEvents() {
    return List.copyOf(goalEvents);
  }

  public void addPenalty(Team team, Penalty penalty) {
    switch (team) {
      case home:
        homePenalties.add(penalty);
        break;
      case away:
        awayPenalties.add(penalty);
        break;
    }
    updatePenalties();
  }

  public Goal addGoal(Team team, Goal goal) {
    if (goal == null) {
      return null;
    }

    if (goal.getPeriod() <= 0) {
      goal.setPeriod(getPeriod());
    }

    int goalTime = goal.getTime();
    if (goalTime <= 0) {
      goalTime = getRemainingTimeMillis();
    }
    goal.setTime(Math.max(0, roundToSecond(goalTime)));

    goalEvents.add(new GoalEvent(team, goal, Instant.now()));

    setScore(team, getScore(team) + 1);
    return goal;
  }

  public Goal removeLastGoal(Team team) {
    Goal removed = null;
    for (int i = goalEvents.size() - 1; i >= 0; i--) {
      GoalEvent event = goalEvents.get(i);
      if (event.getTeam() == team) {
        removed = event.getGoal();
        goalEvents.remove(i);
        break;
      }
    }

    int score = getScore(team);
    if (score > 0) {
      setScore(team, score - 1);
    }

    return removed;
  }

  public void reset() {
    stopClock();
    scoreBoard.setGameState(ScoreBoard.GameState.PRE_GAME);
    homePenalties.clear();
    awayPenalties.clear();
    goalEvents.clear();
    scoreBoard.setAwayPenalty(0, null);
    scoreBoard.setAwayPenalty(1, null);
    scoreBoard.setHomePenalty(0, null);
    scoreBoard.setHomePenalty(1, null);
    setPeriod(0);
    setScore(Team.home, 0);
    setScore(Team.away, 0);
    homeShots = 0;
    awayShots = 0;
    setTime((int) TimeUnit.MINUTES.toMillis(getPeriodLength()));
  }

  public void playBuzzer(int millis) {
    scoreBoard.ringBuzzer(millis);
  }

  public boolean updatesRunning() {
    return scoreboardAdapter.isRunning();
  }

  public List<String> possiblePortNames() {
    return scoreboardAdapter.possiblePorts();
  }

  public void setAdapterPort(String portName) {
    scoreboardAdapter.setPortName(portName);

    if ( scoreboardAdapter.isRunning()) {
      scoreboardAdapter.stop();
      scoreboardAdapter.start();
    }
    // Persist selected port
    appConfig.setCommPort(portName);
  }

  public void stopUpdates() {
    scoreboardAdapter.stop();
  }

  public void startUpdates() {
    scoreboardAdapter.start();
  }

  public boolean isBuzzerOn() {
    return scoreboardAdapter.isBuzzerOn();
  }

  public void setShiftLengthSeconds(final Integer shiftLengthSeconds) {
    this.shiftLengthSeconds = shiftLengthSeconds;
  }

  public String currentPort() {
    return scoreboardAdapter.getPortName();
  }

  public void setGameConfig(GameConfig gameConfig) {
    this.gameConfig = gameConfig;
  }

  // Expose the injected config instance so callers (e.g., WS) can mutate in place.
  public GameConfig getGameConfigInstance() {
    return this.gameConfig;
  }
}
