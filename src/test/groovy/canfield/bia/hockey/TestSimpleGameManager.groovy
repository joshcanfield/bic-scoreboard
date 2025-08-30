package canfield.bia.hockey

import canfield.bia.hockey.scoreboard.Clock
import canfield.bia.hockey.scoreboard.ScoreBoard
import canfield.bia.hockey.scoreboard.io.ScoreboardAdapter
import org.testng.annotations.Test

import java.util.concurrent.TimeUnit

import static org.mockito.Mockito.mock
import static org.mockito.Mockito.when

/**
 *
 */
class TestSimpleGameManager {


    @Test
    void "test penalty update after period rolls"() {
        def scoreBoard = mock(ScoreBoard)
        def gameClock = mock(Clock)
        def scoreboardAdapter = mock(ScoreboardAdapter)

        when(scoreBoard.getGameClock()).thenReturn(gameClock)
        when(scoreBoard.getPeriodLengthMinutes()).thenReturn(20)
        when(scoreBoard.getPeriod()).thenReturn(2)
        when(gameClock.getTime()).thenReturn(new Clock.ClockTime(20, 0, 0))

        final SimpleGameManager simpleGameManager = new SimpleGameManager(scoreBoard, scoreboardAdapter)


        def lengthOfPenaltyMillis = TimeUnit.MINUTES.toMillis(3)
        def clockTimeAtPenaltyStartMillis = TimeUnit.MINUTES.toMillis(2)

        def penalty = [
                time     : lengthOfPenaltyMillis,
                period   : 1,
                startTime: clockTimeAtPenaltyStartMillis
        ] as Penalty

        simpleGameManager.updateElapsed(penalty)

        assert penalty.elapsed == TimeUnit.MINUTES.toMillis(2)
    }

    @Test
    void "test penalty update after next period starts"() {
        def scoreBoard = mock(ScoreBoard)
        def gameClock = mock(Clock)
        def scoreboardAdapter = mock(ScoreboardAdapter)

        when(scoreBoard.getGameClock()).thenReturn(gameClock)
        when(scoreBoard.getPeriodLengthMinutes()).thenReturn(20)
        when(scoreBoard.getPeriod()).thenReturn(2)
        when(gameClock.getTime()).thenReturn(new Clock.ClockTime(19, 0, 0))

        final SimpleGameManager simpleGameManager = new SimpleGameManager(scoreBoard, scoreboardAdapter)


        def lengthOfPenaltyMillis = TimeUnit.MINUTES.toMillis(3)
        def clockTimeAtPenaltyStartMillis = TimeUnit.MINUTES.toMillis(1)

        def penalty = [
                time     : lengthOfPenaltyMillis,
                period   : 1,
                startTime: clockTimeAtPenaltyStartMillis
        ] as Penalty

        simpleGameManager.updateElapsed(penalty)

        // 1 minute from period one plus 1 minute from period 2
        assert penalty.elapsed == TimeUnit.MINUTES.toMillis(2)
    }
}
