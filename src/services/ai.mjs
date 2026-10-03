// The only place that talks to AI providers. Keys come from the environment (GitHub Actions secrets).

/**
 * Text model. Free by default: GitHub Models via the GITHUB_TOKEN every Actions run has.
 * ANTHROPIC_API_KEY switches to Claude (paid). Returns null when neither is configured.
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
      const data = await res.json();
      return data.content.filter((/** @type {any} */ b) => b.type === "text").map((/** @type {any} */ b) => b.text).join("").trim();
    };
  }
  if (env.GITHUB_TOKEN) {
    const model = env.AI_MODEL || "openai/gpt-4.1-mini";
    return async (system, prompt) => {
      const res = await fetch("https://models.github.ai/inference/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(300000),
      });
      if (!res.ok) throw new Error(`GitHub Models ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return String((await res.json()).choices?.[0]?.message?.content ?? "").trim();
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
  const account = env.CF_ACCOUNT_ID;
  const token = env.CF_API_TOKEN;
  if (!account || !token) return null;
  if (!/^[a-f0-9]{32}$/i.test(account)) throw new Error("CF_ACCOUNT_ID should be a 32-character hex id");
  return async (prompt) => {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt, steps: 6 }),
      signal: AbortSignal.timeout(120000),
    });
    const data = await res.json();
    if (!res.ok || typeof data.result?.image !== "string") throw new Error(`Cloudflare ${res.status} ${JSON.stringify(data.errors ?? "")}`);
    const buf = Buffer.from(data.result.image, "base64");
    // JPEG files start with FF D8; anything else is not a picture we should publish.
    if (buf.length < 1000 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("Cloudflare returned something that is not a JPEG");
    return buf;
  };
}
