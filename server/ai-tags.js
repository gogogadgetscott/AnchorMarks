const smartOrg = require("./smart-organization");

/**
 * AI Tag Suggestion Provider
 *
 * Supports optional providers via environment configuration:
 * - provider: 'openai' | 'ollama' | 'none'
 * - apiUrl: base URL for provider
 * - apiKey: API key (if required)
 * - model: model name
 */
async function suggestTagsAI({ url, title, limit = 10, userTags = [] }, aiConfig) {
  const provider = (aiConfig?.provider || "none").toLowerCase();
  if (provider === "none") {
    const err = new Error("AI provider not configured");
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }

  const prompt = buildPrompt({ url, title, userTags, limit });

  if (provider === "openai") {
    return await callOpenAI(prompt, aiConfig, limit);
  }
  if (provider === "ollama") {
    return await callOllama(prompt, aiConfig, limit);
  }

  const err = new Error(`Unsupported AI provider: ${provider}`);
  err.code = "AI_UNSUPPORTED";
  throw err;
}

function buildPrompt({ url, title, userTags, limit }) {
  const preferred = Array.isArray(userTags) ? userTags.slice(0, 100) : [];
  const data = {
    task: "suggest-tags",
    url,
    title: title || null,
    preferredTags: preferred,
    constraints: {
      maxTags: limit,
      lowercase: true,
      noPunctuation: true,
      noDuplicates: true,
    },
  };
  return `You are a bookmarking assistant. Given this JSON, propose up to ${limit} concise tags relevant to the page. Prioritize items from preferredTags when fitting. Return ONLY a JSON object: {\n  \"tags\": [\"...\"]\n} with lowercase tags, hyphenated where natural (e.g., web-dev), no spaces, no punctuation, no emojis.\n\nInput:\n${JSON.stringify(data, null, 2)}`;
}

async function callOpenAI(prompt, aiConfig, limit) {
  const apiUrl = aiConfig?.apiUrl || "https://api.openai.com/v1/chat/completions";
  const apiKey = aiConfig?.apiKey;
  const model = aiConfig?.model || "gpt-4o-mini";
  if (!apiKey) {
    const err = new Error("AI_API_KEY missing for OpenAI provider");
    err.code = "AI_KEY_MISSING";
    throw err;
  }

  const body = {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: "You suggest bookmark tags. Output strict JSON only." },
      { role: "user", content: prompt },
    ],
  };

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`OpenAI error: ${res.status} ${text}`);
    err.code = "AI_API_ERROR";
    throw err;
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content || "";
  const tags = extractTagsFromContent(content, limit);
  return tags.map((t) => ({ tag: t, score: null, source: "ai", reason: "AI-generated" }));
}

async function callOllama(prompt, aiConfig, limit) {
  const apiUrl = aiConfig?.apiUrl || "http://localhost:11434/api/generate";
  const model = aiConfig?.model || "llama3.1";

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Ollama error: ${res.status} ${text}`);
    err.code = "AI_API_ERROR";
    throw err;
  }

  const json = await res.json();
  const content = json?.response || "";
  const tags = extractTagsFromContent(content, limit);
  return tags.map((t) => ({ tag: t, score: null, source: "ai", reason: "AI-generated" }));
}

function extractTagsFromContent(content, limit) {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    const obj = match ? JSON.parse(match[0]) : JSON.parse(content);
    const raw = Array.isArray(obj?.tags) ? obj.tags : [];
    return sanitizeTags(raw).slice(0, limit);
  } catch {
    // Fallback: parse comma/line separated
    const candidates = content
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean);
    return sanitizeTags(candidates).slice(0, limit);
  }
}

function sanitizeTags(list) {
  const seen = new Set();
  const out = [];
  list.forEach((t) => {
    let tag = String(t || "").toLowerCase().trim();
    tag = tag.replace(/[^a-z0-9\-]/g, "");
    if (!tag || tag.length < 2 || tag.length > 40) return;
    if (!seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  });
  return out;
}

module.exports = {
  suggestTagsAI,
};
