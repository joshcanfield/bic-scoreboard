package canfield.bia.hockey.web;

import canfield.bia.hockey.Goal;

import java.util.List;

public class ControlViewModel {
    public String clockText;
    public String elapsedText;
    public String periodText;
    public String homeScoreText;
    public String awayScoreText;
    public String homeShotsText;
    public String awayShotsText;
    public boolean scoreboardOn;
    public boolean buzzerOn;
    public List<PenaltyViewModel> homePenalties;
    public List<PenaltyViewModel> awayPenalties;
    public List<Goal> homeGoals;
    public List<Goal> awayGoals;
}
