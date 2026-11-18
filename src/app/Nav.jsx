"use client";

import { useEffect, useState } from "react";
import "./nav.css";

const LINKS = [
  { id: "agents", label: "Agents", href: "/agents" },
  { id: "portfolio", label: "Portfolio", href: "/portfolio" },
  { id: "vault", label: "Vault", href: "/vault" },
  { id: "docs", label: "Docs", href: "/docs" },
  { id: "roadmap", label: "Roadmap", href: "/#roadmap" },
  { id: "faq", label: "FAQ", href: "/#faq" },
];
const X_URL = "https://x.com/NextraAgent";

export function Mark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="7" y="7" width="31" height="31" rx="9" fill="none" stroke="#161613" strokeWidth="7" />
      <rect x="26" y="26" width="31" height="31" rx="9" fill="none" stroke="#5DA000" strokeWidth="7" />
    </svg>
  );
}

export default function Nav({ active }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
    <header className={`nx-nav${scrolled ? " scrolled" : ""}${open ? " open" : ""}`}>
      <div className="nx-nav-in">
        <a className="nx-brand" href="/" aria-label="Nextra home">
          <Mark />
          <span>
            ne<b>x</b>tra
          </span>
        </a>

        <nav className="nx-links" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.id} href={l.href} className={active === l.id ? "on" : ""} aria-current={active === l.id ? "page" : undefined}>
              {l.label}
            </a>
          ))}
          <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="Nextra on X">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h6.9l4.8 6.3L18.9 2zm-1.2 18h1.7L6.4 3.9H4.6L17.7 20z" />
            </svg>
          </a>
        </nav>

        <a className="nx-cta" href="/agents">
          Open app
        </a>

        <button type="button" className="nx-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>

      <div className="nx-sheet" hidden={!open}>
        <nav aria-label="Mobile">
          {LINKS.map((l, i) => (
            <a key={l.id} href={l.href} className={active === l.id ? "on" : ""} onClick={() => setOpen(false)} style={{ "--i": i }}>
              <span>{l.label}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </a>
          ))}
          <a href={X_URL} target="_blank" rel="noopener noreferrer" style={{ "--i": LINKS.length }}>
            <span>X (Twitter)</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </nav>
        <a className="nx-sheet-cta" href="/agents" onClick={() => setOpen(false)}>
          Open app
        </a>
      </div>
    </>
  );
}
