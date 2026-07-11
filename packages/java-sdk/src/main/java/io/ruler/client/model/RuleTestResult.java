package io.ruler.client.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record RuleTestResult(
    @JsonProperty("test_id") String testId,
    @JsonProperty("test_name") String testName,
    @JsonProperty("rule_name") String ruleName,
    @JsonProperty("rule_version") int ruleVersion,
    @JsonProperty("passed") boolean passed,
    @JsonProperty("expected") Object expected,
    @JsonProperty("actual") Object actual,
    @JsonProperty("error") String error,
    @JsonProperty("performance") String performance
) {}
