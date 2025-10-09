Feature: Index and Basics

  Scenario: Index page should have title
    When I open the index page
    Then the page title should be "Scoreboard"

  Scenario: Scoreboard page should contain scoreboard controls
    When I open the scoreboard page
    Then I should see an element with id "home"

