package canfield.bia.hockey.web;

import canfield.bia.hockey.Penalty;
import canfield.bia.hockey.Team;

public class PenaltyViewModel {
    public String id;
    public String team;
    public String period;
    public String player;
    public String duration;
    public String off;
    public String start;
    public String remaining;
    public String servingPlayer;

    public PenaltyViewModel(Team team, Penalty penalty) {
        this.id = String.valueOf(penalty.getId());
        this.team = team.name();
        this.period = String.valueOf(penalty.getPeriod());

        this.player = String.valueOf(penalty.getPlayerNumber());
        int servingPlayerNumber = penalty.getServingPlayerNumber();
        if (servingPlayerNumber == 0) {
            servingPlayerNumber = penalty.getPlayerNumber();
        }
        this.servingPlayer = String.valueOf(servingPlayerNumber);


        this.duration = formatTime(penalty.getTime());
        this.off = formatTime(penalty.getOffIceTime());
        this.start = formatTime(penalty.getStartTime());

        int remainingMillis = 0;
        if (penalty.getStartTime() > 0) {
            remainingMillis = Math.max(0, penalty.getTime() - penalty.getElapsed());
        } else {
            remainingMillis = penalty.getTime();
        }
        this.remaining = formatTime(remainingMillis);
    }

    private String formatTime(long millis) {
        long minutes = millis / 60000;
        long seconds = (millis / 1000) % 60;
        return String.format("%02d:%02d", minutes, seconds);
    }
}
