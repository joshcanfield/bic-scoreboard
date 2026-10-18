package canfield.bia.hockey.scoreboard.io;

import com.fazecast.jSerialComm.SerialPort;
import org.junit.jupiter.api.Test;

/**
 * Quick test to verify com0com virtual ports are connected.
 * Run with: ./gradlew test --tests "*Com0ComConnectionTest"
 */
class Com0ComConnectionTest {

    @Test
    void testCom0ComPortsConnected() throws Exception {
        SerialPort port10 = SerialPort.getCommPort("COM10");
        SerialPort port11 = SerialPort.getCommPort("COM11");

        try {
            if (!port10.openPort()) {
                System.out.println("ERROR: Failed to open COM10");
                System.out.println("Available ports: ");
                for (SerialPort p : SerialPort.getCommPorts()) {
                    System.out.println("  - " + p.getSystemPortName());
                }
                return;
            }
            if (!port11.openPort()) {
                System.out.println("ERROR: Failed to open COM11");
                port10.closePort();
                return;
            }

            System.out.println("Both ports opened successfully");

            // Send test data from COM10
            byte[] testData = "HELLO".getBytes();
            port10.writeBytes(testData, testData.length);
            System.out.println("Sent 'HELLO' on COM10");

            // Wait and try to read from COM11
            Thread.sleep(200);

            int available = port11.bytesAvailable();
            System.out.println("Bytes available on COM11: " + available);

            if (available > 0) {
                byte[] buffer = new byte[available];
                port11.readBytes(buffer, available);
                System.out.println("Received on COM11: '" + new String(buffer) + "'");
                System.out.println("SUCCESS: com0com ports ARE connected!");
            } else {
                System.out.println("FAILED: No data received");
                System.out.println("The COM10 and COM11 ports exist but are NOT paired.");
                System.out.println("");
                System.out.println("To fix this, run as Administrator:");
                System.out.println("  cd \"C:\\Program Files (x86)\\com0com\"");
                System.out.println("  .\\setupc.exe install PortName=COM10 PortName=COM11");
            }
        } finally {
            port10.closePort();
            port11.closePort();
        }
    }
}
