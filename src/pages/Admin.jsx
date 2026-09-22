import { useEffect, useMemo, useState } from "react";
import { FaCheck, FaCopy, FaExternalLinkAlt, FaPlus, FaSignOutAlt, FaTrash, FaUpload, FaUtensils, FaQrcode } from "react-icons/fa";
import {
  adminLogin,
  clearAdminToken,
  createBusiness,
  deleteBusiness,
  deleteMedia,
  getAdminBusinesses,
  getAdminToken,
  getMediaPathFromPublicUrl,
  supabaseConfigured,
  updateBusiness,
  uploadMedia,
} from "../lib/supabaseRest";
import "./Admin.css";

const emptyForm = {
  business_name: "",
  person_name: "",
  phone: "",
  whatsapp: "",
  email: "",
  instagram: "",
  facebook: "",
  linkedin: "",
  website: "",
  google_review_url: "",
  booking_url: "",
  upi_id: "",
  logo_url: "",
  bio: "",
};

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function copyText(value, setCopied) {
  navigator.clipboard?.writeText(value).then(() => {
    setCopied(value);
    setTimeout(() => setCopied(""), 1400);
  });
}

async function compressImage(file, { maxDimension = 1600, quality = 0.78 } = {}) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error(`Could not compress ${file.name}.`);
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
}

