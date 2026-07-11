package io.ruler.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.ruler.client.model.*;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * HTTP client for the Ruler rule engine service.
 *
 * <p>Covers all endpoints exposed by the FastAPI reference server:
 * rules, versions + status transitions, evaluate, replay, tests, audit log.
 */
public final class RulerClient {

    private final String baseUrl;
    private final HttpClient http;
    private final Map<String, String> headers;
    private final ObjectMapper mapper;

    private RulerClient(Builder b) {
        this.baseUrl = b.baseUrl.replaceAll("/+$", "");
        this.http = b.http != null
            ? b.http
            : HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        this.headers = Map.copyOf(b.headers);
        this.mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    public static Builder builder(String baseUrl) {
        return new Builder(baseUrl);
    }

    public static RulerClient create(String baseUrl) {
        return builder(baseUrl).build();
    }

    // ----------------------------- Rules ------------------------------- //

    public List<RuleRecord> listRules() {
        return get("/api/rules", new TypeReference<>() {});
    }

    public RuleRecord getRule(String name) {
        return get("/api/rules/" + enc(name), new TypeReference<>() {});
    }

    public RuleRecord saveRule(String name, Map<String, Object> content) {
        return post("/api/rules/" + enc(name),
            Map.of("content", content),
            new TypeReference<>() {});
    }

    public boolean deleteRule(String name) {
        Map<String, Boolean> r = delete("/api/rules/" + enc(name), new TypeReference<>() {});
        return Boolean.TRUE.equals(r.get("deleted"));
    }

    public EvaluationResponse evaluate(String name, Map<String, Object> input) {
        return evaluate(name, input, null);
    }

    public EvaluationResponse evaluate(String name, Map<String, Object> input, Integer version) {
        String path = "/api/rules/" + enc(name) + "/evaluate"
            + (version != null ? "?version=" + version : "");
        return post(path, Map.of("input", input), new TypeReference<>() {});
    }

    // ---------------------------- Versions ----------------------------- //

    public List<RuleVersion> listVersions(String name) {
        return get("/api/rules/" + enc(name) + "/versions", new TypeReference<>() {});
    }

    public RuleVersion getVersion(String name, int version) {
        return get("/api/rules/" + enc(name) + "/versions/" + version,
            new TypeReference<>() {});
    }

    public RuleVersion createDraft(String name, Map<String, Object> content) {
        return createDraft(name, content, null, null);
    }

    public RuleVersion createDraft(String name, Map<String, Object> content,
                                   String author, String notes) {
        Map<String, Object> body = new HashMap<>();
        body.put("content", content);
        if (author != null) body.put("author", author);
        if (notes != null) body.put("notes", notes);
        return post("/api/rules/" + enc(name) + "/versions", body, new TypeReference<>() {});
    }

    public RuleVersion transitionVersion(String name, int version, StatusTransition action) {
        return transitionVersion(name, version, action, null, null);
    }

    public RuleVersion transitionVersion(String name, int version, StatusTransition action,
                                         String reviewer, String comment) {
        Map<String, Object> body = new HashMap<>();
        body.put("action", enumJson(action));
        if (reviewer != null) body.put("reviewer", reviewer);
        if (comment != null) body.put("comment", comment);
        return post("/api/rules/" + enc(name) + "/versions/" + version + "/transition",
            body, new TypeReference<>() {});
    }

    // ----------------------------- Replay ------------------------------ //

    public List<ReplayEntry> replay(String name, int version, List<Map<String, Object>> inputs) {
        return post("/api/rules/" + enc(name) + "/versions/" + version + "/replay",
            Map.of("inputs", inputs), new TypeReference<>() {});
    }

    public List<ReplayEntry> replayHistory(String name, int version, int limit) {
        return post("/api/rules/" + enc(name) + "/versions/" + version + "/replay-history",
            Map.of("limit", limit), new TypeReference<>() {});
    }

    // ------------------------------ Tests ------------------------------ //

    public List<RuleTest> listTests(String name) {
        return get("/api/rules/" + enc(name) + "/tests", new TypeReference<>() {});
    }

    public RuleTest saveTest(String name, SaveTestPayload payload) {
        return post("/api/rules/" + enc(name) + "/tests", payload, new TypeReference<>() {});
    }

    public boolean deleteTest(String name, String testId) {
        Map<String, Boolean> r = delete("/api/rules/" + enc(name) + "/tests/" + enc(testId),
            new TypeReference<>() {});
        return Boolean.TRUE.equals(r.get("deleted"));
    }

    public List<RuleTestResult> runTests(String name) {
        return runTests(name, null);
    }

    public List<RuleTestResult> runTests(String name, Integer version) {
        Map<String, Object> body = new HashMap<>();
        body.put("version", version);
        return post("/api/rules/" + enc(name) + "/tests/run", body, new TypeReference<>() {});
    }

    // ------------------------------ Logs ------------------------------- //

    public List<AuditRecord> listLogs() {
        return listLogs(null, null);
    }

    public List<AuditRecord> listLogs(Integer limit, String ruleName) {
        StringBuilder sb = new StringBuilder("/api/logs");
        boolean sep = true;
        if (limit != null) {
            sb.append('?').append("limit=").append(limit);
            sep = false;
        }
        if (ruleName != null) {
            sb.append(sep ? '?' : '&').append("rule_name=").append(enc(ruleName));
        }
        return get(sb.toString(), new TypeReference<>() {});
    }

    public AuditRecord getLog(String id) {
        return get("/api/logs/" + enc(id), new TypeReference<>() {});
    }

    // ------------------------------- Core ------------------------------ //

    private <T> T get(String path, TypeReference<T> type) {
        return send(HttpRequest.newBuilder(URI.create(baseUrl + path))
            .header("Accept", "application/json")
            .GET(), path, type);
    }

    private <T> T post(String path, Object body, TypeReference<T> type) {
        return send(HttpRequest.newBuilder(URI.create(baseUrl + path))
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofByteArray(writeJson(body))), path, type);
    }

