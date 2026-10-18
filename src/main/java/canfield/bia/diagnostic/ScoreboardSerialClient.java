package canfield.bia.diagnostic;

import com.fazecast.jSerialComm.SerialPort;
import com.fazecast.jSerialComm.SerialPortDataListener;
import com.fazecast.jSerialComm.SerialPortEvent;

import java.io.ByteArrayOutputStream;
import java.util.Arrays;

/**
 * Serial client for monitoring scoreboard adapter output.
 * Connects to a serial port and displays decoded scoreboard data.
 *
 * Usage:
 *   java -cp <classpath> canfield.bia.diagnostic.ScoreboardSerialClient [port]
 *
 * If no port is specified, lists available ports.
 */
public class ScoreboardSerialClient {

    private static final byte EMPTY_DIGIT = (byte) 0xFF;
    private static final byte CMD_START = 0x2E;
    private static final byte CMD_CLOCK_SCORE = 0x78;
    private static final byte CMD_FAST_CLOCK = 0x79;
    private static final byte CMD_PENALTY_CLOCK = 0x7A;
    private static final byte CMD_PENALTY_PLAYERS = 0x7E;

    // Current state
    private int homeScore = 0;
    private int awayScore = 0;
    private int period = 0;
    private String gameTime = "00:00";
    private boolean buzzer = false;
    private boolean fastClockMode = false;

    private final String[] penaltyTimes = {"--:--", "--:--", "--:--", "--:--"};
    private final String[] penaltyPlayers = {"--", "--", "--", "--"};

    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();

    public static void main(String[] args) {
        System.out.println("=== Scoreboard Serial Client ===\n");

        if (args.length == 0) {
            listPorts();
            System.out.println("\nUsage: ScoreboardSerialClient <port>");
            System.out.println("Example: ScoreboardSerialClient COM3");
            return;
        }

        String portName = args[0];
        ScoreboardSerialClient client = new ScoreboardSerialClient();
        client.connect(portName);
    }

    private static void listPorts() {
        System.out.println("Available serial ports:");
        SerialPort[] ports = SerialPort.getCommPorts();
        if (ports.length == 0) {
            System.out.println("  (none found)");
        } else {
            for (SerialPort port : ports) {
                System.out.printf("  %s - %s%n", port.getSystemPortName(), port.getDescriptivePortName());
            }
        }
    }

