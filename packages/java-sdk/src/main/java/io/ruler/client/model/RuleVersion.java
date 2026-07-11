package io.ruler.client.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

public record RuleVersion(
    @JsonProperty("rule_name") String ruleName,
    @JsonProperty("version") int version,
    @JsonProperty("content") Map<String, Object> content,
    @JsonProperty("status") RuleStatus status,
    @JsonProperty("author") String author,
    @JsonProperty("notes") String notes,
    @JsonProperty("created_at") Instant createdAt,
    @JsonProperty("submitted_at") Instant submittedAt,
    @JsonProperty("reviewed_at") Instant reviewedAt,
    @JsonProperty("reviewed_by") String reviewedBy,
    @JsonProperty("review_decision") String reviewDecision,
    @JsonProperty("review_comment") String reviewComment,
    @JsonProperty("published_at") Instant publishedAt
) {}
