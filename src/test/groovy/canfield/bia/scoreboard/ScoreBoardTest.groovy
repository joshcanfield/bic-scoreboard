package canfield.bia.scoreboard

import org.testng.annotations.Test

/**
 *
 */
class ScoreBoardTest {

    @Test
    void "penalty clock runs with game clock"() {
        ScoreBoard scoreBoard = new ScoreBoard()
        scoreBoard.setGameClock(20, 0)
        // create a 5 second penalty
        scoreBoard.addAwayPenalty(10, 5000)

        scoreBoard.start()
        Thread.sleep(3000)
        Clock gameClock = scoreBoard.gameClock
        int minutes = gameClock.minutes
        int seconds = gameClock.seconds
        assert minutes == 19
        assert seconds == 57

        Clock clock = scoreBoard.awayPenaltyList[0].clock
        assert clock.minutes == 0
        assert clock.seconds == 2
    }

    @Test
    void "penalty removed after clock expires"() {
        ScoreBoard scoreBoard = new ScoreBoard()
        scoreBoard.setGameClock(20, 0)
        // create a 5 second penalty
        scoreBoard.addAwayPenalty(10, 5000)

        scoreBoard.start()
        Thread.sleep(6000)

        int minutes = scoreBoard.gameClock.minutes
        int seconds = scoreBoard.gameClock.seconds
        assert minutes == 19
        assert seconds == 54

        assert scoreBoard.awayPenaltyList.empty
    }
}
