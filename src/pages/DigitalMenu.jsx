import {useEffect,useMemo,useState} from "react";
import {FaExternalLinkAlt,FaInstagram,FaMapMarkerAlt,FaStar} from "react-icons/fa";
import {getPublicDigitalMenu,getPublicDigitalMenus,trackEvent} from "../lib/supabaseRest";
import "./DigitalMenu.css";

const CAFE={bg:"#171717",panel:"#202020",panel2:"#292929",accent:"#e51b23",accent2:"#b80f17",cream:"#fff7ed",gold:"#f4c542",muted:"#bdbdbd"};
const THEMES={
  "Cafe Rio":CAFE,
  "Classic Red":{bg:"#171717",panel:"#202020",panel2:"#292929",accent:"#e51b23",accent2:"#b80f17",cream:"#fff7ed",gold:"#f4c542",muted:"#bdbdbd"},
  "Emerald":{bg:"#10251e",panel:"#17352b",panel2:"#21483a",accent:"#43a56f",accent2:"#2c8053",cream:"#f4fff8",gold:"#d9c47a",muted:"#b6c8bd"},
  "Midnight Gold":{bg:"#111318",panel:"#1b1e25",panel2:"#252a34",accent:"#d6aa45",accent2:"#aa7f24",cream:"#faf7ef",gold:"#f0c967",muted:"#b9b7b0"},
  "Ocean":{bg:"#101e2a",panel:"#182b3a",panel2:"#233b4c",accent:"#168aad",accent2:"#126782",cream:"#f2fbff",gold:"#8ed8e8",muted:"#b4cbd5"}
};
const defaultHours=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(day=>({day,open:"10:30",close:"23:30",closed:false}));
const fmtTime=value=>{if(!value)return "";const [h,m]=String(value).split(":").map(Number);const hour=h%12||12;return `${hour}:${String(m||0).padStart(2,"0")} ${h>=12?"PM":"AM"}`};
const safeUrl=value=>{try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return ""}};

