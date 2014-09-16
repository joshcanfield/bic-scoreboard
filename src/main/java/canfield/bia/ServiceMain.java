package canfield.bia;

import canfield.bia.rest.GameApplication;
import dagger.ObjectGraph;

/**
 *
 */
public class ServiceMain {
    private static HockeyGameServer hockeyGameServer;

    public static void main(String[] args) {
        final ObjectGraph objectGraph = GameApplication.getObjectGraph();
        hockeyGameServer = objectGraph.get(HockeyGameServer.class);

        if (args.length == 0 || args[0].equals("start")) {
            hockeyGameServer.start();
        } else {
            hockeyGameServer.stop();
        }
    }
}
