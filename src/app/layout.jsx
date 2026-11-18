import "./theme.css";
import "./theme2.css";
import "./theme3.css";
import "./overrides.css";

export const metadata = {
  metadataBase: new URL("https://www.nextra-agent.xyz"),
  title: "Nextra — Trading agents on Robinhood Chain",
  description: "Trading agents that follow your rules, and a Vault that stacks tokenized stocks. Built on Robinhood Chain.",
  openGraph: {
    title: "Nextra: agents that trade your rules",
    description: "Sentry & Tempo trade from your own wallet. A Vault that drops tokenized stocks to $NEXTRA holders.",
    url: "https://www.nextra-agent.xyz",
    siteName: "Nextra",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@NextraAgent",
    title: "Nextra: agents that trade your rules",
    description: "Sentry & Tempo trade from your own wallet. A Vault that drops tokenized stocks to $NEXTRA holders.",
  },
};

export const viewport = {
  themeColor: "#F4EFE4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
