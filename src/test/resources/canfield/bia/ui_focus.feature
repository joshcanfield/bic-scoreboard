Feature: Button focus handling

  Scenario: Home goal button loses focus after opening its modal
    When I click the home goal button
    Then the goal modal should be visible
    And the element "#home .score .score-up" should not be focused
    And the element "#home .score .score-up" should not be hovered
    When I close the goal modal

  Scenario: Home penalty button loses focus after opening its modal
    When I click the home penalty button
    Then the penalty modal should be visible
    And the element "#home .penalties a.btn[data-team=\"home\"]" should not be focused
    And the element "#home .penalties a.btn[data-team=\"home\"]" should not be hovered
    When I close the penalty modal
