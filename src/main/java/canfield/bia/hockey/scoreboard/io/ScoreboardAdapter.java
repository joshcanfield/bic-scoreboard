package canfield.bia.hockey.scoreboard.io;

import java.util.List;

/**
 *
 */
public interface ScoreboardAdapter {
  String getPortName();

  void setPortName(String portName);

  void start();

  void stop();

  boolean isRunning();

  boolean isBuzzerOn();

  List<String> possiblePorts();
}
