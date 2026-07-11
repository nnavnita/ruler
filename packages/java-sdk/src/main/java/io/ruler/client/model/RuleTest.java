package io.ruler.client.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record RuleTest(
    @JsonProperty("id") String id,
    @JsonProperty("rule_name") String ruleName,
    @JsonProperty("name") String name,
    @JsonProperty("input") Map<String, Object> input,
    @JsonProperty("expected") Object expected,
    @JsonProperty("tags") List<String> tags,
    @JsonProperty("created_at") Instant createdAt
) {}
