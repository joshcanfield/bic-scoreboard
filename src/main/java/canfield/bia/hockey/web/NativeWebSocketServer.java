package canfield.bia.hockey.web;

import canfield.bia.hockey.GameConfig;
import canfield.bia.hockey.Goal;
import canfield.bia.hockey.Penalty;
import canfield.bia.hockey.SimpleGameManager;
import canfield.bia.hockey.Team;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Minimal native WebSocket server that mirrors the Socket.IO event API using JSON messages: - Client
 * -> Server: {"event": "goal", "data": {"team":"home"}} - Server -> Client: {"event": "update",
 * "data": { ... state ... }}
 */
public class NativeWebSocketServer extends WebSocketServer {
  private static final Logger log = LoggerFactory.getLogger(NativeWebSocketServer.class);

  private final SimpleGameManager gameManager;
  private final ObjectMapper mapper = new ObjectMapper();
  private final Set<WebSocket> clients = Collections.newSetFromMap(new ConcurrentHashMap<>());
  private final ScheduledExecutorService scheduler =
      Executors.newSingleThreadScheduledExecutor(
          r -> {
            Thread t = new Thread(r, "ws-broadcast");
            t.setDaemon(true);
            return t;
          });

  public NativeWebSocketServer(SimpleGameManager gameManager, int port) {
    super(new InetSocketAddress(port));
    this.gameManager = gameManager;
  }

  @Override
  public void onOpen(WebSocket conn, ClientHandshake handshake) {
    clients.add(conn);
    log.debug("WS open: {}", conn.getRemoteSocketAddress());
    // send initial state
    try {
      Object updateData = buildUpdate();
      String currentUpdateJson = mapper.writeValueAsString(updateData);
      lastUpdateJson = currentUpdateJson;
      Map<String, Object> message = new HashMap<>();
      message.put("changed", true);
      message.put("data", updateData);
      sendJson(conn, "update", message);
    } catch (Exception ignored) {
    }
  }

  @Override
  public void onClose(WebSocket conn, int code, String reason, boolean remote) {
    clients.remove(conn);
    log.debug("WS close: {} reason={}", conn.getRemoteSocketAddress(), reason);
  }

  @Override
  public void onMessage(WebSocket conn, String message) {
    try {
      Map<String, Object> msg = mapper.readValue(message, new TypeReference<Map<String, Object>>() {});
      String event = (String) msg.get("event");
      Object data = msg.get("data");
      handleEvent(event, data);
    } catch (Exception e) {
      log.warn("WS message parse error: {}", e.getMessage());
    }
  }

  @Override
  public void onError(WebSocket conn, Exception ex) {
    log.warn("WS error: {}", ex.getMessage());
  }

  private String lastUpdateJson = "";

  @Override
  public void onStart() {
    log.info("Native WebSocket server started on {}", getAddress());
    // periodic updates (4 Hz) matching legacy behavior
    scheduler.scheduleAtFixedRate(
        () -> {
          try {
            Object updateData = buildUpdate();
            String currentUpdateJson = mapper.writeValueAsString(updateData);
            boolean changed = !currentUpdateJson.equals(lastUpdateJson);

            Map<String, Object> message = new HashMap<>();
            message.put("changed", changed);

            if (changed) {
              lastUpdateJson = currentUpdateJson;
              message.put("data", updateData);
            }
            broadcastJson("update", message);

          } catch (Exception ignored) {
          }
        },
        250,
        250,
        TimeUnit.MILLISECONDS);
  }

  public void shutdown() {
    try {
      scheduler.shutdownNow();
    } catch (Exception ignored) {
    }
    try {
      stop();
    } catch (Exception ignored) {
    }
  }

