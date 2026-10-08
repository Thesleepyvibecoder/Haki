const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MENU_MODEL || "gemini-3.5-flash-lite";

async function supabase(path, options={}, token=SUPABASE_SECRET){
  const r=await fetch(`${SUPABASE_URL}${path}`,{...options,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(options.headers||{})}});
  const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{}
  if(!r.ok) throw new Error(data?.message||data?.error||text||`Supabase error ${r.status}`); return data;
}
async function getAuthUser(token){return supabase("/auth/v1/user",{headers:{Authorization:`Bearer ${token}`}},token)}
async function allowed(token){
  const user=await getAuthUser(token);
  const rows=await supabase(`/rest/v1/restaurant_users?select=business_id&auth_user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&limit=1`);
  if(rows?.[0]) return {role:"manager",businessId:rows[0].business_id};
  const admins=await supabase(`/rest/v1/haki_admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
  if(admins?.[0]) return {role:"admin",businessId:null};
  throw new Error("You are not authorised to import menus.");
}
function cleanJson(text){let s=String(text||"").trim();if(s.startsWith("```") )s=s.replace(/^```(?:json)?/i,"").replace(/```$/i,"").trim();return JSON.parse(s)}
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    if(!GEMINI_KEY) throw new Error("GEMINI_API_KEY is not configured in Vercel.");
    const auth=String(req.headers.authorization||"").replace(/^Bearer\s+/i,""); if(!auth) throw new Error("Authentication required.");
    await allowed(auth);
    const {file,mimeType="image/jpeg"}=req.body||{}; if(!file) throw new Error("No menu file received.");
    const base64=String(file).split(",").pop();
    const prompt=`You are Haki's menu data-entry clerk. Extract ONLY information visible in this restaurant menu. Do not invent, infer, improve, translate, or rewrite anything. Preserve dish names and descriptions as written. Preserve Indian prices such as ₹299, Rs. 299, 299/-. Put each dish under the visible category. If a price or text is unclear, leave that field blank and add a warning. Keep sizes/variants in the description for now. Return every visible category and dish. Output JSON only using this shape: {"title":"","subtitle":"","categories":[{"name":"","items":[{"name":"","description":"","price":"","available":true}]}],"warnings":[]}.`;
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt},{inlineData:{mimeType,data:base64}}]}],generationConfig:{temperature:0,responseMimeType:"application/json"}})});
    const data=await response.json(); if(!response.ok) throw new Error(data?.error?.message||"Gemini extraction failed.");
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||""; const menu=cleanJson(text); return res.status(200).json({menu});
  }catch(e){return res.status(400).json({error:e.message||"Menu extraction failed."})}
}
