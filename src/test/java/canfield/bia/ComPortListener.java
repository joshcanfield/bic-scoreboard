package canfield.bia;

import com.fazecast.jSerialComm.SerialPort;

import java.io.InputStream;
import java.util.Scanner;
import java.util.logging.Logger;

public class ComPortListener {

    private static final byte ZERO_VALUE_EMPTY = (byte) 0xFF;
    private static final Logger logger = Logger.getLogger(ComPortListener.class.getName());

    public static void main(String[] args) {
        try {
            String portName = null;
            if (args.length > 0) {
                portName = args[0];
            } else {
                SerialPort[] ports = SerialPort.getCommPorts();
                if (ports.length == 0) {
                    logger.info("No COM ports found.");
                    return;
                }

                System.out.println("Available COM ports:");
                for (int i = 0; i < ports.length; i++) {
                    System.out.println(i + ": " + ports[i].getSystemPortName());
                }

                System.out.print("Enter the number of the COM port to listen on: ");
                Scanner scanner = new Scanner(System.in);
                int portIndex = scanner.nextInt();

                if (portIndex < 0 || portIndex >= ports.length) {
                    logger.warning("Invalid port selection.");
                    return;
                }
                portName = ports[portIndex].getSystemPortName();
            }

            logger.info("Attempting to open port: " + portName);
            SerialPort selectedPort = SerialPort.getCommPort(portName);
            if (selectedPort.openPort()) {
                logger.info("Listening on " + selectedPort.getSystemPortName() + "...");
                selectedPort.setComPortTimeouts(SerialPort.TIMEOUT_READ_SEMI_BLOCKING, 0, 0);
                InputStream in = selectedPort.getInputStream();
                try {
                    byte[] buffer = new byte[1024];
                    int len;
                    while ((len = in.read(buffer)) > -1) {
                        logger.info("Received " + len + " bytes.");
                        logger.info("Raw data: " + bytesToHex(buffer, len));
                        processData(buffer, len);
                    }
                } catch (Exception e) {
                    logger.severe("Error reading from serial port: " + e.getMessage());
                    e.printStackTrace();
                }
            } else {
                logger.severe("Failed to open port.");
            }
        } catch (Exception e) {
            logger.severe("An unexpected error occurred: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static String lastOutput = "";

    private static void processData(byte[] buffer, int len) {
        logger.info("Raw data: " + bytesToHex(buffer, len));
        StringBuilder output = new StringBuilder();
        for (int i = 0; i < len; i++) {
            byte b = buffer[i];
            if (b == 0x2e) { // Start of a command
                if (i + 1 < len) {
                    byte cmd = buffer[i + 1];
                    switch (cmd) {
                        case 0x78: // GameClock and Score
                            if (i + 12 < len) {
                                output.append("GameClock/Score: ");
                                output.append(parseClockAndScore(buffer, i + 2));
                                i += 12;
                            }
                            break;
                        case 0x79: // GameClock under a minute
                            if (i + 5 < len) {
                                output.append("GameClock < 1m: ");
                                output.append(parseSubMinuteClock(buffer, i + 2));
                                i += 5;
                            }
                            break;
                        case 0x7a: // Penalty clock
                            if (i + 13 < len) {
                                output.append("Penalty Clock: ");
                                output.append(parsePenaltyClock(buffer, i + 2));
                                i += 13;
                            }
                            break;
                        case 0x7e: // Penalty player numbers
                            if (i + 9 < len) {
                                output.append("Penalty Players: ");
                                output.append(parsePenaltyPlayers(buffer, i + 2));
                                i += 9;
                            }
                            break;
                    }
                }
            }
        }
        String currentOutput = output.toString();
        if (!currentOutput.equals(lastOutput)) {
            System.out.println(currentOutput);
            lastOutput = currentOutput;
        }
    }

    private static String parseClockAndScore(byte[] buffer, int offset) {
        int homeScore = bcdToInt(buffer[offset], buffer[offset + 1]);
        int awayScore = bcdToInt(buffer[offset + 2], buffer[offset + 3]);
        int minutes = bcdToInt(buffer[offset + 4], buffer[offset + 5]);
        int seconds = bcdToInt(buffer[offset + 6], buffer[offset + 7]);
        int period = bcdToInt(buffer[offset + 8]);
        return String.format("Home: %d, Away: %d, Time: %02d:%02d, Period: %d", homeScore, awayScore, minutes, seconds, period);
    }

    private static String parseSubMinuteClock(byte[] buffer, int offset) {
        int seconds = bcdToInt(buffer[offset], buffer[offset + 1]);
        int tenths = bcdToInt(buffer[offset + 2]);
        return String.format("Time: %02d.%d", seconds, tenths);
    }

    private static String parsePenaltyClock(byte[] buffer, int offset) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 4; i++) {
            int penaltyOffset = offset + i * 3;
            if (buffer[penaltyOffset] != ZERO_VALUE_EMPTY) {
                int minutes = bcdToInt(buffer[penaltyOffset]);
                int seconds = bcdToInt(buffer[penaltyOffset + 1], buffer[penaltyOffset + 2]);
                sb.append(String.format("P%d: %d:%02d ", i + 1, minutes, seconds));
            }
        }
        return sb.toString();
    }

    private static String parsePenaltyPlayers(byte[] buffer, int offset) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 4; i++) {
            int playerOffset = offset + i * 2;
            if (buffer[playerOffset] != ZERO_VALUE_EMPTY) {
                int playerNumber = bcdToInt(buffer[playerOffset], buffer[playerOffset + 1]);
                sb.append(String.format("P%d: #%d ", i + 1, playerNumber));
            }
        }
        return sb.toString();
    }

    private static int bcdToInt(byte b) {
        return (b >> 4) * 10 + (b & 0x0F);
    }

    private static int bcdToInt(byte b1, byte b2) {
        return bcdToInt(b1) * 100 + bcdToInt(b2);
    }

    private static String bytesToHex(byte[] bytes, int len) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < len; i++) {
            sb.append(String.format("%02X ", bytes[i]));
        }
        return sb.toString();
    }
}
