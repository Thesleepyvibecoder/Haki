import { BrowserRouter, Routes, Route } from "react-router-dom";
import { About, Contact, Experience, Feedbacks, Hero, Navbar, Tech, Works, StarsCanvas, ScrollToTop, CTAButtons, Greeting } from "./components";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import Admin from "./pages/Admin";
import MenuAdmin from "./pages/MenuAdmin";
import RestaurantLogin from "./pages/RestaurantLogin";
import DigitalMenu from "./pages/DigitalMenu";
import StandRoute from "./pages/StandRoute";

const Home = () => (<div className='relative z-0 bg-primary'><div className='bg-hero-pattern bg-cover bg-no-repeat bg-center'><Navbar/><Hero/><Greeting/></div><About/><Experience/><Tech/><Works/>{/* <Feedbacks /> */}<div className='relative z-0'><Contact/><StarsCanvas/></div><CTAButtons/><ScrollToTop/></div>);
const part=(index)=>window.location.pathname.split("/").filter(Boolean)[index]||"";
export default function App(){return <BrowserRouter><Routes><Route path="/" element={<Home/>}/><Route path="/p/:slug" element={<ProfileRoute/>}/><Route path="/a/:token" element={<AnalyticsRoute/>}/><Route path="/admin" element={<Admin/>}/><Route path="/menu-admin/:businessId" element={<MenuAdmin/>}/><Route path="/restaurant-login" element={<RestaurantLogin/>}/><Route path="/restaurant-menu" element={<MenuAdmin/>}/><Route path="/m/:businessSlug" element={<DigitalMenuRoute/>}/><Route path="/m/:businessSlug/:menuSlug" element={<DigitalMenuRoute/>}/><Route path="/s/:token" element={<StandRoute token={part(1)}/>}/></Routes></BrowserRouter>}
function ProfileRoute(){return <Profile slug={part(1)}/>}
function AnalyticsRoute(){return <Analytics token={part(1)}/>}
function DigitalMenuRoute(){const parts=window.location.pathname.split("/").filter(Boolean);return <DigitalMenu businessSlug={parts[1]||""} menuSlug={parts[2]||""}/>}
