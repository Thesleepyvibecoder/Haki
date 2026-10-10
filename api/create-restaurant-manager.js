const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const PUBLIC_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ADMIN_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Legacy service_role keys are JWTs; modern sb_secret_* keys are not.
const ADMIN_KEY_IS_LEGACY_JWT = Boolean(ADMIN_KEY && ADMIN_KEY.split(".").length === 3);

async function request(path, options = {}, { accessToken = null, admin = false } = {}) {
  if (!SUPABASE_URL) throw new Error("VITE_SUPABASE_URL is not configured in Vercel.");
  if (!PUBLIC_KEY) throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is not configured in Vercel.");
  if (admin && !ADMIN_KEY) {
    throw new Error("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel.");
  }

  const { headers: extraHeaders = {}, ...fetchOptions } = options;
  const headers = {
    apikey: admin && !ADMIN_KEY_IS_LEGACY_JWT ? ADMIN_KEY : PUBLIC_KEY,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  // Remove any inherited Authorization header before adding the right credential.
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
    // Preserve plain-text errors for the message below.
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

  let stage = "configuration";
  let createdAuthUserId = null;
  try {
    if (!ADMIN_KEY) {
      throw new Error("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel.");
    }

    const authHeader = String(req.headers.authorization || "");
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) throw new Error("Haki admin authentication required.");

    stage = "verify Haki admin session";
    const caller = await request("/auth/v1/user", {}, { accessToken });
    if (!caller?.id) throw new Error("Could not verify the signed-in Haki admin.");

    // Use the existing SECURITY DEFINER RPC because direct access to haki_admin_users
    // is intentionally revoked from authenticated clients.
    stage = "check Haki admin permission";
    const isAdmin = await request(
      "/rest/v1/rpc/is_haki_admin",
      { method: "POST", body: JSON.stringify({}) },
      { accessToken }
    );
    if (isAdmin !== true) throw new Error("Only Haki admins can create restaurant access.");

    const { businessId, email: rawEmail, password } = req.body || {};
    const email = String(rawEmail || "").trim().toLowerCase();
    if (!businessId || !email || !password) {
      throw new Error("Business, email and password are required.");
    }
    if (typeof password !== "string" || password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    // This SELECT and the insert below require explicit table grants to service_role.
    // The included SQL grants only SELECT/INSERT to service_role, not to browser roles.
    stage = "check for an existing restaurant manager";
    const existing = await request(
      `/rest/v1/restaurant_users?select=id&business_id=eq.${encodeURIComponent(businessId)}&email=eq.${encodeURIComponent(email)}&limit=1`,
      {},
      { admin: true }
    );
    if (existing?.[0]) {
      throw new Error("A manager with this email already exists for this business.");
    }

    stage = "create the manager's Supabase Auth account";
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
    createdAuthUserId = user?.id || null;
    if (!createdAuthUserId) throw new Error("Supabase Auth did not return the new manager's user ID.");

    stage = "link the manager to this business";
    await request(
      "/rest/v1/restaurant_users",
      {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          business_id: businessId,
          auth_user_id: createdAuthUserId,
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
    // Give the UI enough context to avoid another blind round of patching.
    const message = error?.message || "Could not create manager.";
    return res.status(400).json({
      error: `${stage}: ${message}`,
      stage,
      orphanedAuthUser: Boolean(createdAuthUserId),
    });
  }
}
