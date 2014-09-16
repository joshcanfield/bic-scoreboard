package canfield.bia;

import canfield.bia.hockey.web.WebSocketAdapter;
import canfield.bia.rest.GameApplication;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.DefaultHandler;
import org.eclipse.jetty.server.handler.HandlerList;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.eclipse.jetty.server.nio.SelectChannelConnector;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.jboss.resteasy.plugins.server.servlet.HttpServletDispatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;

public class HockeyGameServer {
    private static Logger log = LoggerFactory.getLogger(HockeyGameServer.class);

    private Server server = null;
    private WebSocketAdapter webSocketAdapter;


    @Inject
    public HockeyGameServer(WebSocketAdapter webSocketAdapter) {
        this.webSocketAdapter = webSocketAdapter;
    }

    public void start() {
        if (server != null) {
            return;
        }

        webSocketAdapter.start();

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

        if (webSocketAdapter != null) {
            try {
                webSocketAdapter.stop();
            } catch (Exception e) {
                log.error("Failed to stop socket io server", e);
            }
        }
    }

    private void startServer() {
        server = new Server();
        final SelectChannelConnector connector = new SelectChannelConnector();
        connector.setPort(8080);
        server.addConnector(connector);

        final ResourceHandler fileHandler = new ResourceHandler();
        fileHandler.setDirectoriesListed(true);
        fileHandler.setWelcomeFiles(new String[]{"index.html"});
        fileHandler.setResourceBase("web");

        final ServletContextHandler resteasyHandler = new ServletContextHandler();
        final ServletHolder servletHolder = resteasyHandler.addServlet(HttpServletDispatcher.class, "/api/*");
        servletHolder.setInitParameter("javax.ws.rs.Application", GameApplication.class.getCanonicalName());
        servletHolder.setInitParameter("resteasy.servlet.mapping.prefix", "/api");

        final HandlerList handlers = new HandlerList();
        handlers.setHandlers(new Handler[]{resteasyHandler, fileHandler, new DefaultHandler()});
        server.setHandler(handlers);

        try {
            server.start();
            log.info("Server waiting for requests...");
            server.join(); // keeps this thread from exiting until the server shuts down
        } catch (Exception e) {
            throw new RuntimeException("Failed to start service.", e);
        }
    }
}
