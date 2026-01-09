package canfield.bia;

import canfield.bia.hockey.scoreboard.ScoreBoardImpl;
import canfield.bia.hockey.scoreboard.io.ScoreboardAdapterImpl;
import canfield.bia.hockey.v2.engine.*;
import canfield.bia.hockey.v2.spec.CreateGameCommand;
import canfield.bia.hockey.v2.web.GameWebSocketV2;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.*;
import java.awt.*;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.net.URI;
import java.util.Collections;

/**
 *
 */
public class ServiceMain {
    private static HockeyGameServer hockeyGameServer;
    private static GameWebSocketV2 gameWebSocketV2; // New WebSocket server
    private static final Logger log = LoggerFactory.getLogger(ServiceMain.class);
    private static volatile JFrame startupFrame;

    public static void main(String[] args) {

        if (args.length == 0 || args[0].equals("start")) {
            // only try to start if we're already started
            if (hockeyGameServer == null) {

                normalizeAppWorkingDir();
                maybeShowStartupWindow();

                // --- New Architecture Components Initialization ---
                JsonTemplateRepository templateRepository = new JsonTemplateRepository();
                
                // Legacy ScoreBoard and Adapter
                ScoreBoardImpl legacyScoreBoard = new ScoreBoardImpl();
                ScoreboardAdapterImpl legacyScoreboardAdapter = new ScoreboardAdapterImpl(legacyScoreBoard, "COM1"); // Default port, can be configured
                legacyScoreboardAdapter.start(); // Start the legacy adapter

                LegacyScoreboardHardwareAdapter hardwareOutputAdapter = new LegacyScoreboardHardwareAdapter(legacyScoreBoard);
                ScheduledGameTimer gameTimer = new ScheduledGameTimer();
                StateDiffer stateDiffer = new StateDiffer();

                // Initialize GameWebSocketV2 first, so we can pass its broadcast method to GameEngine
                gameWebSocketV2 = new GameWebSocketV2(8082, stateDiffer); // Port 8082 for new WebSocket
                
                // GameEngine now takes a consumer for state changes
                GameEngine gameEngine = new GameEngine(templateRepository, hardwareOutputAdapter, gameTimer, (oldState, newState) -> gameWebSocketV2.broadcastStateChange(oldState, newState));
                gameWebSocketV2.setGameEngine(gameEngine); // Set GameEngine in GameWebSocketV2 after it's fully constructed

                try {
                    gameEngine.processCommand(new CreateGameCommand("USAH_ADULT_20", Collections.emptyMap()), System.currentTimeMillis());
                } catch (Exception e) {
                    log.warn("Failed to initialize default game state", e);
                }

                gameWebSocketV2.start();
                // --- End New Architecture Components Initialization ---

                hockeyGameServer = new HockeyGameServer();
                addShutdownHook();
                try {
                    hockeyGameServer.start();
                } catch (Throwable t) {
                    log.error("Failed to start service", t);
                    SwingUtilities.invokeLater(() -> {
                        try {
                            JOptionPane.showMessageDialog(
                                    startupFrame,
                                    "Failed to start: " + String.valueOf(t.getMessage()),
                                    "Scoreboard Error",
                                    JOptionPane.ERROR_MESSAGE);
                        } catch (Exception ignored) {}
                    });
                }
            } else {
                log.info("Service already running...");
            }
        } else {
            if (hockeyGameServer != null) {
                log.info("Stopping server...");
                hockeyGameServer.stop();
                if (gameWebSocketV2 != null) { // Stop new WebSocket server
                    try { gameWebSocketV2.stop(); } catch (InterruptedException e) { log.error("Error stopping new WebSocket server", e); }
                }
                if (startupFrame != null) {
                    try { startupFrame.dispose(); } catch (Exception ignored) {}
                    startupFrame = null;
                }
            } else {
                log.warn("Unable to stop server: Service isn't running!");
            }
        }
    }



    private static void normalizeAppWorkingDir() {
        try {
            java.net.URL loc = ServiceMain.class.getProtectionDomain().getCodeSource().getLocation();
            java.io.File jarOrDir = new java.io.File(loc.toURI());
            java.io.File appDir = jarOrDir.getParentFile(); // .../scoreboard/app
            if (appDir != null && appDir.getName().equalsIgnoreCase("app")) {
                java.io.File root = appDir.getParentFile(); // .../scoreboard
                if (root != null && root.isDirectory()) {
                    // Point static resources to the packaged web-generated folder (TypeScript build output)
                    // Fall back to web folder if web-generated doesn't exist (backward compatibility)
                    java.io.File webGenerated = new java.io.File(root, "web-generated");
                    java.io.File web = new java.io.File(root, "web");
                    if (webGenerated.isDirectory()) {
                        System.setProperty("RESOURCE_BASE", webGenerated.getAbsolutePath());
                    } else if (web.isDirectory()) {
                        System.setProperty("RESOURCE_BASE", web.getAbsolutePath());
                    }
                    // Ensure logs directory exists for logback file appender
                    java.io.File logs = new java.io.File(root, "logs");
                    if (!logs.exists()) {
                        try { logs.mkdirs(); } catch (Exception ignored) {}
                    }
                    // Set user.dir to root so relative paths (e.g., ./logs) resolve
                    System.setProperty("user.dir", root.getAbsolutePath());
                }
            }
        } catch (Exception ignored) {
        }
    }

