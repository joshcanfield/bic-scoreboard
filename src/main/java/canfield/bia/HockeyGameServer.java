package canfield.bia;

import canfield.bia.resource.GameApplication;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.ContextHandler;
import org.eclipse.jetty.server.handler.DefaultHandler;
import org.eclipse.jetty.server.handler.HandlerList;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.eclipse.jetty.server.nio.SelectChannelConnector;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.jboss.resteasy.plugins.server.servlet.HttpServletDispatcher;

/**
 *
 */
public class HockeyGameServer {
    public static void main(String[] args) {
        final Server server = new Server();
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
            server.join();
        } catch (Exception e) {
            throw new RuntimeException("Failed to start service.", e);
        }
    }
}
