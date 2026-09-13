import React, { useState, useEffect, useMemo } from "react";
import {
  Home, Calendar, Wrench, User, Plus, X, ChevronRight, ArrowLeft,
  LogOut, CheckCircle2, Clock, FileText, Shield,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import * as api from "./api";

/* ---------------------------------------------------------------------- */
/*  Design tokens                                                          */
/* ---------------------------------------------------------------------- */
const C = {
  paper: "#EEF3F9", card: "#FFFFFF", ink: "#12233F", muted: "#5B6B84",
  border: "#DCE4EF", accent: "#1E6FD9", accentSoft: "#E3EEFC",
  red: "#E5484D", redSoft: "#FBE4E4", amber: "#F0A020", amberSoft: "#FDF0D8",
  green: "#2FAE60", greenSoft: "#E1F5E9", blue: "#1E6FD9", blueSoft: "#E3EEFC",
};
const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.hos-display { font-family: 'Poppins', sans-serif; }
.hos-body { font-family: 'Poppins', sans-serif; }
`;

/* ---------------------------------------------------------------------- */
/*  Domain data                                                            */
/* ---------------------------------------------------------------------- */
const CATEGORIES = [
  { id: "ac", label: "AC", emoji: "❄️", intervalMonths: 6 },
  { id: "fridge", label: "Refrigerator", emoji: "🧊", intervalMonths: null },
  { id: "washing", label: "Washing Machine", emoji: "🧺", intervalMonths: 12 },
  { id: "ro", label: "RO Water Purifier", emoji: "🚰", intervalMonths: 6 },
  { id: "geyser", label: "Geyser", emoji: "🔥", intervalMonths: 12 },
  { id: "microwave", label: "Microwave", emoji: "📡", intervalMonths: 12 },
  { id: "tv", label: "TV", emoji: "📺", intervalMonths: null },
  { id: "other", label: "Other", emoji: "📦", intervalMonths: 12 },
];
const catMeta = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
const DAY = 1000 * 60 * 60 * 24;
function addMonths(date, months) { const d = new Date(date); d.setMonth(d.getMonth() + months); return d; }
function fmt(date) { return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function monthYear(date) { return new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
function ageString(purchaseDate) {
  const now = new Date(); const p = new Date(purchaseDate);
  let months = (now.getFullYear() - p.getFullYear()) * 12 + (now.getMonth() - p.getMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12); const rem = months % 12;
  if (years === 0) return `${rem} month${rem === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"}${rem ? ` ${rem} month${rem === 1 ? "" : "s"}` : ""}`;
}
function evaluateAppliance(a) {
  const meta = catMeta(a.category);
  const now = new Date();
  const warrantyExpiry = addMonths(a.purchaseDate, Number(a.warrantyMonths || 0));
  const warrantyActive = warrantyExpiry > now;
  if (!meta.intervalMonths) {
    return { status: warrantyActive ? "green" : "neutral", message: warrantyActive ? `Warranty active until ${fmt(warrantyExpiry)}` : "Out of warranty", dueDate: null, warrantyExpiry, warrantyActive };
  }
  const lastEvent = a.lastServiceDate ? new Date(a.lastServiceDate) : new Date(a.purchaseDate);
  const dueDate = addMonths(lastEvent, meta.intervalMonths);
  const daysUntilDue = Math.round((dueDate - now) / DAY);
  let status, message;
  if (daysUntilDue < 0) { status = "red"; message = `Maintenance overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"}`; }
  else if (daysUntilDue <= 30) { status = "amber"; message = `Service recommended within ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`; }
  else { status = "green"; message = `On track — next service due ${fmt(dueDate)}`; }
  return { status, message, dueDate, warrantyExpiry, warrantyActive };
}
function healthScore(appliances) {
  if (appliances.length === 0) return 100;
  let score = 100;
  appliances.forEach((a) => { const { status } = evaluateAppliance(a); if (status === "red") score -= 15; if (status === "amber") score -= 6; });
  return Math.max(0, Math.min(100, score));
}
const STATUS_STYLE = {
  red: { dot: "🔴", color: C.red, soft: C.redSoft, label: "Attention Required" },
  amber: { dot: "🟡", color: C.amber, soft: C.amberSoft, label: "Upcoming" },
  green: { dot: "🟢", color: C.green, soft: C.greenSoft, label: "Protected" },
  neutral: { dot: "⚪", color: C.muted, soft: "#E7E7E1", label: "No action needed" },
};

/* ---------------------------------------------------------------------- */
/*  UI primitives                                                          */
/* ---------------------------------------------------------------------- */
function Pill({ status }) {
  const s = STATUS_STYLE[status];
  return <span className="hos-body inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: s.soft, color: s.color }}><span>{s.dot}</span>{s.label}</span>;
}
function PrimaryButton({ children, onClick, type = "button", full, disabled }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`hos-body rounded-md px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 ${full ? "w-full" : ""}`} style={{ background: C.accent, color: "#F5F6F1" }}>{children}</button>;
}
function GhostButton({ children, onClick, full }) {
  return <button type="button" onClick={onClick} className={`hos-body rounded-md border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.03] ${full ? "w-full" : ""}`} style={{ borderColor: C.border, color: C.ink }}>{children}</button>;
}
function Field({ label, children }) {
  return <label className="hos-body block text-sm mb-3"><span className="block mb-1.5" style={{ color: C.muted }}>{label}</span>{children}</label>;
}
const inputCls = "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2";
const inputStyle = { borderColor: C.border, color: C.ink };

