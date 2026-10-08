import { useEffect, useState } from "react";
import { FaExternalLinkAlt, FaMapMarkerAlt, FaInstagram, FaStar } from "react-icons/fa";
import { getPublicDigitalMenu, getPublicDigitalMenus, trackEvent } from "../lib/supabaseRest";
import "./DigitalMenu.css";

const CAFE = {
  bg: "#171717",
  panel: "#202020",
  panel2: "#292929",
  accent: "#e51b23",
  accent2: "#b80f17",
  cream: "#fff7ed",
  gold: "#f4c542",
  muted: "#bdbdbd",
  line: "rgba(229,27,35,.28)",
};

const THEMES = {
  "Cafe Rio": CAFE,
  "Classic Red": { ...CAFE, bg: "#fff7f5", panel: "#ffffff", panel2: "#f9e7e4", accent: "#c62828", accent2: "#a51e1e", cream: "#30100d", gold: "#b67a00", muted: "#77635f", line: "rgba(198,40,40,.24)" },
  Emerald: { ...CAFE, bg: "#10251e", panel: "#17352b", panel2: "#21483a", accent: "#43a56f", accent2: "#2c8053", cream: "#f4fff8", gold: "#d9c47a", muted: "#b9c8c0", line: "rgba(67,165,111,.28)" },
  "Midnight Gold": { ...CAFE, bg: "#111318", panel: "#1b1e25", panel2: "#252a34", accent: "#d6aa45", accent2: "#aa7f24", cream: "#faf7ef", gold: "#f0c967", muted: "#bdb9ad", line: "rgba(214,170,69,.26)" },
};

function priceText(value) {
  if (value === null || value === undefined || value === "") return "";
  const v = String(value).trim();
  return /^₹|^Rs\.?\s?/i.test(v) ? v : `₹${v}`;
}

function escapeText(value) {
  return String(value ?? "");
}

