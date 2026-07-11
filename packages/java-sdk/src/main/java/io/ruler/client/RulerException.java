package io.ruler.client;

public class RulerException extends RuntimeException {
    private final int status;
    private final String path;
    private final String body;

    public RulerException(int status, String path, String body) {
        super("Ruler API " + status + " on " + path + ": " + body);
        this.status = status;
        this.path = path;
        this.body = body;
    }

    public RulerException(String message, Throwable cause) {
        super(message, cause);
        this.status = -1;
        this.path = "";
        this.body = "";
    }

    public int getStatus() { return status; }
    public String getPath() { return path; }
    public String getBody() { return body; }
}
