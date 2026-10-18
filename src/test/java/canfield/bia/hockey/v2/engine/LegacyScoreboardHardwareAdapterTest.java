package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.scoreboard.Clock;
import canfield.bia.hockey.scoreboard.ScoreBoard;
import canfield.bia.hockey.scoreboard.ScoreBoardImpl;
import canfield.bia.hockey.v2.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class LegacyScoreboardHardwareAdapterTest {

    private ScoreBoard scoreBoard;
    private LegacyScoreboardHardwareAdapter adapter;

    @BeforeEach
    void setUp() {
        scoreBoard = new ScoreBoardImpl();
        adapter = new LegacyScoreboardHardwareAdapter(scoreBoard, null);
    }

    @Test
    void clockRoundsUpSecondsAndPreservesTenths() {
        // 65.4 seconds (1:05.4) remaining should display as 1:06 on legacy scoreboard (rounded up)
        GameState state = createStateWithClock(65400L, true);
        adapter.update(state);

        Clock.ClockTime time = scoreBoard.getGameClock().getTime();
        assertEquals(1, time.getMinutes(), "Minutes should be 1");
        assertEquals(6, time.getSeconds(), "65.4s should display as 1:06, not 1:05");

        // 45.2 seconds remaining should have tenths digit 2, not 9
        GameState stateSubMinute = createStateWithClock(45200L, true);
        adapter.update(stateSubMinute);

        Clock.ClockTime subMinTime = scoreBoard.getGameClock().getTime();
        assertEquals(0, subMinTime.getMinutes());
        assertEquals(46, subMinTime.getSeconds()); // 45.2s rounds up to 46s for whole-second displays
        assertEquals(2, subMinTime.getTenthsOfSeconds(), "Tenths digit of 45.2s should be 2, not 9");
    }

    @Test
    void buzzerRingsOnlyOnceOnRisingEdge() {
        ScoreBoard mockScoreboard = mock(ScoreBoard.class);
        when(mockScoreboard.getGameClock()).thenReturn(scoreBoard.getGameClock());
        LegacyScoreboardHardwareAdapter mockAdapter = new LegacyScoreboardHardwareAdapter(mockScoreboard, null);

        GameState buzzerOff = createStateWithBuzzer(false);
        GameState buzzerOn = createStateWithBuzzer(true);

        mockAdapter.update(buzzerOff);
        verify(mockScoreboard, never()).ringBuzzer(anyInt());

        // Rising edge: buzzer turns on
        mockAdapter.update(buzzerOn);
        verify(mockScoreboard, times(1)).ringBuzzer(3000);

        // Successive updates while buzzer remains on should NOT re-ring buzzer
        mockAdapter.update(buzzerOn);
        mockAdapter.update(buzzerOn);
        verify(mockScoreboard, times(1)).ringBuzzer(3000);

        // Falling edge: buzzer turns off
        mockAdapter.update(buzzerOff);
        verify(mockScoreboard, times(1)).ringBuzzer(3000);

        // Next rising edge: rings again
        mockAdapter.update(buzzerOn);
        verify(mockScoreboard, times(2)).ringBuzzer(3000);
    }

    private GameState createStateWithClock(long timeRemainingMillis, boolean isRunning) {
        return new GameState(
            "game-1",
            new GameConfig("USAH_ADULT_20", 0, 20, 0, 3, ClockType.STOP_TIME, null, false),
            GameStatus.PLAYING,
            1,
            new ClockState(timeRemainingMillis, isRunning, 0L),
            new TeamState(Collections.emptyList(), 0, Collections.emptyList(), Collections.emptyList()),
            new TeamState(Collections.emptyList(), 0, Collections.emptyList(), Collections.emptyList()),
            false,
            Collections.emptyList()
        );
    }

    private GameState createStateWithBuzzer(boolean buzzerOn) {
        return new GameState(
            "game-1",
            new GameConfig("USAH_ADULT_20", 0, 20, 0, 3, ClockType.STOP_TIME, null, false),
            GameStatus.PLAYING,
            1,
            new ClockState(100000L, false, 0L),
            new TeamState(Collections.emptyList(), 0, Collections.emptyList(), Collections.emptyList()),
            new TeamState(Collections.emptyList(), 0, Collections.emptyList(), Collections.emptyList()),
            buzzerOn,
            Collections.emptyList()
        );
    }
}
