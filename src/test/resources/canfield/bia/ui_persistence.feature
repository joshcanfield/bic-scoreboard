Feature: UI persistence

  Scenario: Standard template fills preset values
    When I open the index page
    And I open the New Game dialog
    And I choose the standard template "youth60"
    Then the standard period inputs should be 5, 15, 15, 12
    And the standard intermission should be 1

  Scenario: Jr template sets warmup and intermission
    When I open the index page
    And I open the New Game dialog
    And I choose the standard template "jr"
    Then the standard period inputs should be 15, 20, 20, 20
    And the standard intermission should be 15

  Scenario: Standard periods persist across reload
    When I open the index page
    And I open the New Game dialog
    And I set standard periods to 3, 12, 17, 22
    And I create the standard game
    And I refresh the page
    And I open the New Game dialog
    Then the standard period inputs should be 3, 12, 17, 22

  Scenario: Standard intermission can be set and persists
    When I open the index page
    And I open the New Game dialog
    And I set standard intermission to 7
    And I create the standard game
    And I open the New Game dialog
    Then the standard intermission should be 7