export default function DigitalMenu({ businessSlug, menuSlug }) {
  const [data, setData] = useState(null);
  const [list, setList] = useState(null);
  const [active, setActive] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (menuSlug) {
          const d = await getPublicDigitalMenu(businessSlug, menuSlug);
          if (!d) throw new Error("Menu unavailable.");
          if (live) {
            setData(d);
            trackEvent(d.business_id, "digital_menu_view").catch(() => {});
          }
        } else {
          const d = await getPublicDigitalMenus(businessSlug);
          if (!d) throw new Error("Restaurant not found.");
          if (live) setList(d);
        }
      } catch (e) {
        if (live) setError(e.message || "Menu unavailable.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [businessSlug, menuSlug]);

  if (loading) {
    return <main className="digital-menu-page"><div className="digital-menu-state">Loading menu…</div></main>;
  }

  if (!menuSlug && list) {
    const menus = list.menus || [];
    return (
      <main className="digital-menu-page" style={themeVars(CAFE)}>
        <div className="digital-menu-shell menu-selector-page">
          <div className="selector-brand">
            <strong>{list.business_name}</strong>
            <span>CHOOSE A MENU</span>
          </div>
          <h1>What would you like to explore?</h1>
          <div className="menu-selector-list">
            {menus.map((m) => (
              <a key={m.id} href={`/m/${businessSlug}/${m.slug}`}>
                <div className="selector-logo">
                  {m.logo_url ? <img src={m.logo_url} alt="" /> : <span>🍽</span>}
                </div>
                <section><strong>{m.title}</strong><small>{m.subtitle || "View menu"}</small></section>
                <span className="selector-arrow">›</span>
              </a>
            ))}
          </div>
          <footer className="dm-footer">POWERED BY HAKI <FaExternalLinkAlt /></footer>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return <main className="digital-menu-page"><div className="digital-menu-state"><h1>Menu unavailable</h1><p>{error || "This menu could not be found."}</p></div></main>;
  }

  const m = data.menu || {};
  const details = m.details || {};
  const theme = THEMES[m.theme?.preset] || CAFE;
  const categories = (m.menu_data?.categories || []).filter((c) => (c.items || []).some((i) => i.available !== false));
  const selectedName = active || categories[0]?.name || "";
  const selected = categories.find((c) => c.name === selectedName) || categories[0];
  const title = escapeText(m.title || "Restaurant");
  const subtitle = escapeText(m.subtitle || details.tagline || "");
  const galleryOne = details.gallery1Url || m.banner_url || "";
  const galleryTwo = details.gallery2Url || m.banner_url || "";

  return (
    <main className="digital-menu-page" style={themeVars(theme)}>
      <div className="digital-menu-shell">
        <section className="dm-hero">
          {m.banner_url ? <img src={m.banner_url} alt={`${title} banner`} /> : <div className="dm-hero-placeholder" />}
        </section>

        <div className="dm-logo-card">
          {m.logo_url ? <img src={m.logo_url} alt={`${title} logo`} /> : (
            <div className="dm-fallback-logo"><span>{title}</span><small>{subtitle}</small></div>
          )}
        </div>

        <div className="dm-content">
          <h1>Welcome To<br /><span>{title}</span></h1>
          {subtitle && <div className="dm-tagline">{subtitle}</div>}

          <div className="dm-main-actions">
            <button className="dm-button primary" onClick={() => { setMenuOpen(true); trackEvent(data.business_id, "digital_menu_open").catch(() => {}); }}>
              <span>▣</span> VIEW MENU
            </button>
            {details.googleReviewUrl && (
              <a className="dm-button" href={details.googleReviewUrl} target="_blank" rel="noreferrer">
                <FaStar /> RATE US ON GOOGLE ↗
              </a>
            )}
          </div>

          {details.story && (
            <section className="dm-section">
              <div className="dm-section-title">THE RESTAURANT STORY</div>
              <p className="dm-story">{details.story}</p>
            </section>
          )}

          {(galleryOne || galleryTwo) && (
            <section className="dm-section">
              <div className="dm-section-title">AMBIENCE & UPCOMING EVENTS</div>
              <div className="dm-gallery">
                {galleryOne && <img src={galleryOne} alt={`${title} ambience`} />}
                {galleryTwo && <img src={galleryTwo} alt={`${title} storefront`} />}
              </div>
            </section>
          )}

          {Array.isArray(m.working_hours) && m.working_hours.length > 0 && (
            <section className="dm-section">
              <div className="dm-section-title">OPERATING HOURS</div>
              <div className="dm-hours">
                {m.working_hours.map((h, i) => {
                  const day = Array.isArray(h) ? h[0] : h.day;
                  const hours = Array.isArray(h) ? h[1] : h.hours;
                  return <div className="dm-hour-row" key={`${day}-${i}`}><strong>{day}</strong><strong>{hours}</strong></div>;
                })}
              </div>
            </section>
          )}

          {(details.address || details.mapUrl || details.instagramUrl) && (
            <section className="dm-section">
              <div className="dm-section-title">RESTAURANT DETAILS</div>
              <div className="dm-details">
                <b>{title}</b>
                {details.tagline && <><br />{details.tagline}</>}
                {details.address && <><br /><span>{details.address}</span></>}
                <div className="dm-detail-links">
                  {details.mapUrl && <a href={details.mapUrl} target="_blank" rel="noreferrer"><FaMapMarkerAlt /> View on Map</a>}
                  {details.instagramUrl && <a href={details.instagramUrl} target="_blank" rel="noreferrer"><FaInstagram /> Instagram</a>}
                </div>
              </div>
            </section>
          )}

          <div className="dm-footer">POWERED BY HAKI</div>
        </div>
      </div>

      {menuOpen && (
        <div className="dm-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) setMenuOpen(false); }}>
          <div className="dm-sheet">
            <div className="dm-sheet-head">
              <div>
                <h2>{title} Menu</h2>
                <div className="dm-sheet-sub">{subtitle || "Fresh menu · prices can be updated anytime"}</div>
              </div>
              <button className="dm-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button>
            </div>

            {categories.length > 0 && (
              <div className="dm-menu-tabs">
                {categories.map((c) => (
                  <button key={c.id || c.name} className={selected?.name === c.name ? "active" : ""} onClick={() => setActive(c.name)}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            <div className="dm-menu-items">
              {selected ? (
                <>
                  <div className="dm-menu-category">{selected.name}</div>
                  {(selected.items || []).filter((i) => i.available !== false).map((item, index) => (
                    <article className="dm-menu-item" key={`${item.id || item.name}-${index}`}>
                      <div><b>{item.name}</b>{item.description && <p>{item.description}</p>}</div>
                      {item.price !== "" && item.price !== null && item.price !== undefined && <span>{priceText(item.price)}</span>}
                    </article>
                  ))}
                </>
              ) : <div className="dm-empty">No dishes added yet.</div>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function themeVars(theme) {
  return {
    "--dm-bg": theme.bg,
    "--dm-panel": theme.panel,
    "--dm-panel2": theme.panel2,
    "--dm-accent": theme.accent,
    "--dm-accent2": theme.accent2,
    "--dm-cream": theme.cream,
    "--dm-gold": theme.gold,
    "--dm-muted": theme.muted || CAFE.muted,
    "--dm-line": theme.line || CAFE.line,
  };
}
