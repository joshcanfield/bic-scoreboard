package canfield.bia;

import org.junit.jupiter.api.Test;
import org.slf4j.ILoggerFactory;
import org.slf4j.LoggerFactory;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class LoggingConfigurationTest {

    @Test
    void slf4jBindsToLogbackAndNotNOP() {
        ILoggerFactory factory = LoggerFactory.getILoggerFactory();
        assertFalse(factory.getClass().getName().contains("NOPLoggerFactory"),
                "SLF4J failed to find a valid provider and defaulted to NOPLoggerFactory: " + factory.getClass().getName());
        assertTrue(factory.getClass().getName().contains("LoggerContext"),
                "Expected Logback LoggerContext but found: " + factory.getClass().getName());
    }
}
