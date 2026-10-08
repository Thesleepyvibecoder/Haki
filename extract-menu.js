const MENU_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    categories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
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

const jsonHeaders = { "Content-Type": "application/json" };

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json").send(JSON.stringify(body));
}

async function verifyMenuToken(token) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase configuration is missing on the server.");

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_digital_menu_admin`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_token: token })
  });
  if (!response.ok) throw new Error("Could not verify the menu link.");
  const data = await response.json();
  return data?.[0] || data || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });

  try {
    const { token, image } = req.body || {};
    if (!token || typeof token !== "string") return send(res, 400, { error: "Invalid menu link." });
    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return send(res, 400, { error: "Please upload a valid menu image." });
    }
    if (image.length > 6_000_000) return send(res, 413, { error: "This menu image is too large. Please use a smaller image." });

    await verifyMenuToken(token);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return send(res, 503, { error: "Menu AI is not configured yet. Add OPENAI_API_KEY to the Vercel environment variables." });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MENU_MODEL || "gpt-6-luna",
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Read this restaurant menu image and convert it into structured menu data.

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
- The result will be reviewed by a restaurant owner before it is saved.`
            },
            { type: "input_image", image_url: image, detail: "high" }
          ]
        }],
        text: {
          format: {
            type: "json_schema",
            name: "restaurant_menu",
            strict: true,
            schema: MENU_SCHEMA
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return send(res, 502, { error: data?.error?.message || "The menu AI service could not process this image." });
    }

    let parsed;
    try {
      parsed = JSON.parse(data.output_text || "{}");
    } catch {
      return send(res, 502, { error: "The menu AI returned an unreadable result. Please try the image again." });
    }

    return send(res, 200, { menu: parsed });
  } catch (error) {
    return send(res, 500, { error: error?.message || "Could not digitalize the menu." });
  }
}
