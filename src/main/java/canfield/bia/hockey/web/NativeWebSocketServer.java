package canfield.bia.hockey.web;

import canfield.bia.hockey.GameConfig;
import canfield.bia.hockey.SimpleGameManager;
import canfield.bia.hockey.Team;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.codehaus.jackson.map.ObjectMapper;
import org.codehaus.jackson.type.TypeReference;

import java.net.InetSocketAddress;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Minimal native WebSocket server that mirrors the Socket.IO event API using JSON messages:
 * - Client -> Server: {"event": "goal", "data": {"team":"home"}}
 * - Server -> Client: {"event": "update", "data": { ... state ... }}
 */
public class NativeWebSocketServer extends WebSocketServer {
    private static final Logger log = LoggerFactory.getLogger(NativeWebSocketServer.class);

    private final SimpleGameManager gameManager;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Set<WebSocket> clients = Collections.newSetFromMap(new ConcurrentHashMap<>());
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public NativeWebSocketServer(SimpleGameManager gameManager, int port) {
        super(new InetSocketAddress(port));
        this.gameManager = gameManager;
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        clients.add(conn);
        log.debug("WS open: {}", conn.getRemoteSocketAddress());
        // send initial state
        sendJson(conn, "update", buildUpdate());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        clients.remove(conn);
        log.debug("WS close: {} reason={}", conn.getRemoteSocketAddress(), reason);
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        try {
            Map<String, Object> msg = mapper.readValue(message, new TypeReference<Map<String, Object>>(){});
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

    @Override
    public void onStart() {
        log.info("Native WebSocket server started on {}", getAddress());
        // periodic updates (4 Hz) matching legacy behavior
        scheduler.scheduleAtFixedRate(() -> {
            try { broadcastJson("update", buildUpdate()); } catch (Exception ignored) {}
        }, 250, 250, TimeUnit.MILLISECONDS);
    }

    public void shutdown() {
        try { scheduler.shutdownNow(); } catch (Exception ignored) {}
        try { stop(); } catch (Exception ignored) {}
    }

    private void handleEvent(String event, Object dataObj) {
        try {
            if ("clock_start".equals(event)) {
                gameManager.startClock();
            } else if ("clock_pause".equals(event)) {
                gameManager.stopClock();
            } else if ("goal".equals(event)) {
                Map<String, String> data = mapper.convertValue(dataObj, new TypeReference<Map<String, String>>(){});
                Team team = Team.valueOf(data.get("team"));
                gameManager.setScore(team, gameManager.getScore(team) + 1);
            } else if ("undo_goal".equals(event)) {
                Map<String, String> data = mapper.convertValue(dataObj, new TypeReference<Map<String, String>>(){});
                Team team = Team.valueOf(data.get("team"));
                gameManager.setScore(team, gameManager.getScore(team) - 1);
            } else if ("set_period".equals(event)) {
                Map<String, Integer> data = mapper.convertValue(dataObj, new TypeReference<Map<String, Integer>>(){});
                Integer p = data.get("period");
                if (p != null) gameManager.setPeriod(p);
            } else if ("buzzer".equals(event)) {
                gameManager.playBuzzer(1000);
            } else if ("power".equals(event)) {
                // Backward-compat toggle
                boolean running = gameManager.updatesRunning();
                if (running) gameManager.stopUpdates(); else gameManager.startUpdates();
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
                GameConfig cfg = mapper.convertValue(dataObj, GameConfig.class);
                gameManager.getScoreBoard().setPeriodLength(cfg.getPeriodLengths());
                gameManager.setShiftLengthSeconds(cfg.getBuzzerIntervalSeconds());
                gameManager.reset();
                if (gameManager.getPeriodLength() == 0) {
                    gameManager.setPeriod(1);
                }
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
        } catch (Exception ignored) {}
    }

    private void broadcastJson(String event, Object data) {
        for (WebSocket c : clients) {
            if (c != null && c.isOpen()) sendJson(c, event, data);
        }
    }

    private Object buildUpdate() {
        final HashMap<String, Object> state = new HashMap<>();
        state.put("time", gameManager.getRemainingTimeMillis());
        state.put("running", gameManager.isClockRunning());
        state.put("period", gameManager.getPeriod());
        state.put("periodLength", gameManager.getPeriodLength());
        state.put("scoreboardOn", gameManager.updatesRunning());
        state.put("buzzerOn", gameManager.isBuzzerOn());

        for (Team team : Team.values()) {
            final HashMap<String, Object> o = new HashMap<>();
            o.put("score", gameManager.getScore(team));
            o.put("penalties", gameManager.getPenalties(team));
            state.put(team.name(), o);
        }
        return state;
    }
}
