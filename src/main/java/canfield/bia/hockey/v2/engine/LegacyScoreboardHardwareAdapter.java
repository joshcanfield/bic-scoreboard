package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.Penalty;
import canfield.bia.hockey.scoreboard.Clock;
import canfield.bia.hockey.scoreboard.ScoreBoard;
import canfield.bia.hockey.scoreboard.io.ScoreboardAdapter;
import canfield.bia.hockey.v2.domain.GameState;
import canfield.bia.hockey.v2.domain.GameStatus;
import canfield.bia.hockey.v2.domain.TeamState;

import java.util.Collections;
import java.util.List;

/**
 * Adapts the new GameState to the legacy ScoreBoard interface.
 */
public class LegacyScoreboardHardwareAdapter implements HardwareOutputAdapter {

    private final ScoreBoard legacyScoreBoard;
    private final ScoreboardAdapter scoreboardAdapter;

    public LegacyScoreboardHardwareAdapter(ScoreBoard legacyScoreBoard, ScoreboardAdapter scoreboardAdapter) {
        this.legacyScoreBoard = legacyScoreBoard;
        this.scoreboardAdapter = scoreboardAdapter;
    }

    @Override
    public void start() {
        if (scoreboardAdapter != null) {
            scoreboardAdapter.start();
        }
    }

    @Override
    public void stop() {
        if (scoreboardAdapter != null) {
            scoreboardAdapter.stop();
        }
    }

    @Override
    public boolean isRunning() {
        return scoreboardAdapter != null && scoreboardAdapter.isRunning();
    }

    @Override
    public List<String> getPossiblePorts() {
        if (scoreboardAdapter != null) {
            return scoreboardAdapter.possiblePorts();
        }
        return Collections.emptyList();
    }

    @Override
    public void setPortName(String portName) {
        if (scoreboardAdapter != null) {
            scoreboardAdapter.setPortName(portName);
        }
    }

    @Override
    public String getPortName() {
        if (scoreboardAdapter != null) {
            return scoreboardAdapter.getPortName();
        }
        return null;
    }

    @Override
    public void update(GameState state) {
        // Update scores
        legacyScoreBoard.setHomeScore(state.home().goals().size());
        legacyScoreBoard.setAwayScore(state.away().goals().size());

        // Update period
        legacyScoreBoard.setPeriod(state.period());

        // Update game clock
        Clock gameClock = legacyScoreBoard.getGameClock();
        long timeRemainingMillis = state.clock().timeRemainingMillis();
        int minutes = Clock.getMinutes((int) timeRemainingMillis);
        int seconds = Clock.getSeconds((int) timeRemainingMillis);
        gameClock.setTime(minutes, seconds);

        if (state.clock().isRunning()) {
            gameClock.start();
        } else {
            gameClock.stop();
        }

        // Update penalties (and optionally show shots in empty penalty slot)
        boolean showShots = state.config() != null && state.config().showShotsInPenaltySlot();
        updatePenalties(state.home().penalties(), true, state.home().shots(), showShots);
        updatePenalties(state.away().penalties(), false, state.away().shots(), showShots);

        // Handle buzzer
        if (state.buzzerOn()) {
            legacyScoreBoard.ringBuzzer(3000); // Ring for 3 seconds
        }

        // Handle game status
        if (state.status() == GameStatus.GAME_OVER) {
            // Potentially do something specific for game over on the legacy scoreboard
        }
    }

    private void updatePenalties(List<canfield.bia.hockey.v2.domain.Penalty> penalties, boolean isHomeTeam,
                                  int shots, boolean showShotsInPenaltySlot) {
        // Clear existing penalties on the legacy scoreboard
        for (int i = 0; i < 2; i++) { // Assuming max 2 penalties per team for legacy
            if (isHomeTeam) {
                legacyScoreBoard.setHomePenalty(i, null);
            } else {
                legacyScoreBoard.setAwayPenalty(i, null);
            }
        }

        // Add new penalties
        int penaltyCount = Math.min(penalties.size(), 2);
        for (int i = 0; i < penaltyCount; i++) { // Limit to 2 for legacy
            canfield.bia.hockey.v2.domain.Penalty newPenalty = penalties.get(i);
            Penalty legacyPenalty = new Penalty();
            legacyPenalty.setPlayerNumber(newPenalty.playerNumber());
            legacyPenalty.setServingPlayerNumber(newPenalty.servingPlayerNumber());
            // Set remaining time in milliseconds (legacy adapter calculates remaining = time - elapsed,
            // and elapsed defaults to 0, so setting time = remaining gives correct display)
            legacyPenalty.setTime((int) newPenalty.timeRemainingMillis());
            if (isHomeTeam) {
                legacyScoreBoard.setHomePenalty(i, legacyPenalty);
            } else {
                legacyScoreBoard.setAwayPenalty(i, legacyPenalty);
            }
        }

        // If enabled and slot 2 is available, show shots on goal in penalty slot 2
        if (showShotsInPenaltySlot && penaltyCount < 2) {
            Penalty shotsPenalty = new Penalty();
            shotsPenalty.setPlayerNumber(0);        // Player 0 = shots marker
            shotsPenalty.setServingPlayerNumber(0);
            // Convert shots to milliseconds so Clock.getSeconds() returns the shot count
            // e.g., 5 shots -> 5000 millis -> displays as 0:05
            shotsPenalty.setTime(shots * 1000);
            if (isHomeTeam) {
                legacyScoreBoard.setHomePenalty(1, shotsPenalty);  // Always slot 2 (index 1)
            } else {
                legacyScoreBoard.setAwayPenalty(1, shotsPenalty);  // Always slot 2 (index 1)
            }
        }
    }
}
