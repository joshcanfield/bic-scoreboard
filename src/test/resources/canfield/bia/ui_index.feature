Feature: Index and Basics

  Scenario: Index page should have title
    When I open the index page
    Then the page title should be "Scoreboard"

  Scenario: Scoreboard page should contain scoreboard controls
    When I open the scoreboard page
    Then I should see an element with id "home"

  Scenario: Keyboard shortcuts load and expose bindings
    When I open the index page
    Then the keyboard shortcuts should load successfully
    And shortcut "homeGoal" should include "ArrowLeft"
    And shortcut "homeGoal" should include "a"
    And shortcut "awayGoal" should include "ArrowRight"
    And shortcut "clockStart" should include "w"

  Scenario: Escape closes open dialogs
    When I open the index page
    And I open the add goal dialog for the home team
    Then the modal "#add-goal" should be visible
    When I press Escape
    Then the modal "#add-goal" should be hidden

