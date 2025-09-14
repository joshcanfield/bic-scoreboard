Feature: Game Flow

  Scenario: Creating a game resets state
    Given the game state is modified
    When I create a new game
    Then the game period should be 0
    And the clock should not be running
    And the home score should be 0
    And the away score should be 0

  Scenario: Clock should start and stop
    Given the clock is stopped
    When I start the clock
    And I wait 1100 milliseconds
    Then the clock should count down
    When I stop the clock
    And I wait 1100 milliseconds
    Then the clock should stay the same

