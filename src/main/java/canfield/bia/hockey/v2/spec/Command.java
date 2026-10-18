package canfield.bia.hockey.v2.spec;

/**
 * Base interface for all game commands.
 * Commands are immutable objects that represent an action to be performed on the game state.
 */
public sealed interface Command permits
    CreateGameCommand,
    StartClockCommand,
    PauseClockCommand,
    AddPenaltyCommand,
    ReleasePenaltyCommand,
    CancelPenaltyCommand,
    TickCommand,
    AddGoalCommand,
    RemoveGoalCommand,
    AddShotCommand,
    UndoLastShotCommand,
    EndGameCommand,
    ResetGameCommand,
    SetPeriodCommand,
    TriggerBuzzerCommand,
    SetClockCommand,
    StartAdapterCommand,
    StopAdapterCommand,
    GetPortsCommand
{}
