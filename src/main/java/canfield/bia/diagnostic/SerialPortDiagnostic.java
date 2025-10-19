package canfield.bia.diagnostic;

import purejavacomm.CommPortIdentifier;

import java.util.Enumeration;

/**
 * Standalone diagnostic utility for troubleshooting serial port detection issues.
 * Run this to test if PureJavaComm can detect COM ports on your system.
 *
 * Usage:
 *   java -cp &lt;classpath&gt; canfield.bia.diagnostic.SerialPortDiagnostic
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
    System.out.println("PureJavaComm Configuration:");
    System.out.println("  java.library.path:       " + System.getProperty("java.library.path"));
    System.out.println("  purejavacomm.porttypes:  " + System.getProperty("purejavacomm.porttypes", "(not set)"));
    System.out.println("  purejavacomm.pollstrategy: " + System.getProperty("purejavacomm.pollstrategy", "(not set)"));
    System.out.println();
  }

  private static void scanSerialPorts() {
    System.out.println("Scanning for Serial Ports...");
    System.out.println("-------------------------------------------");

    try {
      @SuppressWarnings("unchecked")
      Enumeration<CommPortIdentifier> portEnum = CommPortIdentifier.getPortIdentifiers();

      int totalPorts = 0;
      int serialPorts = 0;

      while (portEnum.hasMoreElements()) {
        CommPortIdentifier portId = portEnum.nextElement();
        totalPorts++;

        String portType = getPortTypeName(portId.getPortType());
        System.out.printf("  Port %d: %s\n", totalPorts, portId.getName());
        System.out.printf("    Type: %s (%d)\n", portType, portId.getPortType());
        System.out.printf("    Currently Owned: %s\n", portId.isCurrentlyOwned() ? "Yes (by " + portId.getCurrentOwner() + ")" : "No");

        if (portId.getPortType() == CommPortIdentifier.PORT_SERIAL) {
          serialPorts++;
          System.out.println("    ** This is a SERIAL port **");
        }
        System.out.println();
      }

      System.out.println("-------------------------------------------");
      System.out.println("Summary:");
      System.out.println("  Total ports found:  " + totalPorts);
      System.out.println("  Serial ports found: " + serialPorts);

      if (totalPorts == 0) {
        System.out.println("\n*** WARNING: No ports detected! ***");
        System.out.println("Possible causes:");
        System.out.println("  1. No serial ports or USB-to-serial adapters connected");
        System.out.println("  2. PureJavaComm native library failed to load");
        System.out.println("  3. Insufficient permissions (try running as Administrator)");
        System.out.println("  4. PureJavaComm configuration issue");
        System.out.println("\nTroubleshooting steps:");
        System.out.println("  1. Check Windows Device Manager for COM ports");
        System.out.println("  2. Try setting -Dpurejavacomm.porttypes=WindowsRegistry");
        System.out.println("  3. Run this tool as Administrator");
        System.out.println("  4. Check if USB-to-serial drivers are installed");
      } else if (serialPorts == 0) {
        System.out.println("\n*** WARNING: Ports found but none are serial ports ***");
        System.out.println("This usually means parallel ports or other non-serial ports were detected.");
      } else {
        System.out.println("\n*** SUCCESS: Serial ports detected! ***");
        System.out.println("Your system should be able to communicate with the scoreboard.");
      }

    } catch (UnsatisfiedLinkError e) {
      System.err.println("\n*** ERROR: Failed to load PureJavaComm native library ***");
      System.err.println("Error: " + e.getMessage());
      System.err.println("\nThis usually means:");
      System.err.println("  1. The native DLL is missing or incompatible");
      System.err.println("  2. The library path is not set correctly");
      System.err.println("  3. Architecture mismatch (32-bit vs 64-bit)");
      e.printStackTrace();
    } catch (Exception e) {
      System.err.println("\n*** ERROR: Unexpected error during port scanning ***");
      System.err.println("Error: " + e.getMessage());
      e.printStackTrace();
    }
  }

  private static String getPortTypeName(int portType) {
    switch (portType) {
      case CommPortIdentifier.PORT_SERIAL:
        return "Serial Port";
      case CommPortIdentifier.PORT_PARALLEL:
        return "Parallel Port";
      default:
        return "Unknown";
    }
  }
}