/* ---------------------------------------------------------------------- */
/*  Landing / Auth                                                         */
/* ---------------------------------------------------------------------- */
function BrandLogo({ size = "text-xl" }) {
  return (
    <span className={`hos-display ${size}`} style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
      <span style={{ color: C.ink }}>HOME</span><span style={{ color: C.accent }}>OS</span>
    </span>
  );
}

function DashboardIllustration() {
  return (
    <svg viewBox="0 0 420 340" className="w-full h-auto">
      <circle cx="340" cy="60" r="34" fill={C.accentSoft} />
      <circle cx="380" cy="140" r="16" fill={C.accentSoft} />
      <circle cx="40" cy="280" r="24" fill={C.accentSoft} />
      <rect x="40" y="40" width="300" height="200" rx="14" fill={C.ink} />
      <rect x="56" y="56" width="268" height="168" rx="6" fill={C.paper} />
      <rect x="72" y="150" width="24" height="60" rx="3" fill={C.accent} opacity="0.35" />
      <rect x="104" y="120" width="24" height="90" rx="3" fill={C.accent} opacity="0.55" />
      <rect x="136" y="90" width="24" height="120" rx="3" fill={C.accent} />
      <rect x="168" y="130" width="24" height="80" rx="3" fill={C.accent} opacity="0.55" />
      <circle cx="260" cy="100" r="26" fill={C.accentSoft} />
      <path d="M247 100 l10 10 l18 -22" stroke={C.accent} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="230" y="150" width="80" height="10" rx="5" fill={C.border} />
      <rect x="230" y="168" width="60" height="10" rx="5" fill={C.border} />
      <rect x="150" y="255" width="120" height="16" rx="8" fill={C.card} stroke={C.border} />
      <circle cx="90" cy="250" r="20" fill={C.accent} />
      <rect x="80" y="270" width="20" height="40" rx="6" fill={C.ink} />
    </svg>
  );
}

