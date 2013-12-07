package canfield.bia.rest;

import canfield.bia.hockey.Penalty;
import canfield.bia.hockey.SimpleGameManager;

import javax.inject.Inject;
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.List;

import static canfield.bia.hockey.SimpleGameManager.Team;
import static canfield.bia.hockey.SimpleGameManager.Team.away;
import static canfield.bia.hockey.SimpleGameManager.Team.home;

/**
 *
 */
@Path("/game")
@Produces("application/json")
public class GameResource {

    private SimpleGameManager game;

    @Inject
    public GameResource(SimpleGameManager game) {
        this.game = game;
    }

    @GET
    @Path("/")
    public Response get() {
        final HashMap<String, Object> state = new HashMap<String, Object>();
        state.put("time", game.getTime());
        state.put("running", game.isClockRunning());
        state.put("period", game.getPeriod());

        for (Team team : Team.values()) {
            final HashMap<String, Object> o = new HashMap<String, Object>();
            o.put("score", game.getScore(team));
            o.put("penalties", game.getPenalties(team));
            state.put(team.name(), o);
        }

        return Response.ok(state).build();
    }

    @POST
    @Path("/")
    public Response update(
            HashMap<String, Object> data
    ) {
        if (data.containsKey("period")) {
            Object period = data.get("period");
            game.setPeriod((Integer) period);
        }
        return get();
    }

    @POST
    @Path("/clock")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response setClock(
            HashMap<String, Object> clock
    ) {

        if (clock.containsKey("running")) {
            Boolean running = (Boolean) clock.get("running");
            if (running) {
                game.startClock();
            } else {
                game.stopClock();
            }
        }

        if (clock.containsKey("time")) {
            Object time = clock.get("time");
            game.setTime((Integer) time);
        }

        return Response.ok().build();
    }

    @POST
    @Path("/{team}/goal")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response addGoal(
            @PathParam("team") Team team
    ) {
        switch (team) {
            case home:
                int homeScore = game.getScore(home);
                game.setScore(home, homeScore + 1);
                break;
            case away:
                int awayScore = game.getScore(away);
                game.setScore(away, awayScore + 1);
                break;
            default:
                return Response.status(Response.Status.BAD_REQUEST).entity("Invalid team: " + team).build();
        }
        return Response.ok().build();
    }

    @POST
    @Path("/{team}/penalty")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response addPenalty(
            @PathParam("team") Team team,
            Penalty penalty
    ) {
        game.addPenalty(team, penalty);

        return Response.ok(penalty).build();
    }

    @DELETE
    @Path("/{team}/penalty/{penaltyId}")
    public Response deletePenalty(
            @PathParam("team") Team team,
            @PathParam("penaltyId") Integer penaltyId
    ) {
        final List<Penalty> penalties = game.getPenalties(team);

        if (penalties != null) {
            for (Penalty penalty : penalties) {
                if (penalty.getId().equals(penaltyId)) {
                    game.deletePenalty(team, penalty);
                    break;
                }
            }
        }
        return Response.ok().build();
    }

    @DELETE
    @Path("/{team}/goal")
    public Response undoGoal(@PathParam("team") Team team) {

        int score = game.getScore(team);
        if (score > 0)
            game.setScore(team, score - 1);

        return Response.ok().build();
    }

    @POST
    @Path("/buzzer")
    public Response buzzer(int millis) {
        game.playBuzzer(millis);
        return Response.ok().build();
    }

}
