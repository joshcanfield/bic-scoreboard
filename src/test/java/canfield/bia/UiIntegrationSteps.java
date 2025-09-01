package canfield.bia;

import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import io.cucumber.java.en.*;
import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.*;

import java.nio.file.*;
import java.time.Duration;
import java.util.*;

import static canfield.bia.UiHooks.driver;

public class UiIntegrationSteps {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static int initialTime;

    @After
    public void takeScreenshotOnFailure(Scenario scenario) {
        if (scenario.isFailed() && driver instanceof TakesScreenshot) {
            try {
                byte[] screenshot = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
                Path dir = Paths.get("build", "reports", "screenshots");
                Files.createDirectories(dir);
                String name = scenario.getName().replaceAll("[^a-zA-Z0-9_-]", "_");
                Files.write(dir.resolve(name + ".png"), screenshot);
                scenario.attach(screenshot, "image/png", name);
            } catch (IOException ignored) {
            }
        }
    }

    @Before
    public void resetGame() throws Exception {
        postJson(new HashMap<>());
    }

    private static void postJson(Map<String, Object> body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) URI.create("http://localhost:8080/api/game").toURL().openConnection();
        conn.setRequestMethod("POST");
        conn.setConnectTimeout(2000);
        conn.setReadTimeout(2000);
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json");
        try (OutputStream out = conn.getOutputStream()) {
            MAPPER.writeValue(out, body);
        }
        try (InputStream in = conn.getInputStream()) {
            in.readAllBytes();
        }
    }

    @When("I open the index page")
    public void openIndexPage() {
        driver.get("http://localhost:8080/");
    }

    @Then("the page title should be {string}")
    public void pageTitleShouldBe(String title) {
        Assert.assertEquals(driver.getTitle(), title, "Index page should contain scoreboard title");
    }

    @When("I open the scoreboard page")
    public void openScoreboardPage() {
        driver.get("http://localhost:8080/");
    }

    @Then("I should see an element with id {string}")
    public void elementShouldExist(String id) {
        Assert.assertNotNull(driver.findElement(By.id(id)),
                "Expected element with id '" + id + "' to be present");
    }

    // New step definitions driven by UI interactions

    @Given("the game state is modified")
    public void modifyGameState() throws Exception {
        driver.get("http://localhost:8080/");
        jsClick("a.period-up");
        jsClick("#home button.score-up");
        jsClick("#clock-start");
        Thread.sleep(500);
    }

    @When("I create a new game")
    public void createNewGame() throws Exception {
        jsClick("button[href=\"#new-game-dialog\"]");
        Thread.sleep(100);
        jsClick("#new-game");
        new WebDriverWait(driver, Duration.ofSeconds(2)).until(
                d -> "0".equals(d.findElement(By.cssSelector("#period .digit")).getText()));
    }

    @Then("the game period should be {int}")
    public void gamePeriodShouldBe(int period) {
        int displayed = Integer.parseInt(driver.findElement(By.cssSelector("#period .digit")).getText());
        Assert.assertEquals(displayed, period);
    }

    @Then("the clock should not be running")
    public void clockShouldNotBeRunning() throws InterruptedException {
        int before = readClockMillis();
        Thread.sleep(500);
        int after = readClockMillis();
        Assert.assertEquals(after, before);
    }

    @Then("the home score should be {int}")
    public void homeScoreShouldBe(int score) {
        Assert.assertEquals(readScore("#home"), score);
    }

    @Then("the away score should be {int}")
    public void awayScoreShouldBe(int score) {
        Assert.assertEquals(readScore("#away"), score);
    }

    @Given("the clock is stopped")
    public void theClockIsStopped() {
        driver.get("http://localhost:8080/");
        // the clock starts at 0 when the page loads - wait for it to load
        // wait until the clock text is not 00:00
        new WebDriverWait(driver, Duration.ofSeconds(2)).until(
                d -> {
                    try {
                        String t = d.findElement(By.id("clock-text")).getText().trim();
                        return !"00:00".equals(t);
                    } catch (org.openqa.selenium.NoSuchElementException e) {
                        return false;
                    }
                }
        );

        // ensure the clock is stopped
        jsClick("#clock-pause");
        initialTime = readClockMillis();
        assert initialTime > 0;
    }

    @When("I start the clock")
    public void startTheClock() {
        jsClick("#clock-start");
    }

    @When("I wait {int} milliseconds")
    public void waitMilliseconds(int ms) throws InterruptedException {
        Thread.sleep(ms);
    }

    @Then("the clock should count down")
    public void clockShouldCountDown() {
        new WebDriverWait(driver, Duration.ofSeconds(3))
                .until(d -> readClockMillis() < initialTime);
        initialTime = readClockMillis();
    }

    @When("I stop the clock")
    public void stopTheClock() {
        jsClick("#clock-pause");
        initialTime = readClockMillis();
    }

    @Then("the clock should stay the same")
    public void clockShouldStayTheSame() {
        int stoppedTime2 = readClockMillis();
        Assert.assertEquals(initialTime, stoppedTime2, "Clock should not change when stopped");
    }

    @Given("the game is in period {int}")
    public void setGamePeriod(int period) throws InterruptedException {
        driver.get("http://localhost:8080/");
        int current = Integer.parseInt(driver.findElement(By.cssSelector("#period .digit")).getText());
        while (current < period) {
            jsClick(".period-up");
            Thread.sleep(100);
            current++;
        }
        while (current > period) {
            jsClick(".period-down");
            Thread.sleep(100);
            current--;
        }
    }

    @When("I add a penalty for player {int} to the home team")
    public void addPenalty(int player) throws InterruptedException {
        jsClick("#home .penalties a.penalty");
        Thread.sleep(100);
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("document.getElementById('add-penalty-player').value='" + player + "';");
        js.executeScript("document.getElementById('add-penalty-serving').value='" + player + "';");
        js.executeScript("document.getElementById('add-penalty-time').value='2:00';");
        js.executeScript("document.getElementById('add-penalty-off_ice').value='2:00';");
        jsClick("#add-penalty-add");
        new WebDriverWait(driver, Duration.ofSeconds(2)).until(
                d -> !d.findElements(By.cssSelector("#home .penalties tbody.list tr")).isEmpty());
    }

    @Then("the home team penalties list should contain {int} penalty for player {int}")
    public void verifyPenalty(int count, int player) {
        List<WebElement> rows = driver.findElements(By.cssSelector("#home .penalties tbody.list tr"));
        Assert.assertEquals(rows.size(), count);
        WebElement first = rows.getFirst();
        List<WebElement> cells = first.findElements(By.tagName("td"));
        int playerNum = Integer.parseInt(cells.get(1).getText());
        Assert.assertEquals(playerNum, player);
    }

    private int readScore(String teamSelector) {
        String id = teamSelector.replace("#", "").trim() + "-score"; // "#home" -> "home-score"
        WebElement el = driver.findElement(By.id(id));
        String txt = el.getText().trim();
        return Integer.parseInt(txt);
    }

    private int readClockMillis() {
        String txt = driver.findElement(By.id("clock-text")).getText().trim(); // mm:ss
        String[] parts = txt.split(":");
        int minutes = Integer.parseInt(parts[0]);
        int seconds = Integer.parseInt(parts[1]);
        return (minutes * 60 + seconds) * 1000;
    }

    private void jsClick(String selector) {
        ((JavascriptExecutor) driver).executeScript(
                "var el=document.querySelector('" + selector + "'); if(el) el.click();");
    }
}
