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

  Scenario: Swapping teams keeps colors aligned with labels
    When I open the index page
    And I record the current team colors
    And I swap the teams
    And I add a goal for the away team
    Then the home column color should remain the recorded home color
    And the away column color should remain the recorded away color
    And the home score should be 0
    And the away score should be 1

  Scenario: Keyboard shortcuts follow the active column layout
    When I open the index page
    And I reset the team layout to default
    And I press the shortcut "Q"
    Then the home shots should be 1
    When I swap the teams
    And I press the shortcut "Q"
    Then the home shots should be 1
    And the away shots should be 1
    And I press the shortcut "Ctrl+ArrowUp"
    Then the game period should be 1
    And I press the shortcut "Ctrl+ArrowDown"
    Then the game period should be 0

  Scenario: Repeated clock stop shortcut should not change the time
    Given the clock is stopped
    When I press the clock start shortcut
    And I wait 1100 milliseconds
    Then the clock should count down
    When I press the clock stop shortcut
    And I wait 200 milliseconds
    Then the clock should not be running
    And I record the current clock time
    When I press the clock stop shortcut
    And I wait 200 milliseconds
    Then the clock should stay the same

