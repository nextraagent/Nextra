import { Mark } from "./Nav";

export default function Footer() {
  return (
    <footer className="nx-foot">
      <div className="nx-foot-in">
        <div className="nx-foot-brand">
          <a className="nx-brand" href="/">
            <Mark />
            <span>
              ne<b>x</b>tra
            </span>
          </a>
        </div>
        <div>
          <h4>Product</h4>
          <a href="/agents">Agents</a>
          <a href="/portfolio">Portfolio</a>
          <a href="/vault">Vault</a>
          <a href="/#roadmap">Roadmap</a>
        </div>
        <div>
          <h4>Learn</h4>
          <a href="/docs">Docs</a>
          <a href="/#faq">FAQ</a>
          <a href="https://x.com/NextraAgent" target="_blank" rel="noopener noreferrer">
            X (Twitter)
          </a>
        </div>
      </div>
    </footer>
  );
}
