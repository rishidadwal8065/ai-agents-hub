// The only place that talks to AI providers. Keys come from the environment (GitHub Actions secrets).

/**
 * Reads a JSON body, turning anything else into a readable error.
 * @param {Response} res
 */
async function readJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`reply was not JSON: ${text.slice(0, 100)}`); }
}

/**
 * Checks and returns the Cloudflare account id and token, or null when not configured.
 * @param {NodeJS.ProcessEnv} env
 */
function cloudflare(env) {
  const account = env.CF_ACCOUNT_ID?.trim();
  const token = env.CF_API_TOKEN?.trim();
  if (!account || !token) return null;
  if (!/^[a-f0-9]{32}$/i.test(account)) throw new Error("CF_ACCOUNT_ID should be a 32-character hex id");
  return { base: `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/`, token };
}

/**
 * Text model. Free by default: Cloudflare Workers AI (same account and token as hosting).
 * ANTHROPIC_API_KEY switches to Claude (paid). Returns null when neither is configured.
 * GitHub Models was retired on 30 July 2026 and is no longer supported.
 * @param {NodeJS.ProcessEnv} env
 * @returns {import("../generate.mjs").Complete | null}
 */
export function textModel(env) {
  if (env.ANTHROPIC_API_KEY) {
    const model = env.AI_MODEL || "claude-sonnet-5-5";
    return async (system, prompt) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": String(env.ANTHROPIC_API_KEY), "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 8000, system, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(300000),
      });
      if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await readJson(res);
      return data.content.filter((/** @type {any} */ b) => b.type === "text").map((/** @type {any} */ b) => b.text).join("").trim();
    };
  }
  const cf = cloudflare(env);
  if (cf) {
    const model = env.AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    return async (system, prompt) => {
      const res = await fetch(cf.base + model, {
        method: "POST",
        headers: { authorization: `Bearer ${cf.token}`, "content-type": "application/json" },
        body: JSON.stringify({ max_tokens: 4096, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(300000),
      });
      if (!res.ok) throw new Error(`Cloudflare AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const r = (await readJson(res)).result ?? {};
      return String(r.response ?? r.choices?.[0]?.message?.content ?? "").trim();
    };
  }
  return null;
}

/**
 * Watermark-free pictures from Cloudflare Workers AI (FLUX schnell, free daily allowance).
 * @param {NodeJS.ProcessEnv} env
 * @returns {import("../generate.mjs").ImageFn | null}
 */
export function imageModel(env) {
  const cf = cloudflare(env);
  if (!cf) return null;
  return async (prompt) => {
    const res = await fetch(`${cf.base}@cf/black-forest-labs/flux-1-schnell`, {
      method: "POST",
      headers: { authorization: `Bearer ${cf.token}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt, steps: 6 }),
      signal: AbortSignal.timeout(120000),
    });
    const data = await readJson(res);
    if (!res.ok || typeof data.result?.image !== "string") throw new Error(`Cloudflare ${res.status} ${JSON.stringify(data.errors ?? "")}`);
    const buf = Buffer.from(data.result.image, "base64");
    // JPEG files start with FF D8; anything else is not a picture we should publish.
    if (buf.length < 1000 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("Cloudflare returned something that is not a JPEG");
    return buf;
  };
}
