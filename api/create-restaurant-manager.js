const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const PUBLIC_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Legacy service_role keys are JWTs. New sb_secret_* keys are API keys and
// must be sent through `apikey`, never `Authorization: Bearer ...`.
const ADMIN_KEY_IS_LEGACY_JWT = Boolean(ADMIN_KEY && ADMIN_KEY.split(".").length === 3);

async function request(path, options = {}, { accessToken = null, admin = false } = {}) {
  if (!SUPABASE_URL) throw new Error("VITE_SUPABASE_URL is not configured in Vercel.");
  if (!PUBLIC_KEY) throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is not configured in Vercel.");
  if (admin && !ADMIN_KEY) {
    throw new Error("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel.");
  }

  const { headers: extraHeaders = {}, ...fetchOptions } = options;
  const apiKey = admin && !ADMIN_KEY_IS_LEGACY_JWT ? ADMIN_KEY : PUBLIC_KEY;
  const headers = {
    apikey: apiKey,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  // Do not accidentally forward a key as a bearer token from merged headers.
  delete headers.Authorization;
  delete headers.authorization;

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (admin && ADMIN_KEY_IS_LEGACY_JWT) {
    headers.Authorization = `Bearer ${ADMIN_KEY}`;
  }

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Keep the original response text for a useful error below.
  }

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error_description || data?.msg || text || `Supabase error ${response.status}`
    );
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!ADMIN_KEY) {
      throw new Error("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel.");
    }

    const authHeader = String(req.headers.authorization || "");
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) throw new Error("Haki admin authentication required.");

    // Authenticate the currently signed-in user with their Supabase Auth JWT.
    const caller = await request("/auth/v1/user", {}, { accessToken });
    if (!caller?.id) throw new Error("Could not verify the signed-in Haki admin.");

    // Use server-side elevated access only after identifying the caller.
    const admins = await request(
      `/rest/v1/haki_admin_users?select=user_id&user_id=eq.${encodeURIComponent(caller.id)}&limit=1`,
      {},
      { admin: true }
    );
    if (!admins?.[0]) throw new Error("Only Haki admins can create restaurant access.");

    const { businessId, email: rawEmail, password } = req.body || {};
    const email = String(rawEmail || "").trim().toLowerCase();
    if (!businessId || !email || !password) {
      throw new Error("Business, email and password are required.");
    }
    if (typeof password !== "string" || password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const existing = await request(
      `/rest/v1/restaurant_users?select=id&business_id=eq.${encodeURIComponent(businessId)}&email=eq.${encodeURIComponent(email)}&limit=1`,
      {},
      { admin: true }
    );
    if (existing?.[0]) {
      throw new Error("A manager with this email already exists for this business.");
    }

    const user = await request(
      "/auth/v1/admin/users",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          app_metadata: { role: "restaurant_manager", business_id: businessId },
        }),
      },
      { admin: true }
    );

    await request(
      "/rest/v1/restaurant_users",
      {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          business_id: businessId,
          auth_user_id: user.id,
          email,
          role: "restaurant_manager",
          is_active: true,
        }),
      },
      { admin: true }
    );

    return res.status(200).json({
      message: `Manager created for ${email}. Share /restaurant-login and the credentials with them.`,
    });
  } catch (error) {
    return res.status(400).json({ error: error?.message || "Could not create manager." });
  }
}