export default function Admin() {
  const [loggedIn, setLoggedIn] = useState(Boolean(getAdminToken()));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [menuFiles, setMenuFiles] = useState([]);
  const [paymentQrFile, setPaymentQrFile] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const slug = useMemo(() => slugify(form.business_name), [form.business_name]);

  const loadBusinesses = async () => {
    try {
      setBusinesses(await getAdminBusinesses());
    } catch (err) {
      clearAdminToken();
      setLoggedIn(false);
      setError(err.message);
    }
  };

  useEffect(() => {
    if (loggedIn) loadBusinesses();
  }, [loggedIn]);

  if (!supabaseConfigured) return <div className="admin-state">Supabase is not configured.</div>;

  if (!loggedIn) {
    const submitLogin = async (event) => {
      event.preventDefault();
      setLoginError("");
      try {
        await adminLogin(email, password);
        setLoggedIn(true);
      } catch (err) {
        setLoginError(err.message || "Login failed");
      }
    };

    return (
      <main className="admin-page">
        <section className="admin-login-card">
          <img src="/haki-logo.png" alt="Haki" />
          <p className="admin-kicker">HAKI ADMIN</p>
          <h1>Manage businesses</h1>
          <p>Sign in to create and manage Haki customer profiles.</p>
          <form onSubmit={submitLogin}>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            {loginError && <div className="admin-error">{loginError}</div>}
            <button className="admin-primary" type="submit">Sign in</button>
          </form>
        </section>
      </main>
    );
  }

  const handleChange = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleMenuFiles = (event) => {
    const files = Array.from(event.target.files || []);
    setMenuFiles((current) => [...current, ...files]);
    event.target.value = "";
  };

  const removeMenuFile = (index) => setMenuFiles((current) => current.filter((_, i) => i !== index));

  const submitBusiness = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!slug) {
      setError("Business name is required.");
      return;
    }

    let created = null;
    const uploadedPaths = [];

    try {
      setStatus("Creating business...");
      created = await createBusiness({
        ...form,
        slug,
        menu_images: [],
        payment_qr_url: null,
        is_active: true,
      });

      const menuUrls = [];
      for (let index = 0; index < menuFiles.length; index += 1) {
        const compressed = await compressImage(menuFiles[index], { maxDimension: 1600, quality: 0.78 });
        const path = `business/${created.id}/menu-${Date.now()}-${index}.webp`;
        menuUrls.push(await uploadMedia(compressed, path));
        uploadedPaths.push(path);
      }

      let paymentQrUrl = null;
      if (paymentQrFile) {
        const compressedQr = await compressImage(paymentQrFile, { maxDimension: 1000, quality: 0.88 });
        const path = `business/${created.id}/payment-qr-${Date.now()}.webp`;
        paymentQrUrl = await uploadMedia(compressedQr, path);
        uploadedPaths.push(path);
      }

      await updateBusiness(created.id, {
        menu_images: menuUrls,
        payment_qr_url: paymentQrUrl,
      });

      setForm(emptyForm);
      setMenuFiles([]);
      setPaymentQrFile(null);
      setStatus(`Created ${created.business_name}.`);
      await loadBusinesses();
    } catch (err) {
      for (const path of uploadedPaths) await deleteMedia(path).catch(() => {});
      if (created?.id) await deleteBusiness(created.id).catch(() => {});
      setStatus("");
      setError(err.message || "Could not create business. Make sure the Haki V3 SQL has been run in Supabase.");
    }
  };

  const signOut = () => {
    clearAdminToken();
    setLoggedIn(false);
  };

  const handleDeleteBusiness = async (business) => {
    const confirmed = window.confirm(
      `Delete ${business.business_name}?\n\nThis will permanently delete the business and all of its analytics data.`
    );
    if (!confirmed) return;

    setError("");
    setStatus("");
    try {
      const menuUrls = Array.isArray(business.menu_images) ? business.menu_images : [];
      const mediaUrls = [...menuUrls, business.payment_qr_url].filter(Boolean);
      for (const url of mediaUrls) {
        const path = getMediaPathFromPublicUrl(url);
        if (path) await deleteMedia(path).catch(() => {});
      }
      await deleteBusiness(business.id);
      setStatus(`Deleted ${business.business_name}.`);
      await loadBusinesses();
    } catch (err) {
      setError(err.message || "Could not delete business.");
    }
  };

  const baseUrl = window.location.origin;

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <header className="admin-header">
          <div className="admin-brand"><img src="/haki-logo.png" alt="Haki" /><div><span>HAKI ADMIN</span><strong>Business Manager</strong></div></div>
          <button className="admin-ghost" onClick={signOut}><FaSignOutAlt /> Sign out</button>
        </header>

        <div className="admin-grid">
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="admin-kicker">NEW CUSTOMER</span><h1>Add Business</h1></div><FaPlus /></div>
            <p className="admin-help">Add only the information this business actually needs. Only those options will appear on its customer profile.</p>
            <form className="admin-form" onSubmit={submitBusiness}>
              <div className="admin-section-title">Basic information</div>
              <label>Business name *<input value={form.business_name} onChange={handleChange("business_name")} placeholder="Raj Salon" required /></label>
              <div className="admin-two-col">
                <label>Person name<input value={form.person_name} onChange={handleChange("person_name")} placeholder="Raj Patil" /></label>
                <label>Phone<input value={form.phone} onChange={handleChange("phone")} placeholder="9876543210" /></label>
              </div>
              <label>Short bio<input value={form.bio} onChange={handleChange("bio")} placeholder="Hair · Beauty · Styling" /></label>

              <div className="admin-section-title">Customer actions</div>
              <label>WhatsApp number <span className="admin-muted">leave empty to hide</span><input value={form.whatsapp} onChange={handleChange("whatsapp")} placeholder="9876543210" /></label>
              <label>Instagram URL <span className="admin-muted">leave empty to hide</span><input value={form.instagram} onChange={handleChange("instagram")} placeholder="https://instagram.com/..." /></label>
              <label>Website URL <span className="admin-muted">leave empty to hide</span><input value={form.website} onChange={handleChange("website")} placeholder="https://example.com" /></label>
              <label>Google Review URL <span className="admin-muted">leave empty to hide</span><input value={form.google_review_url} onChange={handleChange("google_review_url")} placeholder="https://g.page/.../review" /></label>
              <label>Booking URL <span className="admin-muted">WhatsApp or any booking page</span><input value={form.booking_url} onChange={handleChange("booking_url")} placeholder="https://wa.me/... or https://..." /></label>

              <div className="admin-section-title">Restaurant menu</div>
              <div className="admin-upload-box">
                <div className="admin-upload-heading"><FaUtensils /><div><strong>Menu images</strong><span>Upload one or multiple pages. Customers can swipe through them.</span></div></div>
                <label className="admin-upload-button"><FaUpload /> Upload menu pages<input type="file" accept="image/*" multiple onChange={handleMenuFiles} /></label>
                {menuFiles.length > 0 && (
                  <div className="admin-file-list">
                    {menuFiles.map((file, index) => (
                      <div className="admin-file" key={`${file.name}-${index}`}><span>{index + 1}. {file.name}</span><button type="button" onClick={() => removeMenuFile(index)}><FaTrash /></button></div>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-section-title">Payments</div>
              <label>Merchant UPI ID <span className="admin-muted">adds the Pay Now button</span><input value={form.upi_id} onChange={handleChange("upi_id")} placeholder="business@upi" /></label>
              <div className="admin-upload-box">
                <div className="admin-upload-heading"><FaQrcode /><div><strong>Payment QR</strong><span>Optional. It appears at the bottom of the customer profile.</span></div></div>
                <label className="admin-upload-button"><FaUpload /> {paymentQrFile ? "Change payment QR" : "Upload payment QR"}<input type="file" accept="image/*" onChange={(e) => setPaymentQrFile(e.target.files?.[0] || null)} /></label>
                {paymentQrFile && <div className="admin-file"><span>{paymentQrFile.name}</span><button type="button" onClick={() => setPaymentQrFile(null)}><FaTrash /></button></div>}
              </div>

              <div className="admin-section-title">Other links</div>
              <div className="admin-two-col">
                <label>Facebook<input value={form.facebook} onChange={handleChange("facebook")} placeholder="Optional" /></label>
                <label>LinkedIn<input value={form.linkedin} onChange={handleChange("linkedin")} placeholder="Optional" /></label>
              </div>
              <label>Logo URL <span className="admin-muted">optional for now</span><input value={form.logo_url} onChange={handleChange("logo_url")} placeholder="https://.../logo.png" /></label>

              <div className="admin-preview-url"><span>Profile URL</span><code>/p/{slug || "business-name"}</code></div>
              {status && <div className="admin-success"><FaCheck /> {status}</div>}
              {error && <div className="admin-error">{error}</div>}
              <button className="admin-primary" type="submit"><FaPlus /> Create Business</button>
            </form>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="admin-kicker">CUSTOMERS</span><h2>Haki Businesses</h2></div><span className="admin-count">{businesses.length}</span></div>
            <div className="admin-list">
              {businesses.length === 0 ? <p className="admin-muted">No businesses yet.</p> : businesses.map((business) => {
                const profileUrl = `${baseUrl}/p/${business.slug}`;
                const analyticsUrl = `${baseUrl}/a/${business.analytics_token}`;
                return (
                  <article className="admin-business" key={business.id}>
                    <div><strong>{business.business_name}</strong><span>{business.person_name || business.slug}</span></div>
                    <div className="admin-links">
                      <a href={profileUrl} target="_blank" rel="noreferrer"><FaExternalLinkAlt /> Profile</a>
                      <a href={analyticsUrl} target="_blank" rel="noreferrer"><FaExternalLinkAlt /> Analytics</a>
                      <button onClick={() => copyText(profileUrl, setCopied)}>{copied === profileUrl ? <FaCheck /> : <FaCopy />} NFC URL</button>
                      <button className="admin-delete" onClick={() => handleDeleteBusiness(business)}><FaTrash /> Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
