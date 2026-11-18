"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { defineChain } from "viem";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  network: "robinhood-chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
});

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmwlt50pp04c00gle2uwinvg5";

export default function Providers({ children }) {
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        loginMethods: ["email", "google", "twitter", "wallet"],
        appearance: { theme: "light", accentColor: "#5DA000", landingHeader: "Log in to Nextra", showWalletLoginFirst: false },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
        defaultChain: robinhoodChain,
        supportedChains: [robinhoodChain],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
