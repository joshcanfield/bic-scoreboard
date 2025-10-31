package canfield.bia.diagnostic;

import com.fazecast.jSerialComm.SerialPort;

/**
 * Standalone diagnostic utility for troubleshooting serial port detection issues.
 * Run this to test if jSerialComm can detect COM ports on your system.
 *
 * Usage:
 *   java -cp <classpath> canfield.bia.diagnostic.SerialPortDiagnostic
 */
public class SerialPortDiagnostic {

  public static void main(String[] args) {
    System.out.println("=== Serial Port Diagnostic Tool ===\n");

    // Print system information
    printSystemInfo();

    // Print relevant system properties
    printSystemProperties();

    // Scan for serial ports
    scanSerialPorts();

    System.out.println("\n=== Diagnostic Complete ===");
  }

  private static void printSystemInfo() {
    System.out.println("System Information:");
    System.out.println("  OS Name:        " + System.getProperty("os.name"));
    System.out.println("  OS Version:     " + System.getProperty("os.version"));
    System.out.println("  OS Architecture: " + System.getProperty("os.arch"));
    System.out.println("  Java Version:   " + System.getProperty("java.version"));
    System.out.println("  Java Vendor:    " + System.getProperty("java.vendor"));
    System.out.println("  Java Home:      " + System.getProperty("java.home"));
    System.out.println("  User Directory: " + System.getProperty("user.dir"));
    System.out.println();
  }

  private static void printSystemProperties() {
    System.out.println("jSerialComm Configuration:");
    System.out.println("  java.library.path:    " + System.getProperty("java.library.path"));
    System.out.println("  java.io.tmpdir:         " + System.getProperty("java.io.tmpdir"));
    System.out.println("  fazecast.jSerialComm.appid: " + System.getProperty("fazecast.jSerialComm.appid", "(not set)"));
    System.out.println();
  }

  private static void scanSerialPorts() {
    System.out.println("Scanning for Serial Ports...");
    System.out.println("-------------------------------------------");

    try {
      SerialPort[] ports = SerialPort.getCommPorts();

      int totalPorts = ports.length;

      for (int i = 0; i < totalPorts; i++) {
        SerialPort port = ports[i];
        System.out.printf("  Port %d: %s (%s)\n", i + 1, port.getSystemPortName(), port.getDescriptivePortName());
        System.out.printf("    Description: %s\n", port.getPortDescription());
        System.out.printf("    Location: %s\n", port.getPortLocation());
        System.out.printf("    Currently Opened: %s\n", port.isOpen() ? "Yes" : "No");
        System.out.println();
      }

      System.out.println("-------------------------------------------");
      System.out.println("Summary:");
      System.out.println("  Serial ports found: " + totalPorts);

      if (totalPorts == 0) {
        System.out.println("\n*** WARNING: No serial ports detected! ***");
        System.out.println("Possible causes:");
        System.out.println("  1. No serial ports or USB-to-serial adapters connected");
        System.out.println("  2. jSerialComm native library failed to load (check permissions on java.io.tmpdir)");
        System.out.println("  3. Insufficient permissions (try running as Administrator)");
        System.out.println("  4. Hardware or driver issue");
        System.out.println("\nTroubleshooting steps:");
        System.out.println("  1. Check Windows Device Manager for COM ports");
        System.out.println("  2. Ensure USB-to-serial drivers are installed correctly");
        System.out.println("  3. Run this tool as Administrator");
      } else {
        System.out.println("\n*** SUCCESS: Serial ports detected! ***");
        System.out.println("Your system should be able to communicate with the scoreboard.");
      }

    } catch (UnsatisfiedLinkError e) {
      System.err.println("\n*** ERROR: Failed to load jSerialComm native library ***");
      System.err.println("Error: " + e.getMessage());
      System.err.println("\nThis usually means:");
      System.err.println("  1. The native DLL is missing or incompatible");
      System.err.println("  2. The library path is not set correctly");
      System.err.println("  3. Architecture mismatch (32-bit vs 64-bit)");
      System.err.println("  4. Permission issue with the temporary directory (java.io.tmpdir)");
      e.printStackTrace();
    } catch (Exception e) {
      System.err.println("\n*** ERROR: Unexpected error during port scanning ***");
      System.err.println("Error: " + e.getMessage());
      e.printStackTrace();
    }
  }
}