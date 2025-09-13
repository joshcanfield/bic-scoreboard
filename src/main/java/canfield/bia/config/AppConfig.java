package canfield.bia.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Singleton;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Properties;

/**
 * Simple properties-backed configuration stored next to the executable.
 */
@Singleton
public class AppConfig {
  private static final Logger log = LoggerFactory.getLogger(AppConfig.class);

  public static final String FILE_NAME = "scoreboard.properties";
  public static final String KEY_COMM_PORT = "scoreboard.commport";

  private final File file;
  private final Properties props = new Properties();

  public AppConfig() {
    this(new File(FILE_NAME));
  }

  public AppConfig(File file) {
    this.file = file;
    load();
  }

  private void load() {
    if (!file.exists()) {
      return;
    }
    try (FileInputStream fis = new FileInputStream(file)) {
      props.load(fis);
    } catch (IOException e) {
      log.warn("Failed to load config from {}", file.getAbsolutePath(), e);
    }
  }

  private void save() {
    try (FileOutputStream fos = new FileOutputStream(file)) {
      props.store(fos, "BIA Scoreboard settings");
    } catch (IOException e) {
      log.warn("Failed to save config to {}", file.getAbsolutePath(), e);
    }
  }

  public String getCommPort() {
    String fromProps = props.getProperty(KEY_COMM_PORT);
    if (fromProps != null && !fromProps.isEmpty()) {
      return fromProps;
    }
    // Fall back to JVM property or default
    return System.getProperty(KEY_COMM_PORT, "usb.ttyserial");
  }

  public void setCommPort(String portName) {
    if (portName == null) return;
    props.setProperty(KEY_COMM_PORT, portName);
    save();
  }
}

