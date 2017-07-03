package canfield.bia.hockey.scoreboard

import org.testng.annotations.Test

/**
 *
 */
class GameClockTest {

    @Test
    void "can create scoreboard clock"() {
        def clock = new GameClock(20,00)

        def time = clock.getTime()

        assert time.getMinutes() == 20
        assert time.getSeconds() == 0
    }

    @Test
    void "expected clock after sleeping half second"() {
        def clock = new GameClock(20,00)

        clock.start()

        Thread.sleep(500)

        def time = clock.getTime()
        assert time.getMinutes() == 20
        assert time.getSeconds() == 0
    }

    @Test
    void "expected clock after sleeping 5 seconds"() {
        def clock = new GameClock(20,00)

        clock.start()

        Thread.sleep(5000)

        def time = clock.getTime()
        assert time.getMinutes() == 19
        assert time.getSeconds() == 55
    }

    @Test
    void "expected clock after pause"() {
        def clock = new GameClock(20,00)
        clock.start()
        Thread.sleep(2000)
        clock.stop()
        // 2 seconds elapsed
        def time = clock.getTime()
        assert time.getMinutes() == 19
        assert time.getSeconds() == 58

        Thread.sleep(2000)
        // 2 seconds elapsed still
        time = clock.getTime()
        assert time.getMinutes() == 19
        assert time.getSeconds() == 58

        clock.start()

        Thread.sleep(2000)
        // now 4 seconds have elapsed
        time = clock.getTime()
        assert time.getMinutes() == 19
        assert time.getSeconds() == 56
    }
}
