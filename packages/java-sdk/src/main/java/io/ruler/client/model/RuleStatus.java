package io.ruler.client.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum RuleStatus {
    @JsonProperty("draft") DRAFT,
    @JsonProperty("review") REVIEW,
    @JsonProperty("published") PUBLISHED,
    @JsonProperty("archived") ARCHIVED;
}
