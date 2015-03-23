package canfield.bia;

import canfield.bia.rest.GameApplication;
import dagger.ObjectGraph;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

                System.out.print(
                    "  _____   __   ___   ____     ___  ____    ___    ____  ____   ___       \n" +
                    " / ___/  /  ] /   \\ |    \\   /  _]|    \\  /   \\  /    ||    \\ |   \\      \n" +
                    "(   \\_  /  / |     ||  D  ) /  [_ |  o  )|     ||  o  ||  D  )|    \\     \n" +
                    " \\__  |/  /  |  O  ||    / |    _]|     ||  O  ||     ||    / |  D  |    \n" +
                    " /  \\ /   \\_ |     ||    \\ |   [_ |  O  ||     ||  _  ||    \\ |     |    \n" +
                    " \\    \\     ||     ||  .  \\|     ||     ||     ||  |  ||  .  \\|     |    \n" +
                    "  \\___|\\____| \\___/ |__|\\_||_____||_____| \\___/ |__|__||__|\\_||_____|    \n" +
                    "                                                                         \n" +
                    "  _____   ___  ____  __ __    ___  ____                                  \n" +
                    " / ___/  /  _]|    \\|  |  |  /  _]|    \\                                 \n" +
                    "(   \\_  /  [_ |  D  )  |  | /  [_ |  D  )                                \n" +
                    " \\__  ||    _]|    /|  |  ||    _]|    /                                 \n" +
                    " /  \\ ||   [_ |    \\|  :  ||   [_ |    \\                                 \n" +
                    " \\    ||     ||  .  \\\\   / |     ||  .  \\                                \n" +
                    "  \\___||_____||__|\\_| \\_/  |_____||__|\\_|                                \n" +
                    "\n");
                System.out.println("***************************************************");
                System.out.println("Don't close this window while the clock is running!");
                System.out.println("***************************************************");
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
}
