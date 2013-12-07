package canfield.bia.hockey.scoreboard

import org.testng.annotations.Test

/**
 *
 */
class GameClockTest {

    @Test
    void "can create scoreboard clock"() {
        def clock = new GameClock(20,00)

        clock.update()
        assert clock.getMinutes() == 20
        assert clock.getSeconds() == 0
    }

    @Test
    void "expected clock after sleeping half second"() {
        def clock = new GameClock(20,00)

        clock.start()

        Thread.sleep(500)

        clock.update()
        assert clock.getMinutes() == 20
        assert clock.getSeconds() == 0
    }

    @Test
    void "expected clock after sleeping 5 seconds"() {
        def clock = new GameClock(20,00)

        clock.start()

        Thread.sleep(5000)

        clock.update()
        assert clock.getMinutes() == 19
        assert clock.getSeconds() == 55
    }

    @Test
    void "expected clock after pause"() {
        def clock = new GameClock(20,00)
        clock.start()
        Thread.sleep(2000)
        clock.stop()
        // 2 seconds elapsed
        clock.update()
        assert clock.getMinutes() == 19
        assert clock.getSeconds() == 58

        Thread.sleep(2000)
        // 2 seconds elapsed still
        clock.update()
        assert clock.getMinutes() == 19
        assert clock.getSeconds() == 58

        clock.start()

        Thread.sleep(2000)
        // now 4 seconds have elapsed
        clock.update()
        assert clock.getMinutes() == 19
        assert clock.getSeconds() == 56
    }
}
