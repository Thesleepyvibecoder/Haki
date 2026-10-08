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
    cache: "no-store",
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
      "cache-control": "3600",
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
    "/businesses?select=*&order=created_at.desc",
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

// --- Digital Menu V4: multi-menu, restaurant manager and NFC stand routing ---
const RESTAURANT_TOKEN_KEY = "haki_restaurant_access_token";
export function getRestaurantToken(){ return sessionStorage.getItem(RESTAURANT_TOKEN_KEY); }
export function clearRestaurantToken(){ sessionStorage.removeItem(RESTAURANT_TOKEN_KEY); }

export async function restaurantLogin(email,password){
  if(!supabaseConfigured) throw new Error("Supabase is not configured.");
  const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  const data=await response.json();
  if(!response.ok||!data.access_token) throw new Error(data.error_description||data.msg||"Login failed");
  sessionStorage.setItem(RESTAURANT_TOKEN_KEY,data.access_token); return data;
}

export async function getAdminDigitalMenus(businessId){
  const token=getAdminToken(); if(!token) throw new Error("Not signed in.");
  return supabaseFetch("/rpc/get_admin_digital_menus",{method:"POST",body:JSON.stringify({p_business_id:businessId})},token);
}
export async function saveAdminDigitalMenu(businessId,payload){
  const token=getAdminToken(); if(!token) throw new Error("Not signed in.");
  const rows=await supabaseFetch("/rpc/save_admin_digital_menu",{method:"POST",body:JSON.stringify({p_business_id:businessId,p_payload:payload})},token);
  return rows;
}
export async function deleteAdminDigitalMenu(businessId,menuId){
  const token=getAdminToken(); if(!token) throw new Error("Not signed in.");
  return supabaseFetch("/rpc/delete_admin_digital_menu",{method:"POST",body:JSON.stringify({p_business_id:businessId,p_menu_id:menuId})},token);
}
export async function saveAdminStand(businessId,payload){
  const token=getAdminToken(); if(!token) throw new Error("Not signed in.");
  return supabaseFetch("/rpc/save_admin_stand",{method:"POST",body:JSON.stringify({p_business_id:businessId,p_payload:payload})},token);
}
export async function deleteAdminStand(businessId,standId){
  const token=getAdminToken(); if(!token) throw new Error("Not signed in.");
  return supabaseFetch("/rpc/delete_admin_stand",{method:"POST",body:JSON.stringify({p_business_id:businessId,p_stand_id:standId})},token);
}
export async function getRestaurantMenus(){
  const token=getRestaurantToken(); if(!token) throw new Error("Please sign in to the restaurant portal.");
  return supabaseFetch("/rpc/get_restaurant_menus",{method:"POST",body:JSON.stringify({})},token);
}
export async function saveRestaurantMenu(payload){
  const token=getRestaurantToken(); if(!token) throw new Error("Please sign in to the restaurant portal.");
  return supabaseFetch("/rpc/save_restaurant_menu",{method:"POST",body:JSON.stringify({p_payload:payload})},token);
}
export async function deleteRestaurantMenu(menuId){
  const token=getRestaurantToken(); if(!token) throw new Error("Please sign in to the restaurant portal.");
  return supabaseFetch("/rpc/delete_restaurant_menu",{method:"POST",body:JSON.stringify({p_menu_id:menuId})},token);
}
export async function saveRestaurantStand(payload){
  const token=getRestaurantToken(); if(!token) throw new Error("Please sign in to the restaurant portal.");
  return supabaseFetch("/rpc/save_restaurant_stand",{method:"POST",body:JSON.stringify({p_payload:payload})},token);
}
export async function getPublicDigitalMenu(businessSlug,menuSlug){
  const rows=await supabaseFetch("/rpc/get_public_digital_menu",{method:"POST",body:JSON.stringify({p_business_slug:businessSlug,p_menu_slug:menuSlug})});
  return rows||null;
}
export async function getPublicMenuByStand(token){
  const rows=await supabaseFetch("/rpc/get_public_menu_by_stand",{method:"POST",body:JSON.stringify({p_stand_token:token})});
  return rows||null;
}
export async function createRestaurantManager(payload){
  const token=getAdminToken(); if(!token) throw new Error("Haki admin sign-in is required.");
  const response=await fetch("/api/create-restaurant-manager",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(payload)});
  const data=await response.json(); if(!response.ok) throw new Error(data.error||"Could not create restaurant access."); return data;
}
export async function uploadRestaurantMedia(file,path){
  const token=getRestaurantToken(); if(!token) throw new Error("Not signed in.");
  await storageFetch(`/object/${MEDIA_BUCKET}/${path}`,{method:"POST",headers:{"Content-Type":file.type||"application/octet-stream","x-upsert":"true","cache-control":"3600"},body:file},token);
  return getPublicMediaUrl(path);
}
export async function getPublicDigitalMenus(businessSlug){
  const rows=await supabaseFetch("/rpc/get_public_digital_menus",{method:"POST",body:JSON.stringify({p_business_slug:businessSlug})});
  return rows||null;
}