export default function DigitalMenu({businessSlug,menuSlug}){
 const [data,setData]=useState(null),[list,setList]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[menuOpen,setMenuOpen]=useState(false),[activeCategory,setActiveCategory]=useState("all");
 useEffect(()=>{let live=true;(async()=>{try{if(menuSlug){const result=await getPublicDigitalMenu(businessSlug,menuSlug);if(!result)throw new Error("Menu unavailable.");if(live){setData(result);trackEvent(result.business_id,"digital_menu_view").catch(()=>{})}}else{const result=await getPublicDigitalMenus(businessSlug);if(!result)throw new Error("Restaurant not found.");if(live)setList(result)}}catch(e){if(live)setError(e.message||"Menu unavailable.")}finally{if(live)setLoading(false)}})();return()=>{live=false}},[businessSlug,menuSlug]);
 useEffect(()=>{const close=e=>{if(e.key==="Escape")setMenuOpen(false)};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close)},[]);
 if(loading)return <main className="cafe-page-wrap"><div className="cafe-state">Loading menu…</div></main>;
 if(error)return <main className="cafe-page-wrap"><div className="cafe-state"><h1>Menu unavailable</h1><p>{error}</p></div></main>;
 if(!menuSlug&&list){const menus=list.menus||[];return <main className="cafe-page-wrap"><div className="cafe-page cafe-selector"><div className="cafe-selector-heading"><strong>{list.business_name}</strong><span>CHOOSE A MENU</span></div><h1>What would you like to explore?</h1><div className="cafe-selector-list">{menus.map(item=><a key={item.id} href={`/m/${businessSlug}/${item.slug}`}><span className="cafe-selector-logo">{item.logo_url?<img src={item.logo_url} alt=""/>:"🍽"}</span><span><b>{item.title}</b><small>{item.subtitle||"View menu"}</small></span><span>›</span></a>)}</div><div className="cafe-footer">POWERED BY HAKI</div></div></main>}
 if(!data)return null;
 const m=data.menu,d=m.details||{};
 const preset=THEMES[m.theme?.preset]||CAFE;
 const theme={...preset,...Object.fromEntries(["bg","panel","panel2","accent","accent2","cream","gold","muted"].filter(k=>m.theme?.[k]).map(k=>[k,m.theme[k]]))};
 const cats=(m.menu_data?.categories||[]).filter(c=>(c.items||[]).some(i=>i.available!==false));
 const hours=Array.isArray(m.working_hours)&&m.working_hours.length?m.working_hours:defaultHours;
 const gallery=Array.isArray(d.galleryImages)?d.galleryImages.filter(Boolean):[];
 const story=d.story||"";
 const detailDescription=d.restaurantDescription||[m.subtitle,""].filter(Boolean).join(" · ");
 const style={"--bg":theme.bg,"--panel":theme.panel,"--panel2":theme.panel2,"--red":theme.accent,"--red2":theme.accent2,"--cream":theme.cream,"--gold":theme.gold,"--muted":theme.muted,"--line":`${theme.accent}47`};
 const openMenu=()=>{setActiveCategory("all");setMenuOpen(true);trackEvent(m.business_id,"digital_menu_open").catch(()=>{})};
 const googleUrl=safeUrl(d.googleReviewUrl);
 const mapUrl=safeUrl(d.mapUrl);
 const instagramUrl=safeUrl(d.instagramUrl);
 const welcomePrefix=d.welcomePrefix??"Welcome To";
 const titleText=d.landingTitle||d.restaurantName||data.business_name||m.title||"Menu";
 const viewMenuText=d.viewMenuText||"▣  VIEW MENU";
 const googleButtonText=d.googleButtonText||"★  RATE US ON GOOGLE ↗";
 return <main className="cafe-page-wrap" style={style}>
  <main className="cafe-page">
   {m.banner_url&&<section className="hero"><img src={m.banner_url} alt="Restaurant banner"/></section>}
   <div className={`logo-card ${m.logo_url?"has-image":""}`}>{m.logo_url?<img className="uploaded-logo" src={m.logo_url} alt={`${m.title} logo`}/>:<div className="logo"><span>{d.logoTopText||""}</span>{d.logoMainText||d.restaurantName||data.business_name||m.title}<small>{d.logoBottomText||d.tagline||m.subtitle||""}</small></div>}</div>
   <div className="content">
    <h1>{welcomePrefix&&<>{welcomePrefix}<br/></>}{titleText}</h1>
    {(d.tagline||m.subtitle)&&<div className="tagline">{d.tagline||m.subtitle}</div>}
    <div className="btns"><button type="button" className="btn primary" onClick={openMenu}>{viewMenuText}</button><a className="btn" href={googleUrl||undefined} target={googleUrl?"_blank":undefined} rel={googleUrl?"noopener noreferrer":undefined}>{googleButtonText}</a></div>
    <section className="section"><div className="section-title">{d.storyHeading||"THE RESTAURANT STORY"}</div><p className="story">{story}</p></section>
    {gallery.length>0&&<section className="section"><div className="section-title">{d.galleryHeading||"AMBIENCE & UPCOMING EVENTS"}</div><div className="gallery">{gallery.map((url,i)=><img key={`${url}-${i}`} src={url} alt={`${m.title} gallery ${i+1}`}/>)}</div></section>}
    {hours.length>0&&<section className="section"><div className="section-title">{d.hoursHeading||"OPERATING HOURS"}</div><div className="hours">{hours.map((h,i)=><div className="row" key={h.day||i}><strong>{h.day}</strong><strong>{h.closed?"Closed":`${fmtTime(h.open)} – ${fmtTime(h.close)}`}</strong></div>)}</div></section>}
    <section className="section"><div className="section-title">{d.detailsHeading||"RESTAURANT DETAILS"}</div><div className="details"><b>{d.restaurantName||data.business_name||m.title}</b>{detailDescription&&<><br/>{detailDescription}</>}{d.address&&<><br/>{d.address}</>}<div className="links">{mapUrl&&<a href={mapUrl} target="_blank" rel="noopener noreferrer"><FaMapMarkerAlt/> View on Map</a>}{instagramUrl&&<a href={instagramUrl} target="_blank" rel="noopener noreferrer"><FaInstagram/> Instagram</a>}</div></div></section>
    <div className="cafe-footer">{d.footerText||"POWERED BY HAKI"}</div>
   </div>
  </main>
  <div className={`modal ${menuOpen?"open":""}`} onMouseDown={e=>{if(e.target===e.currentTarget)setMenuOpen(false)}} aria-hidden={!menuOpen}>
   <div className="sheet" role="dialog" aria-modal="true" aria-label={`${m.title} menu`}>
    <div className="sheet-head"><div><h2>{d.modalTitle||`${m.title} Menu`}</h2>{d.modalSubtitle&&<div className="sheet-subtitle">{d.modalSubtitle}</div>}</div><button className="close" type="button" onClick={()=>setMenuOpen(false)} aria-label="Close menu">×</button></div>
    <div className="tabs"><button type="button" className={`tab ${activeCategory==="all"?"active":""}`} onClick={()=>setActiveCategory("all")}>All</button>{cats.map(c=><button type="button" key={c.id||c.name} className={`tab ${activeCategory===c.name?"active":""}`} onClick={()=>setActiveCategory(c.name)}>{c.name}</button>)}</div>
    <div className="menu-items">{cats.filter(c=>activeCategory==="all"||c.name===activeCategory).map(c=><section key={c.id||c.name}><div className="category">{c.name}</div>{(c.items||[]).filter(i=>i.available!==false).map((item,i)=><article className="item" key={`${item.id||item.name}-${i}`}><div><b>{item.name}</b>{item.description&&<p>{item.description}</p>}</div>{item.price&&<span className="price">{String(item.price).match(/^(₹|Rs\.?)/i)?item.price:`₹${item.price}`}</span>}</article>)}</section>)}{cats.length===0&&<p className="cafe-empty-menu">Menu items will appear here once added.</p>}</div>
   </div>
  </div>
 </main>;
}
