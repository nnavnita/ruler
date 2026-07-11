package io.ruler.client.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SaveTestPayload(
    @JsonProperty("id") String id,
    @JsonProperty("name") String name,
    @JsonProperty("input") Map<String, Object> input,
    @JsonProperty("expected") Object expected,
    @JsonProperty("tags") List<String> tags
) {
    public static SaveTestPayload of(String name, Map<String, Object> input, Object expected) {
        return new SaveTestPayload(null, name, input, expected, null);
    }
}
