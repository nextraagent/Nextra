import Nav from "../Nav";
import Footer from "../Footer";
import Providers from "../agents/Providers";
import PortfolioClient from "./PortfolioClient";
import "../agents/agents.css";
import "./portfolio.css";

export const metadata = {
  title: "Nextra Portfolio — Your wallet on Robinhood Chain",
  description: "See your ETH and stock tokens, send funds, and export your wallet key.",
};

export default function PortfolioPage() {
  return (
    <>
      <Nav active="portfolio" />
      <main className="wrap">
        <Providers>
          <PortfolioClient />
        </Providers>
      </main>
      <Footer />
    </>
  );
}
