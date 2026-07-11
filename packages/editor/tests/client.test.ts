import { describe, expect, it, vi } from "vitest";
import { RulerApiError, createRulerClient } from "../src/client";

function mockFetch(response: unknown, status = 200) {
  return vi.fn(async (input: string, init?: RequestInit) => {
    return {
      ok: status < 300,
      status,
      statusText: status < 300 ? "OK" : "error",
      json: async () => response,
      text: async () => JSON.stringify(response),
      url: input,
      init,
    } as unknown as Response;
  });
}

describe("createRulerClient", () => {
  it("trims trailing slash from baseUrl", async () => {
    const fetchImpl = mockFetch([]);
    const client = createRulerClient({
      baseUrl: "http://example.com/",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.listRules();
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://example.com/api/rules",
      expect.any(Object),
    );
  });

  it("sends content-type + custom headers on POST", async () => {
    const fetchImpl = mockFetch({ name: "fruit", content: {}, version: 1, updated_at: "" });
    const client = createRulerClient({
      baseUrl: "http://example.com",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      headers: { authorization: "Bearer xyz" },
    });
    await client.saveRule("fruit", { foo: 1 });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      authorization: "Bearer xyz",
    });
    expect(JSON.parse(init.body as string)).toEqual({ content: { foo: 1 } });
  });

  it("passes version query on evaluate", async () => {
    const fetchImpl = mockFetch({ result: null, trace: null, performance: null, rule_version: 5 });
    const client = createRulerClient({
      baseUrl: "http://example.com",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.evaluate("fruit", { fruit: "apple" }, { version: 5 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://example.com/api/rules/fruit/evaluate?version=5",
      expect.any(Object),
    );
  });

  it("throws RulerApiError on non-2xx responses", async () => {
    const fetchImpl = mockFetch({ detail: "not found" }, 404);
    const client = createRulerClient({
      baseUrl: "http://example.com",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.getRule("missing")).rejects.toBeInstanceOf(RulerApiError);
  });

  it("URL-encodes rule names with slashes and spaces", async () => {
    const fetchImpl = mockFetch({ name: "a b", content: {}, version: 1, updated_at: "" });
    const client = createRulerClient({
      baseUrl: "http://example.com",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.getRule("a b/c");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://example.com/api/rules/a%20b%2Fc",
      expect.any(Object),
    );
  });
});
