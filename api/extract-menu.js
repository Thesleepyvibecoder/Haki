const MENU_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                price: { type: "string" },
                available: { type: "boolean" }
              },
              required: ["name", "description", "price", "available"]
            }
          }
        },
        required: ["name", "items"]
      }
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["title", "subtitle", "categories", "warnings"]
};

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json").send(JSON.stringify(body));
}

async function verifyMenuToken(token) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase configuration is missing on the server.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_digital_menu_admin`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_token: token })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Could not verify the menu link.${detail ? ` ${detail.slice(0, 300)}` : ""}`);
  }

  const data = await response.json();
  return data?.[0] || data || null;
}

function parseDataImage(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });

  try {
    const { token, image } = req.body || {};

    if (!token || typeof token !== "string") {
      return send(res, 400, { error: "Invalid menu link." });
    }

    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return send(res, 400, { error: "Please upload a valid menu image." });
    }

    if (image.length > 6_000_000) {
      return send(res, 413, { error: "This menu image is too large. Please use a smaller image." });
    }

    await verifyMenuToken(token);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return send(res, 503, {
        error: "Menu AI is not configured yet. Add GEMINI_API_KEY to the Vercel environment variables."
      });
    }

    const media = parseDataImage(image);
    if (!media) return send(res, 400, { error: "Invalid menu image data." });

    const prompt = `Read this restaurant menu image and convert it into structured menu data.

Rules:
- Extract only information visibly present in the image.
- Do not invent dishes, descriptions, prices, categories, or availability.
- Preserve item names and descriptions as written, except for harmless whitespace cleanup.
- Keep Indian currency values exactly as displayed when possible, such as ₹299, Rs. 299, or 299/-.
- Put each dish under the category it visibly belongs to.
- If a price is unclear or missing, leave price as an empty string and add a warning.
- If text is unreadable, do not guess. Add a warning instead.
- If the image contains sizes or variants, keep that information in the description for now.
- Do not rewrite marketing copy.
- The result will be reviewed by a restaurant owner before it is saved.
- Return every visible category and dish you can read. Do not summarize or omit items merely because the menu is long.`;

    const model = process.env.GEMINI_MENU_MODEL || "gemini-2.5-flash-lite";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: media.mimeType, data: media.data } }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: MENU_SCHEMA,
          temperature: 0
        }
      })
    });

    const raw = await response.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const providerMessage = data?.error?.message || raw?.slice(0, 800) || "No provider error message was returned.";
      console.error("Gemini menu extraction failed:", {
        status: response.status,
        model,
        message: providerMessage
      });
      return send(res, 502, {
        error: `Gemini error (${response.status}): ${providerMessage}`
      });
    }

    const outputText = data?.candidates?.[0]?.content?.parts
      ?.filter((part) => typeof part?.text === "string")
      ?.map((part) => part.text)
      ?.join("") || "";

    if (!outputText) {
      console.error("Gemini returned no text output:", JSON.stringify(data).slice(0, 2000));
      return send(res, 502, { error: "Gemini returned no menu data. Please try the image again." });
    }

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch (error) {
      console.error("Gemini returned invalid JSON:", outputText.slice(0, 2000));
      return send(res, 502, { error: "Gemini returned an unreadable menu result. Please try the image again." });
    }

    return send(res, 200, { menu: parsed });
  } catch (error) {
    console.error("Menu extraction server error:", error);
    return send(res, 500, { error: error?.message || "Could not digitalize the menu." });
  }
}
