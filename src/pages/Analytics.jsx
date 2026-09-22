import { useEffect, useState } from "react";
import { FaArrowUp, FaChartLine, FaEye, FaLink } from "react-icons/fa";
import { getAnalyticsByToken, supabaseConfigured } from "../lib/supabaseRest";
import "./Analytics.css";

const labels = {
  whatsapp_click: "WhatsApp",
  phone_click: "Phone",
  instagram_click: "Instagram",
  facebook_click: "Facebook",
  linkedin_click: "LinkedIn",
  website_click: "Website",
  email_click: "Email",
  save_contact: "Save Contact",
};

const formatDate = (date) => date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function Analytics({ token }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!supabaseConfigured || !token) {
      setStatus("error");
      return;
    }
    getAnalyticsByToken(token)
      .then((result) => { setData(result); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "loading") return <div className="analytics-state">Loading analytics...</div>;
  if (status === "error" || !data) return <div className="analytics-state"><h1>Analytics unavailable</h1><p>Check the analytics link and try again.</p></div>;

  const counts = data.counts || {};
  const chart = data.daily || [];
  const maxDaily = Math.max(...chart.map((item) => Number(item.views || 0) + Number(item.interactions || 0)), 1);
  const ordered = Object.entries(labels)
    .map(([key, label]) => [label, Number(counts[key] || 0)])
    .filter(([, value]) => value > 0);

  return (
    <main className="analytics-page">
      <section className="analytics-card">
        <div className="analytics-brand">
          <img src="/haki-logo.png" alt="Haki" />
          <span>HAKI ANALYTICS</span>
        </div>

        <div className="analytics-heading">
          <div>
            <h1>{data.business_name}</h1>
            <p>Last 7 days · live interaction data</p>
          </div>
          <div className="analytics-status"><span /> Live</div>
        </div>

        <div className="analytics-grid">
          <div className="analytics-stat analytics-stat-primary">
            <div className="analytics-stat-icon"><FaEye /></div>
            <span>Profile Views</span>
            <strong>{counts.profile_view || 0}</strong>
          </div>
          <div className="analytics-stat">
            <div className="analytics-stat-icon"><FaChartLine /></div>
            <span>Interactions</span>
            <strong>{data.total_interactions || 0}</strong>
          </div>
        </div>

        <div className="analytics-panel">
          <div className="analytics-panel-title"><span>Activity</span><small>Views + interactions</small></div>
          <div className="analytics-chart">
            {chart.map((item) => {
              const total = Number(item.views || 0) + Number(item.interactions || 0);
              const height = Math.max(8, Math.round((total / maxDaily) * 100));
              return (
                <div className="analytics-bar-wrap" key={item.day} title={`${item.day}: ${total} activity`}>
                  <div className="analytics-bar" style={{ height: `${height}%` }} />
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="analytics-panel">
          <div className="analytics-panel-title"><span>Interactions</span><small>{ordered.length} active links</small></div>
          <div className="analytics-list">
            {ordered.length === 0 ? <div className="analytics-empty">No interactions yet.</div> : ordered.map(([label, value]) => (
              <div className="analytics-row" key={label}>
                <span><FaLink /> {label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <p className="analytics-note"><FaArrowUp /> Counts update as people interact with the Haki profile.</p>
        <p className="analytics-footer">Powered by <strong>Haki</strong></p>
      </section>
    </main>
  );
}
