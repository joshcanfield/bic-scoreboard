package canfield.bia;

import canfield.bia.rest.GameApplication;
import dagger.ObjectGraph;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;

/**
 *
 */
public class ServiceMain {
    private static HockeyGameServer hockeyGameServer;
    private static final Logger log = LoggerFactory.getLogger(ServiceMain.class);

    public static void main(String[] args) {

        if (args.length == 0 || args[0].equals("start")) {
            // only try to start if we're already started
            if (hockeyGameServer == null) {
                printBanner();
                final ObjectGraph objectGraph = GameApplication.getObjectGraph();
                hockeyGameServer = objectGraph.get(HockeyGameServer.class);
                hockeyGameServer.start();
            } else {
                log.info("Service already running...");
            }
        } else {
            if (hockeyGameServer != null) {
                log.info("Stopping server...");
                hockeyGameServer.stop();
            } else {
                log.warn("Unable to stop server: Service isn't running!");
            }
        }
    }

    private static void printBanner() {
        try {
          InputStream bannerStream = ClassLoader.getSystemResourceAsStream("banner.txt");
          IOUtils.copy(bannerStream, System.out);
        } catch (Exception ignored) {
            // ignored
          System.out.println();
        }
    }
}
