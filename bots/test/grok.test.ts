import { describe, expect, it, vi } from "vitest";

import {
  GROQ_BASE_URL,
  GROQ_DEFAULT_MODEL,
  GrokClient,
  XAI_BASE_URL,
  XAI_DEFAULT_MODEL,
  chatClientFor,
  type FetchLike,
} from "../src/ai/grok.js";
import { chooseProvider } from "../src/ai/provider.js";
import { GrokPredictor, describeInput, type PredictInput } from "../src/ai/predictor.js";

const input: PredictInput = {
  summary: {
    usd: 70,
    change1m: 0.2,
    change5m: 0.9,
    change15m: 1.5,
    high15m: 71,
    low15m: 68,
    samples: 30,
  },
  record: { calls: 4, hits: 3, streak: 2, profit: 80 },
  chips: 400,
};

const reply = (content: unknown, status = 200): ReturnType<FetchLike> =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
  });

describe("GrokClient", () => {
  it("posts an OpenAI-style chat completion to xAI with the key as a bearer token", async () => {
    const fetch = vi.fn<FetchLike>().mockImplementation(() => reply("hello"));
    const client = new GrokClient({ apiKey: "xai-secret", fetch });
    expect(await client.complete({ system: "sys", user: "usr" })).toBe("hello");
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`${XAI_BASE_URL}/chat/completions`);
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer xai-secret");
    const body = JSON.parse(init.body);
    expect(body.model).toBe(XAI_DEFAULT_MODEL);
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "usr" },
    ]);
    expect(body.reasoning_effort).toBe("low");
    expect(body.max_completion_tokens).toBeGreaterThanOrEqual(1_000);
    expect(body.stream).toBe(false);
    // no penalties or stop words: reasoning models reject them
    expect(body).not.toHaveProperty("stop");
    expect(body).not.toHaveProperty("presence_penalty");
  });

  it("takes the model, base URL and effort from the options, and can leave the effort out", async () => {
    const fetch = vi.fn<FetchLike>().mockImplementation(() => reply("ok"));
    await new GrokClient({
      apiKey: "k",
      model: "grok-x",
      baseUrl: "https://example.test/v1/",
      reasoningEffort: "",
      fetch,
    }).complete({ system: "s", user: "u" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://example.test/v1/chat/completions");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("grok-x");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("throws on an API error without leaking the key", async () => {
    const fetch = vi.fn<FetchLike>().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":"Incorrect API key provided"}',
    });
    const error = await new GrokClient({ apiKey: "xai-secret", fetch })
      .complete({ system: "s", user: "u" })
      .catch((e: Error) => e);
    expect((error as Error).message).toContain("401");
    expect((error as Error).message).not.toContain("xai-secret");
  });

  it("throws on a body that is not JSON or has no message", async () => {
    const notJson = vi
      .fn<FetchLike>()
      .mockResolvedValue({ ok: true, status: 200, text: async () => "<html>" });
    await expect(
      new GrokClient({ apiKey: "k", fetch: notJson }).complete({ system: "s", user: "u" }),
    ).rejects.toThrow("not JSON");
    const empty = vi.fn<FetchLike>().mockImplementation(() => reply(null));
    await expect(
      new GrokClient({ apiKey: "k", fetch: empty }).complete({ system: "s", user: "u" }),
    ).rejects.toThrow("no message");
  });

  it("lets a network failure propagate", async () => {
    const fetch = vi.fn<FetchLike>().mockRejectedValue(new Error("connection refused"));
    await expect(
      new GrokClient({ apiKey: "k", fetch }).complete({ system: "s", user: "u" }),
    ).rejects.toThrow("connection refused");
  });
});

