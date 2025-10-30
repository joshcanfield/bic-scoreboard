package canfield.bia;

import canfield.bia.hockey.web.NativeWebSocketServer;
import canfield.bia.rest.GameApplication;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.DefaultHandler;
import org.eclipse.jetty.server.handler.HandlerList;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.jboss.resteasy.plugins.server.servlet.HttpServletDispatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;

public class HockeyGameServer {
    private static final Logger log = LoggerFactory.getLogger(HockeyGameServer.class);

    private Server server = null;
    private final NativeWebSocketServer nativeWebSocketServer;


    @Inject
    public HockeyGameServer(NativeWebSocketServer nativeWebSocketServer) {
        this.nativeWebSocketServer = nativeWebSocketServer;
    }

    public void start() {
        if (server != null) {
            return;
        }

        try {
            nativeWebSocketServer.start();
        } catch (Exception e) {
            log.error("Failed to start native WebSocket server", e);
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

        if (nativeWebSocketServer != null) {
            try {
                nativeWebSocketServer.shutdown();
            } catch (Exception e) {
                log.error("Failed to stop native WebSocket server", e);
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

        final ServletContextHandler resteasyHandler = new ServletContextHandler(ServletContextHandler.NO_SESSIONS);
        resteasyHandler.setContextPath("/");
        final ServletHolder servletHolder = resteasyHandler.addServlet(HttpServletDispatcher.class, "/api/*");
        servletHolder.setInitParameter("jakarta.ws.rs.Application", GameApplication.class.getCanonicalName());
        servletHolder.setInitParameter("resteasy.servlet.mapping.prefix", "/api");

        final HandlerList handlers = new HandlerList();
        // Serve static files first, then REST API under /api/*, then default
        handlers.setHandlers(new Handler[]{fileHandler, resteasyHandler, new DefaultHandler()});
        server.setHandler(handlers);

        try {
            // Start Jetty asynchronously; do not join so the UI thread can manage lifecycle
            server.setStopAtShutdown(true);
            server.start();
            log.info("Server waiting for requests...");
        } catch (Exception e) {
            throw new RuntimeException("Failed to start service.", e);
        }
    }
}
