import { useEffect, useMemo, useState } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCalendarAlt,
  FaFacebookF,
  FaGlobe,
  FaInstagram,
  FaLinkedinIn,
  FaPhone,
  FaQrcode,
  FaRegAddressCard,
  FaStar,
  FaTimes,
  FaUtensils,
  FaWhatsapp,
} from "react-icons/fa";
import { getBusinessBySlug, supabaseConfigured, trackEvent } from "../lib/supabaseRest";
import "./Profile.css";

const coreLinks = [
  ["phone", "Call", FaPhone],
  ["instagram", "Instagram", FaInstagram],
  ["website", "Website", FaGlobe],
  ["google_review_url", "Google Review", FaStar],
  ["whatsapp", "WhatsApp", FaWhatsapp],
  ["booking_url", "Booking", FaCalendarAlt],
  ["facebook", "Facebook", FaFacebookF],
  ["linkedin", "LinkedIn", FaLinkedinIn],
];

function normalizeLink(type, value) {
  if (!value) return null;
  if (type === "phone") return `tel:${value.replace(/[^+\d]/g, "")}`;
  if (type === "whatsapp") return `https://wa.me/${value.replace(/[^\d]/g, "")}`;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function getMenuImages(business) {
  if (Array.isArray(business.menu_images)) return business.menu_images.filter(Boolean);
  try {
    const parsed = JSON.parse(business.menu_images || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function buildUpiUrl(business, amount) {
  if (!business.upi_id) return null;
  const params = new URLSearchParams({
    pa: business.upi_id.trim(),
    pn: business.business_name || "Haki Business",
    cu: "INR",
  });
  if (amount) params.set("am", amount);
  return `upi://pay?${params.toString()}`;
}

export default function Profile({ slug }) {
  const [business, setBusiness] = useState(null);
  const [status, setStatus] = useState("loading");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [showPaymentQr, setShowPaymentQr] = useState(false);

  useEffect(() => {
    let active = true;
    if (!supabaseConfigured) {
      setStatus("config");
      return undefined;
    }

    getBusinessBySlug(slug)
      .then((data) => {
        if (!active) return;
        if (!data) {
          setStatus("not-found");
          return;
        }
        setBusiness(data);
        setStatus("ready");
        trackEvent(data.id, "profile_view").catch(() => {});
      })
      .catch(() => active && setStatus("error"));

    return () => { active = false; };
  }, [slug]);

  const menuImages = useMemo(() => business ? getMenuImages(business) : [], [business]);
  const upiUrl = useMemo(() => business ? buildUpiUrl(business) : null, [business]);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (status === "loading") return <div className="profile-state">Loading Haki profile...</div>;
  if (status === "config") return <div className="profile-state">Haki profile system is not configured yet.</div>;
  if (status === "not-found") return <div className="profile-state"><h1>Profile not found</h1><p>This Haki profile doesn't exist or is inactive.</p></div>;
  if (status === "error") return <div className="profile-state"><h1>Something went wrong</h1><p>Please try again in a moment.</p></div>;

  const links = coreLinks
    .map(([key, label, Icon]) => ({ key, label, Icon, value: business[key], href: normalizeLink(key, business[key]) }))
    .filter((item) => item.href);

  if (menuImages.length > 0) {
    links.splice(1, 0, { key: "menu", label: "Menu", Icon: FaUtensils, href: null });
  }

  const saveContact = async () => {
    await trackEvent(business.id, "save_contact").catch(() => {});
    const vcard = [
      "BEGIN:VCARD", "VERSION:3.0",
      `FN:${business.person_name || business.business_name}`,
      business.business_name ? `ORG:${business.business_name}` : "",
      business.phone ? `TEL:${business.phone}` : "",
      business.email ? `EMAIL:${business.email}` : "",
      business.website ? `URL:${normalizeLink("website", business.website)}` : "",
      "END:VCARD",
    ].filter(Boolean).join("\n");
    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${business.slug}.vcf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleLink = async (item) => {
    if (item.key === "menu") {
      await trackEvent(business.id, "menu_click").catch(() => {});
      setMenuIndex(0);
      setMenuOpen(true);
      return;
    }
    await trackEvent(business.id, `${item.key}_click`).catch(() => {});
    window.location.href = item.href;
  };

  const openPayment = async () => {
    await trackEvent(business.id, "payment_click").catch(() => {});
    setPaymentAmount("");
    setPaymentError("");
    setShowPaymentQr(isIOS);
    setPaymentOpen(true);
  };

  const payWithUpiApp = async () => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a valid amount greater than ₹0.");
      return;
    }
    const url = buildUpiUrl(business, amount.toFixed(2));
    if (!url) return;
    await trackEvent(business.id, "upi_app_click").catch(() => {});
    window.location.href = url;
  };

  const nextMenu = () => setMenuIndex((index) => (index + 1) % menuImages.length);
  const previousMenu = () => setMenuIndex((index) => (index - 1 + menuImages.length) % menuImages.length);
  const handleMenuTouchStart = (event) => setTouchStartX(event.touches[0]?.clientX ?? null);
  const handleMenuTouchEnd = (event) => {
    if (touchStartX === null || menuImages.length < 2) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;
    if (Math.abs(delta) > 45) {
      if (delta < 0) nextMenu();
      else previousMenu();
    }
    setTouchStartX(null);
  };

  return (
    <main className="profile-page">
      <div className="profile-card">
        <img className="profile-haki-logo" src="/haki-logo.png" alt="Haki" />
        <div className="profile-avatar-wrap">
          {business.logo_url ? (
            <img className="profile-avatar" src={business.logo_url} alt="" />
          ) : (
            <div className="profile-avatar profile-avatar-fallback">
              {(business.business_name || "H").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <h1>{business.business_name}</h1>
        {business.person_name && <p className="profile-person">{business.person_name}</p>}
        {business.bio && <p className="profile-bio">{business.bio}</p>}

        <button className="profile-save" onClick={saveContact}>
          <FaRegAddressCard /> Save Contact
        </button>

        <div className="profile-links">
          {links.map(({ key, label, Icon, href }) => (
            <button key={key} className="profile-link" onClick={() => handleLink({ key, label, Icon, href })}>
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {(upiUrl || business.payment_qr_url) && (
          <section className="profile-payment">
            <div className="profile-divider" />
            <div className="profile-payment-heading"><FaQrcode /><div><strong>Pay</strong><span>Secure UPI payment</span></div></div>
            {upiUrl && <button className="profile-pay-button" onClick={openPayment}>Pay Now</button>}
            {business.payment_qr_url && (
              <div className="profile-payment-qr">
                <span>Or scan to pay</span>
                <img src={business.payment_qr_url} alt="Payment QR code" />
                {business.upi_id && <code>{business.upi_id}</code>}
              </div>
            )}
          </section>
        )}

        <div className="profile-footer">Powered by <strong>Haki</strong></div>
      </div>

      {paymentOpen && (
        <div className="payment-modal" role="dialog" aria-modal="true" aria-label="Haki Pay" onClick={() => setPaymentOpen(false)}>
          <div className="payment-modal-card" onClick={(event) => event.stopPropagation()}>
            <header className="payment-modal-header">
              <div>
                <span>HAKI PAY</span>
                <strong>{business.business_name}</strong>
              </div>
              <button className="payment-close" onClick={() => setPaymentOpen(false)} aria-label="Close payment"><FaTimes /></button>
            </header>

            <div className="payment-modal-body">
              <label className="payment-amount-label" htmlFor="haki-payment-amount">Enter amount</label>
              <div className="payment-amount-wrap">
                <span>₹</span>
                <input
                  id="haki-payment-amount"
                  inputMode="decimal"
                  type="number"
                  min="1"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => {
                    setPaymentAmount(event.target.value);
                    setPaymentError("");
                  }}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              {paymentError && <p className="payment-error">{paymentError}</p>}

              <div className="payment-method-title">Choose how to pay</div>

              {!isIOS && (
                <button className="payment-method-button payment-upi-button" onClick={payWithUpiApp}>
                  <span className="payment-method-icon">UPI</span>
                  <span><strong>Pay by any UPI app</strong><small>PhonePe, Google Pay, BHIM & more</small></span>
                  <FaArrowRight />
                </button>
              )}

              {business.payment_qr_url && (
                <button
                  className="payment-method-button payment-qr-button"
                  onClick={() => {
                    trackEvent(business.id, "payment_qr_view").catch(() => {});
                    setShowPaymentQr((value) => !value);
                  }}
                >
                  <span className="payment-method-icon"><FaQrcode /></span>
                  <span><strong>Scan QR to pay</strong><small>Open your preferred UPI app and scan</small></span>
                  <FaArrowRight />
                </button>
              )}

              {showPaymentQr && business.payment_qr_url && (
                <div className="payment-modal-qr">
                  <img src={business.payment_qr_url} alt="Payment QR code" />
                  <code>{business.upi_id}</code>
                  <small>Amount: ₹{paymentAmount || "0.00"} · Enter the amount in your UPI app if needed.</small>
                </div>
              )}

              {isIOS && (
                <p className="payment-ios-note">On iPhone, use the QR code with your preferred UPI app. UPI app selection from a web page is currently supported through Android intent, not iOS. </p>
              )}
            </div>
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="menu-modal" role="dialog" aria-modal="true" aria-label={`${business.business_name} menu`} onClick={() => setMenuOpen(false)}>
          <div className="menu-modal-card" onClick={(event) => event.stopPropagation()}>
            <header className="menu-modal-header">
              <div><span>MENU</span><strong>{business.business_name}</strong></div>
              <button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><FaTimes /></button>
            </header>
            <div className="menu-image-wrap" onTouchStart={handleMenuTouchStart} onTouchEnd={handleMenuTouchEnd}>
              <img src={menuImages[menuIndex]} alt={`Menu page ${menuIndex + 1}`} />
              {menuImages.length > 1 && (
                <>
                  <button className="menu-nav menu-prev" onClick={previousMenu} aria-label="Previous menu page"><FaArrowLeft /></button>
                  <button className="menu-nav menu-next" onClick={nextMenu} aria-label="Next menu page"><FaArrowRight /></button>
                </>
              )}
            </div>
            <div className="menu-page-count">{menuIndex + 1} / {menuImages.length}</div>
          </div>
        </div>
      )}
    </main>
  );
}
