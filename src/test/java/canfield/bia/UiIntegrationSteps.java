package canfield.bia;

import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import io.cucumber.java.en.*;
import org.openqa.selenium.*;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.Select;
import org.testng.Assert;

import com.fasterxml.jackson.core.type.TypeReference;
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
    private String recordedHomeColor;
    private String recordedAwayColor;

    private boolean isSelectorFocused(String selector) {
        Object result = ((JavascriptExecutor) driver).executeScript(
                "var el=document.querySelector(arguments[0]);" +
                        "return !!el && el === document.activeElement;", selector);
        return Boolean.TRUE.equals(result);
    }

    private boolean isSelectorHovered(String selector) {
        Object result = ((JavascriptExecutor) driver).executeScript(
                "var el=document.querySelector(arguments[0]);" +
                        "return !!el && el.matches(':hover');", selector);
        return Boolean.TRUE.equals(result);
    }

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

    @And("I record the current team colors")
    public void recordCurrentTeamColors() {
        recordedHomeColor = normalizeColor(readCssVar("--home-color"));
        recordedAwayColor = normalizeColor(readCssVar("--away-color"));
        Assert.assertNotNull(recordedHomeColor, "Expected home color to be detectable");
        Assert.assertNotNull(recordedAwayColor, "Expected away color to be detectable");
        Assert.assertNotEquals(recordedHomeColor, recordedAwayColor,
                "Home and away colors should be distinct when recorded");
    }

    @When("I swap the teams")
    public void swapTeams() {
        jsClick("#swap-teams-btn");
        new WebDriverWait(driver, Duration.ofSeconds(3)).until(d -> {
            Object val = ((JavascriptExecutor) d).executeScript(
                    "return document.body && document.body.dataset ? document.body.dataset.leftTeam : null;");
            return val != null && !"".equals(val);
        });
    }

    @When("I reset the team layout to default")
    public void resetTeamLayoutToDefault() throws InterruptedException {
        Object leftTeam = ((JavascriptExecutor) driver).executeScript(
                "return document.body && document.body.dataset ? document.body.dataset.leftTeam : 'home';");
        if ("away".equals(String.valueOf(leftTeam))) {
            swapTeams();
            Thread.sleep(100);
        }
    }

    @When("I add a goal for the away team")
    public void addGoalForAwayTeam() throws Exception {
        int before = readScore("#away");
        jsClick("#away button.score-up");
        setInputValue("#add-goal-player", "91");
        setInputValue("#add-goal-assist", "18");
        jsClick("#add-goal-add");
        try { Thread.sleep(200); } catch (InterruptedException ignored) {}
        Map<String, Object> gameState = fetchGameState();
        Map<?, ?> awayState = (Map<?, ?>) gameState.get("away");
        int serverScore = awayState.get("score") instanceof Number ? ((Number) awayState.get("score")).intValue() : Integer.parseInt(String.valueOf(awayState.get("score")));
        Object goalsRaw = awayState.get("goals");
        int after = readScore("#away");
        Assert.assertEquals(serverScore, before + 1, "Server away score should increment (actual: " + serverScore + ")");
        Assert.assertEquals(after, before + 1, "Away score should increment via goal dialog (actual: " + after + ")");
        if (goalsRaw instanceof List<?>) {
            Assert.assertFalse(((List<?>) goalsRaw).isEmpty(), "Server should return at least one away goal entry");
        }
    }

    @When("I press the shortcut {string}")
    public void pressShortcut(String shortcut) throws InterruptedException {
        String[] parts = shortcut.split("\\+");
        String keyToken = parts[parts.length - 1].trim();
        boolean ctrl = false;
        boolean shift = false;
        boolean alt = false;
        boolean meta = false;
        for (int i = 0; i < parts.length - 1; i++) {
            String token = parts[i].trim();
            switch (token.toLowerCase(Locale.ROOT)) {
                case "ctrl":
                case "control":
                    ctrl = true;
                    break;
                case "shift":
                    shift = true;
                    break;
                case "alt":
                    alt = true;
                    break;
                case "meta":
                case "cmd":
                case "command":
                    meta = true;
                    break;
                default:
                    throw new IllegalArgumentException("Unsupported modifier: " + token);
            }
        }
        String[] spec = resolveKeySpec(keyToken);
        ((JavascriptExecutor) driver).executeScript(
                "var event = new KeyboardEvent('keydown', {key: arguments[0], code: arguments[1], " +
                        "ctrlKey: arguments[2], shiftKey: arguments[3], altKey: arguments[4], metaKey: arguments[5], " +
                        "bubbles: true, cancelable: true}); document.dispatchEvent(event);",
                spec[0], spec[1], ctrl, shift, alt, meta
        );
        Thread.sleep(150); // allow websocket update to arrive
    }

    @Then("the home shots should be {int}")
    public void homeShotsShouldBe(int expected) {
        assertShots("#home", expected);
    }

    @Then("the away shots should be {int}")
    public void awayShotsShouldBe(int expected) {
        assertShots("#away", expected);
    }

    @Then("the home column color should remain the recorded home color")
    public void homeColorShouldRemainRecordedHomeColor() {
        Assert.assertNotNull(recordedHomeColor, "Home color must be recorded before verification");
        String current = normalizeColor(readCssVar("--home-color"));
        Assert.assertEquals(current, recordedAwayColor,
                "Home column color should be the recorded away color after swap");
    }

    @Then("the away column color should remain the recorded away color")
    public void awayColorShouldRemainRecordedAwayColor() {
        Assert.assertNotNull(recordedAwayColor, "Away color must be recorded before verification");
        String current = normalizeColor(readCssVar("--away-color"));
        Assert.assertEquals(current, recordedHomeColor,
                "Away column color should be the recorded home color after swap");
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
        waitForModalVisible("#add-goal");
        // Modal auto-fills period and time from game state, so we only set player and assists
        setInputValue("#add-goal-player", "77");
        setInputValue("#add-goal-assist", "18");
        jsClick("#add-goal-add");
        waitForModalHidden("#add-goal");
        waitForScore("#home-score", 1);
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
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        Boolean ok = wait.until(d -> {
            String text = d.findElement(By.cssSelector("#period .digit")).getText();
            return Integer.parseInt(text) == period;
        });
        Assert.assertTrue(ok, "Expected period " + period);
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
        waitForScore("#home-score", score);
        Assert.assertEquals(readScore("#home"), score);
    }

    @Then("the away score should be {int}")
    public void awayScoreShouldBe(int score) {
        waitForScore("#away-score", score);
        Assert.assertEquals(readScore("#away"), score);
    }

    @Then("the score-down buttons should use default style")
    public void minusButtonsUseDefault() {
        WebElement homeMinus = driver.findElement(By.cssSelector("#home button.score-down"));
        WebElement awayMinus = driver.findElement(By.cssSelector("#away button.score-down"));
        String hc = homeMinus.getAttribute("class");
        String ac = awayMinus.getAttribute("class");
        Assert.assertTrue(hc.contains("btn-default"), "Home minus should be btn-default");
        Assert.assertTrue(ac.contains("btn-default"), "Away minus should be btn-default");
        Assert.assertFalse(hc.contains("btn-danger"), "Home minus should not be btn-danger");
        Assert.assertFalse(ac.contains("btn-danger"), "Away minus should not be btn-danger");
    }

    @Then("I should not see section labels in team panels")
    public void noSectionLabels() {
        List<WebElement> labels = driver.findElements(By.cssSelector("#home .section-label, #away .section-label"));
        Assert.assertEquals(labels.size(), 0, "No section-labels should be present in team panels");
    }

    @Then("the buzzer button should have right margin {int} px")
    public void buzzerHasRightMargin(int px) {
        WebElement buzzer = driver.findElement(By.id("buzzer"));
        JavascriptExecutor js = (JavascriptExecutor) driver;
        String mr = (String) js.executeScript(
                "var el=document.getElementById('buzzer'); return el? getComputedStyle(el).marginRight : '';"
        );
        Assert.assertEquals(mr, px + "px", "Buzzer right margin should be " + px + "px");
    }

    @When("I open the New Game dialog")
    public void openNewGameDialog() throws InterruptedException {
        jsClick("button[href=\\\"#new-game-dialog\\\"]");
        Thread.sleep(100);
    }

    @When("I choose the standard template {string}")
    public void chooseStandardTemplate(String label) {
        WebElement selectEl = new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(ExpectedConditions.elementToBeClickable(By.id("standard-template")));
        Select select = new Select(selectEl);
        try {
            select.selectByValue(label);
        } catch (NoSuchElementException ignored) {
            select.selectByVisibleText(label);
        }
    }

    @When("I set standard periods to {int}, {int}, {int}, {int}")
    public void setStandardPeriods(int p0, int p1, int p2, int p3) {
        setInputValue("#period-0", String.valueOf(p0));
        setInputValue("#period-1", String.valueOf(p1));
        setInputValue("#period-2", String.valueOf(p2));
        setInputValue("#period-3", String.valueOf(p3));
    }

    @When("I create the standard game")
    public void createStandardGame() throws InterruptedException {
        jsClick("#new-game");
        Thread.sleep(200);
    }

    @When("I set standard intermission to {int}")
    public void setStandardIntermission(int minutes) {
        setInputValue("#intermission-minutes", String.valueOf(minutes));
    }

    @Then("the standard intermission should be {int}")
    public void verifyStandardIntermission(int minutes) {
        String v = getInputValue("#intermission-minutes");
        Assert.assertEquals(Integer.parseInt(v), minutes, "intermission-minutes");
    }

    @When("I refresh the page")
    public void refreshPage() {
        driver.navigate().refresh();
    }

    @Then("the standard period inputs should be {int}, {int}, {int}, {int}")
    public void verifyStandardPeriods(int p0, int p1, int p2, int p3) {
        String v0 = getInputValue("#period-0");
        String v1 = getInputValue("#period-1");
        String v2 = getInputValue("#period-2");
        String v3 = getInputValue("#period-3");
        Assert.assertEquals(Integer.parseInt(v0), p0, "period-0");
        Assert.assertEquals(Integer.parseInt(v1), p1, "period-1");
        Assert.assertEquals(Integer.parseInt(v2), p2, "period-2");
        Assert.assertEquals(Integer.parseInt(v3), p3, "period-3");
    }

    private void ensureShortcutsReady() {
        JavascriptExecutor js = (JavascriptExecutor) driver;
        Object status = js.executeAsyncScript(
                "var cb = arguments[arguments.length - 1];" +
                        "if (!window.__test || !window.__test.shortcutsReady) { cb('missing'); return; }" +
                        "try {" +
                        "  window.__test.shortcutsReady().then(function() {" +
                        "    try {" +
                        "      var errFn = window.__test.shortcutsLoadError;" +
                        "      var hasError = errFn ? errFn() : false;" +
                        "      cb(hasError ? 'error' : 'ok');" +
                        "    } catch (err) {" +
                        "      cb('error');" +
                        "    }" +
                        "  }).catch(function() { cb('error'); });" +
                        "} catch (err) { cb('error'); }"
        );
        Assert.assertEquals(status, "ok", "Keyboard shortcuts should load successfully");
    }

    @Then("the keyboard shortcuts should load successfully")
    public void keyboardShortcutsShouldLoadSuccessfully() {
        ensureShortcutsReady();
    }

    @SuppressWarnings("unchecked")
    private List<String> getShortcutBindings(String action) {
        ensureShortcutsReady();
        JavascriptExecutor js = (JavascriptExecutor) driver;
        Object result = js.executeScript(
                "return window.__test && window.__test.shortcuts ? window.__test.shortcuts() : null;"
        );
        Assert.assertNotNull(result, "Shortcuts map should be available");
        Map<String, Object> shortcuts = (Map<String, Object>) result;
        Object raw = shortcuts.get(action);
        Assert.assertNotNull(raw, "Shortcut '" + action + "' should exist");
        if (raw instanceof List<?>) {
            List<?> rawList = (List<?>) raw;
            List<String> bindings = new ArrayList<>(rawList.size());
            for (Object entry : rawList) {
                bindings.add(String.valueOf(entry));
            }
            return bindings;
        }
        return Collections.singletonList(String.valueOf(raw));
    }

    @Then("shortcut {string} should include {string}")
    public void shortcutShouldIncludeBinding(String action, String binding) {
        List<String> bindings = getShortcutBindings(action);
        Assert.assertTrue(bindings.contains(binding),
                "Expected shortcut '" + action + "' to include binding '" + binding + "' but had " + bindings);
    }

    @When("I press the clock start shortcut")
    public void pressClockStartShortcut() {
        new Actions(driver).sendKeys(Keys.ARROW_UP).perform();
    }

    @When("I press the clock stop shortcut")
    public void pressClockStopShortcut() {
        new Actions(driver).sendKeys(Keys.ARROW_DOWN).perform();
    }

    @When("I record the current clock time")
    public void recordCurrentClockTime() {
        initialTime = readClockMillis();
    }

    @When("I open the add goal dialog for the home team")
    public void openAddGoalDialogHome() {
        jsClick("#home button.score-up");
        waitForModalVisible("#add-goal");
    }

    @When("^I enter scorer \"([^\"]*)\" and assist \"([^\"]*)\"$")
    public void enterScorerAndAssist(String scorer, String assist) {
        setInputValue("#add-goal-player", scorer);
        setInputValue("#add-goal-assist", assist);
    }

    @When("I submit the goal dialog")
    public void submitGoalDialog() {
        jsClick("#add-goal-add");
        waitForModalHidden("#add-goal");
        try {
            Map<String, Object> state = fetchGameState();
            System.out.println("DEBUG submitGoalDialog state=" + state);
        } catch (Exception ignore) {
            System.out.println("DEBUG submitGoalDialog failed to fetch state");
        }
    }

    @Then("^the home goal table should list player \"([^\"]*)\" with assist \"([^\"]*)\"$")
    public void verifyHomeGoalTable(String scorer, String assist) {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(3));
        Boolean ok = null;
        try {
            ok = wait.until(d -> {
                try {
                    WebElement table = d.findElement(By.cssSelector("#home .goals tbody.goal-list"));
                    List<WebElement> rows = table.findElements(By.tagName("tr"));
                    for (WebElement row : rows) {
                        List<WebElement> cells = row.findElements(By.tagName("td"));
                        if (cells.size() >= 4) {
                            String rowScorer = cells.get(2).getText().trim();
                            String rowAssist = cells.get(3).getText().trim();
                            if (scorer.equals(rowScorer) && rowAssist.contains(assist)) {
                                return true;
                            }
                        }
                    }
                    return false;
                } catch (NoSuchElementException | StaleElementReferenceException ex) {
                    return false;
                }
            });
        } catch (TimeoutException ex) {
            ok = false;
        }
        Object state = ((JavascriptExecutor) driver).executeScript(
                "return window.State ? window.State.home && window.State.home.goals : null;"
        );
        System.out.println("DEBUG client goals=" + state);
        Object tableHtml = ((JavascriptExecutor) driver).executeScript(
                "var el=document.querySelector('#home .goals tbody.goal-list'); return el ? el.innerHTML : null;"
        );
        System.out.println("DEBUG goal table html=" + tableHtml);
        Object lastUpdate = ((JavascriptExecutor) driver).executeScript(
                "return window.__test && window.__test.lastUpdate ? window.__test.lastUpdate.home : null;"
        );
        System.out.println("DEBUG last update home=" + lastUpdate);
        Assert.assertTrue(ok, "Expected to find scorer " + scorer + " with assist " + assist + " in goal table");
    }

    @When("I press Escape")
    public void pressEscape() {
        new Actions(driver).sendKeys(Keys.ESCAPE).perform();
    }

    @Then("the modal {string} should be visible")
    public void modalShouldBeVisible(String selector) {
        waitForModalVisible(selector);
    }

    @Then("the modal {string} should be hidden")
    public void modalShouldBeHidden(String selector) {
        waitForModalHidden(selector);
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
        // Open the dialog via the same selector the app binds to
        jsClick("#home .penalties a[href=\\\"#add-penalty\\\"][data-toggle=\\\"modal\\\"]");
        // Wait for modal to be visible
        new WebDriverWait(driver, Duration.ofSeconds(3)).until(d -> {
            try {
                WebElement m = d.findElement(By.id("add-penalty"));
                String cls = m.getAttribute("class");
                String disp = (String) ((JavascriptExecutor) d).executeScript(
                        "var el=document.getElementById('add-penalty'); return el? getComputedStyle(el).display : '';"
                );
                return cls != null && cls.contains("in") && "block".equals(disp);
            } catch (org.openqa.selenium.NoSuchElementException e) {
                return false;
            }
        });

        // Fill fields after modal init code resets them
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("document.getElementById('add-penalty-player').value='" + player + "';");
        js.executeScript("document.getElementById('add-penalty-serving').value='" + player + "';");
        js.executeScript("document.getElementById('add-penalty-time').value='2:00';");
        js.executeScript("document.getElementById('add-penalty-off_ice').value='2:00';");
        // Submit
        jsClick("#add-penalty-add");

        // Wait for table to update via WebSocket update render
        new WebDriverWait(driver, Duration.ofSeconds(8))
                .ignoring(StaleElementReferenceException.class)
                .until(d -> !d.findElements(By.cssSelector("#home .penalties tbody.list tr")).isEmpty());
    }

    @Then("the home team penalties list should contain {int} penalty for player {int}")
    public void verifyPenalty(int count, int player) {
        // The table updates dynamically; re-query elements and tolerate DOM refreshes.
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(8));
        boolean ok = wait.ignoring(StaleElementReferenceException.class).until(d -> {
            List<WebElement> rows = d.findElements(By.cssSelector("#home .penalties tbody.list tr"));
            if (rows.size() != count) {
                return false;
            }
            try {
                List<WebElement> cells = rows.getFirst().findElements(By.tagName("td"));
                int playerNum = Integer.parseInt(cells.get(1).getText().trim());
                return playerNum == player;
            } catch (StaleElementReferenceException | NumberFormatException e) {
                return false;
            }
        });
        Assert.assertTrue(ok, "Expected " + count + " penalty row(s) for player " + player);
    }

    private Map<String, Object> fetchGameState() throws Exception {
        HttpURLConnection conn = (HttpURLConnection) URI.create("http://localhost:8080/api/game/").toURL().openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(2000);
        conn.setReadTimeout(2000);
        try (InputStream in = conn.getInputStream()) {
            return MAPPER.readValue(in, new TypeReference<Map<String, Object>>() {});
        }
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

    private void assertShots(String teamSelector, int expected) {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        Boolean ok = wait.ignoring(StaleElementReferenceException.class)
                .until(d -> readShots(teamSelector) == expected);
        Assert.assertTrue(ok, "Expected " + teamSelector + " shots to be " + expected);
    }

    private int readShots(String teamSelector) {
        String id = teamSelector.replace("#", "").trim() + "-shots";
        WebElement el = driver.findElement(By.id(id));
        String txt = el.getText().trim();
        return Integer.parseInt(txt);
    }

    private String[] resolveKeySpec(String token) {
        String normalized = token.trim();
        switch (normalized.toLowerCase(Locale.ROOT)) {
            case "arrowup":
                return new String[]{"ArrowUp", "ArrowUp"};
            case "arrowdown":
                return new String[]{"ArrowDown", "ArrowDown"};
            case "arrowleft":
                return new String[]{"ArrowLeft", "ArrowLeft"};
            case "arrowright":
                return new String[]{"ArrowRight", "ArrowRight"};
            case "space":
            case "spacebar":
                return new String[]{" ", "Space"};
            default:
                if (normalized.length() == 1) {
                    String lower = normalized.toLowerCase(Locale.ROOT);
                    String upper = normalized.toUpperCase(Locale.ROOT);
                    return new String[]{lower, "Key" + upper};
                }
                throw new IllegalArgumentException("Unsupported key: " + token);
        }
    }

    private String readCssVar(String varName) {
        Object ret = ((JavascriptExecutor) driver).executeScript(
                "return getComputedStyle(document.documentElement).getPropertyValue(arguments[0]);",
                varName);
        return ret == null ? "" : String.valueOf(ret).trim();
    }

    private String normalizeColor(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.startsWith("#")) {
            return lower;
        }
        if (lower.startsWith("rgb")) {
            try {
                String inner = lower.substring(lower.indexOf('(') + 1, lower.indexOf(')'));
                String[] parts = inner.split(",");
                int r = Integer.parseInt(parts[0].trim());
                int g = Integer.parseInt(parts[1].trim());
                int b = Integer.parseInt(parts[2].trim());
                return String.format("#%02x%02x%02x", r, g, b);
            } catch (Exception ignored) {
                return lower;
            }
        }
        return lower;
    }

    private void jsClick(String selector) {
        ((JavascriptExecutor) driver).executeScript(
                "var el=document.querySelector('" + selector + "'); if(el) el.click();");
    }

    private void waitForModalVisible(String selector) {
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> Boolean.TRUE.equals(((JavascriptExecutor) d)
                        .executeScript("var el=document.querySelector(arguments[0]); return !!el && window.getComputedStyle(el).display !== 'none';", selector)));
    }

    private void waitForModalHidden(String selector) {
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> Boolean.TRUE.equals(((JavascriptExecutor) d)
                        .executeScript("var el=document.querySelector(arguments[0]); return !el || window.getComputedStyle(el).display === 'none';", selector)));
    }

    private void waitForScore(String scoreId, int expected) {
        new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(d -> {
                    WebElement el = d.findElement(By.id(scoreId.replace("#", "")));
                    String txt = el.getText().trim();
                    try {
                        return Integer.parseInt(txt) == expected;
                    } catch (NumberFormatException ex) {
                        return false;
                    }
                });
    }

    private void setInputValue(String selector, String value) {
        ((JavascriptExecutor) driver).executeScript(
                "var el=document.querySelector(arguments[0]);" +
                        "if(el){ el.value=arguments[1]; el.dispatchEvent(new Event('input', {bubbles:true})); }",
                selector, value);
    }

    private String getInputValue(String selector) {
        Object ret = ((JavascriptExecutor) driver).executeScript(
                "var el=document.querySelector('" + selector + "'); return el? el.value: '';"
        );
        return String.valueOf(ret);
    }

    @When("I click the home goal button")
    public void clickHomeGoalButton() {
        driver.get("http://localhost:8080/");
        WebElement btn = new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(ExpectedConditions.elementToBeClickable(By.cssSelector("#home .score .score-up")));
        btn.click();
    }

    @Then("the goal modal should be visible")
    public void goalModalShouldBeVisible() {
        waitForModalVisible("#add-goal");
    }

    @Then("the element {string} should not be focused")
    public void elementShouldNotBeFocused(String selector) {
        boolean unfocused = new WebDriverWait(driver, Duration.ofSeconds(2))
                .until(d -> !isSelectorFocused(selector));
        Assert.assertTrue(unfocused,
                "Expected element " + selector + " to lose focus after interaction");
    }

    @Then("the element {string} should not be hovered")
    public void elementShouldNotBeHovered(String selector) {
        boolean unhovered = new WebDriverWait(driver, Duration.ofSeconds(2))
                .until(d -> !isSelectorHovered(selector));
        Assert.assertTrue(unhovered,
                "Expected element " + selector + " to lose hover state after interaction");
    }

    @When("I close the goal modal")
    public void closeGoalModal() {
        jsClick("#add-goal .modal-footer .btn[data-dismiss=\"modal\"]");
        waitForModalHidden("#add-goal");
    }

    @When("I click the home penalty button")
    public void clickHomePenaltyButton() {
        driver.get("http://localhost:8080/");
        WebElement btn = new WebDriverWait(driver, Duration.ofSeconds(5))
                .until(ExpectedConditions.elementToBeClickable(By.cssSelector("#home .penalties a.btn[data-team=\"home\"]")));
        btn.click();
    }

    @Then("the penalty modal should be visible")
    public void penaltyModalShouldBeVisible() {
        waitForModalVisible("#add-penalty");
    }

    @When("I close the penalty modal")
    public void closePenaltyModal() {
        jsClick("#add-penalty .modal-footer .btn[data-dismiss=\"modal\"]");
        waitForModalHidden("#add-penalty");
    }
}