function MarketingNav({ page, setPage, onGetStarted }) {
  const navLinks = [
    { id: "home", label: "Home" },
    { id: "how", label: "How It Works" },
    { id: "services", label: "Services" },
    { id: "faqs", label: "FAQs" },
  ];
  return (
    <div className="border-b" style={{ borderColor: C.border, background: C.card }}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <button className="flex items-center gap-2" onClick={() => setPage("home")}>
          <span className="text-2xl">🏠</span>
          <BrandLogo />
        </button>
        <nav className="hidden md:flex items-center gap-8 hos-body text-sm">
          {navLinks.map((l) => (
            <button
              key={l.id}
              onClick={() => setPage(l.id)}
              style={{ color: page === l.id ? C.accent : C.muted, fontWeight: page === l.id ? 600 : 400 }}
            >
              {l.label}
            </button>
          ))}
        </nav>
        <button
          onClick={onGetStarted}
          className="hos-body rounded-full px-5 py-2.5 text-sm font-semibold"
          style={{ background: C.accent, color: "#fff" }}
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

function MarketingShell({ children }) {
  return <div className="min-h-screen" style={{ background: C.paper, color: C.ink }}>{children}</div>;
}

function HomePage({ onGetStarted }) {
  const features = [
    { icon: Shield, title: "Track Warranties", text: "Know exactly when every appliance's coverage ends." },
    { icon: Calendar, title: "Never Miss Service", text: "Auto-generated reminders before things break down." },
    { icon: Wrench, title: "Request Help Fast", text: "One tap to get connected with a technician." },
  ];
  return (
    <>
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="hos-display leading-[1.05] text-5xl md:text-6xl" style={{ fontWeight: 800 }}>
            <span style={{ color: C.ink }}>Your Home.</span><br />
            <span style={{ color: C.accent }}>Our Care.</span><br />
            <span style={{ color: C.ink }}>Everything Under Control.</span>
          </h1>
          <p className="hos-body mt-6 text-lg" style={{ color: C.muted, maxWidth: "40ch" }}>
            HomeOS helps you manage your appliances, maintenance, warranties, and service needs — all in one place.
          </p>
          <button
            onClick={onGetStarted}
            className="hos-body rounded-full px-7 py-3.5 mt-8 text-base font-semibold inline-flex items-center gap-2"
            style={{ background: C.accent, color: "#fff" }}
          >
            Get Started <ChevronRight size={17} />
          </button>
        </div>
        <div className="hidden md:block"><DashboardIllustration /></div>
      </div>
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid sm:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="rounded-lg border p-5" style={{ background: C.card, borderColor: C.border }}>
                <div className="w-9 h-9 rounded-md flex items-center justify-center mb-3" style={{ background: C.accentSoft }}>
                  <Icon size={18} color={C.accent} />
                </div>
                <p className="hos-body text-sm font-semibold mb-1" style={{ color: C.ink }}>{f.title}</p>
                <p className="hos-body text-sm" style={{ color: C.muted }}>{f.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function HowItWorksPage({ onGetStarted }) {
  const steps = [
    { icon: Plus, title: "Add Your Appliances", text: "Enter the brand, model, purchase date, and warranty for each appliance in your home — takes under a minute per item." },
    { icon: Calendar, title: "Get a Maintenance Calendar", text: "HomeOS builds a month-by-month schedule automatically, based on standard service intervals for each appliance type." },
    { icon: Shield, title: "Track Warranties & History", text: "Every appliance gets its own page showing warranty status, age, and a full service history in one place." },
    { icon: Wrench, title: "Request a Technician", text: "When something needs attention, request service in a tap — we connect you with a verified technician." },
  ];
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="hos-display text-4xl mb-3" style={{ fontWeight: 800 }}>How It Works</h1>
      <p className="hos-body text-lg mb-12" style={{ color: C.muted }}>Four simple steps to a household that manages itself.</p>
      <div className="space-y-6">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex gap-5 rounded-lg border p-5" style={{ background: C.card, borderColor: C.border }}>
              <div className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center" style={{ background: C.accentSoft }}>
                <Icon size={20} color={C.accent} />
              </div>
              <div>
                <p className="hos-body text-xs uppercase tracking-wide mb-1" style={{ color: C.accent, fontWeight: 700 }}>Step {i + 1}</p>
                <p className="hos-body text-lg font-semibold mb-1" style={{ color: C.ink }}>{s.title}</p>
                <p className="hos-body text-sm" style={{ color: C.muted }}>{s.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={onGetStarted} className="hos-body rounded-full px-7 py-3.5 mt-10 text-base font-semibold" style={{ background: C.accent, color: "#fff" }}>
        Get Started
      </button>
    </div>
  );
}

function ServicesPage({ onGetStarted }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="hos-display text-4xl mb-3" style={{ fontWeight: 800 }}>Services</h1>
      <p className="hos-body text-lg mb-10" style={{ color: C.muted }}>HomeOS covers the appliances every household relies on.</p>
      <div className="grid sm:grid-cols-4 gap-4 mb-12">
        {CATEGORIES.map((c) => (
          <div key={c.id} className="rounded-lg border p-4 text-center" style={{ background: C.card, borderColor: C.border }}>
            <div className="text-3xl mb-2">{c.emoji}</div>
            <p className="hos-body text-sm font-medium" style={{ color: C.ink }}>{c.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border p-6" style={{ background: C.card, borderColor: C.border }}>
        <p className="hos-body text-lg font-semibold mb-2" style={{ color: C.ink }}>Need a repair or service visit?</p>
        <p className="hos-body text-sm" style={{ color: C.muted }}>
          Submit a request from any appliance's page and our team personally connects you with a verified local technician —
          no automated marketplace, no guesswork, just a real person making sure it gets handled.
        </p>
      </div>
      <button onClick={onGetStarted} className="hos-body rounded-full px-7 py-3.5 mt-10 text-base font-semibold" style={{ background: C.accent, color: "#fff" }}>
        Get Started
      </button>
    </div>
  );
}

function FaqsPage({ onGetStarted }) {
  const faqs = [
    { q: "Is HomeOS free to use?", a: "Yes. Creating an account and tracking your appliances, warranties, and maintenance schedule is completely free." },
    { q: "Do you send a technician automatically?", a: "Not yet. When you submit a service request, our team personally connects you with a verified technician." },
    { q: "Is my household data private?", a: "Yes. Only you can see your own appliances, service history, and requests — no one else's account can access it." },
    { q: "Which appliances can I track?", a: "AC, Refrigerator, Washing Machine, RO Water Purifier, Geyser, Microwave, TV, and any other appliance under \"Other\"." },
    { q: "How are maintenance reminders calculated?", a: "Each appliance category has a standard recommended service interval. HomeOS uses your last service date (or purchase date) to predict when the next one is due." },
  ];
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="hos-display text-4xl mb-10" style={{ fontWeight: 800 }}>Frequently Asked Questions</h1>
      <div className="space-y-5">
        {faqs.map((f, i) => (
          <div key={i} className="rounded-lg border p-5" style={{ background: C.card, borderColor: C.border }}>
            <p className="hos-body font-semibold mb-1.5" style={{ color: C.ink }}>{f.q}</p>
            <p className="hos-body text-sm" style={{ color: C.muted }}>{f.a}</p>
          </div>
        ))}
      </div>
      <button onClick={onGetStarted} className="hos-body rounded-full px-7 py-3.5 mt-10 text-base font-semibold" style={{ background: C.accent, color: "#fff" }}>
        Get Started
      </button>
    </div>
  );
}

function Marketing({ onGetStarted }) {
  const [page, setPage] = useState("home");
  return (
    <MarketingShell>
      <MarketingNav page={page} setPage={setPage} onGetStarted={onGetStarted} />
      {page === "home" && <HomePage onGetStarted={onGetStarted} />}
      {page === "how" && <HowItWorksPage onGetStarted={onGetStarted} />}
      {page === "services" && <ServicesPage onGetStarted={onGetStarted} />}
      {page === "faqs" && <FaqsPage onGetStarted={onGetStarted} />}
    </MarketingShell>
  );
}

function AuthScreen({ onBack }) {
  const [mode, setMode] = useState("signup"); // signup | login
  const [form, setForm] = useState({ name: "", email: "", password: "", city: "", members: "" });
  const [error, setError] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: err } = await api.signUp({ email: form.email, password: form.password });
        if (err) throw err;
        if (!data.session) { setPendingConfirm(true); setLoading(false); return; }
        await api.upsertProfile(data.user.id, { name: form.name, contact: form.email, city: form.city, members: form.members });
      } else {
        const { error: err } = await api.signIn({ email: form.email, password: form.password });
        if (err) throw err;
      }
      // onAuthStateChange in the root App picks up the session from here
    } catch (e) {
      setError(e.message || "Something went wrong.");
    }
    setLoading(false);
  };

  if (pendingConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: C.paper }}>
        <div className="w-full max-w-sm rounded-lg border p-8 text-center" style={{ background: C.card, borderColor: C.border }}>
          <p className="hos-display text-xl mb-2" style={{ color: C.ink, fontWeight: 600 }}>Check your email</p>
          <p className="hos-body text-sm" style={{ color: C.muted }}>We sent a confirmation link to {form.email}. Confirm it, then sign in below.</p>
          <div className="mt-6"><GhostButton full onClick={() => { setPendingConfirm(false); setMode("login"); }}>Go to sign in</GhostButton></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: C.paper }}>
      <div className="w-full max-w-sm rounded-lg border p-8" style={{ background: C.card, borderColor: C.border }}>
        <button onClick={onBack} className="hos-body flex items-center gap-1.5 text-sm mb-6" style={{ color: C.muted }}><ArrowLeft size={14} /> Back</button>
        <h2 className="hos-display text-2xl mb-1" style={{ color: C.ink, fontWeight: 600 }}>{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
        <p className="hos-body text-sm mb-6" style={{ color: C.muted }}>{mode === "signup" ? "Set up your household in a minute." : "Sign in to your household."}</p>

        {mode === "signup" && (
          <>
            <Field label="Name"><input className={inputCls} style={inputStyle} value={form.name} onChange={set("name")} placeholder="Prince Kumar" /></Field>
            <Field label="City"><input className={inputCls} style={inputStyle} value={form.city} onChange={set("city")} placeholder="Bengaluru" /></Field>
            <Field label="Household members (optional)"><input className={inputCls} style={inputStyle} value={form.members} onChange={set("members")} placeholder="4" /></Field>
          </>
        )}
        <Field label="Email"><input type="email" className={inputCls} style={inputStyle} value={form.email} onChange={set("email")} placeholder="you@example.com" /></Field>
        <Field label="Password"><input type="password" className={inputCls} style={inputStyle} value={form.password} onChange={set("password")} placeholder="At least 6 characters" /></Field>

        {error && <p className="hos-body text-sm mb-3" style={{ color: C.red }}>{error}</p>}

        <PrimaryButton full disabled={loading || !form.email || !form.password} onClick={submit}>
          {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </PrimaryButton>

        <button className="hos-body text-sm mt-4 w-full text-center" style={{ color: C.muted }} onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Nav                                                                     */
/* ---------------------------------------------------------------------- */
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "myhome", label: "My Home", icon: Shield },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "services", label: "Services", icon: Wrench },
  { id: "profile", label: "Profile", icon: User },
];
function Sidebar({ view, setView, onLogout }) {
  return (
    <div className="hidden md:flex flex-col w-56 shrink-0 border-r px-4 py-6" style={{ borderColor: C.border }}>
      <div className="flex items-center gap-2 px-2 mb-8"><span className="text-xl">🏠</span><BrandLogo size="text-lg" /></div>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon; const active = view === item.id;
          return <button key={item.id} onClick={() => setView(item.id)} className="hos-body w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-left transition-colors" style={{ background: active ? C.accentSoft : "transparent", color: active ? C.accent : C.muted, fontWeight: active ? 600 : 400 }}><Icon size={17} />{item.label}</button>;
        })}
      </nav>
      <button onClick={onLogout} className="hos-body flex items-center gap-3 px-3 py-2.5 text-sm" style={{ color: C.muted }}><LogOut size={17} /> Log out</button>
    </div>
  );
}
function BottomNav({ view, setView }) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 border-t flex justify-around py-2 z-20" style={{ background: C.card, borderColor: C.border }}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon; const active = view === item.id;
        return <button key={item.id} onClick={() => setView(item.id)} className="flex flex-col items-center gap-0.5 px-2 py-1"><Icon size={19} color={active ? C.accent : C.muted} /><span className="hos-body text-[10px]" style={{ color: active ? C.accent : C.muted }}>{item.label}</span></button>;
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Dashboard                                                               */
/* ---------------------------------------------------------------------- */
function Dashboard({ profile, appliances, setView, openAppliance }) {
  const score = healthScore(appliances);
  const evaluated = appliances.map((a) => ({ a, e: evaluateAppliance(a) }));
  const red = evaluated.filter((x) => x.e.status === "red");
  const amber = evaluated.filter((x) => x.e.status === "amber");
  const green = evaluated.filter((x) => x.e.status === "green" || x.e.status === "neutral");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="max-w-3xl">
      <h1 className="hos-display text-3xl mb-1" style={{ color: C.ink, fontWeight: 700 }}>{greeting}{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}</h1>
      <p className="hos-body text-sm mb-8" style={{ color: C.muted }}>Here's how your household is doing today.</p>
      <div className="rounded-lg border p-6 mb-8 flex items-center gap-8 flex-wrap" style={{ background: C.card, borderColor: C.border }}>
        <div><p className="hos-body text-xs uppercase tracking-wide mb-1" style={{ color: C.muted }}>Household Health</p><p className="hos-display text-5xl" style={{ fontWeight: 800, color: C.ink }}>{score}<span className="text-xl" style={{ color: C.muted }}>/100</span></p></div>
        <div className="flex gap-6 hos-body text-sm"><div><span className="mr-1.5">🟢</span>{green.length} Healthy</div><div><span className="mr-1.5">🟡</span>{amber.length} Need Attention Soon</div><div><span className="mr-1.5">🔴</span>{red.length} Overdue</div></div>
      </div>
      {appliances.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: C.border }}>
          <p className="hos-body text-sm mb-4" style={{ color: C.muted }}>You haven't added any appliances yet.</p>
          <PrimaryButton onClick={() => setView("myhome")}>Add your first appliance</PrimaryButton>
        </div>
      )}
      {red.length > 0 && <Section title="Needs Attention">{red.map(({ a, e }) => <ApplianceRow key={a.id} a={a} e={e} onClick={() => openAppliance(a.id)} />)}</Section>}
      {amber.length > 0 && <Section title="Upcoming">{amber.map(({ a, e }) => <ApplianceRow key={a.id} a={a} e={e} onClick={() => openAppliance(a.id)} />)}</Section>}
      {green.length > 0 && <Section title="Protected">{green.map(({ a, e }) => <ApplianceRow key={a.id} a={a} e={e} onClick={() => openAppliance(a.id)} />)}</Section>}
    </div>
  );
}
function Section({ title, children }) { return <div className="mb-8"><h3 className="hos-body text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>{title}</h3><div className="space-y-2">{children}</div></div>; }
function ApplianceRow({ a, e, onClick }) {
  const meta = catMeta(a.category); const s = STATUS_STYLE[e.status];
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 rounded-md border px-4 py-3 text-left transition-colors hover:bg-black/[.02]" style={{ background: C.card, borderColor: C.border, borderLeft: `3px solid ${s.color}` }}>
      <span className="text-xl">{meta.emoji}</span>
      <div className="flex-1 min-w-0"><p className="hos-body text-sm font-medium" style={{ color: C.ink }}>{a.brand} {meta.label}</p><p className="hos-body text-xs mt-0.5" style={{ color: C.muted }}>{e.message}</p></div>
      <ChevronRight size={16} color={C.muted} />
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/*  My Home                                                                 */
/* ---------------------------------------------------------------------- */
function MyHome({ appliances, openAppliance, onAdd }) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="hos-display text-3xl" style={{ color: C.ink, fontWeight: 700 }}>My Appliances</h1>
        <PrimaryButton onClick={() => setShowAdd(true)}><span className="flex items-center gap-1.5"><Plus size={15} /> Add Appliance</span></PrimaryButton>
      </div>
      {appliances.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: C.border }}><p className="hos-body text-sm" style={{ color: C.muted }}>No appliances yet. Add your first one to start tracking maintenance.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {appliances.map((a) => {
            const meta = catMeta(a.category); const e = evaluateAppliance(a);
            return (
              <button key={a.id} onClick={() => openAppliance(a.id)} className="text-left rounded-lg border p-4 transition-colors hover:bg-black/[.02]" style={{ background: C.card, borderColor: C.border }}>
                <div className="flex items-start justify-between mb-3"><span className="text-2xl">{meta.emoji}</span><Pill status={e.status} /></div>
                <p className="hos-body text-sm font-medium" style={{ color: C.ink }}>{a.brand} {a.model}</p>
                <p className="hos-body text-xs mt-0.5" style={{ color: C.muted }}>{meta.label}</p>
              </button>
            );
          })}
        </div>
      )}
      {showAdd && <AddApplianceModal saving={saving} onClose={() => setShowAdd(false)} onSave={async (a) => { setSaving(true); await onAdd(a); setSaving(false); setShowAdd(false); }} />}
    </div>
  );
}
function AddApplianceModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ category: "ac", brand: "", model: "", purchaseDate: "", warrantyMonths: "12", note: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const canSave = form.brand && form.purchaseDate;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(31,42,36,0.4)" }}>
      <div className="w-full max-w-md rounded-lg p-6 max-h-[90vh] overflow-y-auto" style={{ background: C.card }}>
        <div className="flex items-center justify-between mb-4"><h3 className="hos-display text-xl" style={{ color: C.ink, fontWeight: 600 }}>Add Appliance</h3><button onClick={onClose}><X size={18} color={C.muted} /></button></div>
        <Field label="Category"><select className={inputCls} style={inputStyle} value={form.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}</select></Field>
        <Field label="Brand"><input className={inputCls} style={inputStyle} value={form.brand} onChange={set("brand")} placeholder="Voltas" /></Field>
        <Field label="Model"><input className={inputCls} style={inputStyle} value={form.model} onChange={set("model")} placeholder="XYZ123" /></Field>
        <Field label="Purchase date"><input type="date" className={inputCls} style={inputStyle} value={form.purchaseDate} onChange={set("purchaseDate")} /></Field>
        <Field label="Warranty duration (months)"><input type="number" className={inputCls} style={inputStyle} value={form.warrantyMonths} onChange={set("warrantyMonths")} /></Field>
        <Field label="Invoice note (optional)"><input className={inputCls} style={inputStyle} value={form.note} onChange={set("note")} placeholder="e.g. invoice filed in email" /></Field>
        <div className="flex gap-2 mt-2">
          <GhostButton full onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton full disabled={!canSave || saving} onClick={() => onSave(form)}>{saving ? "Saving…" : "Save"}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Appliance Passport                                                     */
