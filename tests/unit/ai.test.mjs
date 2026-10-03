import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { textModel, imageModel } from "../../src/services/ai.mjs";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** @type {{ url: string, init: RequestInit }[]} */
let calls = [];
/** @param {number} status @param {unknown} body */
function mockFetch(status, body) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
}
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(2000)]);

test("no keys means no models", () => {
  assert.equal(textModel({}), null);
  assert.equal(imageModel({}), null);
});

const CF = { CF_ACCOUNT_ID: "a".repeat(32), CF_API_TOKEN: "tok" };

test("Cloudflare Workers AI writes text with the same Cloudflare token", async () => {
  mockFetch(200, { success: true, result: { response: " hi " } });
  const out = await textModel(CF)?.("sys", "prompt");
  assert.equal(out, "hi");
  assert.match(calls[0].url, /accounts\/a{32}\/ai\/run\/@cf\/meta\/llama-3\.3-70b-instruct-fp8-fast$/);
  assert.equal(new Headers(calls[0].init.headers).get("authorization"), "Bearer tok");
  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body.messages, [{ role: "system", content: "sys" }, { role: "user", content: "prompt" }]);
  assert.ok(body.max_tokens >= 3000, "long articles need a high token limit");
});

test("Cloudflare OpenAI-style responses are also understood", async () => {
  mockFetch(200, { result: { choices: [{ message: { content: "x" } }] } });
  assert.equal(await textModel(CF)?.("s", "p"), "x");
});

test("a non-JSON reply is a clear error (regression: GitHub Models answered 'OK')", async () => {
  mockFetch(200, "OK");
  await assert.rejects(() => /** @type {any} */ (textModel(CF))("s", "p"), /not JSON: OK/);
});

test("GitHub Models is retired and no longer used", () => {
  assert.equal(textModel({ GITHUB_TOKEN: "t" }), null);
});

test("Anthropic key takes priority and joins text blocks", async () => {
  mockFetch(200, { content: [{ type: "text", text: "a" }, { type: "tool_use" }, { type: "text", text: "b" }] });
  const out = await textModel({ ...CF, ANTHROPIC_API_KEY: "k" })?.("sys", "p");
  assert.equal(out, "ab");
  assert.match(calls[0].url, /api\.anthropic\.com/);
  assert.equal(JSON.parse(String(calls[0].init.body)).model, "claude-sonnet-5-5");
});

test("AI_MODEL overrides the default Cloudflare model", async () => {
  mockFetch(200, { result: { response: "x" } });
  await textModel({ ...CF, AI_MODEL: "@cf/qwen/other" })?.("s", "p");
  assert.match(calls[0].url, /ai\/run\/@cf\/qwen\/other$/);
});

test("HTTP errors are thrown with status, for both providers", async () => {
  mockFetch(429, { errors: [{ message: "daily limit" }] });
  await assert.rejects(() => /** @type {any} */ (textModel(CF))("s", "p"), /Cloudflare AI 429.*daily limit/);
  await assert.rejects(() => /** @type {any} */ (textModel({ ANTHROPIC_API_KEY: "k" }))("s", "p"), /Claude API 429/);
});


test("Cloudflare image is decoded from base64", async () => {
  mockFetch(200, { result: { image: JPEG.toString("base64") } });
  const buf = await imageModel(CF)?.("prompt");
  assert.equal(buf?.length, JPEG.length);
  assert.match(calls[0].url, /accounts\/a{32}\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell/);
});

test("a malformed account id is rejected before any request", () => {
  assert.throws(() => imageModel({ ...CF, CF_ACCOUNT_ID: "../evil" }), /32-character/);
});

test("non-JPEG or failed image responses are rejected", async () => {
  mockFetch(200, { result: { image: Buffer.from("<html>nope</html>").toString("base64") } });
  await assert.rejects(() => /** @type {any} */ (imageModel(CF))("p"), /not a JPEG/);
  mockFetch(403, { errors: [{ message: "forbidden" }] });
  await assert.rejects(() => /** @type {any} */ (imageModel(CF))("p"), /Cloudflare 403/);
});
