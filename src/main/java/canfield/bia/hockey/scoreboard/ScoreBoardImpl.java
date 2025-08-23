package canfield.bia.hockey.scoreboard;

import canfield.bia.hockey.Penalty;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Scoreboard owns the state of the scoreboard.
 */
public class ScoreBoardImpl implements ScoreBoard {
  private static final int HOME = 0;
  private static final int AWAY = 1;
  private final Clock gameClock = new GameClock(5, 0);
  private int period = 0;

  // Default game configuration
  private List<Integer> periodMinutes = Arrays.asList(5, 20, 20, 20);

  private int homeScore;
  private int awayScore;

  // Empty penalties
  private final Penalty[][] penalties = new Penalty[][] {
      {null, null},
      {null, null}
  };

  private final Event tickEvent = new Event(EventType.tick);
  private final Event endOfPeriodEvent = new Event(EventType.end_of_period);

  private final List<EventListener> listeners = new ArrayList<>();

  public ScoreBoardImpl() {
    final ScheduledExecutorService executorService = Executors.newSingleThreadScheduledExecutor();

    final Runnable gameLoop = () -> {
      if (gameClock == null) {
        return;
      }

      fire(tickEvent); // this drives the scoreboard serial adapter.

      if (gameClock.isRunning() && gameClock.hasExpired()) {
        fire(endOfPeriodEvent);

        advancePeriod();
      }
    };

    // Run the loop 60 x per second
    executorService.scheduleAtFixedRate(
        gameLoop, 1000, 1000 / 60, TimeUnit.MILLISECONDS
    );
  }

  @Override
  public void ringBuzzer(int millis) {
    fire(new BuzzerEvent(millis));
  }

  @Override
  public Clock getGameClock() {
    return gameClock;
  }

  @Override
  public int getPeriod() {
    return period;
  }

  @Override
  public void setPeriod(int period) {
    if (period < 0 || period >= periodMinutes.size()) {
      return;
    }
    if (getPeriodMinutes(period) > 0) {
      this.period = period;
    }
  }

  @Override
  public int getPeriodLengthMinutes() {
    return getPeriodMinutes(period);
  }

  @Override
  public int getPeriodMinutes(int p) {
    if (p >= 0 && periodMinutes.size() > p) {
      final Integer minutes = periodMinutes.get(p);
      return minutes == null ? 0 : minutes;
    }
    return 0;
  }

  @Override
  public void setPeriodLength(final List<Integer> minutes) {
    // Validate period lengths: any period other than 0 has to be greater than 0
    for (int i = 1; i < minutes.size(); i++) {
      final Integer minute = minutes.get(i);
      if (minute == 0) {
        // TODO: Return an error
        return;
      }
    }
    periodMinutes = new ArrayList<>(minutes);
  }

  @Override
  public void setHomePenalty(int index, Penalty penalty) {
    if (index < 0 || index >= penalties[HOME].length) {
      return;
    }
    penalties[HOME][index] = penalty;
  }

  @Override
  public Penalty getHomePenalty(int index) {
    if (index < 0 || index >= penalties[HOME].length) {
      return null;
    }
    return penalties[HOME][index];
  }

  @Override
  public void setAwayPenalty(int index, Penalty penalty) {
    if (index < 0 || index >= penalties[AWAY].length) {
      return;
    }
    penalties[AWAY][index] = penalty;
  }


  @Override
  public Penalty getAwayPenalty(int index) {
    if (index < 0 || index >= penalties[AWAY].length) {
      return null;
    }
    return penalties[AWAY][index];
  }

  @Override
  public void pause() {
    gameClock.stop();
  }

  @Override
  public void start() {
    gameClock.start();
  }

  @Override
  public int getHomeScore() {
    return homeScore;
  }

  @Override
  public void setHomeScore(int homeScore) {
    if (homeScore >= 0) {
      this.homeScore = homeScore;
    }
  }

  @Override
  public int getAwayScore() {
    return awayScore;
  }

  @Override
  public void setAwayScore(int awayScore) {
    if (awayScore >= 0) {
      this.awayScore = awayScore;
    }
  }

  @Override
  public void advancePeriod() {
    gameClock.stop();
    if (period + 1 < periodMinutes.size()) {
      period = ++period % periodMinutes.size();
      gameClock.setTime(getPeriodLengthMinutes(), 0);
    }
  }

  private void fire(Event eventType) {
    for (EventListener listener : listeners) {
      listener.handle(eventType);
    }
  }

  @Override
  public void addListener(EventListener listener) {
    listeners.add(listener);
  }
}
