package canfield.bia.hockey.v2.engine;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Implementation of GameTimer that uses a ScheduledExecutorService to trigger tick events.
 */
public class ScheduledGameTimer implements GameTimer {

    private static final long TICK_INTERVAL_MILLIS = 100; // Tick every 100ms
    private ScheduledExecutorService scheduler;

    @Override
    public void start(Runnable tickCallback) {
        if (scheduler != null && !scheduler.isShutdown()) {
            // Already running
            return;
        }
        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(tickCallback, 0, TICK_INTERVAL_MILLIS, TimeUnit.MILLISECONDS);
    }

    @Override
    public void stop() {
        if (scheduler != null) {
            scheduler.shutdownNow();
            scheduler = null;
        }
    }
}
