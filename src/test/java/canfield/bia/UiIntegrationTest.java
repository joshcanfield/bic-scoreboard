package canfield.bia;

import io.cucumber.testng.CucumberOptions;
import io.cucumber.testng.FeatureWrapper;
import io.cucumber.testng.PickleWrapper;
import io.cucumber.testng.TestNGCucumberRunner;
import org.testng.annotations.*;

@CucumberOptions(
    features = "src/test/resources/canfield/bia",
    glue = "canfield.bia",
    plugin = {"pretty"}
)
public class UiIntegrationTest {
    private TestNGCucumberRunner runner;

    @BeforeClass(alwaysRun = true)
    public void setUpClass() {
        runner = new TestNGCucumberRunner(this.getClass());
    }

    @Test(description = "Runs Cucumber Scenarios", dataProvider = "scenarios")
    public void runScenario(PickleWrapper pickle, FeatureWrapper feature) {
        runner.runScenario(pickle.getPickle());
    }

    @DataProvider
    public Object[][] scenarios() {
        return runner.provideScenarios();
    }

    @AfterClass(alwaysRun = true)
    public void tearDownClass() {
        if (runner != null) {
            runner.finish();
        }
    }
}
