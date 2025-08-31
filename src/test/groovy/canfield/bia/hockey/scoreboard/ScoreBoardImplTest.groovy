package canfield.bia.hockey.scoreboard

import org.testng.annotations.Test

class ScoreBoardImplTest {
    // Verifies that invalid period and penalty indexes are ignored rather than throwing exceptions
    @Test
    void "ignores out of range indexes"() {
        def board = new ScoreBoardImpl()

        board.setPeriod(-1)
        assert board.getPeriod() == 0
        assert board.getPeriodMinutes(-1) == 0

        board.setPeriod(99)
        assert board.getPeriod() == 0
        assert board.getPeriodMinutes(99) == 0

        board.setHomePenalty(-1, null)
        board.setAwayPenalty(-1, null)
        assert board.getHomePenalty(-1) == null
        assert board.getAwayPenalty(-1) == null

        board.setHomePenalty(2, null)
        board.setAwayPenalty(2, null)
        assert board.getHomePenalty(2) == null
        assert board.getAwayPenalty(2) == null
    }
}