  private void handleEvent(String event, Object dataObj) {
    try {
      if ("clock_start".equals(event)) {
        gameManager.startClock();
      } else if ("clock_pause".equals(event)) {
        gameManager.stopClock();
      } else if ("goal".equals(event)) {
        Map<String, Object> data =
            mapper.convertValue(dataObj, new TypeReference<Map<String, Object>>() {});
        Object teamValue = data.get("team");
        if (teamValue != null) {
          Team team = Team.valueOf(String.valueOf(teamValue));
          Goal goal = new Goal();
          Object player = data.get("player");
          if (player != null) {
            try {
              goal.setPlayerNumber(Integer.parseInt(String.valueOf(player)));
            } catch (NumberFormatException ignored) {
              // ignore invalid value to preserve backward compatibility
            }
          }
          Object assist = data.get("assist");
          if (assist != null) {
            try {
              goal.setPrimaryAssistNumber(Integer.parseInt(String.valueOf(assist)));
            } catch (NumberFormatException ignored) {
              // ignore invalid value to preserve backward compatibility
            }
          }
          Object secondary = data.get("secondaryAssist");
          if (secondary != null) {
            try {
              goal.setSecondaryAssistNumber(Integer.parseInt(String.valueOf(secondary)));
            } catch (NumberFormatException ignored) {
              // ignore invalid value to preserve backward compatibility
            }
          }
          gameManager.addGoal(team, goal);
        }
      } else if ("undo_goal".equals(event)) {
        Map<String, Object> data =
            mapper.convertValue(dataObj, new TypeReference<Map<String, Object>>() {});
        Object teamValue = data.get("team");
        if (teamValue != null) {
          Team team = Team.valueOf(String.valueOf(teamValue));
          gameManager.removeLastGoal(team);
        }
      } else if ("shot".equals(event)) {
        Map<String, String> data =
            mapper.convertValue(dataObj, new TypeReference<Map<String, String>>() {});
        Team team = Team.valueOf(data.get("team"));
        gameManager.addShot(team);
      } else if ("undo_shot".equals(event)) {
        Map<String, String> data =
            mapper.convertValue(dataObj, new TypeReference<Map<String, String>>() {});
        Team team = Team.valueOf(data.get("team"));
        gameManager.removeShot(team);
      } else if ("set_period".equals(event)) {
        Map<String, Integer> data =
            mapper.convertValue(dataObj, new TypeReference<Map<String, Integer>>() {});
        Integer p = data.get("period");
        if (p != null) gameManager.setPeriod(p);
      } else if ("buzzer".equals(event)) {
        gameManager.playBuzzer(1000);
      } else if ("power".equals(event)) {
        // Backward-compat toggle
        boolean running = gameManager.updatesRunning();
        if (running) gameManager.stopUpdates();
        else gameManager.startUpdates();
        HashMap<String, Object> out = new HashMap<>();
        out.put("scoreboardOn", gameManager.updatesRunning());
        broadcastJson("power", out);
      } else if ("power_on".equals(event)) {
        if (!gameManager.updatesRunning()) gameManager.startUpdates();
        HashMap<String, Object> out = new HashMap<>();
        out.put("scoreboardOn", gameManager.updatesRunning());
        broadcastJson("power", out);
      } else if ("power_off".equals(event)) {
        if (gameManager.updatesRunning()) gameManager.stopUpdates();
        HashMap<String, Object> out = new HashMap<>();
        out.put("scoreboardOn", gameManager.updatesRunning());
        broadcastJson("power", out);
      } else if ("power_state".equals(event)) {
        HashMap<String, Object> out = new HashMap<>();
        out.put("scoreboardOn", gameManager.updatesRunning());
        broadcastJson("power", out);
      } else if ("createGame".equals(event)) {
        // Defensive Map-based parsing to respect 0 values and avoid type erasure issues
        Map<String, Object> data =
            mapper.convertValue(dataObj, new TypeReference<Map<String, Object>>() {});

        // Mutate the injected GameConfig instance in place
        GameConfig cfg = gameManager.getGameConfigInstance();

        // Period lengths
        if (data.containsKey("periodLengths")) {
          try {
            Object pl = data.get("periodLengths");
            if (pl instanceof Iterable) {
              java.util.ArrayList<Integer> list = new java.util.ArrayList<>();
              for (Object o : (Iterable<?>) pl) {
                if (o == null) continue;
                if (o instanceof Number) list.add(((Number) o).intValue());
                else list.add(Integer.parseInt(String.valueOf(o)));
              }
              cfg.setPeriodLengths(list);
              gameManager.getScoreBoard().setPeriodLength(list);
            }
          } catch (Exception ex) {
            log.warn("WS createGame: invalid periodLengths: {}", ex.getMessage());
          }
        }

        // Intermission minutes (respect explicit 0)
        if (data.containsKey("intermissionDurationMinutes")) {
          try {
            Object im = data.get("intermissionDurationMinutes");
            Integer minutes =
                (im instanceof Number)
                    ? ((Number) im).intValue()
                    : Integer.parseInt(String.valueOf(im));
            cfg.setIntermissionDurationMinutes(minutes);
          } catch (Exception ex) {
            log.warn("WS createGame: invalid intermission: {}", ex.getMessage());
          }
        }

        // Buzzer interval (optional)
        if (data.containsKey("buzzerIntervalSeconds")) {
          try {
            Object bi = data.get("buzzerIntervalSeconds");
            Integer seconds =
                (bi instanceof Number)
                    ? ((Number) bi).intValue()
                    : Integer.parseInt(String.valueOf(bi));
            cfg.setBuzzerIntervalSeconds(seconds);
            gameManager.setShiftLengthSeconds(seconds);
          } catch (Exception ex) {
            log.warn("WS createGame: invalid buzzerIntervalSeconds: {}", ex.getMessage());
          }
        }

        gameManager.reset();
      }
    } catch (Exception e) {
      log.warn("WS event handling error: {}", e.getMessage());
    }
  }

