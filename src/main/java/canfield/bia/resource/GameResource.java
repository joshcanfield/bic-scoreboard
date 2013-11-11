package canfield.bia.resource;

import canfield.bia.hockey.HockeyGame;
import canfield.bia.hockey.Penalty;
import canfield.bia.scoreboard.Clock;
import canfield.bia.scoreboard.ScoreBoard;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.HashMap;
import java.util.List;

import static canfield.bia.hockey.HockeyGame.Team;
import static canfield.bia.resource.GameApplication.getGame;

/**
 *
 */
@Path("/game")
@Produces("application/json")
public class GameResource {

    @GET
    @Path("/")
    public Response get() {
        HockeyGame game = getGame();
        ScoreBoard scoreBoard = game.getScoreBoard();
        HashMap<String, Object> state = new HashMap<String, Object>();
        state.put("time", scoreBoard.getGameClock().getMillis());
        state.put("running", scoreBoard.getGameClock().isRunning());
        state.put("period", scoreBoard.getPeriod());

        HashMap<String, Object> home = new HashMap<String, Object>();
        home.put("score", scoreBoard.getHomeScore());
        home.put("penalties", game.getHomePenalties());

        state.put("home", home);

        HashMap<String, Object> away = new HashMap<String, Object>();
        away.put("score", scoreBoard.getAwayScore());
        away.put("penalties", game.getAwayPenalties());
        state.put("away", away);

        return Response.ok(state).build();
    }

    @POST
    @Path("/")
    public Response update(
            HashMap<String, Object> data
    ) {
        HockeyGame game = getGame();
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
        HockeyGame game = getGame();

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
            @PathParam("team") Team team,
            HashMap<String, Object> players
    ) {
        HockeyGame game = getGame();
        ScoreBoard s = game.getScoreBoard();
        switch (team) {
            case home:
                int homeScore = s.getHomeScore();
                s.setHomeScore(homeScore + 1);
                break;
            case away:
                int awayScore = s.getAwayScore();
                s.setAwayScore(awayScore + 1);
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
        HockeyGame game = getGame();

        switch (team) {
            case home:
                game.addHomePenalty(penalty);
                break;
            case away:
                game.addAwayPenalty(penalty);
                break;
            default:
                return Response.status(Response.Status.BAD_REQUEST).build();
        }

        return Response.ok(penalty).build();
    }

    @DELETE
    @Path("/{team}/penalty/{penaltyId}")
    public Response deletePenalty(
            @PathParam("team") Team team,
            @PathParam("penaltyId") Integer penaltyId
    ) {
        HockeyGame game = getGame();
        List<Penalty> penalties = null;
        switch (team) {
            case home:
                penalties = game.getHomePenalties();
                break;
            case away:
                penalties = game.getAwayPenalties();
                break;
        }

        if (penalties != null) {
            int index = -1;
            for (int i = 0; i < penalties.size(); i++) {
                Penalty penalty = penalties.get(i);
                if (penalty.getId().equals(penaltyId)) {
                    index = i;
                    break;
                }
            }
            if (index >= 0) {
                penalties.remove(index);
            }
        }

        return Response.ok().build();
    }

    @DELETE
    @Path("/{team}/goal")
    public Response undoGoal(@PathParam("team") String team) {
        HockeyGame game = getGame();
        ScoreBoard s = game.getScoreBoard();
        if ("home".equals(team)) {
            int score = s.getHomeScore();
            if (score > 0)
                s.setHomeScore(score - 1);
        } else if ("away".equals(team)) {
            int score = s.getAwayScore();
            if (score > 0)
                s.setAwayScore(score - 1);
        } else {
            return Response.status(Response.Status.BAD_REQUEST).entity("Invalid team: " + team).build();
        }
        return Response.ok().build();
    }

}
