package canfield.bia.hockey.scoreboard.io

import org.testng.annotations.DataProvider
import org.testng.annotations.Test

/**
 *
 */
class SerialUpdaterTest {

    @Test
    void "10s digit"() {
        assert SerialUpdater.digit(10, 59, 0 as byte) == 0x55
    }

    @Test
    void "10s digit with single digit"() {
        assert SerialUpdater.digit(10, 5, 0 as byte) == 0x00
    }

    @Test(dataProvider = "digits")
    void "digits"(int value, byte tens, byte ones) {
        assert SerialUpdater.digit(1, value, (byte) 0) == ones
        assert SerialUpdater.digit(10, value, (byte) 0) == tens
    }

    @Test(dataProvider = "blank 10s digits")
    void "blank 10s digits"(int value, byte tens, byte ones) {
        assert SerialUpdater.digit(1, value, (byte) 0) == ones
        assert SerialUpdater.digit(10, value, (byte) 0xFF) == tens
    }

    @DataProvider(name = "digits")
    Object[][] "zero 10s digits"() {
        return [
                // value, zero value, expected 10s, expected 1s
                [0, (byte) 0x00, (byte) 0x00],
                [1, (byte) 0x00, (byte) 0x11],
                [10, (byte) 0x11, (byte) 0x00],
                [59, (byte) 0x55, (byte) 0x99],
        ]
    }

    @DataProvider(name = "blank 10s digits")
    Object[][] "0xff 10s digits"() {
        return [
                // value, zero value, expected 10s, expected 1s
                [0, (byte) 0xFF, (byte) 0x00],
                [1, (byte) 0xFF, (byte) 0x11],
                [10, (byte) 0x11, (byte) 0x00],
                [59, (byte) 0x55, (byte) 0x99],
        ]
    }
}
