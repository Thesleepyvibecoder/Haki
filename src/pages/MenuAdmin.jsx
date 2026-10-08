import { useEffect, useMemo, useState } from "react";
import {
  FaCheck, FaExternalLinkAlt, FaPlus, FaTrash, FaArrowUp, FaArrowDown,
  FaSave, FaUtensils, FaUpload, FaMagic, FaTimes, FaExclamationTriangle
} from "react-icons/fa";
import { getDigitalMenuAdminByToken, saveDigitalMenuByToken } from "../lib/supabaseRest";
import "./MenuAdmin.css";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const EMPTY_HOURS = DAYS.map(day => ({ day, open: "10:00", close: "22:00", closed: false }));
const EMPTY_MENU = { title: "", subtitle: "", categories: [] };
const EMPTY_DETAILS = { tagline: "", story: "", address: "", mapUrl: "", instagramUrl: "", googleReviewUrl: "" };

function uid(){ return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function blankCategory(){ return { id: uid(), name: "New Category", items: [] }; }
function blankItem(){ return { id: uid(), name: "New Item", description: "", price: "", available: true }; }

async function compressMenuImage(file){
  if (!file.type.startsWith("image/")) throw new Error("Please upload an image file.");
  const bitmap = await createImageBitmap(file);
  const max = 1800;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) return reject(new Error("Could not prepare the image."));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(blob);
  }, "image/jpeg", 0.78));
}

function mergeExtractedMenus(base, extracted){
  const next = { ...base, title: base.title || extracted.title || "", subtitle: base.subtitle || extracted.subtitle || "", categories: [...(base.categories || [])] };
  for (const category of extracted.categories || []) {
    const existing = next.categories.find(c => c.name.trim().toLowerCase() === category.name.trim().toLowerCase());
    const incomingItems = (category.items || []).map(item => ({ ...blankItem(), ...item, id: uid(), available: item.available !== false }));
    if (!existing) {
      next.categories.push({ id: uid(), name: category.name || "Other", items: incomingItems });
    } else {
      existing.items = [...existing.items, ...incomingItems];
    }
  }
  return next;
}

