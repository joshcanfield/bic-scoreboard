package canfield.bia.scoreboard.io;

import canfield.bia.hockey.Penalty;
import canfield.bia.scoreboard.Clock;
import canfield.bia.scoreboard.GameClock;
import canfield.bia.scoreboard.ScoreBoard;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import purejavacomm.CommPortIdentifier;
import purejavacomm.PortInUseException;
import purejavacomm.SerialPort;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Enumeration;

public class SerialUpdater {
    private Logger log = LoggerFactory.getLogger(SerialUpdater.class);

    public static final byte ZERO_VALUE_EMPTY = (byte) 0xFF;
    public static final int SECONDS = 1000;

    /**
     * This is the scoreboard data that we're sending down the serial line
     */
    private ScoreBoard scoreBoard;

    private String portName;
    private SerialPort serialPort;

    private final PenaltyClockCmd penaltyClockCmd;
    private final SerialUpdater.ClockAndScoreCmd clockAndScoreCmd;
    private Long buzzer_started;

    public SerialUpdater(ScoreBoard scoreBoard, String portName) {
        this.scoreBoard = scoreBoard;
        this.portName = portName;
        clockAndScoreCmd = new ClockAndScoreCmd();
        penaltyClockCmd = new PenaltyClockCmd();

        initListener(scoreBoard);
    }

    private void initListener(final ScoreBoard scoreBoard) {

        scoreBoard.addListener(new ScoreBoard.EventListener() {
            @Override
            public void handle(ScoreBoard.Event eventType) {

                long now = System.currentTimeMillis();
                switch (eventType.getType()) {
                    case tick:
                        if (buzzer_started != null && now - buzzer_started < 3 * SECONDS) {
                            // we don't update for 3 seconds while the buzzer is going off...
                            break;
                        }
                        Clock gameClock = scoreBoard.getGameClock();
                        int millis = gameClock.getMillis();
                        if (buzzer_started != null) {
                            // clear the buzzer
                            clockAndScoreCmd.sendGameClock(gameClock, true);
                        } else if (millis > 59 * 1000) {
                            clockAndScoreCmd.sendGameClock(gameClock);
                        } else {
                            // if the game clock is less than a minute we push changes faster
                            clockAndScoreCmd.sendLastMinuteGameClock(gameClock);
                        }

                        penaltyClockCmd.sendPenaltyClock();

                        buzzer_started = null;
                        break;
                    case end_of_period:
                        buzzer_started = now;
                        break;
                }
            }


        });
    }

    public String getPortName() {
        return portName;
    }

    public void setPortName(String portName) {
        this.portName = portName;
    }

    public void start() {
        // Connect to serial port and start
        if (serialPort == null) {
            openPort();
        }
    }

    long lastOpenAttempt = 0;

    private void openPort() {
        long now = System.currentTimeMillis();
        if (now - lastOpenAttempt < 2 * 1000) {
            return;
        }
        lastOpenAttempt = now;
        log.trace("Attempt to open port {}", portName);
        final CommPortIdentifier portId = getPortId(portName);
        if (portId == null) {
            return;
        }

        final SerialPort open;
        try {
            open = (SerialPort) portId.open("BIA Scoreboard", 1000);
        } catch (PortInUseException e) {
            log.warn("port already in use! {}", portName, e);
            serialPort = null;
            return;
        }
        log.debug("Port {} opened", portName);

        configure(open);
        serialPort = open;
    }

    private void configure(SerialPort port) {
        port.notifyOnOutputEmpty(true);
    }

