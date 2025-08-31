package canfield.bia;

import canfield.bia.rest.GameApplication;
import dagger.ObjectGraph;
import org.apache.commons.io.IOUtils;
import javax.swing.*;
import java.awt.*;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;

/**
 *
 */
public class ServiceMain {
    private static HockeyGameServer hockeyGameServer;
    private static final Logger log = LoggerFactory.getLogger(ServiceMain.class);
    private static volatile JDialog startupDialog;

    public static void main(String[] args) {

        if (args.length == 0 || args[0].equals("start")) {
            // only try to start if we're already started
            if (hockeyGameServer == null) {
                printBanner();
                maybeShowStartupDialog();
                final ObjectGraph objectGraph = GameApplication.getObjectGraph();
                hockeyGameServer = objectGraph.get(HockeyGameServer.class);
                hockeyGameServer.start();
            } else {
                log.info("Service already running...");
            }
        } else {
            if (hockeyGameServer != null) {
                log.info("Stopping server...");
                hockeyGameServer.stop();
                if (startupDialog != null) {
                    try { startupDialog.dispose(); } catch (Exception ignored) {}
                    startupDialog = null;
                }
            } else {
                log.warn("Unable to stop server: Service isn't running!");
            }
        }
    }

    private static void printBanner() {
        try {
          InputStream bannerStream = ClassLoader.getSystemResourceAsStream("banner.txt");
          IOUtils.copy(bannerStream, System.out);
        } catch (Exception ignored) {
            // ignored
          System.out.println();
        }
    }

    private static void maybeShowStartupDialog() {
        String show = System.getProperty("scoreboard.showDialog", "false");
        if (!Boolean.parseBoolean(show)) return;
        if (GraphicsEnvironment.isHeadless()) return;
        try {
            SwingUtilities.invokeLater(() -> {
                try {
                    JDialog dialog = new JDialog((Frame) null, "BIA Scoreboard", false);
                    dialog.setDefaultCloseOperation(WindowConstants.DISPOSE_ON_CLOSE);
                    JPanel panel = new JPanel();
                    panel.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
                    panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));

                    JLabel title = new JLabel("Bremerton Ice Arena Scoreboard");
                    title.setAlignmentX(Component.LEFT_ALIGNMENT);
                    title.setFont(title.getFont().deriveFont(Font.BOLD, 16f));

                    String html = "<html>" +
                            "<div style='margin-top:6px'>Server running on <b>http://localhost:8080/</b></div>" +
                            "<div>REST <b>8080</b>, WebSocket <b>8081</b></div>" +
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
                    close.addActionListener(e -> dialog.dispose());
                    buttons.add(open);
                    buttons.add(close);

                    panel.add(title);
                    panel.add(Box.createVerticalStrut(8));
                    panel.add(info);
                    panel.add(Box.createVerticalStrut(12));
                    panel.add(buttons);
                    dialog.setContentPane(panel);
                    dialog.pack();
                    dialog.setLocationRelativeTo(null);
                    dialog.setAlwaysOnTop(true);
                    dialog.addWindowListener(new WindowAdapter() {
                        @Override public void windowClosed(WindowEvent e) { startupDialog = null; }
                    });
                    startupDialog = dialog;
                    dialog.setVisible(true);
                } catch (Exception ex) {
                    log.debug("Startup dialog suppressed due to error", ex);
                }
            });
        } catch (Throwable t) {
            log.debug("Startup dialog unsupported", t);
        }
    }
}