describe("GrokPredictor", () => {
  it("asks with the persona prompt over public data and parses the answer", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockImplementation(() =>
        reply(
          'Sure: {"direction":"down","horizon":60,"stake":25,"confidence":60,"reason":"stretched"}',
        ),
      );
    const predictor = new GrokPredictor("contrarian", new GrokClient({ apiKey: "k", fetch }));
    expect(predictor.name).toBe("grok:contrarian");
    expect(await predictor.predict(input)).toMatchObject({ direction: -1, stake: 25, horizon: 60 });
    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body.messages[0].content).toContain("Contrarian");
    expect(body.messages[1].content).toBe(describeInput(input));
    expect(body.messages[1].content.toLowerCase()).not.toMatch(/seat|mempool|vault|leak/);
  });

  it("calls nothing when Grok skips or answers with something unreadable", async () => {
    for (const content of ['{"skip":true}', "I think it goes up", ""]) {
      const fetch = vi.fn<FetchLike>().mockImplementation(() => reply(content));
      const predictor = new GrokPredictor("claude", new GrokClient({ apiKey: "k", fetch }));
      expect(await predictor.predict(input)).toBeUndefined();
    }
  });

  it("clamps the stake to the chips on hand", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockImplementation(() => reply('{"direction":"up","horizon":120,"stake":100}'));
    const predictor = new GrokPredictor("claude", new GrokClient({ apiKey: "k", fetch }));
    expect(await predictor.predict({ ...input, chips: 40 })).toMatchObject({ stake: 40 });
    expect(await predictor.predict({ ...input, chips: 5 })).toBeUndefined();
  });

  it("lets an unreachable API throw so the analyst mints nothing", async () => {
    const fetch = vi.fn<FetchLike>().mockRejectedValue(new Error("connection refused"));
    const predictor = new GrokPredictor("claude", new GrokClient({ apiKey: "k", fetch }));
    await expect(predictor.predict(input)).rejects.toThrow("connection refused");
  });
});

describe("chatClientFor", () => {
  it("builds the Groq client with its own base URL, model and effort", async () => {
    const fetch = vi.fn<FetchLike>().mockImplementation(() => reply("ok"));
    const client = chatClientFor("groq", { GROQ_API_KEY: "gsk_key" }, { fetch });
    await client.complete({ system: "s", user: "u" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`${GROQ_BASE_URL}/chat/completions`);
    expect(init.headers.authorization).toBe("Bearer gsk_key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe(GROQ_DEFAULT_MODEL);
    expect(body.reasoning_effort).toBe("low");
  });

  it("reads model, base URL and effort from the environment, and an empty effort is left out", async () => {
    const fetch = vi.fn<FetchLike>().mockImplementation(() => reply("ok"));
    const client = chatClientFor(
      "groq",
      {
        GROQ_API_KEY: "k",
        GROQ_MODEL: "meta-llama/x",
        GROQ_BASE_URL: "https://proxy.test/v1",
        GROQ_REASONING_EFFORT: "",
      },
      { fetch },
    );
    await client.complete({ system: "s", user: "u" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://proxy.test/v1/chat/completions");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("meta-llama/x");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("builds the xAI client and refuses a missing key", () => {
    expect(() => chatClientFor("xai", {})).toThrow("XAI_API_KEY");
    expect(() => chatClientFor("groq", {})).toThrow("GROQ_API_KEY");
    expect(chatClientFor("xai", { XAI_API_KEY: "k" })).toBeInstanceOf(GrokClient);
  });
});

describe("chooseProvider", () => {
  it("follows the keys that are set, preferring xAI, then Groq, then Anthropic", () => {
    expect(chooseProvider({})).toBeUndefined();
    expect(chooseProvider({ XAI_API_KEY: "a" })).toBe("xai");
    expect(chooseProvider({ GROQ_API_KEY: "g" })).toBe("groq");
    expect(chooseProvider({ ANTHROPIC_API_KEY: "b" })).toBe("anthropic");
    expect(chooseProvider({ GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "b" })).toBe("groq");
    expect(chooseProvider({ XAI_API_KEY: "a", GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "b" })).toBe(
      "xai",
    );
  });

  it("honours AI_PROVIDER only when that key exists", () => {
    const both = { XAI_API_KEY: "a", ANTHROPIC_API_KEY: "b" };
    expect(chooseProvider({ ...both, AI_PROVIDER: "anthropic" })).toBe("anthropic");
    expect(chooseProvider({ ...both, AI_PROVIDER: "XAI" })).toBe("xai");
    expect(chooseProvider({ XAI_API_KEY: "a", AI_PROVIDER: "anthropic" })).toBeUndefined();
    expect(chooseProvider({ ...both, GROQ_API_KEY: "g", AI_PROVIDER: "groq" })).toBe("groq");
    expect(chooseProvider({ ...both, AI_PROVIDER: "nonsense" })).toBeUndefined();
  });
});
