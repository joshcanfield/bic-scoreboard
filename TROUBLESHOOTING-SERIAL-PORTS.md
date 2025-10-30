# Serial Port Troubleshooting Guide (Windows)

## Quick Diagnosis

### Step 1: Check Diagnostics Endpoint
Open your browser and navigate to:
```
http://localhost:8080/api/game/diagnostics
```

This will show:
- Operating system details
- Java version
- Available serial ports
- Current configuration

**Expected Result**: You should see COM ports listed in `availablePorts` if jSerialComm is working correctly.

### Step 2: Check Windows Device Manager
1. Press `Win + X` and select "Device Manager"
2. Expand "Ports (COM & LPT)"
3. Note which COM ports are listed (e.g., COM1, COM3, etc.)

**If you see ports in Device Manager but not in the diagnostics endpoint, proceed to Common Fixes below.**

### Step 3: Check Application Logs
Look in the `logs/scoreboard.log` file for messages like:
```
Port enumeration complete: X total ports, Y serial ports
```

If you see `0 total ports`, jSerialComm is not detecting any ports.

## Common Fixes

### Fix 1: Check USB Driver Installation
Many USB-to-Serial adapters require specific drivers:

1. **FTDI Chips**: Download from https://ftdichip.com/drivers/
2. **Prolific (PL2303)**: Download from http://www.prolific.com.tw/
3. **CH340/CH341**: Search for "CH340 driver Windows"

After installing drivers:
1. Restart the application
2. Check Device Manager again
3. Verify the COM port appears

### Fix 4: Use a Specific COM Port
If you know your scoreboard is on COM3, you can manually set it in the config:

1. Edit `scoreboard.properties` file:
   ```
   scoreboard.commport=COM3
   ```
2. Or use the web UI to manually enter "COM3"

### Fix 5: Run as Administrator
Some Windows systems require elevated privileges to enumerate ports:

1. Right-click the scoreboard application
2. Select "Run as administrator"
3. Check if ports appear now

## Detailed Diagnostics

### Enable TRACE Logging
For maximum diagnostic output:

1. Edit `conf/logback.xml`
2. Change this line:
   ```xml
   <logger name="canfield.bia.hockey.scoreboard.io.ScoreboardAdapterImpl" level="DEBUG"/>
   ```
   to:
   ```xml
   <logger name="canfield.bia.hockey.scoreboard.io.ScoreboardAdapterImpl" level="TRACE"/>
   ```
3. Restart the application
4. Check `logs/scoreboard.log` for detailed port scanning information

### Check jSerialComm Native Library
jSerialComm needs to load a native DLL on Windows. Check the log for errors like:
```
UnsatisfiedLinkError
```

If you see this:
1. The bundled native library may be incompatible with your Windows version
2. Try reinstalling the application
3. Ensure you're using a 64-bit Java if Windows is 64-bit

### Test with Simple Java Program
Create a test file `TestPorts.java`:

```java
import com.fazecast.jSerialComm.SerialPort;

public class TestPorts {
    public static void main(String[] args) {
        System.out.println("Java version: " + System.getProperty("java.version"));
        System.out.println("OS: " + System.getProperty("os.name"));
        System.out.println("\nScanning for ports...");

        SerialPort[] ports = SerialPort.getCommPorts();
        int count = 0;
        for (SerialPort port : ports) {
            System.out.println("Found: " + port.getSystemPortName() + " (" + port.getDescriptivePortName() + ")");
            count++;
        }
        System.out.println("\nTotal ports found: " + count);
    }
}
```

Compile and run:
```bash
javac -cp jSerialComm-2.10.4.jar TestPorts.java
java -cp .;jSerialComm-2.10.4.jar TestPorts
```

This isolates whether the issue is with jSerialComm or the application.

## Known Issues

### Issue: USB-to-Serial Adapter Not Recognized
**Solution**: Many cheap USB-to-Serial adapters have counterfeit chips with driver issues. Try a different adapter from a reputable brand (FTDI, StarTech, etc.).

### Issue: Bluetooth Serial Ports Show Up
**Symptom**: You see ports like "COM4", "COM5" but they're Bluetooth adapters
**Solution**: Disable Bluetooth serial ports in Device Manager, or note the correct COM port number from Device Manager and manually configure it.

### Issue: Ports Appear and Disappear
**Symptom**: Ports show up intermittently
**Solution**:
1. Check USB cable connection
2. Try a different USB port
3. Check Windows USB power management settings (disable "allow computer to turn off this device")

## Getting Help

When reporting a serial port issue, please include:

1. Output from `http://localhost:8080/api/game/diagnostics`
2. Screenshot of Device Manager showing COM ports
3. Contents of `logs/scoreboard.log` (last 100 lines)
4. USB-to-Serial adapter model/chipset if known
5. Windows version (run `winver` command)

## Technical Background

The application uses **jSerialComm 2.10.4** for serial communication. On Windows, this library:

1.  Uses standard Windows APIs to enumerate serial ports.
2.  Bundles a native DLL that is extracted to a temporary directory (`java.io.tmpdir`).
3.  Uses JNI (Java Native Interface) to communicate with the native library.

The most common issues are permission problems with the temporary directory or driver issues with USB-to-Serial adapters.