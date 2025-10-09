package canfield.bia.rest;

import canfield.bia.hockey.Penalty;
import canfield.bia.hockey.SimpleGameManager;
import canfield.bia.hockey.Team;

import javax.inject.Inject;

import canfield.bia.hockey.scoreboard.ScoreBoard.GameState;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Path("/game")
@Produces("application/json")
public class GameResource {

  private final SimpleGameManager game;

  @Inject
  public GameResource(SimpleGameManager game) {
    this.game = game;
  }

  @GET
  @Path("/")
  public Response get() {
    final HashMap<String, Object> state = new HashMap<>();

    state.put("time", game.getRemainingTimeMillis());
    state.put("running", game.isClockRunning());
    state.put("period", game.getPeriod());
    state.put("scoreboardOn", game.updatesRunning());

    GameState gameState = game.getScoreBoard().getGameState();
    state.put("gameState", gameState);

    int periodLength = (gameState == GameState.INTERMISSION)
        ? game.getIntermissionDurationMinutes()
        : game.getPeriodLength();
    state.put("periodLength", periodLength);


    for (Team team : Team.values()) {
      final HashMap<String, Object> o = new HashMap<>();
      o.put("score", game.getScore(team));
      o.put("penalties", game.getPenalties(team));
      o.put("shots", game.getShots(team));
      state.put(team.name(), o);
    }

    return Response.ok(state).build();
  }

  @POST
  @Path("/")
  public Response get(
      HashMap<String, Object> gameState
  ) {
    game.reset();
    return get();
  }

  @PUT
  @Path("/")
  public Response update(
      HashMap<String, Object> data
  ) {
    if (data.containsKey("period")) {
      Object period = data.get("period");
      game.setPeriod((Integer) period);
    }
    if (data.containsKey("running")) {
      Boolean running = (Boolean) data.get("running");
      if (running) {
        game.startClock();
      } else {
        game.stopClock();
      }
    }

    if (data.containsKey("time")) {
      Object time = data.get("time");
      game.setTime((Integer) time);
    }
    return get();
  }

  @POST
  @Path("/portName")
  public Response setPort(Map<String, String> port) {
    String portName = port.get("portName");
    if ( portName != null ) {
      game.setAdapterPort(portName);
    }
    return getAvailablePorts();
  }

  @GET
  @Path("/portNames")
  public Response getAvailablePorts() {
    final HashMap<String, Object> response = new HashMap<>();
    response.put("currentPort", game.currentPort());
    response.put("portNames", game.possiblePortNames());

    return Response.ok(response).build();
  }

  @POST
  @Path("/{team}/goal")
  @Consumes(MediaType.APPLICATION_JSON)
  public Response addGoal(
      @PathParam("team") Team team
  ) {
    switch (team) {
      case home:
        int homeScore = game.getScore(Team.home);
        game.setScore(Team.home, homeScore + 1);
        break;
      case away:
        int awayScore = game.getScore(Team.away);
        game.setScore(Team.away, awayScore + 1);
        break;
      default:
        return Response.status(Response.Status.BAD_REQUEST).entity("Invalid team: " + team).build();
    }
    return Response.ok().build();
  }

  @POST
  @Path("/{team}/shot")
  public Response addShot(
      @PathParam("team") Team team
  ) {
    game.addShot(team);
    return Response.ok().build();
  }

  @DELETE
  @Path("/{team}/shot")
  public Response undoShot(@PathParam("team") Team team) {
    game.removeShot(team);
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
    if (score > 0) {
      game.setScore(team, score - 1);
    }

    return Response.ok().build();
  }

  @POST
  @Path("/buzzer/{millis}")
  public Response buzzer(
      @PathParam("millis") int millis
  ) {
    game.playBuzzer(millis);
    return Response.ok().build();
  }

  @POST
  @Path("/power")
  public Response power() {
    if (game.updatesRunning()) {
      game.stopUpdates();
    } else {
      game.startUpdates();
    }
    return Response.ok().build();
  }

}
