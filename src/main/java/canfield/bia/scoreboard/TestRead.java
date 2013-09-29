package canfield.bia.scoreboard;

import purejavacomm.*;

import java.io.IOException;
import java.io.InputStream;
import java.util.Enumeration;
import java.util.TooManyListenersException;

/**
 *
 */
public class TestRead {

    public static void main(String[] args) {
        PortReader portReader = new PortReader();
        portReader.start();

        try {
            // The main loop listens to the keyboard for a key
            while (true) {
                try {
                    int read = System.in.read();
                    if (read == 'q') {
                        break;
                    }
                } catch (IOException e) {
                    System.out.println("Ignoring io exception");
                }
            }

        } finally {
            portReader.close();
        }

    }


    private static int read(byte[] bytes, InputStream in) {
        int read;
        try {
            read = in.read(bytes);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        return read;
    }

    private static int available(InputStream in) {
        try {
            return in.available();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private static CommPortIdentifier getPortId() {
        CommPortIdentifier portid = null;
        Enumeration e = CommPortIdentifier.getPortIdentifiers();
        while (e.hasMoreElements()) {
            portid = (CommPortIdentifier) e.nextElement();
            if (portid.getName().equals("tty.usbserial")) {
                System.out.println("Found port");
                break;
            }
        }
        return portid;
    }

    private static class PortReader {
        SerialPort port;

        public void start() {
            // ScoreBoard scoreBoard = new ScoreBoard();
            final CommPortIdentifier portId = getPortId();
            if (portId == null) return;

            try {
                port = (SerialPort) portId.open("BIA Scoreboard", 1000);
            } catch (PortInUseException e) {
                e.printStackTrace();
                throw new RuntimeException("Failed to get the port!");
            }

            try {
                handle(port);
            } catch (UnsupportedCommOperationException e) {
                e.printStackTrace();
            }
        }

        public void close() {
            if (port != null) port.close();
        }

        private void handle(SerialPort port) throws UnsupportedCommOperationException {
//            jtermios.JTermios.JTermiosLogging.setLogLevel(4);

            port.notifyOnDataAvailable(true);
            port.setFlowControlMode(SerialPort.FLOWCONTROL_NONE);
            port.setDTR(true);
            port.setRTS(true);

            final InputStream in;
            try {
                in = port.getInputStream();
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
            try {
                port.addEventListener(new SerialPortEventListener() {
                    final byte[] buffer = new byte[10000];
                    int offset = 0;
                    boolean inMessage = false;
                    public long last = 0;
                    // 0x78 set scoreboard
                    // 0x79 scoreboard under a minute
                    // 0x7a set penalty time
                    // 0x7b ?
                    // 0x7c ?
                    // 0x7d ?
                    // 0x7e set penalty player number

                    @Override
                    public void serialEvent(SerialPortEvent event) {
                        if (event.getEventType() == SerialPortEvent.DATA_AVAILABLE) {
                            int available = available(in);

                            byte[] bytes = new byte[available];
                            int read;
                            read = read(bytes, in);
                            for (int i = 0; i < read; ++i) {
                                // messages start with a 2e
                                byte b = bytes[i];
                                if (b == 0x2e) {
                                    if (offset != 0) {
                                        long now = System.currentTimeMillis();
                                        long elapsed = now - last;
                                        last = now;
                                        System.out.printf("%04d: ", elapsed);
                                        for (int j = 0; j < offset; ++j) {
                                            System.out.printf("%02x ", buffer[j]);
                                        }
                                        System.out.print("\n");
                                        offset = 0;
                                    }
                                }
                                buffer[offset++] = b;
                            }
                        }
                    }
                });

            } catch (TooManyListenersException e) {
                throw new RuntimeException(e);
            }
        }
    }
}
