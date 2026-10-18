package canfield.bia.hockey.scoreboard.io;

import com.fazecast.jSerialComm.SerialPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Simulates a physical scoreboard by connecting to a virtual COM port and
 * receiving/parsing the serial protocol messages sent by ScoreboardAdapterImpl.
 *
 * Use with com0com virtual serial port pairs for integration testing:
 * - Configure ScoreboardAdapterImpl to use COM10
 * - Configure ScoreboardSimulator to use COM11
 * - Data written to COM10 appears on COM11
 */
public class ScoreboardSimulator implements AutoCloseable {
    private static final Logger log = LoggerFactory.getLogger(ScoreboardSimulator.class);

    private static final byte HEADER = 0x2E;
    private static final byte CMD_CLOCK_SCORE = 0x78;
    private static final byte CMD_FAST_CLOCK = 0x79;
    private static final byte CMD_PENALTY_CLOCKS = 0x7A;
    private static final byte CMD_PENALTY_PLAYERS = 0x7E;
    private static final byte EMPTY_VALUE = (byte) 0xFF;

    private final String portName;
    private SerialPort serialPort;
    private Thread readerThread;
    private final AtomicBoolean running = new AtomicBoolean(false);

    // Current scoreboard state (thread-safe)
    private final AtomicInteger homeScore = new AtomicInteger(0);
    private final AtomicInteger awayScore = new AtomicInteger(0);
    private final AtomicInteger clockMinutes = new AtomicInteger(0);
    private final AtomicInteger clockSeconds = new AtomicInteger(0);
    private final AtomicInteger clockTenths = new AtomicInteger(0);
    private final AtomicInteger period = new AtomicInteger(1);
    private final AtomicBoolean buzzerOn = new AtomicBoolean(false);

    // Penalty state: [home1, home2, away1, away2]
    private final AtomicReference<PenaltyState[]> penalties = new AtomicReference<>(new PenaltyState[4]);

    // Message counters for testing
    private final AtomicInteger clockScoreMessageCount = new AtomicInteger(0);
    private final AtomicInteger fastClockMessageCount = new AtomicInteger(0);
    private final AtomicInteger penaltyMessageCount = new AtomicInteger(0);

    public ScoreboardSimulator(String portName) {
        this.portName = portName;
        // Initialize penalty slots
        PenaltyState[] initial = new PenaltyState[4];
        for (int i = 0; i < 4; i++) {
            initial[i] = null;
        }
        penalties.set(initial);
    }

    public void start() {
        if (running.get()) {
            return;
        }

        serialPort = SerialPort.getCommPort(portName);
        serialPort.setBaudRate(9600);
        serialPort.setNumDataBits(8);
        serialPort.setNumStopBits(1);
        serialPort.setParity(SerialPort.NO_PARITY);

        if (!serialPort.openPort()) {
            throw new RuntimeException("Failed to open port: " + portName);
        }

        log.info("ScoreboardSimulator connected to {}", portName);
        running.set(true);

        readerThread = new Thread(this::readLoop, "ScoreboardSimulator-Reader");
        readerThread.setDaemon(true);
        readerThread.start();
    }

