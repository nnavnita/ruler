package io.ruler.client.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

public record AuditRecord(
    @JsonProperty("id") String id,
    @JsonProperty("rule_name") String ruleName,
    @JsonProperty("rule_version") int ruleVersion,
    @JsonProperty("rule_snapshot") Map<String, Object> ruleSnapshot,
    @JsonProperty("input") Map<String, Object> input,
    @JsonProperty("result") Object result,
    @JsonProperty("trace") Map<String, Object> trace,
    @JsonProperty("performance") String performance,
    @JsonProperty("error") String error,
    @JsonProperty("created_at") Instant createdAt
) {}
