import { useEffect, useMemo, useState } from "react";
import { FaArrowUp, FaCalendarAlt, FaChartLine, FaClock, FaEye, FaLink, FaStar } from "react-icons/fa";
import { getAnalyticsByToken, supabaseConfigured } from "../lib/supabaseRest";
import "./Analytics.css";

const RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "All Time", days: 0 },
];

const EVENT_LABELS = {
  whatsapp_click: "WhatsApp",
  phone_click: "Call",
  instagram_click: "Instagram",
  facebook_click: "Facebook",
  linkedin_click: "LinkedIn",
  website_click: "Website",
  email_click: "Email",
  save_contact: "Save Contact",
  menu_click: "Menu",
  payment_click: "Payment",
  payment_qr_view: "Payment QR",
  upi_app_click: "UPI App",
  google_review_click: "Google Review",
  booking_url_click: "Booking",
};

function prettyEvent(key = "") {
  if (EVENT_LABELS[key]) return EVENT_LABELS[key];
  if (key.startsWith("module_") && key.endsWith("_click")) key = key.slice(7, -5);
  else key = key.replace(/_click$/, "");
  return key.split("_").filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") || "Interaction";
}

function formatRecentDate(value) {
  const date = new Date(value);
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function LineChart({ data, metric, emptyLabel }) {
  const values = data.map((item) => Number(item[metric] || 0));
  const max = Math.max(...values, 1);
  const width = 760;
  const height = 220;
  const padX = 28;
  const padY = 24;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const points = data.map((item, index) => {
    const x = data.length <= 1 ? width / 2 : padX + (index / (data.length - 1)) * innerW;
    const y = padY + innerH - (Number(item[metric] || 0) / max) * innerH;
    return `${x},${y}`;
  }).join(" ");
  const hasValues = values.some((value) => value > 0);

  return (
    <div className="analytics-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric} activity chart`} preserveAspectRatio="none">
        {[0, 1, 2, 3].map((step) => {
          const y = padY + (innerH / 3) * step;
          return <line key={step} x1={padX} x2={width - padX} y1={y} y2={y} className="chart-grid-line" />;
        })}
        {hasValues && <polyline points={points} className="chart-line" fill="none" />}
        {data.map((item, index) => {
          const x = data.length <= 1 ? width / 2 : padX + (index / (data.length - 1)) * innerW;
          const y = padY + innerH - (Number(item[metric] || 0) / max) * innerH;
          return <circle key={`${item.day}-${index}`} cx={x} cy={y} r="3.5" className="chart-point" />;
        })}
      </svg>
      {!hasValues && <div className="chart-empty">{emptyLabel}</div>}
      <div className="chart-labels">
        {data.map((item, index) => <span key={`${item.day}-label-${index}`}>{item.label}</span>)}
      </div>
    </div>
  );
}

export default function Analytics({ token }) {
  const [range, setRange] = useState(7);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!supabaseConfigured || !token) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    getAnalyticsByToken(token, range)
      .then((result) => { setData(result); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [token, range]);

  const breakdown = useMemo(() => {
    const counts = data?.counts || {};
    return Object.entries(counts)
      .filter(([key, value]) => key !== "profile_view" && Number(value || 0) > 0)
      .map(([key, value]) => ({ label: prettyEvent(key), value: Number(value || 0) }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  if (status === "loading" && !data) return <div className="analytics-state">Loading analytics...</div>;
  if (status === "error" || !data) return <div className="analytics-state"><h1>Analytics unavailable</h1><p>Check the analytics link and try again.</p></div>;

  const counts = data.counts || {};
  const profileViews = Number(counts.profile_view || 0);
  const interactions = Number(data.total_interactions || 0);
  const engagementRate = profileViews ? `${((interactions / profileViews) * 100).toFixed(1)}%` : "0.0%";
  const reviewClicks = Number(counts.google_review_click || 0);
  const chart = data.daily || [];
  const maxBreakdown = Math.max(...breakdown.map((item) => item.value), 1);
  const recent = data.recent || [];
  const selectedLabel = RANGE_OPTIONS.find((item) => item.days === range)?.label || "7 Days";

  return (
    <main className="analytics-page">
      <div className="analytics-shell">
        <header className="analytics-header">
          <div className="analytics-brand">
            <img src="/haki-logo.png" alt="Haki" />
            <div><strong>Haki Analytics</strong><span>Business Performance Dashboard</span></div>
          </div>
          <div className="analytics-live"><span /> Live</div>
        </header>

        <section className="analytics-title-row">
          <div>
            <p className="analytics-eyebrow">Business performance</p>
            <h1>{data.business_name}</h1>
            <p className="analytics-subtitle">Track profile traffic, customer interactions and key actions.</p>
          </div>
          <div className="analytics-range" aria-label="Analytics date range">
            <FaCalendarAlt />
            {RANGE_OPTIONS.map((option) => (
              <button key={option.days} className={range === option.days ? "active" : ""} onClick={() => setRange(option.days)}>
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="analytics-kpis">
          <div className="analytics-kpi"><span>Profile Views</span><strong>{profileViews.toLocaleString("en-IN")}</strong><small><FaEye /> People who opened the profile</small></div>
          <div className="analytics-kpi"><span>Interactions</span><strong>{interactions.toLocaleString("en-IN")}</strong><small><FaChartLine /> Total tracked actions</small></div>
          <div className="analytics-kpi"><span>Engagement Rate</span><strong>{engagementRate}</strong><small><FaArrowUp /> Interactions ÷ profile views</small></div>
          <div className="analytics-kpi"><span>Google Review Clicks</span><strong>{reviewClicks.toLocaleString("en-IN")}</strong><small><FaStar /> Review-page visits</small></div>
        </section>

        <section className="analytics-panel analytics-panel-main">
          <div className="analytics-panel-heading"><div><h2>Customer Interaction Activity</h2><p>Daily interactions for {selectedLabel.toLowerCase()}.</p></div><span>{interactions} interactions</span></div>
          <LineChart data={chart} metric="interactions" emptyLabel="No interactions recorded in this period." />
        </section>

        <section className="analytics-panel analytics-panel-main">
          <div className="analytics-panel-heading"><div><h2>Profile Views</h2><p>Daily profile traffic for the selected period.</p></div><span>{profileViews} views</span></div>
          <LineChart data={chart} metric="views" emptyLabel="No profile views recorded in this period." />
        </section>

        <div className="analytics-two-column">
          <section className="analytics-panel">
            <div className="analytics-panel-heading"><div><h2>Interaction Breakdown</h2><p>Which profile actions people used.</p></div></div>
            <div className="analytics-breakdown">
              {breakdown.length === 0 ? <div className="analytics-empty">No interactions yet.</div> : breakdown.map((item) => (
                <div className="breakdown-item" key={item.label}>
                  <div className="breakdown-top"><span><FaLink /> {item.label}</span><strong>{item.value}</strong></div>
                  <div className="breakdown-track"><div style={{ width: `${Math.max(4, (item.value / maxBreakdown) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="analytics-panel">
            <div className="analytics-panel-heading"><div><h2>Recent Activity</h2><p>Latest tracked profile actions.</p></div><FaClock /></div>
            <div className="analytics-recent">
              {recent.length === 0 ? <div className="analytics-empty">No recent activity.</div> : recent.map((item, index) => (
                <div className="recent-item" key={`${item.created_at}-${index}`}>
                  <span className="recent-dot" />
                  <div><strong>{prettyEvent(item.event_type)}</strong><small>{formatRecentDate(item.created_at)}</small></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="analytics-footer">Powered by <strong>Haki</strong> · Analytics update as people interact with the profile.</footer>
      </div>
    </main>
  );
}
