"use client";

import { useState } from "react";
import "./open-source.css";

const REPO = "https://github.com/nextraagent/Nextra";
const STEPS = ["git clone https://github.com/nextraagent/Nextra.git", "cd Nextra", "npm install", "cp .env.example .env.local", "npm run dev"];

function GitHubMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function OpenSource() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(STEPS.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <section className="sec" id="open-source">
      <span className="eyebrow">Open source</span>
      <h2>Read the code. Run it yourself.</h2>
      <div className="os-band">
        <div className="os-text">
          <p className="sub">
            Every agent, every rule and every trade path is public on GitHub. Check how Sentry, Tempo and Perch trade from your own
            wallet, or clone it and build your own.
          </p>
          <div className="ctas">
            <a className="btn lime os-gh" href={REPO} target="_blank" rel="noopener noreferrer">
              <GitHubMark /> View on GitHub
            </a>
            <a className="btn ghost" href="/docs">
              Read the docs
            </a>
          </div>
        </div>
        <div className="os-term">
          <div className="os-term-bar">
            <i />
            <i />
            <i />
            <span>Quick start</span>
            <button type="button" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre>
            {STEPS.map((s) => (
              <div key={s}>
                <b>$</b> {s}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </section>
  );
}

// Compact version for the hero, sitting above the $NEXTRA chart card.
export function OpenSourceBar() {
  const [copied, setCopied] = useState(false);
  const cmd = "git clone https://github.com/nextraagent/Nextra.git && cd Nextra && npm install";
  const copy = () => {
    navigator.clipboard?.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="osb">
      <a className="osb-top" href={REPO} target="_blank" rel="noopener noreferrer">
        <span className="osb-ico">
          <GitHubMark size={18} />
        </span>
        <span className="osb-name">
          <b>Open source</b>
          <span>nextraagent/Nextra</span>
        </span>
        <span className="osb-go">View code ↗</span>
      </a>
      <button type="button" className="osb-cmd" onClick={copy} aria-label="Copy install command">
        <code>
          <b>$</b> git clone … &amp;&amp; npm install
        </code>
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
