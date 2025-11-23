package canfield.bia.hockey.v2.web;

import canfield.bia.hockey.v2.domain.GameState;
import canfield.bia.hockey.v2.engine.GameEngine;
import canfield.bia.hockey.v2.engine.StateDiffer;
import canfield.bia.hockey.v2.spec.Command;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.InetSocketAddress;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * WebSocket server for the new GameEngine.
 * Handles incoming commands from UI clients and broadcasts state changes.
 */
public class GameWebSocketV2 extends WebSocketServer {

    private static final Logger log = LoggerFactory.getLogger(GameWebSocketV2.class);

    private GameEngine gameEngine; // Changed to non-final
    private final StateDiffer stateDiffer;
    private final ObjectMapper objectMapper;
    private final Set<WebSocket> connections;

    public GameWebSocketV2(int port, StateDiffer stateDiffer) { // Removed GameEngine parameter
        super(new InetSocketAddress(port));
        this.stateDiffer = stateDiffer;
        this.objectMapper = new ObjectMapper();
        this.connections = Collections.synchronizedSet(new HashSet<>());

        SimpleModule module = new SimpleModule();
        module.addDeserializer(Command.class, new CommandDeserializer());
        objectMapper.registerModule(module);
    }

    public void setGameEngine(GameEngine gameEngine) {
        this.gameEngine = gameEngine;
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        connections.add(conn);
        log.info("WebSocket connection established: {}", conn.getRemoteSocketAddress());
        try {
            String initialStateJson = objectMapper.writeValueAsString(Map.of("type", "INITIAL_STATE", "data", gameEngine.getCurrentState()));
            conn.send(initialStateJson);
        } catch (Exception e) {
            System.err.println("Error sending initial state: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        connections.remove(conn);
        log.info("WebSocket closed: {} code={} reason={} remote={}", conn.getRemoteSocketAddress(), code, reason, remote);
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        log.info("Received message from {}: {}", conn.getRemoteSocketAddress(), message);
        try {
            Command command = objectMapper.readValue(message, Command.class);
            processAndBroadcast(command);
        } catch (Exception e) {
            System.err.println("Error processing message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        log.error("WebSocket error", ex);
    }

    @Override
    public void onStart() {
        System.out.println("GameWebSocketV2 started on port " + getPort());
    }

    @Override
    public void stop() throws InterruptedException {
        super.stop();
    }

    private void processAndBroadcast(Command command) {
        GameState oldState = gameEngine.getCurrentState();
        gameEngine.processCommand(command, System.currentTimeMillis());
        GameState newState = gameEngine.getCurrentState();

        // Broadcast state changes
        Map<String, Object> patch = stateDiffer.diff(oldState, newState);
        if (!patch.isEmpty()) {
            try {
                String patchJson = objectMapper.writeValueAsString(Map.of("type", "STATE_PATCH", "data", patch));
                for (WebSocket client : connections) {
                    client.send(patchJson);
                }
            } catch (Exception e) {
                System.err.println("Error broadcasting patch: " + e.getMessage());
                e.printStackTrace();
            }
        }
    }

    public void broadcastStateChange(GameState oldState, GameState newState) {
        Map<String, Object> patch = stateDiffer.diff(oldState, newState);
        if (!patch.isEmpty()) {
            try {
                String patchJson = objectMapper.writeValueAsString(Map.of("type", "STATE_PATCH", "data", patch));
                for (WebSocket client : connections) {
                    client.send(patchJson);
                }
            } catch (Exception e) {
                System.err.println("Error broadcasting patch: " + e.getMessage());
                e.printStackTrace();
            }
        }
    }
}