export default function MenuAdmin(){
  const token = useMemo(() => window.location.pathname.split("/").filter(Boolean)[1] || "", []);
  const [business,setBusiness] = useState(null);
  const [menu,setMenu] = useState(EMPTY_MENU);
  const [hours,setHours] = useState(EMPTY_HOURS);
  const [details,setDetails] = useState(EMPTY_DETAILS);
  const [tab,setTab] = useState("menu");
  const [preview,setPreview] = useState(false);
  const [importOpen,setImportOpen] = useState(false);
  const [importFiles,setImportFiles] = useState([]);
  const [importing,setImporting] = useState(false);
  const [importProgress,setImportProgress] = useState("");
  const [importedMenu,setImportedMenu] = useState(null);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async() => {
      try {
        const data = await getDigitalMenuAdminByToken(token);
        if (!alive) return;
        setBusiness(data);
        setMenu({ ...EMPTY_MENU, ...(data.digital_menu || {}) });
        setHours(Array.isArray(data.digital_menu_hours) && data.digital_menu_hours.length ? data.digital_menu_hours : EMPTY_HOURS);
        setDetails({ ...EMPTY_DETAILS, ...(data.digital_menu_details || {}) });
      } catch(err) {
        if (alive) setError(err.message || "This menu link is invalid or unavailable.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const save = async() => {
    setSaving(true); setMessage(""); setError("");
    try {
      await saveDigitalMenuByToken(token, {
        digital_menu: menu,
        digital_menu_hours: hours,
        digital_menu_details: details,
        digital_menu_enabled: true
      });
      setMessage("Changes saved.");
    } catch(err) {
      setError(err.message || "Could not save changes.");
    } finally { setSaving(false); }
  };

  const updateCategory = (id,patch) => setMenu(m => ({...m,categories:m.categories.map(c => c.id===id ? {...c,...patch}:c)}));
  const removeCategory = id => setMenu(m => ({...m,categories:m.categories.filter(c=>c.id!==id)}));
  const moveCategory = (i,d) => setMenu(m => { const a=[...m.categories], n=i+d; if(n<0||n>=a.length)return m; [a[i],a[n]]=[a[n],a[i]]; return {...m,categories:a}; });
  const addCategory = () => setMenu(m => ({...m,categories:[...m.categories,blankCategory()]}));
  const addItem = id => updateCategory(id,{items:[...(menu.categories.find(c=>c.id===id)?.items||[]),blankItem()]});
  const updateItem = (cid,iid,patch) => updateCategory(cid,{items:(menu.categories.find(c=>c.id===cid)?.items||[]).map(i=>i.id===iid?{...i,...patch}:i)});
  const removeItem = (cid,iid) => updateCategory(cid,{items:(menu.categories.find(c=>c.id===cid)?.items||[]).filter(i=>i.id!==iid)});
  const moveItem = (cid,i,d) => { const c=menu.categories.find(x=>x.id===cid); if(!c)return; const a=[...c.items],n=i+d; if(n<0||n>=a.length)return; [a[i],a[n]]=[a[n],a[i]]; updateCategory(cid,{items:a}); };

  const runImport = async() => {
    if (!importFiles.length) return;
    setImporting(true); setImportProgress(""); setError(""); setMessage("");
    try {
      let extracted = { title:"", subtitle:"", categories:[], warnings:[] };
      for (let i=0;i<importFiles.length;i++) {
        setImportProgress(`Reading menu page ${i+1} of ${importFiles.length}…`);
        const imageData = await compressMenuImage(importFiles[i]);
        const response = await fetch("/api/extract-menu", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ token, image:imageData })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Menu extraction failed.");
        extracted = mergeExtractedMenus(extracted, data.menu || data);
        extracted.warnings = [...(extracted.warnings || []), ...(data.menu?.warnings || data.warnings || [])];
      }
      setImportedMenu(extracted);
      setImportProgress("");
    } catch(err) {
      setError(err.message || "Could not read the menu image.");
    } finally { setImporting(false); }
  };

  const applyImported = () => {
    if (!importedMenu) return;
    setMenu(current => mergeExtractedMenus(current.categories?.length ? current : EMPTY_MENU, importedMenu));
    setImportedMenu(null);
    setImportFiles([]);
    setImportOpen(false);
    setMessage("Imported menu added to the editor. Review it, then save.");
  };

  if(loading) return <main className="menu-admin-page"><div className="menu-admin-loading">Loading menu admin…</div></main>;
  if(error && !business) return <main className="menu-admin-page"><div className="menu-admin-error"><h1>Menu Admin</h1><p>{error}</p></div></main>;
  if(!business) return null;

  return <main className="menu-admin-page">
    <header className="menu-admin-top">
      <div><strong>{business.business_name}</strong><span>OWNER ADMIN PANEL</span></div>
      <div className="menu-admin-top-actions"><a href={`/p/${business.slug}`} target="_blank" rel="noreferrer">View Profile <FaExternalLinkAlt/></a><button onClick={save} disabled={saving}>{saving?<FaSave/>:<FaCheck/>} {saving?"Saving…":"Save Changes"}</button></div>
    </header>

    <div className="menu-admin-layout">
      <nav className="menu-admin-nav">{[["menu","Menu"],["hours","Working Hours"],["branding","Logo & Banner"],["details","Restaurant Details"],["backup","Backup"]].map(([id,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}</nav>
      <section className="menu-admin-content">
        {tab==="menu" && <>
          <div className="menu-admin-heading"><div><h1>Digital Menu</h1><p>Create and edit the menu that customers will see online.</p></div><div className="menu-heading-actions"><button className="menu-admin-secondary" onClick={()=>setImportOpen(true)}><FaUpload/> Upload Menu</button><button className="menu-admin-primary" onClick={addCategory}><FaPlus/> Add Category</button></div></div>
          <div className="menu-import-note"><FaMagic/><div><strong>Upload an existing menu and let Haki organise it.</strong><span>Upload a clear menu image. Haki reads the categories, dishes, descriptions and prices, then lets you review everything before saving.</span></div></div>
          <div className="menu-field-grid"><label>Menu title<input value={menu.title} onChange={e=>setMenu({...menu,title:e.target.value})} placeholder={`${business.business_name} Menu`}/></label><label>Subtitle<input value={menu.subtitle} onChange={e=>setMenu({...menu,subtitle:e.target.value})} placeholder="Fresh menu · prices can be updated anytime"/></label></div>
          <div className="menu-categories">
            {menu.categories.length===0&&<div className="menu-empty"><FaUtensils/><strong>No categories yet</strong><span>Upload an existing menu or add your first category.</span></div>}
            {menu.categories.map((c,ci)=><article className="menu-category" key={c.id}>
              <div className="menu-category-head"><input value={c.name} onChange={e=>updateCategory(c.id,{name:e.target.value})}/><div><button onClick={()=>moveCategory(ci,-1)} disabled={ci===0}><FaArrowUp/></button><button onClick={()=>moveCategory(ci,1)} disabled={ci===menu.categories.length-1}><FaArrowDown/></button><button className="danger" onClick={()=>removeCategory(c.id)}><FaTrash/></button></div></div>
              <div className="menu-items-editor">{c.items.map((item,ii)=><div className="menu-item-row" key={item.id}><div className="menu-item-fields"><input value={item.name} onChange={e=>updateItem(c.id,item.id,{name:e.target.value})} placeholder="Item name"/><input value={item.description} onChange={e=>updateItem(c.id,item.id,{description:e.target.value})} placeholder="Description"/><input value={item.price} onChange={e=>updateItem(c.id,item.id,{price:e.target.value})} placeholder="₹299"/><label className="availability"><input type="checkbox" checked={item.available!==false} onChange={e=>updateItem(c.id,item.id,{available:e.target.checked})}/> Available</label></div><div className="menu-item-actions"><button onClick={()=>moveItem(c.id,ii,-1)} disabled={ii===0}><FaArrowUp/></button><button onClick={()=>moveItem(c.id,ii,1)} disabled={ii===c.items.length-1}><FaArrowDown/></button><button className="danger" onClick={()=>removeItem(c.id,item.id)}><FaTrash/></button></div></div>)}</div>
              <button className="menu-add-item" onClick={()=>addItem(c.id)}><FaPlus/> Add Dish</button>
            </article>)}
          </div>
        </>}

        {tab==="hours"&&<div className="menu-admin-card"><h1>Working Hours</h1><p>Update the hours shown on the digital menu.</p>{hours.map((h,i)=><div className="hours-row" key={h.day}><strong>{h.day}</strong><label><input type="checkbox" checked={!h.closed} onChange={e=>setHours(x=>x.map((v,j)=>j===i?{...v,closed:!e.target.checked}:v))}/> Open</label><input type="time" value={h.open} disabled={h.closed} onChange={e=>setHours(x=>x.map((v,j)=>j===i?{...v,open:e.target.value}:v))}/><span>to</span><input type="time" value={h.close} disabled={h.closed} onChange={e=>setHours(x=>x.map((v,j)=>j===i?{...v,close:e.target.value}:v))}/></div>)}</div>}
        {tab==="branding"&&<div className="menu-admin-card"><h1>Logo & Banner</h1><p>The digital menu uses the existing Haki business branding.</p><div className="branding-preview"><div><span>Logo</span>{business.logo_url?<img src={business.logo_url} alt="Business logo"/>:<div className="no-image">No logo</div>}</div><div><span>Banner</span>{business.banner_url?<img src={business.banner_url} alt="Business banner"/>:<div className="no-image">No banner</div>}</div></div><p className="menu-note">Branding uploads remain controlled from Haki Business Profile for now.</p></div>}
        {tab==="details"&&<div className="menu-admin-card"><h1>Restaurant Details</h1><p>These details belong to the digital menu experience.</p><label>Tagline<input value={details.tagline} onChange={e=>setDetails({...details,tagline:e.target.value})} placeholder="Italian Breeze · Pure Veg"/></label><label>Restaurant story<textarea value={details.story} onChange={e=>setDetails({...details,story:e.target.value})} rows="5" placeholder="Tell customers about the restaurant..."/></label><label>Address<input value={details.address} onChange={e=>setDetails({...details,address:e.target.value})}/></label><div className="menu-field-grid"><label>Google Maps URL<input value={details.mapUrl} onChange={e=>setDetails({...details,mapUrl:e.target.value})}/></label><label>Instagram URL<input value={details.instagramUrl} onChange={e=>setDetails({...details,instagramUrl:e.target.value})}/></label></div><label>Google Review URL<input value={details.googleReviewUrl} onChange={e=>setDetails({...details,googleReviewUrl:e.target.value})}/></label></div>}
        {tab==="backup"&&<div className="menu-admin-card"><h1>Backup</h1><p>Keep a copy of this digital menu before making major changes.</p><div className="backup-actions"><button onClick={()=>{const blob=new Blob([JSON.stringify({menu,hours,details},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`${business.slug}-menu-backup.json`;a.click();URL.revokeObjectURL(url)}}>Export Menu Backup</button><label className="backup-import">Import Backup<input type="file" accept="application/json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.menu)setMenu({...EMPTY_MENU,...data.menu});if(Array.isArray(data.hours))setHours(data.hours);if(data.details)setDetails({...EMPTY_DETAILS,...data.details});setMessage("Backup loaded. Click Save Changes to apply it.")}catch{setError("Invalid backup file.")}}}/></label></div></div>}

        <div className="menu-admin-bottom"><button className="menu-admin-secondary" onClick={()=>setPreview(true)}>Preview Digital Menu</button><button className="menu-admin-primary" onClick={save} disabled={saving}><FaCheck/> {saving?"Saving…":"Save Changes"}</button></div>
        {message&&<div className="menu-admin-success"><FaCheck/> {message}</div>}{error&&<div className="menu-admin-error">{error}</div>}
      </section>
    </div>

    {importOpen&&<div className="menu-import-overlay" onClick={e=>e.target===e.currentTarget&&setImportOpen(false)}><div className="menu-import-modal">
      <div className="menu-import-header"><div><h2><FaMagic/> Import Existing Menu</h2><p>Upload one or more clear menu images. Haki will organise the content into editable categories and dishes.</p></div><button onClick={()=>setImportOpen(false)}><FaTimes/></button></div>
      {!importedMenu ? <>
        <label className="menu-upload-drop"><FaUpload/><strong>Choose menu image(s)</strong><span>JPG, PNG or WebP · multiple pages supported</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setImportFiles(Array.from(e.target.files||[]))}/></label>
        {importFiles.length>0&&<div className="selected-menu-files">{importFiles.map((file,i)=><div key={`${file.name}-${i}`}><span>{i+1}</span><strong>{file.name}</strong><small>{Math.round(file.size/1024)} KB</small></div>)}</div>}
        <div className="menu-import-warning"><FaExclamationTriangle/><span>AI extracts what is visible. It does not invent missing prices or dishes. Review the result before saving.</span></div>
        {importProgress&&<div className="menu-import-progress">{importProgress}</div>}
        <div className="menu-import-actions"><button className="menu-admin-secondary" onClick={()=>setImportOpen(false)}>Cancel</button><button className="menu-admin-primary" onClick={runImport} disabled={!importFiles.length||importing}>{importing?<><FaMagic/> Reading…</>:<><FaMagic/> Digitalize Menu</>}</button></div>
      </> : <>
        <div className="import-review-head"><div><strong>Review imported menu</strong><span>{importedMenu.categories.reduce((n,c)=>n+(c.items?.length||0),0)} items in {importedMenu.categories.length} categories</span></div><button className="menu-admin-secondary" onClick={()=>setImportedMenu(null)}>Re-upload</button></div>
        {importedMenu.warnings?.length>0&&<div className="menu-import-warning"><FaExclamationTriangle/><div>{importedMenu.warnings.map((w,i)=><span key={i}>{w}</span>)}</div></div>}
        <div className="import-review-list">{importedMenu.categories.map((c,ci)=><div className="import-review-category" key={`${c.name}-${ci}`}><h3>{c.name}</h3>{(c.items||[]).map((item,ii)=><div className="import-review-item" key={`${item.name}-${ii}`}><div><strong>{item.name}</strong><span>{item.description || "No description detected"}</span></div><b>{item.price || "Price not detected"}</b></div>)}</div>)}</div>
        <div className="menu-import-actions"><button className="menu-admin-secondary" onClick={()=>setImportedMenu(null)}>Back</button><button className="menu-admin-primary" onClick={applyImported}><FaCheck/> Add to Menu Editor</button></div>
      </>}
    </div></div>}

    {preview&&<div className="menu-preview-overlay" onClick={e=>e.target===e.currentTarget&&setPreview(false)}><div className="menu-preview"><button className="preview-close" onClick={()=>setPreview(false)}>×</button><div className="preview-hero">{business.banner_url&&<img src={business.banner_url} alt=""/>}</div><div className="preview-body">{business.logo_url&&<img className="preview-logo" src={business.logo_url} alt=""/>}<h2>{business.business_name}</h2><p>{details.tagline}</p><div className="preview-hours">{hours.filter(h=>!h.closed).map(h=><span key={h.day}>{h.day.slice(0,3)} {h.open}–{h.close}</span>)}</div><h3>{menu.title||`${business.business_name} Menu`}</h3><small>{menu.subtitle}</small>{menu.categories.map(c=><section key={c.id}><h4>{c.name}</h4>{c.items.filter(i=>i.available!==false).map(i=><div className="preview-item" key={i.id}><div><strong>{i.name}</strong><span>{i.description}</span></div><b>{i.price}</b></div>)}</section>)}</div></div></div>}
  </main>;
}
