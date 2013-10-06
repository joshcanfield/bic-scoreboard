package canfield.bia.resource;

import canfield.bia.hockey.HockeyGame;
import org.codehaus.jackson.jaxrs.JacksonJsonProvider;

import javax.ws.rs.core.Application;
import java.util.HashSet;
import java.util.Set;

/**
 *
 */
public class GameApplication extends Application {
    public static final HashSet<Object> OBJECTS = new HashSet<Object>();
    public static final HockeyGame game = new HockeyGame();

    static {
        game.getUpdater().start();
        OBJECTS.add(new GameResource());
        OBJECTS.add(new JacksonJsonProvider());
    }

    @Override
    public Set<Object> getSingletons() {
        return OBJECTS;
    }

    public static HockeyGame getGame() {
        return game;
    }
}