/* ---------------------------------------------------------------------- */
function AppliancePassport({ appliance, onBack, onAddService, onRequestService, onDelete }) {
  const [showService, setShowService] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const meta = catMeta(appliance.category); const e = evaluateAppliance(appliance);
  const timeline = [{ date: appliance.purchaseDate, activity: "Purchased" }, ...appliance.serviceHistory.map((s) => ({ date: s.date, activity: s.activity }))].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (e.dueDate) timeline.push({ date: e.dueDate, activity: "Next recommended service", upcoming: true });
  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="hos-body flex items-center gap-1.5 text-sm mb-6" style={{ color: C.muted }}><ArrowLeft size={15} /> Back</button>
      <div className="flex items-center gap-3 mb-1"><span className="text-3xl">{meta.emoji}</span><h1 className="hos-display text-3xl" style={{ color: C.ink, fontWeight: 700 }}>{appliance.brand} {meta.label}</h1></div>
      <div className="mb-6"><Pill status={e.status} /></div>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <InfoCard title="Basic Details"><InfoRow k="Brand" v={appliance.brand} /><InfoRow k="Model" v={appliance.model || "—"} /><InfoRow k="Purchased" v={fmt(appliance.purchaseDate)} /><InfoRow k="Age" v={ageString(appliance.purchaseDate)} /></InfoCard>
        <InfoCard title="Warranty"><div className="hos-body text-sm flex items-center gap-2 mb-2" style={{ color: e.warrantyActive ? C.green : C.muted }}>{e.warrantyActive ? <CheckCircle2 size={15} /> : <Clock size={15} />}{e.warrantyActive ? "Active" : "Expired"}</div><InfoRow k="Expires" v={fmt(e.warrantyExpiry)} /></InfoCard>
      </div>
      <InfoCard title="Maintenance Timeline"><div className="space-y-3">{timeline.map((t, i) => <div key={i} className="hos-body flex items-center gap-4 text-sm border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: C.border }}><span className="w-28 shrink-0" style={{ color: C.muted }}>{fmt(t.date)}</span><span style={{ color: t.upcoming ? C.amber : C.ink, fontWeight: t.upcoming ? 600 : 400 }}>{t.activity}</span></div>)}</div></InfoCard>
      {appliance.note && <div className="hos-body flex items-center gap-2 text-sm mt-4" style={{ color: C.muted }}><FileText size={14} /> {appliance.note}</div>}
      <div className="flex flex-wrap gap-2 mt-6">
        <GhostButton onClick={() => setShowService(true)}>➕ Add Service</GhostButton>
        <GhostButton onClick={() => onRequestService(appliance)}>🔧 Find Technician</GhostButton>
        {!confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="hos-body rounded-md border px-4 py-2.5 text-sm font-medium"
            style={{ borderColor: C.red, color: C.red, background: "transparent" }}
          >
            🗑️ Remove Appliance
          </button>
        )}
      </div>

      {confirmDelete && (
        <div className="hos-body text-sm border rounded-md p-4 mt-3" style={{ borderColor: C.red, background: C.redSoft }}>
          <p className="mb-3" style={{ color: C.ink }}>
            This permanently deletes {appliance.brand} {meta.label} and its full service history. This can't be undone.
          </p>
          <div className="flex gap-2">
            <GhostButton onClick={() => setConfirmDelete(false)}>Cancel</GhostButton>
            <button
              disabled={deleting}
              onClick={async () => { setDeleting(true); await onDelete(appliance.id); }}
              className="hos-body rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-50"
              style={{ background: C.red, color: "#fff" }}
            >
              {deleting ? "Removing…" : "Yes, remove it"}
            </button>
          </div>
        </div>
      )}
      {showService && <AddServiceModal onClose={() => setShowService(false)} onSave={async (entry) => { await onAddService(appliance.id, entry); setShowService(false); }} />}
    </div>
  );
}
function InfoCard({ title, children }) { return <div className="rounded-lg border p-4" style={{ background: C.card, borderColor: C.border }}><p className="hos-body text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>{title}</p>{children}</div>; }
function InfoRow({ k, v }) { return <div className="hos-body flex justify-between text-sm py-1"><span style={{ color: C.muted }}>{k}</span><span style={{ color: C.ink }}>{v}</span></div>; }
function AddServiceModal({ onClose, onSave }) {
  const [date, setDate] = useState(""); const [activity, setActivity] = useState("Service"); const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(31,42,36,0.4)" }}>
      <div className="w-full max-w-sm rounded-lg p-6" style={{ background: C.card }}>
        <div className="flex items-center justify-between mb-4"><h3 className="hos-display text-xl" style={{ color: C.ink, fontWeight: 600 }}>Add Service Record</h3><button onClick={onClose}><X size={18} color={C.muted} /></button></div>
        <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Activity"><select className={inputCls} style={inputStyle} value={activity} onChange={(e) => setActivity(e.target.value)}><option>Service</option><option>Cleaning</option><option>Filter Replacement</option><option>Repair</option></select></Field>
        <div className="flex gap-2 mt-2">
          <GhostButton full onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton full disabled={!date || saving} onClick={async () => { setSaving(true); await onSave({ date, activity }); setSaving(false); }}>{saving ? "Saving…" : "Save"}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Calendar                                                                */
/* ---------------------------------------------------------------------- */
function MaintenanceCalendar({ appliances, openAppliance }) {
  const events = useMemo(() => {
    const list = [];
    appliances.forEach((a) => {
      const meta = catMeta(a.category); const e = evaluateAppliance(a);
      if (e.dueDate) list.push({ date: new Date(e.dueDate), label: `${a.brand} ${meta.label} — maintenance due`, status: e.status, id: a.id });
      if (e.warrantyExpiry) list.push({ date: new Date(e.warrantyExpiry), label: `${a.brand} ${meta.label} — warranty renewal`, status: "blue", id: a.id });
    });
    return list.sort((x, y) => x.date - y.date);
  }, [appliances]);
  const groups = {};
  events.forEach((ev) => { const key = monthYear(ev.date); groups[key] = groups[key] || []; groups[key].push(ev); });
  const dotFor = { red: "🔴", amber: "🟡", green: "🟢", blue: "🔵", neutral: "⚪" };
  return (
    <div className="max-w-2xl">
      <h1 className="hos-display text-3xl mb-1" style={{ color: C.ink, fontWeight: 700 }}>Maintenance Calendar</h1>
      <p className="hos-body text-sm mb-8" style={{ color: C.muted }}>Automatically generated from your appliances' service and warranty cycles.</p>
      {Object.keys(groups).length === 0 && <p className="hos-body text-sm" style={{ color: C.muted }}>Add appliances to see your calendar fill in.</p>}
      <div className="space-y-6">
        {Object.entries(groups).map(([month, evs]) => (
          <div key={month}>
            <h3 className="hos-display text-lg mb-2" style={{ color: C.ink, fontWeight: 600 }}>{month}</h3>
            <div className="space-y-2">{evs.map((ev, i) => <button key={i} onClick={() => openAppliance(ev.id)} className="w-full flex items-center gap-3 rounded-md border px-4 py-2.5 text-left hos-body text-sm hover:bg-black/[.02]" style={{ background: C.card, borderColor: C.border }}><span>{dotFor[ev.status]}</span><span style={{ color: C.ink }}>{ev.label}</span><span className="ml-auto" style={{ color: C.muted }}>{fmt(ev.date)}</span></button>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Services                                                                */
/* ---------------------------------------------------------------------- */
function Services({ appliances, requests, onSubmit }) {
  const [applianceId, setApplianceId] = useState(appliances[0]?.id || "");
  const [issue, setIssue] = useState(""); const [submitted, setSubmitted] = useState(false); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!applianceId && appliances[0]) setApplianceId(appliances[0].id); }, [appliances]);
  return (
    <div className="max-w-xl">
      <h1 className="hos-display text-3xl mb-1" style={{ color: C.ink, fontWeight: 700 }}>Service Request</h1>
      <p className="hos-body text-sm mb-8" style={{ color: C.muted }}>Need help with an appliance? Tell us what's going on and we'll connect you with a verified technician.</p>
      {appliances.length === 0 ? (
        <p className="hos-body text-sm" style={{ color: C.muted }}>Add an appliance first so we know what needs service.</p>
      ) : (
        <div className="rounded-lg border p-5 mb-8" style={{ background: C.card, borderColor: C.border }}>
          <Field label="Appliance"><select className={inputCls} style={inputStyle} value={applianceId} onChange={(e) => setApplianceId(e.target.value)}>{appliances.map((a) => <option key={a.id} value={a.id}>{a.brand} {catMeta(a.category).label}</option>)}</select></Field>
          <Field label="What's the issue?"><textarea className={inputCls} style={{ ...inputStyle, minHeight: 90 }} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="e.g. AC isn't cooling properly" /></Field>
          <PrimaryButton disabled={!applianceId || saving} onClick={async () => {
            setSaving(true);
            await onSubmit(applianceId, issue);
            setSaving(false); setIssue(""); setSubmitted(true); setTimeout(() => setSubmitted(false), 4000);
          }}>{saving ? "Sending…" : "Request Service"}</PrimaryButton>
          {submitted && <p className="hos-body text-sm mt-3" style={{ color: C.green }}>Request received — we'll connect you with a verified technician shortly.</p>}
        </div>
      )}
      {requests.length > 0 && (
        <>
          <h3 className="hos-body text-xs uppercase tracking-wide mb-3" style={{ color: C.muted }}>Your Requests</h3>
          <div className="space-y-2">
            {requests.map((r) => {
              const a = appliances.find((x) => x.id === r.applianceId);
              return (
                <div key={r.id} className="hos-body rounded-md border px-4 py-3 text-sm" style={{ background: C.card, borderColor: C.border }}>
                  <div className="flex justify-between"><span style={{ color: C.ink, fontWeight: 500 }}>{a ? `${a.brand} ${catMeta(a.category).label}` : "Appliance"}</span><span style={{ color: C.amber }}>{r.status}</span></div>
                  {r.issue && <p style={{ color: C.muted }} className="mt-1">{r.issue}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Profile                                                                 */
/* ---------------------------------------------------------------------- */
function Profile({ profile, onSave, onLogout }) {
  const [form, setForm] = useState(profile || { name: "", contact: "", city: "", members: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="max-w-sm">
      <h1 className="hos-display text-3xl mb-6" style={{ color: C.ink, fontWeight: 700 }}>Profile</h1>
      <div className="rounded-lg border p-5" style={{ background: C.card, borderColor: C.border }}>
        <Field label="Name"><input className={inputCls} style={inputStyle} value={form.name || ""} onChange={set("name")} /></Field>
        <Field label="Email"><input className={inputCls} style={{ ...inputStyle, background: "#F3F4EF" }} value={form.contact || ""} disabled /></Field>
        <Field label="City"><input className={inputCls} style={inputStyle} value={form.city || ""} onChange={set("city")} /></Field>
        <Field label="Household members"><input className={inputCls} style={inputStyle} value={form.members || ""} onChange={set("members")} /></Field>
        <PrimaryButton full disabled={saving} onClick={async () => { setSaving(true); await onSave(form); setSaving(false); }}>{saving ? "Saving…" : "Save changes"}</PrimaryButton>
      </div>
      <button onClick={onLogout} className="hos-body flex items-center gap-2 text-sm mt-6" style={{ color: C.muted }}><LogOut size={15} /> Log out</button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Root App                                                                */
/* ---------------------------------------------------------------------- */
export default function App() {
  const [stage, setStage] = useState("loading"); // loading | landing | auth | app
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appliances, setAppliances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);

  async function loadAllData(userId) {
    const [p, apps, reqs] = await Promise.all([api.fetchProfile(userId), api.fetchAppliances(userId), api.fetchRequests(userId)]);
    setProfile(p);
    setAppliances(apps);
    setRequests(reqs);
  }

  useEffect(() => {
    let mounted = true;
    api.getSession().then(async (s) => {
      if (!mounted) return;
      setSession(s);
      if (s) { await loadAllData(s.user.id); setStage("app"); } else { setStage("landing"); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s) { await loadAllData(s.user.id); setStage("app"); }
      else { setProfile(null); setAppliances([]); setRequests([]); setStage("landing"); }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const handleAddAppliance = async (form) => {
    const a = await api.addAppliance(session.user.id, form);
    setAppliances((prev) => [...prev, a]);
  };
  const handleAddService = async (applianceId, entry) => {
    await api.addServiceRecord(session.user.id, applianceId, entry);
    setAppliances((prev) => prev.map((a) => a.id === applianceId ? { ...a, lastServiceDate: entry.date, serviceHistory: [...a.serviceHistory, entry] } : a));
  };
  const handleSubmitRequest = async (applianceId, issue) => {
    const r = await api.addRequest(session.user.id, applianceId, issue);
    setRequests((prev) => [r, ...prev]);
  };
  const handleSaveProfile = async (form) => {
    await api.upsertProfile(session.user.id, { name: form.name, contact: form.contact, city: form.city, members: form.members });
    setProfile(form);
  };
  const handleDeleteAppliance = async (applianceId) => {
    await api.deleteAppliance(session.user.id, applianceId);
    setAppliances((prev) => prev.filter((a) => a.id !== applianceId));
    setRequests((prev) => prev.filter((r) => r.applianceId !== applianceId));
    setView("myhome");
  };
  const handleLogout = async () => { await api.signOut(); };
  const openAppliance = (id) => { setSelectedId(id); setView("passport"); };

  if (stage === "loading") return <div className="min-h-screen flex items-center justify-center hos-body" style={{ background: C.paper, color: C.muted }}><style>{FONTS}</style>Loading…</div>;
  if (stage === "landing") return <div><style>{FONTS}</style><Marketing onGetStarted={() => setStage("auth")} /></div>;
  if (stage === "auth") return <div><style>{FONTS}</style><AuthScreen onBack={() => setStage("landing")} /></div>;

  const selected = appliances.find((a) => a.id === selectedId);

  return (
    <div className="min-h-screen flex hos-body" style={{ background: C.paper }}>
      <style>{FONTS}</style>
      <Sidebar view={view} setView={setView} onLogout={handleLogout} />
      <div className="flex-1 px-6 py-8 pb-24 md:pb-8 overflow-y-auto">
        {view === "dashboard" && <Dashboard profile={profile} appliances={appliances} setView={setView} openAppliance={openAppliance} />}
        {view === "myhome" && <MyHome appliances={appliances} openAppliance={openAppliance} onAdd={handleAddAppliance} />}
        {view === "passport" && selected && <AppliancePassport appliance={selected} onBack={() => setView("myhome")} onAddService={handleAddService} onRequestService={() => setView("services")} onDelete={handleDeleteAppliance} />}
        {view === "calendar" && <MaintenanceCalendar appliances={appliances} openAppliance={openAppliance} />}
        {view === "services" && <Services appliances={appliances} requests={requests} onSubmit={handleSubmitRequest} />}
        {view === "profile" && <Profile profile={profile} onSave={handleSaveProfile} onLogout={handleLogout} />}
      </div>
      <BottomNav view={view} setView={setView} />
    </div>
  );
}

