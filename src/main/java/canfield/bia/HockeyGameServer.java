package canfield.bia;

import canfield.bia.hockey.web.GameService;
import canfield.bia.rest.GameApplication;
import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOServer;
import dagger.ObjectGraph;
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


/**
 *
 */
public class HockeyGameServer {
    private static Logger log = LoggerFactory.getLogger(HockeyGameServer.class);

    private static Server server = null;
    private static SocketIOServer socketIOServer;

    public static void main(String[] args) {
        if (args.length == 0 || args[0].equals("start")) {
            start();
        } else {
            stop();
        }
    }

    public HockeyGameServer() {
    }

    private static void stop() {
        if (server != null) {
            try {
                server.stop();
                server = null;
            } catch (Exception e) {
                log.error("failed to stop service", e);
            }
        }

        if (socketIOServer != null) {
            try {
                socketIOServer.stop();
            } catch (Exception e) {
                log.error("Failed to stop socket io server", e);
            }
        }
    }

    private static void start() {
        if (server != null) {
            return;
        }

        Configuration config = new Configuration();
        config.setHostname("localhost");
        config.setPort(8081);

        socketIOServer = new SocketIOServer(config);
        ObjectGraph objectGraph = GameApplication.getObjectGraph();
        socketIOServer.addListeners(objectGraph.get(GameService.class));
        socketIOServer.start();
        startServer();
    }

    private static void startServer() {
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
            server.join();
        } catch (Exception e) {
            throw new RuntimeException("Failed to start service.", e);
        }
    }
}
