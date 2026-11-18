import Nav from "../Nav";
import Footer from "../Footer";
import AgentConsole from "./AgentConsole";
import Providers from "./Providers";
import "./agents.css";

export const metadata = {
  title: "Nextra Agents — Sentry, Tempo, Perch, Echo",
  description:
    "Log in, pick an agent and set your rules: Sentry (TP/SL), Tempo (DCA/TWAP), Perch (limit orders) and Echo (copy trading). Built on Robinhood Chain.",
};

export default function AgentsPage() {
  return (
    <>
      <Nav active="agents" />
      <main className="wrap">
        <Providers>
          <AgentConsole />
        </Providers>
      </main>
      <Footer />
    </>
  );
}
