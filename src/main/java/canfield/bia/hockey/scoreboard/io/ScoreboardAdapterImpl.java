package canfield.bia.hockey.scoreboard.io;

import canfield.bia.hockey.Penalty;
import canfield.bia.hockey.scoreboard.Clock;
import canfield.bia.hockey.scoreboard.ScoreBoard;
import canfield.bia.hockey.scoreboard.ScoreBoardImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fazecast.jSerialComm.SerialPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;

public class ScoreboardAdapterImpl implements ScoreboardAdapter {
  private static final byte ZERO_VALUE_EMPTY = (byte) 0xFF;
  private static final Logger log = LoggerFactory.getLogger(ScoreboardAdapterImpl.class);
  private static final int PORT_OPEN_TIMEOUT_SECONDS = 5;
  private final PenaltyClockCmd penaltyClockCmd = new PenaltyClockCmd();
  private final ScoreboardAdapterImpl.ClockAndScoreCmd clockAndScoreCmd = new ClockAndScoreCmd();

  private String portName;
  private SerialPort serialPort;

  private long buzzer_stops = 0;
  private boolean running = false;
  private long lastOpenAttempt = 0;

  private long lastSend = 0;

  private final ScoreBoard scoreBoard;

  public ScoreboardAdapterImpl(ScoreBoard scoreBoard, String portName) {
    this.scoreBoard = scoreBoard;
    this.portName = portName;

    // WORKAROUND: jSerialComm extracts a native library to java.io.tmpdir.
    // If the default tmpdir has execution restrictions, the library will fail to load,
    // causing the port connection to fail silently. By redirecting the tmpdir to
    // a local directory, we ensure the library can be loaded.
    java.io.File projectTempDir = new java.io.File("build/tmp/jSerialComm");
    if (!projectTempDir.exists()) {
        projectTempDir.mkdirs();
    }
    System.setProperty("java.io.tmpdir", projectTempDir.getAbsolutePath());
    System.setProperty("fazecast.jSerialComm.appid", "Scoreboard");

    initListener(scoreBoard);
  }

  private static byte digit(int place, int i, byte zeroValue) {
    int value = (i / place) % 10;
    return value == 0 ? zeroValue : (byte) (value |= value << 4);
  }

  private static byte digit(int offset, int value) {
    return digit(offset, value, (byte) 0);
  }

  @Override
  public List<String> possiblePorts() {
    return Arrays.stream(SerialPort.getCommPorts()).map(SerialPort::getSystemPortName).sorted().collect(Collectors.toList());
  }

  @Override
  public String getPortName() {
    return portName;
  }

  @Override
  public void setPortName(String portName) {
    this.portName = portName;
  }

  @Override
  public void start() {
    running = true;
    // Connect to serial port and start
    openPort();
  }

  @Override
  public void stop() {
    running = false;
    closePort();
  }

  private void closePort() {
    if (serialPort == null) {
      return;
    }
    serialPort.closePort();
    serialPort = null;
  }

  @Override
  public boolean isRunning() {
    return running;
  }

  @Override
  public boolean isBuzzerOn() {
    return buzzer_stops > System.currentTimeMillis();
  }

  private void initListener(final ScoreBoard scoreBoard) {

    scoreBoard.addListener(event -> {
      final Clock gameClock = scoreBoard.getGameClock();
      final long now = System.currentTimeMillis();
      switch (event.getType()) {
        case tick:
          if (!running) {
            return;
          }

          clockAndScoreCmd.sendGameClock(gameClock, buzzer_stops > now);
          penaltyClockCmd.sendPenaltyClock();

          break;
        case end_of_period:
          buzzer_stops = now + 3000;
          break;
        case buzzer:
          // Is the buzzer already ringing?
          int lengthMillis = ((ScoreBoardImpl.BuzzerEvent) event).getLengthMillis();
          buzzer_stops = Math.max(buzzer_stops, now + lengthMillis);
          break;
      }
    });
  }

