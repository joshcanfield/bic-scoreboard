package canfield.bia.hockey.v2.domain;

/**
 * Status of a penalty in its lifecycle.
 */
public enum PenaltyStatus {
    ACTIVE,      // Currently counting down
    EXPIRED,     // Natural expiration (time ran out)
    RELEASED     // Early release due to power play goal
}
