package canfield.bia;

import io.cucumber.java.After;
import io.cucumber.java.AfterAll;
import io.cucumber.java.Before;
import io.cucumber.java.BeforeAll;
import io.cucumber.java.Scenario;
import io.cucumber.java.en.*;
import org.openqa.selenium.*;
import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

import org.codehaus.jackson.map.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

public class UiIntegrationSteps {
    private static Thread serverThread;
    private static String originalUserDir;
    private static String originalResourceBase;
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static WebDriver driver;
    private static int initialTime;

    public static boolean isServerRunning() {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) URI.create("http://localhost:8080/").toURL().openConnection();
            conn.setConnectTimeout(500);
            conn.setReadTimeout(500);
            conn.setRequestMethod("GET");
            return conn.getResponseCode() == 200;
            // handle response
        } catch (IOException e) {
            throw new RuntimeException(e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    @BeforeAll
    public static void startServer() throws Exception {
        if (isServerRunning()) {
            System.out.println("Server already running, reusing existing instance");
            startChromeDriver();
            return;
        }
        final AtomicReference<Throwable> serverError = setupAndStartServer();

        for (int i = 0; i < 300; i++) {
            if (serverError.get() != null) {
                throw new IllegalStateException("Failed to start service", serverError.get());
            }
            if (isServerRunning()) {
                System.out.println("Server started successfully");
                startChromeDriver();
                return;
            }
            Thread.sleep(100);
        }
        if (serverError.get() != null) {
            throw new IllegalStateException("Failed to start service", serverError.get());
        }
        throw new IllegalStateException("Server failed to start within timeout");
    }

    private static AtomicReference<Throwable> setupAndStartServer() throws IOException {
        originalUserDir = System.getProperty("user.dir");
        originalResourceBase = System.getProperty("RESOURCE_BASE");
        Path dist = Paths.get("src/main/dist").toAbsolutePath();
        System.setProperty("user.dir", dist.toString());
        System.setProperty("RESOURCE_BASE", dist.resolve("web").toString());

        Path webSrc = dist.resolve("web");
        Path webDest = Paths.get("web");
        if (Files.notExists(webDest)) {
            try {
                Files.createSymbolicLink(webDest, webSrc);
            } catch (UnsupportedOperationException | IOException e) {
                Files.walk(webSrc).forEach(src -> {
                    Path dest = webDest.resolve(webSrc.relativize(src).toString());
                    try {
                        if (Files.isDirectory(src)) {
                            Files.createDirectories(dest);
                        } else {
                            Files.copy(src, dest, StandardCopyOption.REPLACE_EXISTING);
                        }
                    } catch (IOException ex) {
                        throw new RuntimeException(ex);
                    }
                });
            }
        }

        final AtomicReference<Throwable> serverError = new AtomicReference<>();
        serverThread = new Thread(() -> {
            try {
                ServiceMain.main(new String[]{"start"});
            } catch (Throwable t) {
                serverError.set(t);
            }
        }, "scoreboard-server");
        serverThread.setDaemon(true);
        serverThread.start();
        return serverError;
    }

    private static void startChromeDriver() {
        System.out.println("[ChromeDriver] Server started, initializing driver");
        String proxy = System.getenv("https_proxy");
        if (proxy != null && !proxy.isEmpty()) {
            URI uri = URI.create(proxy);
            System.setProperty("https.proxyHost", uri.getHost());
            System.setProperty("https.proxyPort", String.valueOf(uri.getPort()));
            System.setProperty("http.proxyHost", uri.getHost());
            System.setProperty("http.proxyPort", String.valueOf(uri.getPort()));
            String proxyHostPort = uri.getHost() + ":" + uri.getPort();
            System.out.println("[ChromeDriver] Using proxy: " + proxyHostPort);
            WebDriverManager.chromedriver().proxy(proxyHostPort).setup();
        } else {
            WebDriverManager.chromedriver().setup();
        }
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage");
        driver = new ChromeDriver(options);
    }

    @AfterAll
    public static void stopServer() throws Exception {
        try {
            ServiceMain.main(new String[]{"stop"});
        } finally {
            if (driver != null) {
                driver.quit();
            }
            if (serverThread != null) {
                serverThread.join(5000);
            }
            Path webDest = Paths.get("web");
            if (Files.exists(webDest)) {
                Files.walk(webDest)
                        .sorted(Comparator.reverseOrder())
                        .forEach(path -> {
                            try {
                                Files.deleteIfExists(path);
                            } catch (IOException ignored) {
                            }
                        });
            }
            if (originalUserDir != null) {
                System.setProperty("user.dir", originalUserDir);
                if (originalResourceBase != null) {
                    System.setProperty("RESOURCE_BASE", originalResourceBase);
                } else {
                    System.clearProperty("RESOURCE_BASE");
                }
            }
        }
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
        // check the tens and minutes digit to be non-zero
        new WebDriverWait(driver, Duration.ofSeconds(2)).until(
                d -> !(d.findElement(By.cssSelector(".digit.minutes.tens")).getText().equals("0")
                       && d.findElement(By.cssSelector(".digit.minutes.ones")).getText().equals("0"))
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
        int afterStart = readClockMillis();
        Assert.assertTrue(afterStart < initialTime, "Clock should count down when running");
        initialTime = afterStart;
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
                d -> d.findElements(By.cssSelector("#home .penalties tbody.list tr")).size() > 0);
    }

    @Then("the home team penalties list should contain {int} penalty for player {int}")
    public void verifyPenalty(int count, int player) {
        List<WebElement> rows = driver.findElements(By.cssSelector("#home .penalties tbody.list tr"));
        Assert.assertEquals(rows.size(), count);
        WebElement first = rows.get(0);
        List<WebElement> cells = first.findElements(By.tagName("td"));
        int playerNum = Integer.parseInt(cells.get(1).getText());
        Assert.assertEquals(playerNum, player);
    }

    private int readScore(String teamSelector) {
        WebElement tens = driver.findElement(By.cssSelector(teamSelector + " .score .digit.tens"));
        WebElement ones = driver.findElement(By.cssSelector(teamSelector + " .score .digit.ones"));
        return Integer.parseInt(tens.getText()) * 10 + Integer.parseInt(ones.getText());
    }

    private int readClockMillis() {
        int minTens = Integer.parseInt(driver.findElement(By.cssSelector(".digit.minutes.tens")).getText());
        int minOnes = Integer.parseInt(driver.findElement(By.cssSelector(".digit.minutes.ones")).getText());
        int secTens = Integer.parseInt(driver.findElement(By.cssSelector(".digit.seconds.tens")).getText());
        int secOnes = Integer.parseInt(driver.findElement(By.cssSelector(".digit.seconds.ones")).getText());
        int minutes = minTens * 10 + minOnes;
        int seconds = secTens * 10 + secOnes;
        return (minutes * 60 + seconds) * 1000;
    }

    private void jsClick(String selector) {
        ((JavascriptExecutor) driver).executeScript(
                "var el=document.querySelector('" + selector + "'); if(el) el.click();");
    }

}
