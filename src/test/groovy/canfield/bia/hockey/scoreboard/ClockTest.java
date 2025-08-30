package canfield.bia.hockey.scoreboard;

import static org.testng.Assert.*;

import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

/**
 *
 */
public class ClockTest {
  @Test
  public void testGetMinutes() throws Exception {
    assertEquals(Clock.getMinutes(1000), 0);
    assertEquals(Clock.getMinutes(5000), 0);
    assertEquals(Clock.getMinutes(60000), 1);
    assertEquals(Clock.getMinutes(70000), 1);
  }

  @Test
  public void testGetSeconds() throws Exception {
    assertEquals(Clock.getSeconds(1000), 1);
    assertEquals(Clock.getSeconds(5000), 5);
    assertEquals(Clock.getSeconds(60000), 0);
    assertEquals(Clock.getSeconds(71000), 11);

  }

  @Test
  public void testGetTenthsOfSecond() throws Exception {
    assertEquals(Clock.getTenthsOfSecond(1110), 1);
    assertEquals(Clock.getTenthsOfSecond(5330), 3);
    assertEquals(Clock.getTenthsOfSecond(60330), 3);
    assertEquals(Clock.getTenthsOfSecond(71200), 2);
  }

}