    public void stop() {
        running.set(false);
        if (readerThread != null) {
            readerThread.interrupt();
            try {
                readerThread.join(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        if (serialPort != null && serialPort.isOpen()) {
            serialPort.closePort();
        }
        log.info("ScoreboardSimulator stopped");
    }

    @Override
    public void close() {
        stop();
    }

    private void readLoop() {
        byte[] buffer = new byte[64];
        int bufferPos = 0;

        while (running.get()) {
            try {
                int available = serialPort.bytesAvailable();
                if (available <= 0) {
                    Thread.sleep(10);
                    continue;
                }

                byte[] incoming = new byte[available];
                int bytesRead = serialPort.readBytes(incoming, available);

                for (int i = 0; i < bytesRead; i++) {
                    buffer[bufferPos++] = incoming[i];

                    // Check if we have a complete message
                    if (bufferPos >= 2 && buffer[0] == HEADER) {
                        int expectedLength = getExpectedLength(buffer[1], buffer, bufferPos);
                        if (expectedLength > 0 && bufferPos >= expectedLength) {
                            byte[] message = new byte[expectedLength];
                            System.arraycopy(buffer, 0, message, 0, expectedLength);
                            parseMessage(message);

                            // Shift remaining bytes
                            int remaining = bufferPos - expectedLength;
                            System.arraycopy(buffer, expectedLength, buffer, 0, remaining);
                            bufferPos = remaining;
                        }
                    } else if (bufferPos > 0 && buffer[0] != HEADER) {
                        // Discard invalid data, look for next header
                        bufferPos = 0;
                    }

                    // Prevent buffer overflow
                    if (bufferPos >= buffer.length - 1) {
                        bufferPos = 0;
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.warn("Error reading from serial port", e);
            }
        }
    }

    private int getExpectedLength(byte command, byte[] buffer, int bufferPos) {
        return switch (command) {
            case CMD_CLOCK_SCORE -> {
                // 0x78 can be 13 bytes (full) or 6 bytes (score-only update)
                // Check if we have enough to determine: look for pattern
                if (bufferPos >= 6) {
                    // If byte 6 would be a valid minute digit OR we only have exactly 6 bytes ending marker
                    // Full message is 13 bytes, partial is 6
                    // Heuristic: if buffer[6] looks like a minute digit, it's full
                    if (bufferPos >= 7 && buffer[6] != 0 && buffer[6] != (byte)0xFF) {
                        yield 13;
                    } else if (bufferPos == 6) {
                        yield 6;
                    }
                    yield 13; // Default to full
                }
                yield 13;
            }
            case CMD_FAST_CLOCK -> 6;
            case CMD_PENALTY_CLOCKS -> 14;  // 0x7A message is 14 bytes
            case CMD_PENALTY_PLAYERS -> 11; // 0x7E message is 11 bytes
            default -> -1;
        };
    }

    private void parseMessage(byte[] msg) {
        if (msg.length < 2 || msg[0] != HEADER) {
            return;
        }

        logMessage(msg);

        switch (msg[1]) {
            case CMD_CLOCK_SCORE -> parseClockAndScore(msg);
            case CMD_FAST_CLOCK -> parseFastClock(msg);
            case CMD_PENALTY_CLOCKS -> parsePenaltyClocks(msg);
            case CMD_PENALTY_PLAYERS -> parsePenaltyPlayers(msg);
        }
    }

    private void parseClockAndScore(byte[] msg) {
        clockScoreMessageCount.incrementAndGet();

        if (msg.length >= 6) {
            // At minimum we have scores
            int hs = decodeScore(msg[2], msg[3]);
            int as = decodeScore(msg[4], msg[5]);
            homeScore.set(hs);
            awayScore.set(as);
            System.out.println("[Simulator] Parsed scores: home=" + hs + " away=" + as);
        }

        if (msg.length >= 13) {
            // Full message with clock and period
            int mins = decodeDigitPair(msg[6], msg[7]);
            int secs = decodeDigitPair(msg[8], msg[9]);
            int per = decodeDigit(msg[10]);
            boolean buzz = msg[11] != 0;

            clockMinutes.set(mins);
            clockSeconds.set(secs);
            clockTenths.set(0);
            period.set(per);
            buzzerOn.set(buzz);

            System.out.println("[Simulator] Parsed clock: " + mins + ":" + String.format("%02d", secs) +
                " period=" + per + " buzzer=" + buzz);
        }
    }

    private void parseFastClock(byte[] msg) {
        fastClockMessageCount.incrementAndGet();

        if (msg.length >= 5) {
            clockMinutes.set(0);
            clockSeconds.set(decodeDigitPair(msg[2], msg[3]));
            clockTenths.set(decodeDigit(msg[4]));

            log.debug("Fast Clock: {}.{}", clockSeconds.get(), clockTenths.get());
        }
    }

    private void parsePenaltyClocks(byte[] msg) {
        penaltyMessageCount.incrementAndGet();

        if (msg.length >= 14) {
            PenaltyState[] current = penalties.get().clone();

            int idx = 2;
            for (int i = 0; i < 4; i++) {
                if (msg[idx] == EMPTY_VALUE) {
                    current[i] = null;
                    idx += 3;
                } else {
                    int minutes = decodeDigit(msg[idx]);
                    int seconds = decodeDigitPair(msg[idx + 1], msg[idx + 2]);
                    if (current[i] == null) {
                        current[i] = new PenaltyState();
                    }
                    current[i].minutes = minutes;
                    current[i].seconds = seconds;
                    idx += 3;
                }
            }

            penalties.set(current);
            log.debug("Penalty Clocks: HP1={} HP2={} AP1={} AP2={}",
                formatPenaltyTime(current[0]), formatPenaltyTime(current[1]),
                formatPenaltyTime(current[2]), formatPenaltyTime(current[3]));
        }
    }

    private void parsePenaltyPlayers(byte[] msg) {
        if (msg.length >= 10) {
            PenaltyState[] current = penalties.get().clone();

            int idx = 2;
            for (int i = 0; i < 4; i++) {
                if (msg[idx] != EMPTY_VALUE || msg[idx + 1] != EMPTY_VALUE) {
                    if (current[i] == null) {
                        current[i] = new PenaltyState();
                    }
                    current[i].playerNumber = decodeDigitPair(msg[idx], msg[idx + 1]);
                }
                idx += 2;
            }

            penalties.set(current);
            log.debug("Penalty Players: HP1=#{} HP2=#{} AP1=#{} AP2=#{}",
                formatPlayerNumber(current[0]), formatPlayerNumber(current[1]),
                formatPlayerNumber(current[2]), formatPlayerNumber(current[3]));
        }
    }

    // BCD decoding utilities

    private int decodeDigit(byte b) {
        if (b == EMPTY_VALUE || b == 0) {
            return 0;
        }
        return b & 0x0F;
    }

    private int decodeDigitPair(byte tens, byte ones) {
        int t = (tens == EMPTY_VALUE) ? 0 : (tens & 0x0F);
        int o = (ones == EMPTY_VALUE) ? 0 : (ones & 0x0F);
        return t * 10 + o;
    }

    private int decodeScore(byte tens, byte ones) {
        return decodeDigitPair(tens, ones);
    }

    private String formatPenaltyTime(PenaltyState p) {
        return p == null ? "--:--" : String.format("%d:%02d", p.minutes, p.seconds);
    }

    private String formatPlayerNumber(PenaltyState p) {
        return p == null ? "--" : String.valueOf(p.playerNumber);
    }

    private void logMessage(byte[] msg) {
        StringBuilder sb = new StringBuilder();
        for (byte b : msg) {
            sb.append(String.format("%02X ", b));
        }
        // Debug output to see what we're receiving
        System.out.println("[Simulator] Received " + msg.length + " bytes: " + sb.toString().trim());
    }

    // Getters for test assertions

    public int getHomeScore() { return homeScore.get(); }
    public int getAwayScore() { return awayScore.get(); }
    public int getClockMinutes() { return clockMinutes.get(); }
    public int getClockSeconds() { return clockSeconds.get(); }
    public int getClockTenths() { return clockTenths.get(); }
    public int getPeriod() { return period.get(); }
    public boolean isBuzzerOn() { return buzzerOn.get(); }

    public PenaltyState getHomePenalty(int slot) {
        return penalties.get()[slot];
    }

    public PenaltyState getAwayPenalty(int slot) {
        return penalties.get()[slot + 2];
    }

    public int getClockScoreMessageCount() { return clockScoreMessageCount.get(); }
    public int getFastClockMessageCount() { return fastClockMessageCount.get(); }
    public int getPenaltyMessageCount() { return penaltyMessageCount.get(); }

    public void resetMessageCounts() {
        clockScoreMessageCount.set(0);
        fastClockMessageCount.set(0);
        penaltyMessageCount.set(0);
    }

    public boolean isRunning() {
        return running.get() && serialPort != null && serialPort.isOpen();
    }

    /**
     * Wait for the simulator to receive at least one clock/score message.
     */
    public boolean waitForMessages(int minMessages, long timeoutMillis) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeoutMillis;
        while (System.currentTimeMillis() < deadline) {
            if (clockScoreMessageCount.get() >= minMessages) {
                return true;
            }
            Thread.sleep(50);
        }
        return false;
    }

    /**
     * Penalty state holder
     */
    public static class PenaltyState {
        public int playerNumber;
        public int minutes;
        public int seconds;

        @Override
        public String toString() {
            return String.format("#%d %d:%02d", playerNumber, minutes, seconds);
        }
    }
}
