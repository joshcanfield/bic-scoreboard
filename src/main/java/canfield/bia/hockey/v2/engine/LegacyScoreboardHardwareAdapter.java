package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.Penalty;
import canfield.bia.hockey.scoreboard.Clock;
import canfield.bia.hockey.scoreboard.ScoreBoard;
import canfield.bia.hockey.v2.domain.GameState;
import canfield.bia.hockey.v2.domain.GameStatus;
import canfield.bia.hockey.v2.domain.TeamState;

import java.util.List;

/**
 * Adapts the new GameState to the legacy ScoreBoard interface.
 */
public class LegacyScoreboardHardwareAdapter implements HardwareOutputAdapter {

    private final ScoreBoard legacyScoreBoard;

    public LegacyScoreboardHardwareAdapter(ScoreBoard legacyScoreBoard) {
        this.legacyScoreBoard = legacyScoreBoard;
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

        // Update penalties
        updatePenalties(state.home().penalties(), true);
        updatePenalties(state.away().penalties(), false);

        // Handle buzzer
        if (state.buzzerOn()) {
            legacyScoreBoard.ringBuzzer(3000); // Ring for 3 seconds
        }

        // Handle game status
        if (state.status() == GameStatus.GAME_OVER) {
            // Potentially do something specific for game over on the legacy scoreboard
        }
    }

    private void updatePenalties(List<canfield.bia.hockey.v2.domain.Penalty> penalties, boolean isHomeTeam) {
        // Clear existing penalties on the legacy scoreboard
        for (int i = 0; i < 2; i++) { // Assuming max 2 penalties per team for legacy
            if (isHomeTeam) {
                legacyScoreBoard.setHomePenalty(i, null);
            } else {
                legacyScoreBoard.setAwayPenalty(i, null);
            }
        }

        // Add new penalties
        for (int i = 0; i < Math.min(penalties.size(), 2); i++) { // Limit to 2 for legacy
            canfield.bia.hockey.v2.domain.Penalty newPenalty = penalties.get(i);
            Penalty legacyPenalty = new Penalty();
            legacyPenalty.setPlayerNumber(newPenalty.playerNumber());
            legacyPenalty.setServingPlayerNumber(newPenalty.servingPlayerNumber());
            legacyPenalty.setTime((int) (newPenalty.durationMillis() / 1000)); // Convert millis to seconds
            // The legacy Penalty class doesn't seem to have a direct way to set elapsed time or start time
            // For now, we'll just set the total duration.
            // Further investigation might be needed if elapsed time needs to be reflected on the legacy scoreboard.
            if (isHomeTeam) {
                legacyScoreBoard.setHomePenalty(i, legacyPenalty);
            } else {
                legacyScoreBoard.setAwayPenalty(i, legacyPenalty);
            }
        }
    }
}
