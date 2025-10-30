package canfield.bia;

import io.cucumber.java.AfterAll;
import io.cucumber.java.BeforeAll;
import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.file.*;
import java.util.Comparator;
import java.util.concurrent.atomic.AtomicReference;

public class UiHooks {
    static Thread serverThread;
    static String originalUserDir;
    static String originalResourceBase;
    public static WebDriver driver;

    static boolean isServerRunning() {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) URI.create("http://localhost:8080/").toURL().openConnection();
            conn.setConnectTimeout(500);
            conn.setReadTimeout(500);
            conn.setRequestMethod("GET");
            return conn.getResponseCode() == 200;
        } catch (IOException e) {
            return false;
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
            return;
        }
        final AtomicReference<Throwable> serverError = setupAndStartServer();

        for (int i = 0; i < 300; i++) {
            if (serverError.get() != null) {
                throw new IllegalStateException("Failed to start service", serverError.get());
            }
            if (isServerRunning()) {
                System.out.println("Server started successfully");
                return;
            }
            Thread.sleep(100);
        }
        if (serverError.get() != null) {
            throw new IllegalStateException("Failed to start service", serverError.get());
        }
        throw new IllegalStateException("Server failed to start within timeout");
    }

    @BeforeAll
    public static void startChromeDriver() {
        initChromeDriver();
    }

    private static AtomicReference<Throwable> setupAndStartServer() throws IOException {
        originalUserDir = System.getProperty("user.dir");
        originalResourceBase = System.getProperty("RESOURCE_BASE");
        Path dist = Paths.get("src/main/dist").toAbsolutePath();
        System.setProperty("user.dir", dist.toString());
        // Serve from web-generated (TypeScript build output) for tests
        System.setProperty("RESOURCE_BASE", dist.resolve("web-generated").toString());

        // Create symlink or copy web-generated folder for relative path access
        Path webSrc = dist.resolve("web-generated");
        Path webDest = Paths.get("web-generated");
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

    private static void initChromeDriver() {
        System.out.println("[ChromeDriver] Initializing driver");
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
    public static void stopChromeDriver() {
        if (driver != null) {
            driver.quit();
        }
    }

    @AfterAll
    public static void stopServer() throws Exception {
        try {
            ServiceMain.main(new String[]{"stop"});
        } finally {
            if (serverThread != null) {
                serverThread.join(5000);
            }
            // Clean up the web-generated symlink/copy created for tests
            Path webDest = Paths.get("web-generated");
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
}

