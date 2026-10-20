const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const PUBLIC_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MENU_MODEL || "gemini-3.5-flash-lite";

// Legacy service_role keys are JWTs. New sb_secret_* keys are not JWTs and
// must be sent as the apikey only, never as Authorization: Bearer.
const ADMIN_KEY_IS_LEGACY_JWT = Boolean(ADMIN_KEY && ADMIN_KEY.split(".").length === 3);

async function request(path, options = {}, { accessToken = null, admin = false } = {}) {
  if (!SUPABASE_URL) throw new Error("VITE_SUPABASE_URL is not configured in Vercel.");
  if (!PUBLIC_KEY) throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is not configured in Vercel.");
  if (admin && !ADMIN_KEY) throw new Error("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel.");

  const { headers: extraHeaders = {}, ...fetchOptions } = options;
  const headers = {
    apikey: admin && !ADMIN_KEY_IS_LEGACY_JWT ? ADMIN_KEY : PUBLIC_KEY,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  delete headers.Authorization;
  delete headers.authorization;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  else if (admin && ADMIN_KEY_IS_LEGACY_JWT) headers.Authorization = `Bearer ${ADMIN_KEY}`;

  const response = await fetch(`${SUPABASE_URL}${path}`, { ...fetchOptions, headers });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}
  if (!response.ok) throw new Error(data?.message || data?.error_description || data?.msg || data?.error || raw || `Supabase error ${response.status}`);
  return data;
}

async function authorize(accessToken) {
  // Validate the user's actual Supabase session first.
  const user = await request("/auth/v1/user", {}, { accessToken });
  if (!user?.id) throw new Error("Could not verify the signed-in user.");

  // Query restaurant assignment with server credentials so table RLS does not
  // block this backend check. The table is never made public.
  const managers = await request(
    `/rest/v1/restaurant_users?select=business_id&auth_user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&limit=1`,
    {},
    { admin: true }
  );
  if (managers?.[0]?.business_id) return { role: "manager", businessId: managers[0].business_id };

  // Admin status is checked through the existing SECURITY DEFINER RPC under
  // the user's JWT, not by exposing haki_admin_users to client-facing roles.
  const isAdmin = await request("/rest/v1/rpc/is_haki_admin", {
    method: "POST", body: JSON.stringify({})
  }, { accessToken });
  if (isAdmin === true) return { role: "admin", businessId: null };
  throw new Error("You are not authorised to import menus.");
}

function cleanJson(text) {
  let value = String(text || "").trim();
  if (value.startsWith("```")) value = value.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(value);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY is not configured in Vercel.");
    if (!ADMIN_KEY) throw new Error("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel.");
    const accessToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) throw new Error("Authentication required.");
    await authorize(accessToken);

    const { file, mimeType = "image/jpeg" } = req.body || {};
    if (!file) throw new Error("No menu file received.");
    const base64 = String(file).split(",").pop();
    const prompt = `You are Haki's menu data-entry clerk. Extract ONLY information visible in this restaurant menu. Do not invent, infer, improve, translate, or rewrite anything. Preserve dish names and descriptions as written. Preserve Indian prices such as ₹299, Rs. 299, 299/-. Put each dish under the visible category. If a price or text is unclear, leave that field blank and add a warning. Keep sizes/variants in the description for now. Return every visible category and dish. Output JSON only using this shape: {"title":"","subtitle":"","categories":[{"name":"","items":[{"name":"","description":"","price":"","available":true}]}],"warnings":[]}.`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Gemini extraction failed.");
    const output = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
    return res.status(200).json({ menu: cleanJson(output) });
  } catch (error) {
    return res.status(400).json({ error: error?.message || "Menu extraction failed." });
  }
}
