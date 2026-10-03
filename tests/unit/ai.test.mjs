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

test("GitHub Models is used with the Actions token", async () => {
  mockFetch(200, { choices: [{ message: { content: " hi " } }] });
  const out = await textModel({ GITHUB_TOKEN: "t" })?.("sys", "prompt");
  assert.equal(out, "hi");
  assert.match(calls[0].url, /models\.github\.ai/);
  assert.equal(new Headers(calls[0].init.headers).get("authorization"), "Bearer t");
});

test("Anthropic key takes priority and joins text blocks", async () => {
  mockFetch(200, { content: [{ type: "text", text: "a" }, { type: "tool_use" }, { type: "text", text: "b" }] });
  const out = await textModel({ GITHUB_TOKEN: "t", ANTHROPIC_API_KEY: "k" })?.("sys", "p");
  assert.equal(out, "ab");
  assert.match(calls[0].url, /api\.anthropic\.com/);
  assert.equal(JSON.parse(String(calls[0].init.body)).model, "claude-sonnet-5-5");
});

test("AI_MODEL overrides the default model", async () => {
  mockFetch(200, { choices: [{ message: { content: "x" } }] });
  await textModel({ GITHUB_TOKEN: "t", AI_MODEL: "openai/other" })?.("s", "p");
  assert.equal(JSON.parse(String(calls[0].init.body)).model, "openai/other");
});

test("HTTP errors are thrown with status, for both providers", async () => {
  mockFetch(429, "rate limited");
  await assert.rejects(() => /** @type {any} */ (textModel({ GITHUB_TOKEN: "t" }))("s", "p"), /GitHub Models 429/);
  await assert.rejects(() => /** @type {any} */ (textModel({ ANTHROPIC_API_KEY: "k" }))("s", "p"), /Claude API 429/);
});

const CF = { CF_ACCOUNT_ID: "a".repeat(32), CF_API_TOKEN: "tok" };

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