    public void connect(String portName) {
        SerialPort port = SerialPort.getCommPort(portName);

        if (!port.openPort()) {
            System.err.println("Failed to open port: " + portName);
            return;
        }

        System.out.println("Connected to " + portName);
        System.out.println("Waiting for scoreboard data... (Ctrl+C to exit)\n");

        port.addDataListener(new SerialPortDataListener() {
            @Override
            public int getListeningEvents() {
                return SerialPort.LISTENING_EVENT_DATA_AVAILABLE;
            }

            @Override
            public void serialEvent(SerialPortEvent event) {
                if (event.getEventType() != SerialPort.LISTENING_EVENT_DATA_AVAILABLE) {
                    return;
                }
                byte[] data = new byte[port.bytesAvailable()];
                port.readBytes(data, data.length);
                processData(data);
            }
        });

        // Keep running until interrupted
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\nClosing port...");
            port.closePort();
        }));

        // Block main thread
        try {
            Thread.currentThread().join();
        } catch (InterruptedException e) {
            port.closePort();
        }
    }

    private void processData(byte[] data) {
        for (byte b : data) {
            buffer.write(b);
            byte[] bytes = buffer.toByteArray();

            // Look for command start
            int startIdx = findCommandStart(bytes);
            if (startIdx > 0) {
                // Discard bytes before command start
                buffer.reset();
                buffer.write(bytes, startIdx, bytes.length - startIdx);
                bytes = buffer.toByteArray();
            }

            // Try to parse complete commands
            if (bytes.length >= 2 && bytes[0] == CMD_START) {
                int cmdLen = getCommandLength(bytes[1]);
                if (cmdLen > 0 && bytes.length >= cmdLen) {
                    parseCommand(Arrays.copyOf(bytes, cmdLen));
                    buffer.reset();
                    if (bytes.length > cmdLen) {
                        buffer.write(bytes, cmdLen, bytes.length - cmdLen);
                    }
                }
            }
        }
    }

    private int findCommandStart(byte[] bytes) {
        for (int i = 0; i < bytes.length; i++) {
            if (bytes[i] == CMD_START) {
                return i;
            }
        }
        return -1;
    }

    private int getCommandLength(byte cmd) {
        return switch (cmd) {
            case CMD_CLOCK_SCORE -> 13;
            case CMD_FAST_CLOCK -> 6;
            case CMD_PENALTY_CLOCK -> 15;  // Without the appended 0x7E command
            case CMD_PENALTY_PLAYERS -> 11;
            default -> 0;
        };
    }

    private void parseCommand(byte[] cmd) {
        if (cmd.length < 2 || cmd[0] != CMD_START) {
            return;
        }

        switch (cmd[1]) {
            case CMD_CLOCK_SCORE -> parseClockAndScore(cmd);
            case CMD_FAST_CLOCK -> parseFastClock(cmd);
            case CMD_PENALTY_CLOCK -> parsePenaltyClock(cmd);
            case CMD_PENALTY_PLAYERS -> parsePenaltyPlayers(cmd);
        }

        displayState();
    }

    /**
     * Parse command 0x78 - Game clock and score
     * Format: 2e 78 [home10] [home1] [away10] [away1] [min10] [min1] [sec10] [sec1] [period] [buzzer] 00
     */
    private void parseClockAndScore(byte[] cmd) {
        if (cmd.length < 12) return;

        fastClockMode = false;
        homeScore = decodeDigitOrZero(cmd[2]) * 10 + decodeDigitOrZero(cmd[3]);
        awayScore = decodeDigitOrZero(cmd[4]) * 10 + decodeDigitOrZero(cmd[5]);

        int minutes = decodeDigitOrZero(cmd[6]) * 10 + decodeDigitOrZero(cmd[7]);
        int seconds = decodeDigitOrZero(cmd[8]) * 10 + decodeDigitOrZero(cmd[9]);
        gameTime = String.format("%02d:%02d", minutes, seconds);

        period = decodeDigitOrZero(cmd[10]);
        buzzer = cmd[11] != 0;
    }

    /**
     * Parse command 0x79 - Fast clock (under 1 minute)
     * Format: 2e 79 [sec10] [sec1] [tenths] ff
     */
    private void parseFastClock(byte[] cmd) {
        if (cmd.length < 5) return;

        fastClockMode = true;
        int seconds = decodeDigitOrZero(cmd[2]) * 10 + decodeDigitOrZero(cmd[3]);
        int tenths = decodeDigitOrZero(cmd[4]);
        gameTime = String.format("%02d.%d", seconds, tenths);
    }

    /**
     * Parse command 0x7A - Penalty clocks
     * Format: 2e 7a [M S S] x4 penalties ff
     */
    private void parsePenaltyClock(byte[] cmd) {
        if (cmd.length < 14) return;

        int idx = 2;
        for (int i = 0; i < 4; i++) {
            int minutes = decodeDigitOrZero(cmd[idx++]);
            int sec10 = decodeDigitOrZero(cmd[idx++]);
            int sec1 = decodeDigitOrZero(cmd[idx++]);

            penaltyTimes[i] = String.format("%d:%d%d", minutes, sec10, sec1);
        }
    }

    /**
     * Parse command 0x7E - Penalty player numbers
     * Format: 2e 7e [10 1] x4 players ff
     */
    private void parsePenaltyPlayers(byte[] cmd) {
        if (cmd.length < 10) return;

        int idx = 2;
        for (int i = 0; i < 4; i++) {
            int tens = decodeDigit(cmd[idx++]);
            int ones = decodeDigit(cmd[idx++]);

            if (tens < 0 || ones < 0) {
                penaltyPlayers[i] = "--";
            } else {
                int number = tens * 10 + ones;
                penaltyPlayers[i] = number == 0 ? "--" : String.format("%2d", number);
            }
        }
    }

    /**
     * Decode a BCD-style digit byte.
     * Returns -1 for empty/invalid values.
     */
    private int decodeDigit(byte b) {
        if (b == EMPTY_DIGIT) {
            return -1; // Empty/blank
        }
        // Handle actual 0 (could be 0x00)
        if (b == 0) {
            return 0;
        }
        // Digits are encoded as value | (value << 4), e.g., 5 -> 0x55
        int low = b & 0x0F;
        int high = (b >> 4) & 0x0F;
        if (low == high && low >= 0 && low <= 9) {
            return low;
        }
        return -1; // Invalid
    }

    /**
     * Decode digit, returning 0 for empty (for clock/score calculations).
     */
    private int decodeDigitOrZero(byte b) {
        int d = decodeDigit(b);
        return d < 0 ? 0 : d;
    }

    private void displayState() {
        // Clear screen and move cursor to top (ANSI escape codes)
        System.out.print("\033[2J\033[H");

        System.out.println("+--------------------------------------------------+");
        System.out.println("|          SCOREBOARD SERIAL MONITOR               |");
        System.out.println("+--------------------------------------------------+");
        System.out.println("|                                                  |");
        System.out.printf("|    HOME: %-3d              GUEST: %-3d             |%n", homeScore, awayScore);
        System.out.println("|                                                  |");
        System.out.printf("|              PERIOD: %d    TIME: %-6s           |%n", period, gameTime);
        System.out.printf("|              %s %s                      |%n",
                fastClockMode ? "(fast)" : "      ",
                buzzer ? "BUZZER!" : "       ");
        System.out.println("|                                                  |");
        System.out.println("+--------------------------------------------------+");
        System.out.println("|  PENALTIES                                       |");
        System.out.println("|                                                  |");
        System.out.printf("|  HOME #%-2s %-5s     GUEST #%-2s %-5s              |%n",
                penaltyPlayers[0], penaltyTimes[0], penaltyPlayers[2], penaltyTimes[2]);
        System.out.printf("|  HOME #%-2s %-5s     GUEST #%-2s %-5s              |%n",
                penaltyPlayers[1], penaltyTimes[1], penaltyPlayers[3], penaltyTimes[3]);
        System.out.println("|                                                  |");
        System.out.println("+--------------------------------------------------+");
    }
}
