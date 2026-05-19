export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.OPENAI_KEY;
  if (!key) return res.status(503).json({ error: "Service not configured" });

  const { prompt } = req.body ?? {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model:      "gpt-4o-mini",
        max_tokens: 500,
        messages:   [{ role: "user", content: prompt }],
      }),
    });
    const d = await r.json();
    if (d.error) return res.status(502).json({ error: d.error.message ?? "OpenAI API error" });
    res.json({ text: d.choices?.[0]?.message?.content ?? "" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