  private void openPort() {
    if (serialPort != null) {
      return;
    }
    if (portName == null || portName.isEmpty()) {
      return; // No port configured yet - will be set via StartAdapterCommand
    }
    long now = System.currentTimeMillis();
    if (now - lastOpenAttempt < 2 * 1000) {
      return;
    }
    lastOpenAttempt = now;
    log.trace("Attempt to open port {}", portName);

    try {
      SerialPort port = SerialPort.getCommPort(portName);

      // Open port with timeout to prevent indefinite blocking
      boolean opened = CompletableFuture.supplyAsync(() -> port.openPort())
          .get(PORT_OPEN_TIMEOUT_SECONDS, TimeUnit.SECONDS);

      if (opened) {
        serialPort = port;
        log.debug("Port {} opened", portName);
      } else {
        log.warn("Failed to open port: {} (openPort returned false)", portName);
        port.closePort();
      }
    } catch (TimeoutException e) {
      log.warn("Timeout opening port {} after {} seconds", portName, PORT_OPEN_TIMEOUT_SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      log.warn("Interrupted while opening port: {}", portName);
    } catch (Exception e) {
      log.warn("Failed to open port: {}", portName, e);
      if (serialPort != null) {
        serialPort.closePort();
        serialPort = null;
      }
    }
  }

  private void send(byte[] msg) {
    if (!running) {
      return;
    }
    log(msg);
    openPort();

    if (serialPort != null) {
      try {
        serialPort.writeBytes(msg, msg.length);
      } catch (Exception e) {
        log.warn("Failed to write to serial port! {} - try to reconnect", portName);
        serialPort.closePort();
        serialPort = null;
      }
    }
  }

  private void log(byte[] msg) {
    if (log.isTraceEnabled()) {
      long now = System.currentTimeMillis();
      long elapsed = now - lastSend;
      lastSend = now;
      StringBuilder sb = new StringBuilder();
      for (byte aMsg : msg) {
        sb.append(String.format("%02x ", aMsg));
      }
      log.trace("{}: {}", elapsed, sb);
    }
  }

  /**
   * <pre>
   * 0x78 - GameClock and Score every 120 ms
   * Period --------------------------------|
   * GameClock seconds ---------------------|   |
   * GameClock minutes ---------------|     |   |
   * Guest score -----------|     |     |   |
   * Home team score -|     |     |     |   |
   * Cmd Id -----|| /   \ /   \ /   \ /   \ ||  tag
   *          2e 78 33 55 44 33 11 22 33 00 33 00 00
   *
   * 0x79 - Game GameClock under a minute (59.1) every 60 ms
   * GameClock 1/10 second ---|
   * GameClock seconds ---|   |
   * Cmd Id -----|| /   \ ||
   *          2e 79 55 99 11 ff
   */
  public class ClockAndScoreCmd {
    private static final long GAME_CLOCK_UPDATE_INTERVAL_MILLIS = 120;
    int lastHomeScore = 0;
    int lastAwayScore = 0;
    private long lastGameClockUpdateMillis;

    private void sendGameClock(Clock gameClock, boolean buzzer) {
      long now = System.currentTimeMillis();
      if (now - lastGameClockUpdateMillis < GAME_CLOCK_UPDATE_INTERVAL_MILLIS) {
        return;
      }

      lastGameClockUpdateMillis = now;

      final int homeScore = scoreBoard.getHomeScore();
      final int awayScore = scoreBoard.getAwayScore();
      final Clock.ClockTime time = gameClock.getTime();

      final int minutes = time.getMinutes();
      final int seconds = time.getSeconds();

      if (minutes > 0 || gameClock.hasExpired()) {
        send(new byte[] {
            0x2e,
            0x78,
            digit(10, homeScore, ZERO_VALUE_EMPTY),
            digit(1, homeScore),
            digit(10, awayScore, ZERO_VALUE_EMPTY),
            digit(1, awayScore),
            digit(10, minutes, ZERO_VALUE_EMPTY),
            digit(1, minutes),
            digit(10, seconds),
            digit(1, seconds),
            digit(1, scoreBoard.getPeriod()),
            buzzer ? digit(1, 5) : 0,
            0
        });

      } else {
        // at less than a minute send seconds with 10th of second remaining
        send(new byte[] {
            0x2E,
            0x79,
            digit(10, seconds, ZERO_VALUE_EMPTY),
            digit(1, seconds),
            digit(1, (byte) time.getTenthsOfSeconds()),
            (byte) 0xFF
        });

        // in fast mode we only update the score when it's changed
        if (homeScore != lastHomeScore || awayScore != lastAwayScore) {
          lastHomeScore = homeScore;
          lastAwayScore = awayScore;
          send(new byte[] {
              0x2E,
              0x78,
              digit(10, scoreBoard.getHomeScore(), ZERO_VALUE_EMPTY),
              digit(1, scoreBoard.getHomeScore()),
              digit(10, scoreBoard.getAwayScore(), ZERO_VALUE_EMPTY),
              digit(1, scoreBoard.getAwayScore()),
          });
        }
      }
    }
  }

  /**
   * Sends the penalty clock
   * - if there is a penalty
   * - if there was a penalty during the previous update to clear the state.
   * <p/>
   * <pre>
   * Penalty clock
   * Away bottom ----------------------------- M -- S
   * Away top ----------------------- M -- S   |    |
   * Home bottom ----------- M -- S   |    |   |    |
   * Home top ----- M -- S   |    |   |    |   |    |
   * Cmd Id -----|| || /   \ || /   \ || /   \ || /   \  tag
   *          2e 7a 0a 00 00 ff ff ff ff ff ff ff ff ff ff
   *
   * Penalty player numbers
   * Away bottom -----------------------|
   * Away top --------------------|     |
   * Home bottom -----------|     |     |
   * Home top --------|     |     |     |
   * Cmd Id -----|| /   \ /   \ /   \ /   \  tag
   *          2e 7e 11 22 00 88 00 00 00 00 ff
   * </pre>
   */
  public class PenaltyClockCmd {
    boolean hadPenalty = true; // initialize true so we send the first message to the penalty clock
    long lastUpdateMillis = 0;

    void sendPenaltyClock() {
      long now = System.currentTimeMillis();

      Penalty[] penalties = new Penalty[] {
          scoreBoard.getHomePenalty(0),
          scoreBoard.getHomePenalty(1),
          scoreBoard.getAwayPenalty(0),
          scoreBoard.getAwayPenalty(1)
      };

      boolean hasPenalty = false;
      for (Penalty penalty : penalties) {
        if (penalty != null) {
          hasPenalty = true;
          break;
        }
      }

      // If we don't have a penalty, and we didn't last time don't bother updating.
      if ((!hasPenalty && !hadPenalty) || (now - lastUpdateMillis < 500)) {
        // only update the clock if the state could have changed
        return;
      }

      hadPenalty = hasPenalty;
      lastUpdateMillis = now;

      int index = 0;
      byte[] b = new byte[26];
      b[index++] = 0x2E;
      b[index++] = 0x7A;
      for (Penalty penalty : penalties) {
        if (penalty == null) {
          b[index++] = (byte) 0xFF;
          b[index++] = (byte) 0xFF;
          b[index++] = (byte) 0xFF;
        } else {
          int remaining = penalty.getTime() - penalty.getElapsed();

          byte minutes = (byte) (Clock.getMinutes(remaining) & 0xFF);
          b[index++] = digit(1, minutes); // == 0 ? (byte) 0xFF : minutes;
          int seconds = Clock.getSeconds(remaining);
          b[index++] = digit(10, seconds);
          b[index++] = digit(1, seconds);
        }
      }
      b[index++] = (byte) 0xFF;
      b[index++] = 0x2E;
      b[index++] = 0x7E;
      for (Penalty penalty : penalties) {
        if (penalty == null) {
          b[index++] = (byte) 0xFF;
          b[index++] = (byte) 0xFF;
        } else {
          int serving = penalty.getServingPlayerNumber();
          int player = serving != 0 ? serving : penalty.getPlayerNumber();
          b[index++] = digit(10, player, ZERO_VALUE_EMPTY);
          b[index++] = digit(1, player);
        }
      }
      b[index] = (byte) 0xFF;

      send(b);

    }
  }
}