  private void sendJson(WebSocket conn, String event, Object data) {
    try {
      Map<String, Object> out = new HashMap<>();
      out.put("event", event);
      out.put("data", data);
      conn.send(mapper.writeValueAsString(out));
    } catch (Exception ignored) {
    }
  }

  private void broadcastJson(String event, Object data) {
    for (WebSocket c : clients) {
      if (c != null && c.isOpen()) sendJson(c, event, data);
    }
  }

  private Object buildUpdate() {
    return buildControlViewModel();
  }

  private ControlViewModel buildControlViewModel() {
    ControlViewModel vm = new ControlViewModel();

    long time = gameManager.getRemainingTimeMillis();
    vm.clockText = formatTime(time);

    canfield.bia.hockey.scoreboard.ScoreBoard.GameState gameState =
        gameManager.getScoreBoard().getGameState();
    int periodLengthMinutes =
        (gameState == canfield.bia.hockey.scoreboard.ScoreBoard.GameState.INTERMISSION)
            ? gameManager.getIntermissionDurationMinutes()
            : gameManager.getPeriodLength();
    long periodLengthMillis = periodLengthMinutes * 60 * 1000;

    if (periodLengthMillis <= 0) {
      vm.elapsedText = "&nbsp;";
    } else {
      long elapsed = Math.max(0, periodLengthMillis - time);
      long minutes = elapsed / 60000;
      long seconds = (elapsed / 1000) % 60;
      String minutePart = minutes > 0 ? minutes + " minute" + (minutes == 1 ? "" : "s") : "";
      String secondPart = seconds + " seconds";
      if (minutePart.isEmpty()) {
        vm.elapsedText = secondPart;
      } else {
        vm.elapsedText = minutePart + " and " + secondPart;
      }
    }

    vm.periodText = String.valueOf(gameManager.getPeriod());
    vm.homeScoreText = String.format("%02d", gameManager.getScore(Team.home));
    vm.awayScoreText = String.format("%02d", gameManager.getScore(Team.away));
    vm.homeShotsText = String.valueOf(gameManager.getShots(Team.home));
    vm.awayShotsText = String.valueOf(gameManager.getShots(Team.away));
    vm.scoreboardOn = gameManager.updatesRunning();
    vm.buzzerOn = gameManager.isBuzzerOn();

    vm.homePenalties =
        gameManager.getPenalties(Team.home).stream()
            .filter(
                p -> {
                  int elapsed = p.getElapsed();
                  int remaining =
                      p.getStartTime() > 0 ? Math.max(0, p.getTime() - elapsed) : p.getTime();
                  return remaining > 0;
                })
            .map(p -> new PenaltyViewModel(Team.home, p))
            .collect(Collectors.toList());

    vm.awayPenalties =
        gameManager.getPenalties(Team.away).stream()
            .filter(
                p -> {
                  int elapsed = p.getElapsed();
                  int remaining =
                      p.getStartTime() > 0 ? Math.max(0, p.getTime() - elapsed) : p.getTime();
                  return remaining > 0;
                })
            .map(p -> new PenaltyViewModel(Team.away, p))
            .collect(Collectors.toList());

    vm.homeGoals = new ArrayList<>(gameManager.getGoals(Team.home));
    vm.awayGoals = new ArrayList<>(gameManager.getGoals(Team.away));

    return vm;
  }

  private String formatTime(long millis) {
    long minutes = millis / 60000;
    long seconds = (millis / 1000) % 60;
    return String.format("%02d:%02d", minutes, seconds);
  }
}
