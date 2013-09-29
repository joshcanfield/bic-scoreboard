package canfield.bia.resource;

import canfield.bia.hockey.HockeyGame;
import canfield.bia.scoreboard.Clock;
import canfield.bia.scoreboard.ScoreBoard;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashMap;

/**
 *
 */
@Path("/game")
@Produces("application/json")
public class GameResource {

    @GET
    @Path("/")
    public Response get() {
        HockeyGame game = GameApplication.getGame();
        ScoreBoard scoreBoard = game.getScoreBoard();
        HashMap<String, Object> state = new HashMap<String, Object>();
        state.put("time", scoreBoard.getGameClock().getMillis());
        state.put("running", scoreBoard.getGameClock().isRunning());
        state.put("period", scoreBoard.getPeriod());

        HashMap<String, Object> home = new HashMap<String, Object>();
        home.put("score", scoreBoard.getHomeScore());
        home.put("penalties", new ArrayList());
        state.put("home", home);

        HashMap<String, Object> away = new HashMap<String, Object>();
        away.put("score", scoreBoard.getAwayScore());
        away.put("penalties", new ArrayList());
        state.put("away", away);

        return Response.ok(state).build();
    }

    @POST
    @Path("/")
    public Response update(
            HashMap<String, Object> data
    ) {
        HockeyGame game = GameApplication.getGame();
        ScoreBoard scoreBoard = game.getScoreBoard();
        if (data.containsKey("period")) {
            Object period = data.get("period");
            scoreBoard.setPeriod((Integer) period);
        }
        return get();
    }

    @POST
    @Path("/clock")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response setClock(
            HashMap<String, Object> clock
    ) {
        HockeyGame game = GameApplication.getGame();

        if (clock.containsKey("running")) {
            Boolean running = (Boolean) clock.get("running");
            if (running) {
                game.getScoreBoard().start();
            } else {
                game.getScoreBoard().pause();
            }
        }

        Clock gameClock = game.getScoreBoard().getGameClock();
        if (clock.containsKey("minutes")) {
            Object minutes = clock.get("minutes");
            gameClock.setMinutes((Integer) minutes);
        }

        if (clock.containsKey("seconds")) {
            Object seconds = clock.get("seconds");
            gameClock.setSeconds((Integer) seconds);
        }

        return Response.ok().build();
    }

    @POST
    @Path("/{team}/goal")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response addGoal(
            @PathParam("team") String team,
            HashMap<String, Object> players
    ) {
        HockeyGame game = GameApplication.getGame();
        ScoreBoard s = game.getScoreBoard();

        if ("home".equals(team)) {
            int homeScore = s.getHomeScore();
            s.setHomeScore(homeScore + 1);
        } else if ("away".equals(team)) {
            int awayScore = s.getAwayScore();
            s.setAwayScore(awayScore + 1);
        } else {
            return Response.status(Response.Status.BAD_REQUEST).entity("Invalid team: " + team).build();
        }
        return Response.ok().build();
    }

    @DELETE
    @Path("/{team}/goal")
    public Response undoGoal(@PathParam("team") String team) {
        HockeyGame game = GameApplication.getGame();
        ScoreBoard s = game.getScoreBoard();
        if ("home".equals(team)) {
            int homeScore = s.getHomeScore();
            s.setHomeScore(homeScore - 1);
        } else if ("away".equals(team)) {
            int awayScore = s.getAwayScore();
            s.setAwayScore(awayScore - 1);
        } else {
            return Response.status(Response.Status.BAD_REQUEST).entity("Invalid team: " + team).build();
        }
        return Response.ok().build();
    }

}
