package canfield.bia.hockey.v2.domain;

/**
 * Represents the various states a game can be in.
 */
public enum GameStatus {
    /**
     * The state before a game has been configured.
     */
    PRE_GAME,

    /**
     * The state after a game is created, before a period begins.
     * The clock is stopped.
     */
    READY_FOR_PERIOD,

    /**
     * The state when the clock is running and the game is in play.
     */
    PLAYING,

    /**
     * The state when the clock is stopped during a period.
     */
    PAUSED,

    /**
     * The state between periods.
     */
    INTERMISSION,

    /**
     * The state after the final period has ended.
     */
    GAME_OVER
}
