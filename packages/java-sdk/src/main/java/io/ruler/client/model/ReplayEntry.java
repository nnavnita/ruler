package io.ruler.client.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

public record ReplayEntry(
    @JsonProperty("input") Map<String, Object> input,
    @JsonProperty("result") Object result,
    @JsonProperty("trace") Map<String, Object> trace,
    @JsonProperty("performance") String performance,
    @JsonProperty("error") String error
) {}