    public void stop() {

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

        private void sendGameClock(Clock gameClock, boolean cancelBuzzer) {
            long now = System.currentTimeMillis();
            if (!cancelBuzzer && (now - lastGameClockUpdateMillis) < GAME_CLOCK_UPDATE_INTERVAL_MILLIS) return;

            lastGameClockUpdateMillis = now;
            send(new byte[]{
                    0x2e,
                    0x78,
                    digit(10, scoreBoard.getHomeScore(), ZERO_VALUE_EMPTY),
                    digit(1, scoreBoard.getHomeScore()),
                    digit(10, scoreBoard.getAwayScore(), ZERO_VALUE_EMPTY),
                    digit(1, scoreBoard.getAwayScore()),
                    digit(10, gameClock.getMinutes(), ZERO_VALUE_EMPTY),
                    digit(1, gameClock.getMinutes()),
                    digit(10, gameClock.getSeconds()),
                    digit(1, gameClock.getSeconds()),
                    digit(1, scoreBoard.getPeriod()),
                    cancelBuzzer ? digit(1, 5) : 0,
                    0
            });
        }

        private void sendGameClock(Clock gameClock) {
            sendGameClock(gameClock, false);
        }

        private void sendLastMinuteGameClock(Clock gameClock) {
            int s = gameClock.getSeconds();
            send(new byte[]{
                    0x2E,
                    0x79,
                    digit(10, s, ZERO_VALUE_EMPTY),
                    digit(1, s),
                    digit(1, (byte) ((gameClock.getMillis() / 100) % 10)),
                    (byte) 0xFF
            });

            // in fast mode we only update the score when it's changed
            int homeScore = scoreBoard.getHomeScore();
            int awayScore = scoreBoard.getHomeScore();
            if (homeScore != lastHomeScore || awayScore != lastAwayScore) {
                lastHomeScore = homeScore;
                lastAwayScore = awayScore;
                send(new byte[]{
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

        public boolean sendPenaltyClock() {
            long now = System.currentTimeMillis();

            Penalty[] penalties = new Penalty[]{
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
                return false;
            }

            hadPenalty = hasPenalty;
            lastUpdateMillis = now;

            int index = 0;
            byte[] b = new byte[26];
            b[index++] = 0x2E;
            b[index++] = 0x7A;
            int gameMillis = scoreBoard.getGameClock().getMillis();
            for (Penalty penalty : penalties) {
                if (penalty == null) {
                    b[index++] = (byte) 0xFF;
                    b[index++] = (byte) 0xFF;
                    b[index++] = (byte) 0xFF;
                } else {
                    int remaining = scoreBoard.getPenaltyRemainingMillis(penalty);

                    byte minutes = (byte) (GameClock.getMinutes(remaining) & 0xFF);
                    b[index++] = minutes == 0 ? (byte) 0xFF : minutes;
                    int seconds = GameClock.getSeconds(remaining);
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
                    int player = penalty.getPlayerNumber();
                    b[index++] = digit(10, player, ZERO_VALUE_EMPTY);
                    b[index++] = digit(1, player);
                }
            }
            send(b);
            return true;
        }
    }

    static byte digit(int place, int i, byte zeroValue) {
        int value = (i / place) % 10;
        return value == 0 ? zeroValue : (byte) (value |= value << 4);
    }

    static byte digit(int offset, int value) {
        return digit(offset, value, (byte) 0);
    }

    private void send(byte[] msg) {
        log(msg);
        if (serialPort == null) {
            openPort();
        }

        if (serialPort != null) {
            OutputStream os;
            try {
                os = serialPort.getOutputStream();
                os.write(msg);
            } catch (IOException e) {
                log.warn("Failed to write to serial port! {} - try to reconnect", portName);
                serialPort = null;
            }
        }
    }


    long lastSend = 0;
    byte[] lastMsg = {};

    private void log(byte[] msg) {
        if (log.isTraceEnabled()) {
            lastMsg = msg;
            long now = System.currentTimeMillis();
            long elapsed = now - lastSend;
            lastSend = now;
            StringBuilder sb = new StringBuilder();
            for (byte aMsg : msg) {
                sb.append(String.format("%02x ", aMsg));
            }
            log.trace("{}: {}", elapsed, sb.toString());
        }
    }

    private static CommPortIdentifier getPortId(String portName) {
        Enumeration e = CommPortIdentifier.getPortIdentifiers();
        while (e.hasMoreElements()) {
            CommPortIdentifier portid = (CommPortIdentifier) e.nextElement();
            if (portid.getName().equals(portName)) {
                return portid;
            }
        }
        return null;
    }
}