    private <T> T delete(String path, TypeReference<T> type) {
        return send(HttpRequest.newBuilder(URI.create(baseUrl + path))
            .header("Accept", "application/json")
            .DELETE(), path, type);
    }

    private <T> T send(HttpRequest.Builder rb, String path, TypeReference<T> type) {
        headers.forEach(rb::header);
        try {
            HttpResponse<byte[]> resp = http.send(rb.build(),
                HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() >= 300) {
                throw new RulerException(resp.statusCode(), path,
                    new String(resp.body(), StandardCharsets.UTF_8));
            }
            return mapper.readValue(resp.body(), type);
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new RulerException("Ruler request failed for " + path, e);
        }
    }

    private byte[] writeJson(Object body) {
        try {
            return mapper.writeValueAsBytes(body);
        } catch (IOException e) {
            throw new RulerException("JSON marshal failed", e);
        }
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    /**
     * Serialise an enum via Jackson to pick up its @JsonProperty mapping,
     * so we don't have to duplicate the lowercase strings inline.
     */
    private String enumJson(Enum<?> e) {
        try {
            String s = mapper.writeValueAsString(e);
            return s.substring(1, s.length() - 1); // strip quotes
        } catch (IOException ex) {
            return e.name().toLowerCase();
        }
    }

    // ------------------------------ Builder ---------------------------- //

    public static final class Builder {
        private final String baseUrl;
        private HttpClient http;
        private final Map<String, String> headers = new HashMap<>();

        private Builder(String baseUrl) {
            this.baseUrl = Objects.requireNonNull(baseUrl, "baseUrl");
        }

        public Builder httpClient(HttpClient http) {
            this.http = http;
            return this;
        }

        public Builder header(String key, String value) {
            headers.put(key, value);
            return this;
        }

        public RulerClient build() {
            return new RulerClient(this);
        }
    }
}
