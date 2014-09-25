package canfield.bia.rest;

import canfield.bia.hockey.SimpleGameModule;
import dagger.ObjectGraph;
import org.codehaus.jackson.jaxrs.JacksonJsonProvider;

import javax.ws.rs.core.Application;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * This is created by Resteasy.
 */
public class GameApplication extends Application {

    private static JacksonJsonProvider jacksonJsonProvider = new JacksonJsonProvider();
    private static GameResource gameResource;
    private static ObjectGraph objectGraph;

    public synchronized static ObjectGraph getObjectGraph() {
        if (objectGraph == null) {
            ObjectGraph graph = ObjectGraph.create(new SimpleGameModule());
            graph.validate();
            objectGraph = graph;
        }
        return objectGraph;
    }

    @Override
    public Set<Object> getSingletons() {
        if (gameResource == null) {
            ObjectGraph graph = getObjectGraph();
            gameResource = graph.get(GameResource.class);
        }
        return new HashSet<Object>(Arrays.asList(gameResource, jacksonJsonProvider));
    }
}
