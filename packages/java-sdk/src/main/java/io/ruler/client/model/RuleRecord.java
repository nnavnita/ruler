package io.ruler.client.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

public record RuleRecord(
    @JsonProperty("name") String name,
    @JsonProperty("content") Map<String, Object> content,
    @JsonProperty("version") int version,
    @JsonProperty("updated_at") Instant updatedAt
) {}