    private static void maybeShowStartupWindow() {
        String show = System.getProperty("scoreboard.showDialog", "false");
        if (!Boolean.parseBoolean(show)) return;
        if (GraphicsEnvironment.isHeadless()) return;
        try {
            SwingUtilities.invokeLater(() -> {
                try {
                    JFrame frame = new JFrame("BIA Scoreboard");
                    // Try to set a nicer window icon so the taskbar shows branding
                    try {
                        java.io.File iconFile = new java.io.File("web/img/bic-logo.png");
                        if (iconFile.exists()) {
                            Image img = Toolkit.getDefaultToolkit().getImage(iconFile.getAbsolutePath());
                            frame.setIconImage(img);
                        }
                    } catch (Exception ignored) {}
                    // Manage close behavior ourselves to guarantee process exit
                    frame.setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
                    JPanel panel = new JPanel();
                    panel.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
                    panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));

                    JLabel title = new JLabel("Bremerton Ice Arena Scoreboard");
                    title.setAlignmentX(Component.LEFT_ALIGNMENT);
                    title.setFont(title.getFont().deriveFont(Font.BOLD, 16f));

                    String html = "<html>" +
                            "<div style='margin-top:6px'>Server running on <b>http://localhost:8080/</b></div>" +
                            "<div style='margin-top:6px;color:#555'>This window is informational and can be closed.</div>" +
                            "</html>";
                    JLabel info = new JLabel(html);
                    info.setAlignmentX(Component.LEFT_ALIGNMENT);

                    JPanel buttons = new JPanel(new FlowLayout(FlowLayout.RIGHT));
                    buttons.setAlignmentX(Component.LEFT_ALIGNMENT);
                    JButton open = new JButton("Open Scoreboard");
                    open.addActionListener(e -> {
                        try {
                            if (Desktop.isDesktopSupported()) {
                                Desktop.getDesktop().browse(URI.create("http://localhost:8080/"));
                            }
                        } catch (Exception ex) {
                            log.warn("Failed to open browser", ex);
                        }
                    });
                    JButton close = new JButton("Close");
                    close.addActionListener(e -> requestExit());
                    buttons.add(open);
                    buttons.add(close);

                    panel.add(title);
                    panel.add(Box.createVerticalStrut(8));
                    panel.add(info);
                    panel.add(Box.createVerticalStrut(12));
                    panel.add(buttons);
                    frame.setContentPane(panel);
                    frame.pack();
                    frame.setLocationRelativeTo(null);
                    frame.addWindowListener(new WindowAdapter() {
                        @Override public void windowClosing(WindowEvent e) {
                            requestExit();
                        }
                        @Override public void windowClosed(WindowEvent e) { startupFrame = null; }
                    });
                    startupFrame = frame;
                    frame.setVisible(true);
                } catch (Exception ex) {
                    log.debug("Startup dialog suppressed due to error", ex);
                }
            });
        } catch (Throwable t) {
            log.debug("Startup dialog unsupported", t);
        }
    }

    private static void addShutdownHook() {
        try {
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    if (hockeyGameServer != null) hockeyGameServer.stop();
                } catch (Exception ignored) {}
                try {
                    if (gameWebSocketV2 != null) gameWebSocketV2.stop(); // Stop new WebSocket server in shutdown hook
                } catch (Exception ignored) {}
                try {
                    if (startupFrame != null) startupFrame.dispose();
                } catch (Exception ignored) {}
                // Do not touch Swing from shutdown hook; avoid invokeAndWait deadlocks
                try {
                    ch.qos.logback.classic.LoggerContext ctx =
                            (ch.qos.logback.classic.LoggerContext) org.slf4j.LoggerFactory.getILoggerFactory();
                    ctx.stop();
                } catch (Throwable ignored) {}
            }, "scoreboard-shutdown"));
        } catch (Throwable ignored) {
        }
    }

    private static void requestExit() {
        // Perform shutdown and exit off the EDT to avoid blocking UI
        Thread exitThread = new Thread(() -> {
            try { if (hockeyGameServer != null) hockeyGameServer.stop(); } catch (Exception ignored) {}
            try { if (gameWebSocketV2 != null) gameWebSocketV2.stop(); } catch (Exception ignored) {} // Stop new WebSocket server
            try { if (startupFrame != null) startupFrame.dispose(); } catch (Exception ignored) {}
            try { disposeAllWindows(); } catch (Exception ignored) {}
            try {
                ch.qos.logback.classic.LoggerContext ctx =
                        (ch.qos.logback.classic.LoggerContext) org.slf4j.LoggerFactory.getILoggerFactory();
                ctx.stop();
            } catch (Throwable ignored) {}
            System.exit(0);
        }, "exit-invoker");
        exitThread.setDaemon(false);
        exitThread.start();

        // Watchdog to forcefully terminate the process if it doesn't exit promptly
        Thread watchdog = new Thread(() -> {
            try { Thread.sleep(5000); } catch (InterruptedException ignored) {}
            try { Runtime.getRuntime().halt(0); } catch (Throwable ignored) {}
        }, "exit-watchdog");
        watchdog.setDaemon(true);
        watchdog.start();
    }

    private static void disposeAllWindows() {
        try {
            for (Window w : Window.getWindows()) {
                try { w.setVisible(false); } catch (Exception ignored) {}
                try { w.dispose(); } catch (Exception ignored) {}
            }
        } catch (Throwable ignored) {
        }
    }
}
