import {useState} from "react";
import {restaurantLogin} from "../lib/supabaseRest";
import "./RestaurantLogin.css";
export default function RestaurantLogin(){
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const submit=async e=>{e.preventDefault();setBusy(true);setError("");try{await restaurantLogin(email,password);window.location.href="/restaurant-menu"}catch(err){setError(err.message||"Login failed.")}finally{setBusy(false)}};
 return <main className="restaurant-login"><section className="restaurant-login-card"><div className="restaurant-login-brand"><img src="/haki-logo.png" alt="Haki"/><span>RESTAURANT MENU</span></div><h1>Manage your digital menu</h1><p>Sign in to update menus, branding and NFC stand assignments.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>{error&&<div className="restaurant-login-error">{error}</div>}<button disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form><small>Restaurant access is created by Haki.</small></section></main>;
}
