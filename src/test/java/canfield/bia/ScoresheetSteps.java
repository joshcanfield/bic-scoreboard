package canfield.bia;

import io.cucumber.java.en.When;
import io.cucumber.java.en.Then;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

import java.time.Duration;

import static canfield.bia.UiHooks.driver;

public class ScoresheetSteps {

    @When("I click the scoresheet link")
    public void clickScoresheetLink() {
        WebElement link = driver.findElement(By.id("header-scoresheet-link"));
        link.click();
    }

    @Then("the scoresheet page should load")
    public void scoresheetPageShouldLoad() {
        new WebDriverWait(driver, Duration.ofSeconds(5)).until(
                d -> d.getTitle().contains("Scoresheet") && d.getCurrentUrl().contains("scoresheet.html")
        );
        Assert.assertTrue(driver.getCurrentUrl().contains("scoresheet.html"),
                "Expected URL to contain 'scoresheet.html' but was " + driver.getCurrentUrl());
    }
}
