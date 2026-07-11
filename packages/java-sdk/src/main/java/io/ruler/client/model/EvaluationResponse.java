package io.ruler.client.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

public record EvaluationResponse(
    @JsonProperty("result") Object result,
    @JsonProperty("trace") Map<String, Object> trace,
    @JsonProperty("performance") String performance,
    @JsonProperty("rule_version") int ruleVersion
) {}
