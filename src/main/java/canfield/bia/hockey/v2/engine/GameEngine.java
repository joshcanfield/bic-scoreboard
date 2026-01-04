package canfield.bia.hockey.v2.engine;

import canfield.bia.hockey.v2.domain.*;
import canfield.bia.hockey.v2.spec.*; // Import all new command types
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;

/**
 * The heart of the new architecture.
 * Contains all business logic for processing game commands.
 */
public class GameEngine {

    private static final Logger log = LoggerFactory.getLogger(GameEngine.class);

    private final TemplateRepository templateRepository;
    private final HardwareOutputAdapter hardwareOutputAdapter;
    private final GameTimer gameTimer;
    private final BiConsumer<GameState, GameState> stateChangeConsumer; // Changed to BiConsumer
    private final ScheduledExecutorService buzzerScheduler =
        Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "buzzer-auto-reset");
            t.setDaemon(true);
            return t;
        });
    private ScheduledFuture<?> buzzerResetFuture;
    private volatile GameState currentState; // GameEngine now holds the current state (volatile for thread visibility)
    private volatile long buzzerOnSince = 0; // Track when buzzer was turned on (for simulated-time reset)
    private static final long BUZZER_AUTO_RESET_MILLIS = 3000;

    public GameEngine(TemplateRepository templateRepository, HardwareOutputAdapter hardwareOutputAdapter, GameTimer gameTimer, BiConsumer<GameState, GameState> stateChangeConsumer) {
        this.templateRepository = templateRepository;
        this.hardwareOutputAdapter = hardwareOutputAdapter;
        this.gameTimer = gameTimer;
        this.stateChangeConsumer = stateChangeConsumer; // Store the consumer
        this.currentState = new GameState(); // Initialize with a default empty state
    }

    // Public method to get the current state
    public GameState getCurrentState() {
        return currentState;
    }

    // Internal method to handle tick commands from the GameTimer
    private void handleTick() {
        processCommand(new TickCommand(), System.currentTimeMillis());
    }

    public GameState processCommand(Command command, long currentTimeMillis) {
        GameState oldState = this.currentState; // Capture old state for potential diffing later

        if (command instanceof CreateGameCommand createGameCommand) {
            this.currentState = createNewGame(createGameCommand);
        } else if (command instanceof StartClockCommand) {
            this.currentState = startClock(this.currentState, currentTimeMillis);
        } else if (command instanceof PauseClockCommand) {
            this.currentState = pauseClock(this.currentState, currentTimeMillis);
        } else if (command instanceof AddPenaltyCommand addPenaltyCommand) {
            this.currentState = addPenalty(this.currentState, addPenaltyCommand);
        } else if (command instanceof TickCommand) {
            this.currentState = tick(this.currentState, currentTimeMillis);
            // Check for simulated-time buzzer auto-reset
            this.currentState = checkBuzzerAutoReset(this.currentState, currentTimeMillis);
        } else if (command instanceof AddGoalCommand addGoalCommand) {
            this.currentState = addGoal(this.currentState, addGoalCommand, currentTimeMillis);
        } else if (command instanceof RemoveGoalCommand removeGoalCommand) {
            this.currentState = removeGoal(this.currentState, removeGoalCommand);
        } else if (command instanceof AddShotCommand addShotCommand) {
            this.currentState = addShot(this.currentState, addShotCommand);
        } else if (command instanceof UndoLastShotCommand undoLastShotCommand) {
            this.currentState = undoLastShot(this.currentState, undoLastShotCommand);
        } else if (command instanceof EndGameCommand) {
            this.currentState = endGame(this.currentState);
        } else if (command instanceof ResetGameCommand) {
            this.currentState = resetGame(this.currentState);
        } else if (command instanceof SetPeriodCommand setPeriodCommand) {
            this.currentState = setPeriod(this.currentState, setPeriodCommand);
        } else if (command instanceof SetClockCommand setClockCommand) {
            this.currentState = setClockTime(this.currentState, setClockCommand);
        } else if (command instanceof TriggerBuzzerCommand) {
            this.currentState = toggleBuzzerAt(this.currentState, currentTimeMillis);
        }
        // Only update hardware if the state actually changed
        if (!oldState.equals(this.currentState)) {
            hardwareOutputAdapter.update(this.currentState);
            stateChangeConsumer.accept(oldState, this.currentState); // Notify consumer of state change with old and new state
        }
        return this.currentState;
    }

    private GameState toggleBuzzer(GameState state) {
        return toggleBuzzerAt(state, System.currentTimeMillis());
    }

    private GameState toggleBuzzerAt(GameState state, long currentTimeMillis) {
        boolean turningOn = !state.buzzerOn();
        GameState newState = new GameState(
            state.gameId(),
            state.config(),
            state.status(),
            state.period(),
            state.clock(),
            state.home(),
            state.away(),
            turningOn, // Toggle buzzer state
            state.eventHistory()
        );
        if (turningOn) {
            buzzerOnSince = currentTimeMillis;
            scheduleBuzzerAutoReset();
        } else {
            buzzerOnSince = 0;
            cancelBuzzerAutoReset();
        }
        return newState;
    }

    private GameState checkBuzzerAutoReset(GameState state, long currentTimeMillis) {
        if (!state.buzzerOn() || buzzerOnSince == 0) {
            return state;
        }
        if (currentTimeMillis - buzzerOnSince >= BUZZER_AUTO_RESET_MILLIS) {
            log.info("Auto resetting buzzer after simulated-time timeout");
            buzzerOnSince = 0;
            cancelBuzzerAutoReset();
            return new GameState(
                state.gameId(),
                state.config(),
                state.status(),
                state.period(),
                state.clock(),
                state.home(),
                state.away(),
                false, // Turn off buzzer
                state.eventHistory()
            );
        }
        return state;
    }

    private GameState resetGame(GameState state) {
        gameTimer.stop();
        long resetClockMillis = state.config() != null ? resolvePeriodDuration(state.config(), 0) : 0L;
        return new GameState(
            state.gameId(), // Keep the same game ID
            state.config(), // Retain the game configuration
            GameStatus.PRE_GAME,
            0, // Reset period
            new ClockState(resetClockMillis, false, 0L), // Reset clock
            new TeamState(List.of(), 0, List.of()), // Reset home team stats
            new TeamState(List.of(), 0, List.of()), // Reset away team stats
            false, // Buzzer off
            List.of() // Clear event history
        );
    }

    private GameState endGame(GameState state) {
        gameTimer.stop();
        return new GameState(
            state.gameId(),
            state.config(),
            GameStatus.GAME_OVER,
            state.period(),
            new ClockState(state.clock().timeRemainingMillis(), false, 0L),
            state.home(),
            state.away(),
            state.buzzerOn(),
            state.eventHistory()
        );
    }

    private GameState undoLastShot(GameState state, UndoLastShotCommand command) {
        String teamId = command.teamId();

        TeamState newHomeState = state.home();
        TeamState newAwayState = state.away();
        boolean changed = false;

        if ("home".equals(teamId)) {
            if (state.home().shots() > 0) {
                newHomeState = new TeamState(state.home().goals(), state.home().shots() - 1, state.home().penalties());
                changed = true;
            }
        } else { // "away"
            if (state.away().shots() > 0) {
                newAwayState = new TeamState(state.away().goals(), state.away().shots() - 1, state.away().penalties());
                changed = true;
            }
        }

        if (!changed) {
            return state; // No change if shots already 0
        }

        return new GameState(
            state.gameId(),
            state.config(),
            state.status(),
            state.period(),
            state.clock(),
            newHomeState,
            newAwayState,
            state.buzzerOn(),
            state.eventHistory()
        );
    }

    private GameState addShot(GameState state, AddShotCommand command) {
        String teamId = command.teamId();

        TeamState newHomeState = state.home();
        TeamState newAwayState = state.away();

        if ("home".equals(teamId)) {
            newHomeState = new TeamState(state.home().goals(), state.home().shots() + 1, state.home().penalties());
        } else {
            newAwayState = new TeamState(state.away().goals(), state.away().shots() + 1, state.away().penalties());
        }

        return new GameState(
            state.gameId(),
            state.config(),
            state.status(),
            state.period(),
            state.clock(),
            newHomeState,
            newAwayState,
            state.buzzerOn(),
            state.eventHistory()
        );
    }

    private GameState removeGoal(GameState state, RemoveGoalCommand command) {
        String goalIdToRemove = command.goalId();

        // Check home team goals
        List<GoalEvent> homeGoals = state.home().goals();
        List<GoalEvent> newHomeGoals = homeGoals.stream()
            .filter(goal -> !goal.goalId().equals(goalIdToRemove))
            .collect(java.util.stream.Collectors.toUnmodifiableList());

        if (newHomeGoals.size() < homeGoals.size()) {
            // Goal found and removed from home team
            TeamState newHomeState = new TeamState(newHomeGoals, state.home().shots(), state.home().penalties());
            return new GameState(state.gameId(), state.config(), state.status(), state.period(), state.clock(), newHomeState, state.away(), state.buzzerOn(), state.eventHistory());
        }

        // Check away team goals if not found in home team
        List<GoalEvent> awayGoals = state.away().goals();
        List<GoalEvent> newAwayGoals = awayGoals.stream()
            .filter(goal -> !goal.goalId().equals(goalIdToRemove))
            .collect(java.util.stream.Collectors.toUnmodifiableList());

        if (newAwayGoals.size() < awayGoals.size()) {
            // Goal found and removed from away team
            TeamState newAwayState = new TeamState(newAwayGoals, state.away().shots(), state.away().penalties());
            return new GameState(state.gameId(), state.config(), state.status(), state.period(), state.clock(), state.home(), newAwayState, state.buzzerOn(), state.eventHistory());
        }

        // Goal not found, return current state unchanged
        return state;
    }

    private GameState addGoal(GameState state, AddGoalCommand command, long currentTimeMillis) {
        String teamId = command.teamId();
        int scorerNumber = command.scorerNumber();
        List<Integer> assistNumbers = command.assistNumbers();
        boolean isEmptyNet = command.isEmptyNet();

        // The timeInPeriodMillis should be the current time remaining in the period
        // This requires calculating the current time remaining from the wall clock
        long timeInPeriodMillis = state.clock().timeRemainingMillis();
        if (state.clock().isRunning()) {
            long elapsed = currentTimeMillis - state.clock().startTimeWallClock();
            timeInPeriodMillis = state.clock().timeRemainingMillis() - elapsed;
        }

        var newGoal = new GoalEvent(
            java.util.UUID.randomUUID().toString(),
            teamId,
            state.period(),
            timeInPeriodMillis,
            scorerNumber,
            assistNumbers,
            isEmptyNet
        );

        TeamState newHomeState = state.home();
        TeamState newAwayState = state.away();

        if ("home".equals(teamId)) {
            var currentGoals = new ArrayList<>(state.home().goals());
            currentGoals.add(newGoal);
            newHomeState = new TeamState(Collections.unmodifiableList(currentGoals), state.home().shots(), Collections.unmodifiableList(state.home().penalties()));
        } else {
            var currentGoals = new ArrayList<>(state.away().goals());
            currentGoals.add(newGoal);
            newAwayState = new TeamState(Collections.unmodifiableList(currentGoals), state.away().shots(), Collections.unmodifiableList(state.away().penalties()));
        }

        return new GameState(
            state.gameId(),
            state.config(),
            state.status(),
            state.period(),
            state.clock(),
            newHomeState,
            newAwayState,
            state.buzzerOn(),
            state.eventHistory()
        );
    }

    private GameState addPenalty(GameState state, AddPenaltyCommand command) {
        String teamId = command.teamId();
        int playerNumber = command.playerNumber();
        int servingPlayerNumber = command.servingPlayerNumber();
        int durationMinutes = command.durationMinutes();
        long durationMillis = durationMinutes * 60 * 1000L;

        // If clock is running during actual play (not intermission), sync penalty
        // to game clock's startTimeWallClock so they tick in unison
        boolean isPlayingTime = state.clock().isRunning() && state.status() == GameStatus.PLAYING;
        long penaltyStartTime = isPlayingTime ? state.clock().startTimeWallClock() : 0L;

        var newPenalty = new Penalty(
            java.util.UUID.randomUUID().toString(),
            teamId,
            playerNumber,
            servingPlayerNumber,
            durationMillis,
            durationMillis,
            penaltyStartTime,
            state.period()
        );

        TeamState newHomeState = state.home();
        TeamState newAwayState = state.away();

        if ("home".equals(teamId)) {
            var currentPenalties = new ArrayList<>(state.home().penalties());
            currentPenalties.add(newPenalty);
            newHomeState = new TeamState(state.home().goals(), state.home().shots(), Collections.unmodifiableList(currentPenalties));
        } else {
            var currentPenalties = new ArrayList<>(state.away().penalties());
            currentPenalties.add(newPenalty);
            newAwayState = new TeamState(state.away().goals(), state.away().shots(), Collections.unmodifiableList(currentPenalties));
        }
        return new GameState(state.gameId(), state.config(), state.status(), state.period(), state.clock(), newHomeState, newAwayState, state.buzzerOn(), state.eventHistory());
    }

    private GameState tick(GameState state, long currentTimeMillis) {
        if (!state.clock().isRunning()) {
            return state;
        }

        long elapsed = currentTimeMillis - state.clock().startTimeWallClock();
        long newTimeRemaining = state.clock().timeRemainingMillis() - elapsed;

        if (log.isDebugEnabled()) {
            log.debug("TICK: elapsed={}ms, oldTime={}ms, newTime={}ms",
                elapsed, state.clock().timeRemainingMillis(), newTimeRemaining);
        }

        ClockState updatedClock = new ClockState(newTimeRemaining, true, currentTimeMillis);

        if (newTimeRemaining <= 0) {
            gameTimer.stop();
            buzzerOnSince = currentTimeMillis; // Track when buzzer was turned on
            if (state.period() == 0) {
                // Warmup ended - go to period 1
                int nextPeriod = state.config().periods() > 0 ? 1 : 0;
                scheduleBuzzerAutoReset();
                return new GameState(
                    state.gameId(),
                    state.config(),
                    GameStatus.READY_FOR_PERIOD,
                    nextPeriod,
                    new ClockState(resolvePeriodDuration(state.config(), nextPeriod), false, 0L),
                    state.home(),
                    state.away(),
                    true,
                    state.eventHistory()
                );
            }
            if (state.status() == GameStatus.INTERMISSION) {
                // Intermission ended - go to next period
                int nextPeriod = state.period() + 1;
                scheduleBuzzerAutoReset();
                return new GameState(
                    state.gameId(),
                    state.config(),
                    GameStatus.READY_FOR_PERIOD,
                    nextPeriod,
                    new ClockState(resolvePeriodDuration(state.config(), nextPeriod), false, 0L),
                    state.home(),
                    state.away(),
                    true,
                    state.eventHistory()
                );
            }
            // Period ended - go to intermission
            scheduleBuzzerAutoReset();
            return new GameState(
                state.gameId(),
                state.config(),
                GameStatus.INTERMISSION,
                state.period(),
                new ClockState(state.config().intermissionLengthMillis(), false, 0L),
                state.home(),
                state.away(),
                true,
                state.eventHistory()
            );
        }

        // Update penalty times (only during actual game play, not intermission)
        TeamState updatedHome = state.home();
        TeamState updatedAway = state.away();
        if (state.status() == GameStatus.PLAYING) {
            updatedHome = updatePenaltyTimes(state.home(), currentTimeMillis);
            updatedAway = updatePenaltyTimes(state.away(), currentTimeMillis);
        }

        return new GameState(
            state.gameId(),
            state.config(),
            state.status(),
            state.period(),
            updatedClock,
            updatedHome,
            updatedAway,
            state.buzzerOn(),
            state.eventHistory()
        );
    }

    private TeamState updatePenaltyTimes(TeamState team, long currentTimeMillis) {
        List<Penalty> updatedPenalties = new ArrayList<>();
        for (Penalty p : team.penalties()) {
            if (p.startTimeWallClock() == 0L) {
                // Penalty not running, keep as is
                updatedPenalties.add(p);
            } else {
                long elapsed = currentTimeMillis - p.startTimeWallClock();
                long newRemaining = p.timeRemainingMillis() - elapsed;
                if (newRemaining > 0) {
                    // Update penalty with new remaining time and reset start time
                    updatedPenalties.add(new Penalty(
                        p.penaltyId(),
                        p.teamId(),
                        p.playerNumber(),
                        p.servingPlayerNumber(),
                        p.durationMillis(),
                        newRemaining,
                        currentTimeMillis,
                        p.period()
                    ));
                }
                // If newRemaining <= 0, penalty expired - don't add to list
            }
        }
        if (updatedPenalties.size() == team.penalties().size() && updatedPenalties.equals(team.penalties())) {
            return team; // No changes
        }
        return new TeamState(team.goals(), team.shots(), Collections.unmodifiableList(updatedPenalties));
    }

    private GameState pauseClock(GameState state, long currentTimeMillis) {
        if (state.status() != GameStatus.PLAYING) {
            return state;
        }

        gameTimer.stop(); // Stop the game timer

        long elapsed = currentTimeMillis - state.clock().startTimeWallClock();
        long newTimeRemaining = state.clock().timeRemainingMillis() - elapsed;

        // Freeze penalty times
        TeamState pausedHome = freezePenaltyTimes(state.home(), currentTimeMillis);
        TeamState pausedAway = freezePenaltyTimes(state.away(), currentTimeMillis);

        return new GameState(
            state.gameId(),
            state.config(),
            GameStatus.PAUSED,
            state.period(),
            new ClockState(newTimeRemaining, false, 0L),
            pausedHome,
            pausedAway,
            state.buzzerOn(),
            state.eventHistory()
        );
    }

    private TeamState freezePenaltyTimes(TeamState team, long currentTimeMillis) {
        List<Penalty> frozenPenalties = new ArrayList<>();
        for (Penalty p : team.penalties()) {
            if (p.startTimeWallClock() == 0L) {
                frozenPenalties.add(p);
            } else {
                long elapsed = currentTimeMillis - p.startTimeWallClock();
                long newRemaining = Math.max(0, p.timeRemainingMillis() - elapsed);
                frozenPenalties.add(new Penalty(
                    p.penaltyId(),
                    p.teamId(),
                    p.playerNumber(),
                    p.servingPlayerNumber(),
                    p.durationMillis(),
                    newRemaining,
                    0L, // Frozen
                    p.period()
                ));
            }
        }
        return new TeamState(team.goals(), team.shots(), Collections.unmodifiableList(frozenPenalties));
    }

    private TeamState startPenaltyTimers(TeamState team, long currentTimeMillis) {
        List<Penalty> startedPenalties = new ArrayList<>();
        for (Penalty p : team.penalties()) {
            if (p.timeRemainingMillis() > 0) {
                startedPenalties.add(new Penalty(
                    p.penaltyId(),
                    p.teamId(),
                    p.playerNumber(),
                    p.servingPlayerNumber(),
                    p.durationMillis(),
                    p.timeRemainingMillis(),
                    currentTimeMillis, // Start counting
                    p.period()
                ));
            }
        }
        return new TeamState(team.goals(), team.shots(), Collections.unmodifiableList(startedPenalties));
    }

    private GameState startClock(GameState state, long currentTimeMillis) {
        if (state.config() == null) {
            return state;
        }
        if (
            state.status() != GameStatus.READY_FOR_PERIOD &&
            state.status() != GameStatus.PAUSED &&
            state.status() != GameStatus.PRE_GAME &&
            state.status() != GameStatus.INTERMISSION
        ) {
            return state;
        }
        // Start the game timer to send TICK commands
        gameTimer.start(this::handleTick); // Use method reference to call internal handleTick

        GameStatus nextStatus = state.status() == GameStatus.INTERMISSION ? GameStatus.INTERMISSION : GameStatus.PLAYING;

        // Start penalty timers only during actual play (not intermission)
        TeamState startedHome = state.home();
        TeamState startedAway = state.away();
        if (nextStatus == GameStatus.PLAYING) {
            startedHome = startPenaltyTimers(state.home(), currentTimeMillis);
            startedAway = startPenaltyTimers(state.away(), currentTimeMillis);
        }

        return new GameState(
            state.gameId(),
            state.config(),
            nextStatus,
            state.period(),
            new ClockState(state.clock().timeRemainingMillis(), true, currentTimeMillis),
            startedHome,
            startedAway,
            state.buzzerOn(),
            state.eventHistory()
        );
    }

    private GameState createNewGame(CreateGameCommand command) {
        String templateId = command.templateId();
        if (templateId == null) {
            return new GameState();
        }

        GameConfig baseConfig = templateRepository.load(templateId);
        GameConfig config = applyOverrides(baseConfig, command.overrides(), templateId);

        return new GameState(
            java.util.UUID.randomUUID().toString(),
            config,
            GameStatus.READY_FOR_PERIOD,
            0,
            new ClockState(config.warmupLengthMillis(), false, 0L),
            new TeamState(List.of(), 0, List.of()),
            new TeamState(List.of(), 0, List.of()),
            false,
            List.of()
        );
    }

    private GameState setPeriod(GameState state, SetPeriodCommand command) {
        if (state.config() == null) {
            return state;
        }
        int configuredPeriods = Math.max(0, state.config().periods());
        int requestedPeriod = Math.max(0, command.period());
        int clampedPeriod = Math.min(requestedPeriod, configuredPeriods);
        return new GameState(
            state.gameId(),
            state.config(),
            GameStatus.READY_FOR_PERIOD, // Set status to READY_FOR_PERIOD when period changes
            clampedPeriod,
            new ClockState(resolvePeriodDuration(state.config(), clampedPeriod), false, 0L), // Reset clock for new period
            state.home(),
            state.away(),
            state.buzzerOn(),
            state.eventHistory()
        );
    }

    private GameState setClockTime(GameState state, SetClockCommand command) {
        if (state.config() == null) {
            return state;
        }
        gameTimer.stop();
        long maxMillis = Math.max(0, resolvePeriodDuration(state.config(), state.period()));
        long requested = Math.max(0, command.timeMillis());
        long clamped = Math.min(requested, maxMillis);
        GameStatus nextStatus = state.status() == GameStatus.PLAYING ? GameStatus.PAUSED : state.status();
        return new GameState(
            state.gameId(),
            state.config(),
            nextStatus,
            state.period(),
            new ClockState(clamped, false, 0L),
            state.home(),
            state.away(),
            state.buzzerOn(),
            state.eventHistory()
        );
    }

    private GameConfig applyOverrides(GameConfig baseConfig, Map<String, Object> overrides, String requestedTemplateId) {
        String templateId = requestedTemplateId != null ? requestedTemplateId : baseConfig.templateId();
        if (overrides == null || overrides.isEmpty()) {
            return new GameConfig(
                templateId,
                baseConfig.warmupLengthMinutes(),
                baseConfig.periodLengthMinutes(),
                baseConfig.intermissionLengthMinutes(),
                baseConfig.periods(),
                baseConfig.clockType(),
                baseConfig.shiftLengthSeconds()
            );
        }

        int warmupMinutes = coerceToInt(overrides.get("warmupMinutes"), baseConfig.warmupLengthMinutes());
        int periodLengthMinutes = coerceToInt(overrides.get("periodLengthMinutes"), baseConfig.periodLengthMinutes());
        int intermissionMinutes = coerceToInt(overrides.get("intermissionLengthMinutes"), baseConfig.intermissionLengthMinutes());
        int periods = coerceToInt(overrides.get("periods"), baseConfig.periods());
        ClockType clockType = coerceClockType(overrides.get("clockType"), baseConfig.clockType());
        Integer shiftLengthSeconds = overrides.containsKey("shiftLengthSeconds")
            ? coerceToNullableInt(overrides.get("shiftLengthSeconds"))
            : baseConfig.shiftLengthSeconds();

        return new GameConfig(
            templateId,
            warmupMinutes,
            periodLengthMinutes,
            intermissionMinutes,
            periods,
            clockType,
            shiftLengthSeconds
        );
    }

    private int coerceToInt(Object candidate, int fallback) {
        if (candidate == null) {
            return fallback;
        }
        if (candidate instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(candidate.toString());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private Integer coerceToNullableInt(Object candidate) {
        if (candidate == null) {
            return null;
        }
        if (candidate instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(candidate.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private ClockType coerceClockType(Object candidate, ClockType fallback) {
        if (candidate == null) {
            return fallback;
        }
        if (candidate instanceof ClockType clockType) {
            return clockType;
        }
        try {
            return ClockType.valueOf(candidate.toString());
        } catch (IllegalArgumentException ex) {
            return fallback;
        }
    }

    private long resolvePeriodDuration(GameConfig config, int period) {
        if (config == null) {
            return 0L;
        }
        return period <= 0 ? config.warmupLengthMillis() : config.periodLengthMillis();
    }

    private void scheduleBuzzerAutoReset() {
        if (buzzerResetFuture != null) {
            buzzerResetFuture.cancel(false);
        }
        buzzerResetFuture = buzzerScheduler.schedule(this::autoResetBuzzer, 3, TimeUnit.SECONDS);
    }

    private void cancelBuzzerAutoReset() {
        if (buzzerResetFuture != null) {
            buzzerResetFuture.cancel(false);
            buzzerResetFuture = null;
        }
    }

    private void autoResetBuzzer() {
        if (this.currentState == null || !this.currentState.buzzerOn()) {
            log.debug("autoResetBuzzer: skipped (state={}, buzzerOn={})",
                this.currentState != null ? "present" : "null",
                this.currentState != null ? this.currentState.buzzerOn() : "n/a");
            return;
        }
        log.info("Auto resetting buzzer after real-time timeout");
        GameState before = this.currentState;
        processCommand(new TriggerBuzzerCommand(), System.currentTimeMillis());
        log.debug("autoResetBuzzer: buzzerOn changed from {} to {}",
            before.buzzerOn(), this.currentState.buzzerOn());
    }
}
