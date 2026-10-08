import { BrowserRouter, Routes, Route } from "react-router-dom";
import { About, Contact, Experience, Feedbacks, Hero, Navbar, Tech, Works, StarsCanvas, ScrollToTop, CTAButtons, Greeting } from "./components";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import Admin from "./pages/Admin";
import MenuAdmin from "./pages/MenuAdmin";

const Home = () => (
  <div className='relative z-0 bg-primary'>
    <div className='bg-hero-pattern bg-cover bg-no-repeat bg-center'>
      <Navbar />
      <Hero />
      <Greeting />
    </div>
    <About />
    <Experience />
    <Tech />
    <Works />
    {/* <Feedbacks /> */}
    <div className='relative z-0'>
      <Contact />
      <StarsCanvas />
    </div>
    <CTAButtons />
    <ScrollToTop />
  </div>
);

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/p/:slug" element={<ProfileRoute />} />
      <Route path="/a/:token" element={<AnalyticsRoute />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/menu-admin/:token" element={<MenuAdmin />} />
    </Routes>
  </BrowserRouter>
);

function ProfileRoute() {
  const slug = window.location.pathname.split("/").filter(Boolean)[1] || "";
  return <Profile slug={slug} />;
}

function AnalyticsRoute() {
  const token = window.location.pathname.split("/").filter(Boolean)[1] || "";
  return <Analytics token={token} />;
}

export default App;
