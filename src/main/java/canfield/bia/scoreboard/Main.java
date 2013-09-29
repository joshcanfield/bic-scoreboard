package canfield.bia.scoreboard;

import canfield.bia.scoreboard.io.SerialUpdater;

import java.io.IOException;
import java.util.regex.Pattern;

/**
 *
 */
public class Main {
    public static void main(String[] args) {
        ScoreBoard scoreBoard = new ScoreBoard();
        scoreBoard.setGameClock(20, 0);
        SerialUpdater updater = new SerialUpdater(scoreBoard, "tty.usbserial");

        try {
            // The main loop listens to the keyboard for a key
            while (true) {
                try {
                    int read = System.in.read();
                    switch (read) {
                        case 'q':
                            System.out.println("Bye bye");
                            return;
                        case 'c':
                            if (System.in.available() > 1) { // ignore the newline
                                byte[] bytes = new byte[System.in.available()];
                                int read1 = System.in.read(bytes);
                                String[] parts = new String(bytes, 0, read1 - 1).split(":");
                                int minutes = Integer.parseInt(parts[0]);
                                int seconds = 0;
                                if (parts.length > 1) {
                                    seconds = Integer.parseInt(parts[1]);
                                }
                                scoreBoard.setGameClock(minutes, seconds);
                            } else {
                                if (scoreBoard.getGameClock().isRunning()) {
                                    scoreBoard.pause();
                                } else {
                                    scoreBoard.start();
                                }
                            }
                            break;
                        case 's':
                            updater.start();
                            break;
                        case 'x':
                            updater.stop();
                            break;
                        case 'h':
                            scoreBoard.setHomeScore(scoreBoard.getHomeScore() + 1);
                            break;
                        case 'H':
                            scoreBoard.setHomeScore(scoreBoard.getHomeScore() - 1);
                            break;
                        case 'a':
                            scoreBoard.setAwayScore(scoreBoard.getAwayScore() + 1);
                            break;
                        case 'A':
                            scoreBoard.setAwayScore(scoreBoard.getAwayScore() - 1);
                            break;
                        case 'p':
                            int period = scoreBoard.getPeriod();
                            scoreBoard.setPeriod(((period + 1) % 10));
                            break;
                        case 'm':


                            break;
                        case 'd':
                            break;
                        case '\n':
                            continue;
                    }
                    showState(scoreBoard);
                } catch (IOException e) {
                    System.out.println("Ignoring io exception");
                }
            }

        } finally {
            updater.stop();
        }
    }

    private static void showState(ScoreBoard scoreBoard) {
        Clock gameClock = scoreBoard.getGameClock();
        System.out.printf("Home: %d, Away: %d : Period: %d, Clock: %d:%02d\n",
                scoreBoard.getHomeScore(), scoreBoard.getAwayScore(), scoreBoard.getPeriod(),
                gameClock.getMinutes(), gameClock.getSeconds());
    }
}
