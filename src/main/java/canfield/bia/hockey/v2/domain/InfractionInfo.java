package canfield.bia.hockey.v2.domain;

/**
 * Encapsulates infraction details. When type is OTHER, customDescription holds the free text.
 */
public record InfractionInfo(
    InfractionType type,
    String customDescription // Only used when type == OTHER
) {
    public InfractionInfo(InfractionType type) {
        this(type, null);
    }
}
