Feature: UI integration

  Scenario: Index page should have title
    When I open the index page
    Then the page title should be "Scoreboard"

  Scenario: Scoreboard page should contain scoreboard controls
    When I open the scoreboard page
    Then I should see an element with id "home"

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

  Scenario: Adding a penalty updates the UI
    Given the game is in period 1
    When I add a penalty for player 22 to the home team
    Then the home team penalties list should contain 1 penalty for player 22
