package canfield.bia.hockey.web;

import canfield.bia.hockey.SimpleGameManager;
import canfield.bia.hockey.Team;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.annotation.OnConnect;
import com.corundumstudio.socketio.annotation.OnDisconnect;
import com.corundumstudio.socketio.annotation.OnEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import java.util.HashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class WebSocketAdapter {
    private Logger log = LoggerFactory.getLogger(WebSocketAdapter.class);

    SimpleGameManager gameManager;

    private SocketIOServer socketIoServer;
    private final ScheduledExecutorService scheduledExecutor;
    private boolean isRunning = false;

    @Inject
    public WebSocketAdapter(
            SimpleGameManager manager,
            SocketIOServer socketIoServer
    ) {
        gameManager = manager;
        this.socketIoServer = socketIoServer;

        socketIoServer.addListeners(this);

        scheduledExecutor = Executors.newSingleThreadScheduledExecutor();
        scheduledExecutor.scheduleAtFixedRate(
                new Runnable() {
                    @Override
                    public void run() {
                        try {
                            sendUpdate();
                        } catch (Exception e ) {
                            log.warn("Failed sending web-socket update");
                        }
                    }
                }, 1000, 1000 / 4, TimeUnit.MILLISECONDS
        );
    }

    @OnEvent("clock_start")
    public void onClockStart(SocketIOClient client) {
        gameManager.startClock();
        sendUpdate(client);
    }

    @OnEvent("clock_pause")
    public void onClockPause(SocketIOClient client) {
        gameManager.stopClock();
        sendUpdate(client);
    }

    @OnEvent("goal")
    public void onGoal(SocketIOClient client, HashMap<String, String> data) {
        final Team team = Team.valueOf(data.get("team"));
        final int score = gameManager.getScore(team);

        // TODO: This should be undo-able
        // - push goals on to a stack
        // - store player/assist and assist
        gameManager.setScore(team, score + 1);

        sendUpdate(client);
    }

    @OnEvent("set_period")
    public void onSetPeriod(SocketIOClient client, HashMap<String, Integer> data) {
        Integer period = data.get("period");
        gameManager.setPeriod(period);

        sendUpdate(client);
    }

    @OnEvent("undo_goal")
    public void onUndoGoal(SocketIOClient client, HashMap<String, String> data) {
        final Team team = Team.valueOf(data.get("team"));
        final int score = gameManager.getScore(team);

        gameManager.setScore(team, score - 1);

        sendUpdate(client);
    }

    @OnEvent("buzzer")
    public void onBuzzer(SocketIOClient client) {
        gameManager.playBuzzer(1000);
    }

    @OnEvent("createGame")
    public void onCreateGame(SocketIOClient client) {
        gameManager.reset();
    }

    @OnEvent("power")
    public void onScoreboardPower(SocketIOClient client) {
        boolean updatesRunning = gameManager.updatesRunning();
        log.info("Turning scoreboard Power {}", updatesRunning ? "Off" : "On");
        if (updatesRunning) gameManager.stopUpdates();
        else gameManager.startUpdates();

        HashMap<String, Object> out = new HashMap<String, Object>();
        out.put("scoreboardOn", gameManager.updatesRunning());

        client.getNamespace().getBroadcastOperations().sendEvent("power", out);
    }

    @OnConnect
    public void onConnectHandler(SocketIOClient client) {
        log.info("Connecting " + client.getSessionId());
        sendUpdate(client);
    }

    @OnDisconnect
    public void onDisconnectHandler(SocketIOClient client) {
        log.info("Disconnected " + client.getSessionId());
    }

    private void sendUpdate(SocketIOClient client) {
        client.getNamespace().getBroadcastOperations().sendEvent("update", buildUpdate());
    }

    public void sendUpdate() {
        if (isRunning) {
            socketIoServer.getBroadcastOperations().sendEvent("update", buildUpdate());
        }
    }

    private Object buildUpdate() {
        final HashMap<String, Object> state = new HashMap<String, Object>();
        state.put("time", gameManager.getTime());
        state.put("running", gameManager.isClockRunning());
        state.put("period", gameManager.getPeriod());
        state.put("scoreboardOn", gameManager.updatesRunning());

        for (Team team : Team.values()) {
            final HashMap<String, Object> o = new HashMap<String, Object>();
            o.put("score", gameManager.getScore(team));
            o.put("penalties", gameManager.getPenalties(team));
            state.put(team.name(), o);
        }
        return state;
    }

    public void start() {
        socketIoServer.start();
        isRunning = true;
    }

    public void stop() {
        isRunning = false;
        socketIoServer.stop();
        scheduledExecutor.shutdown();
    }
}