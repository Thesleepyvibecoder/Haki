const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
const MEDIA_BUCKET = "haki-media";

async function supabaseFetch(path, options = {}, token = SUPABASE_KEY) {
  if (!supabaseConfigured) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function storageFetch(path, options = {}, token = SUPABASE_KEY) {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");

  const response = await fetch(`${SUPABASE_URL}/storage/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Storage request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

export function getPublicMediaUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

export async function uploadMedia(file, path) {
  const token = getAdminToken();
  if (!token) throw new Error("Not signed in.");

  await storageFetch(`/object/${MEDIA_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  }, token);

  return getPublicMediaUrl(path);
}

export async function deleteMedia(path) {
  const token = getAdminToken();
  if (!token || !path) return;
  await storageFetch(`/object/${MEDIA_BUCKET}/${path}`, {
    method: "DELETE",
  }, token);
}

export async function getBusinessBySlug(slug) {
  const rows = await supabaseFetch(
    `/businesses?select=*&slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&limit=1`
  );
  return rows?.[0] || null;
}

export async function trackEvent(businessId, eventType) {
  if (!supabaseConfigured || !businessId) return;

  await supabaseFetch("/analytics_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ business_id: businessId, event_type: eventType }),
  });
}

export async function getAnalyticsByToken(token) {
  return supabaseFetch("/rpc/get_business_analytics", {
    method: "POST",
    body: JSON.stringify({ p_token: token }),
  });
}

const AUTH_TOKEN_KEY = "haki_admin_access_token";

export function getAdminToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function clearAdminToken() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function adminLogin(email, password) {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.msg || "Login failed");
  }

  sessionStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
  return data;
}

export function getMediaPathFromPublicUrl(url) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

export async function getAdminBusinesses() {
  const token = getAdminToken();
  if (!token) throw new Error("Not signed in.");

  return supabaseFetch(
    "/businesses?select=id,business_name,slug,person_name,analytics_token,is_active,created_at,menu_images,payment_qr_url&order=created_at.desc",
    {},
    token
  );
}

export async function createBusiness(payload) {
  const token = getAdminToken();
  if (!token) throw new Error("Not signed in.");

  const rows = await supabaseFetch("/businesses", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  }, token);

  return rows?.[0];
}

export async function updateBusiness(id, payload) {
  const token = getAdminToken();
  if (!token) throw new Error("Not signed in.");

  const rows = await supabaseFetch(`/businesses?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  }, token);

  return rows?.[0];
}

export async function deleteBusiness(id) {
  const token = getAdminToken();
  if (!token) throw new Error("Not signed in.");

  await supabaseFetch("/rpc/delete_business", {
    method: "POST",
    body: JSON.stringify({ p_business_id: id }),
  }, token);
}
