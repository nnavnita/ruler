package io.ruler.client.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum StatusTransition {
    @JsonProperty("submit") SUBMIT,
    @JsonProperty("approve") APPROVE,
    @JsonProperty("reject") REJECT,
    @JsonProperty("publish") PUBLISH,
    @JsonProperty("archive") ARCHIVE;
}
