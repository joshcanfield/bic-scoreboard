# Quick Reference: Debugging Serial Ports in the Field

## Tools Added

I've added comprehensive debugging tools to help diagnose serial port detection issues on Windows deployments:

### 1. **Web Diagnostics Endpoint** (Easiest)
   - URL: `http://localhost:8080/api/game/diagnostics`
   - Shows: OS info, Java version, library paths, and detected ports
   - **Use this first** - no command line needed!

### 2. **Command Line Diagnostic Tool**

   **Option A: Windows Batch Script (Simple)**
   ```cmd
   cd <scoreboard-install-directory>
   bin\diagnose-ports.bat
   ```

   **Option B: PowerShell Script (More detailed)**
   ```powershell
   cd <scoreboard-install-directory>
   powershell -ExecutionPolicy Bypass -File bin\diagnose-ports.ps1
   ```

   **Option C: Direct Java Invocation**
   ```cmd
   java -cp scoreboard-2.0-all.jar canfield.bia.diagnostic.SerialPortDiagnostic
   ```

### 3. **Enhanced Logging**
   - Logs are now enabled by default in `logs/scoreboard.log`
   - Look for lines like: `Port enumeration complete: X total ports, Y serial ports`
   - Shows which ports were found and why they were included/excluded

## Common Field Scenarios

### Scenario 1: No Ports Showing Up

**Steps:**
1. Run `bin\diagnose-ports.bat`
2. Check if Windows Device Manager shows COM ports:
   - Press `Win + X` → Device Manager
   - Look under "Ports (COM & LPT)"
3. If Device Manager shows ports but app doesn't:
   - Try running as Administrator
   - Check USB-to-Serial driver is installed
   - Try setting `-Dpurejavacomm.porttypes=WindowsRegistry`

### Scenario 2: Port Shows Up but Can't Connect

**Steps:**
1. Visit `http://localhost:8080/api/game/diagnostics`
2. Verify `currentPort` matches the port from Device Manager
3. Check `logs/scoreboard.log` for connection errors
4. Try manually setting the port name in the config file

### Scenario 3: Intermittent Port Detection

**Steps:**
1. Check USB cable/connection
2. Disable USB power management in Windows
3. Try a different USB port
4. Check `logs/scoreboard.log` for pattern of connection/disconnection

## What Changed

### Code Changes

1. **ScoreboardAdapterImpl.java:63-84**
   - Added detailed logging to port enumeration
   - Logs system properties that affect port detection
   - Reports total ports found vs serial ports

2. **GameResource.java:126-147**
   - New `/api/game/diagnostics` endpoint
   - Returns comprehensive system and port information

3. **logback.xml:26-30**
   - Enabled DEBUG logging for ScoreboardAdapterImpl
   - Can be changed to TRACE for even more detail

### New Files

1. **SerialPortDiagnostic.java**
   - Standalone diagnostic utility
   - Tests PureJavaComm without running the full app
   - Provides troubleshooting suggestions

2. **bin/diagnose-ports.bat**
   - Windows batch script for easy diagnostics
   - Automatically finds JAR and runs diagnostic

3. **bin/diagnose-ports.ps1**
   - PowerShell script with Windows registry checking
   - Compares Windows Device Manager vs Java detection

4. **TROUBLESHOOTING-SERIAL-PORTS.md**
   - Complete troubleshooting guide
   - Covers common issues and fixes
   - Technical background on PureJavaComm

## Remote Debugging

If you're helping someone remotely:

1. **Ask them to visit:** `http://localhost:8080/api/game/diagnostics`
2. **Have them copy/paste the JSON output**
3. **Ask for screenshot of:** Windows Device Manager → Ports (COM & LPT)
4. **Request:** Last 50 lines of `logs/scoreboard.log`

This gives you everything you need to diagnose the issue!

## Testing the Fix

After deploying these changes:

```cmd
# Build new package
./gradlew jpackageFullJre appImageZip

# The zip will be in: build/artifacts/scoreboard-2.0-app-image.zip

# Extract and test on Windows machine
# Run: bin\diagnose-ports.bat
```

## Expected Output

**Working system:**
```
Port enumeration complete: 1 total ports, 1 serial ports
Added serial port: COM3
```

**Not working:**
```
Port enumeration complete: 0 total ports, 0 serial ports
```

If you see `0 total ports`, see TROUBLESHOOTING-SERIAL-PORTS.md for fixes.
