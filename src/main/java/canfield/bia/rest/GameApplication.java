package canfield.bia.rest;

import canfield.bia.hockey.SimpleGameModule;
import dagger.ObjectGraph;
import org.codehaus.jackson.jaxrs.JacksonJsonProvider;

import javax.servlet.ServletContext;
import javax.ws.rs.core.Application;
import javax.ws.rs.core.Context;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 *
 */
public class GameApplication extends Application {

    private static JacksonJsonProvider jacksonJsonProvider = new JacksonJsonProvider();
    private static GameResource gameResource;

    @Override
    public Set<Object> getSingletons() {
        if ( gameResource == null ) {
            ObjectGraph objectGraph = ObjectGraph.create(new SimpleGameModule());
            objectGraph.validate();
            gameResource = objectGraph.get(GameResource.class);
        }
        return new HashSet<Object>(Arrays.asList(gameResource, jacksonJsonProvider));
    }
}
