package canfield.bia;

import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.DefaultHandler;
import org.eclipse.jetty.server.handler.HandlerList;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Jetty server that serves static files for the scoreboard UI.
 * The v2 architecture uses GameWebSocketV2 for all game state communication.
 */
public class HockeyGameServer {
    private static final Logger log = LoggerFactory.getLogger(HockeyGameServer.class);

    private Server server = null;

    public HockeyGameServer() {
    }

    public void start() {
        if (server != null) {
            return;
        }
        startServer();
    }

    public void stop() {
        if (server != null) {
            try {
                server.stop();
                server = null;
            } catch (Exception e) {
                log.error("failed to stop service", e);
            }
        }
    }

    private void startServer() {
        server = new Server(8080);

        final ResourceHandler fileHandler = new ResourceHandler();
        fileHandler.setDirectoriesListed(true);
        fileHandler.setWelcomeFiles(new String[]{"index.html"});
        // Serve from web-generated (TypeScript build output) by default
        String resourceBase = System.getProperty("RESOURCE_BASE", "web-generated");
        fileHandler.setResourceBase(resourceBase);

        final HandlerList handlers = new HandlerList();
        handlers.setHandlers(new Handler[]{fileHandler, new DefaultHandler()});
        server.setHandler(handlers);

        try {
            server.setStopAtShutdown(true);
            server.start();
            log.info("Server waiting for requests on http://localhost:8080/");
        } catch (Exception e) {
            throw new RuntimeException("Failed to start service.", e);
        }
    }
}
