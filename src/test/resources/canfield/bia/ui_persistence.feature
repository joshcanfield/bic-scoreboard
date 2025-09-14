Feature: UI persistence

  Scenario: Standard periods persist across reload
    When I open the index page
    And I open the New Game dialog
    And I set standard periods to 3, 12, 17, 22
    And I create the standard game
    And I refresh the page
    And I open the New Game dialog
    Then the standard period inputs should be 3, 12, 17, 22

