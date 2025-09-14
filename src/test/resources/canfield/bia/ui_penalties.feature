Feature: Penalties UI

  Scenario: Adding a penalty updates the UI
    Given the game is in period 1
    When I add a penalty for player 22 to the home team
    Then the home team penalties list should contain 1 penalty for player 22

