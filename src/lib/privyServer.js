// Minimal Privy server helpers (no SDK): verify access tokens, read users,
// and sign transactions from users' embedded wallets with the app's authorization key.
import crypto from "crypto";

export const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmwlt50pp04c00gle2uwinvg5";
const API = "https://api.privy.io";

const basic = () => "Basic " + Buffer.from(`${APP_ID}:${process.env.PRIVY_APP_SECRET || ""}`).toString("base64");
const b64url = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

// RFC 8785 canonical JSON for the plain objects we send.
export function canon(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  return (
    "{" +
    Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canon(v[k]))
      .join(",") +
    "}"
  );
}

let jwks = null;
let jwksAt = 0;
async function verificationKey(kid) {
  if (process.env.PRIVY_VERIFICATION_KEY) {
    return crypto.createPublicKey(process.env.PRIVY_VERIFICATION_KEY.replace(/\\n/g, "\n"));
  }
  if (!jwks || Date.now() - jwksAt > 3600_000) {
    const r = await fetch(`https://auth.privy.io/api/v1/apps/${APP_ID}/jwks.json`, { cache: "no-store" });
    if (!r.ok) throw new Error("Could not load Privy verification key");
    jwks = (await r.json()).keys || [];
    jwksAt = Date.now();
  }
  const jwk = jwks.find((k) => !kid || k.kid === kid) || jwks[0];
  if (!jwk) throw new Error("No Privy verification key");
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

// Returns the user's Privy DID if the access token is valid.
export async function verifyAccessToken(token) {
  const [h, p, s] = String(token || "").split(".");
  if (!h || !p || !s) throw new Error("Not logged in");
  const header = JSON.parse(b64url(h).toString());
  const claims = JSON.parse(b64url(p).toString());
  const key = await verificationKey(header.kid);
  const ok = crypto.verify("sha256", Buffer.from(`${h}.${p}`), { key, dsaEncoding: "ieee-p1363" }, b64url(s));
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!ok || claims.iss !== "privy.io" || !aud.includes(APP_ID) || !claims.exp || claims.exp * 1000 < Date.now()) {
    throw new Error("Session expired. Please log in again.");
  }
  return claims.sub;
}

export async function getPrivyUser(did) {
  const r = await fetch(`${API}/v1/users/${encodeURIComponent(did)}`, {
    headers: { Authorization: basic(), "privy-app-id": APP_ID },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Privy user lookup failed (${r.status})`);
  return r.json();
}

export function embeddedWallet(user) {
  return (user?.linked_accounts || []).find(
    (a) => a.type === "wallet" && (a.wallet_client_type === "privy" || a.connector_type === "embedded") && (!a.chain_type || a.chain_type === "ethereum")
  );
}

function authSignature(url, body) {
  const raw = process.env.PRIVY_AUTHORIZATION_KEY;
  if (!raw) throw new Error("PRIVY_AUTHORIZATION_KEY is not set");
  const der = Buffer.from(raw.replace(/^wallet-auth:/, "").replace(/\s+/g, ""), "base64");
  const key = crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  const payload = { version: 1, method: "POST", url, body, headers: { "privy-app-id": APP_ID } };
  return crypto.sign("sha256", Buffer.from(canon(payload)), key).toString("base64");
}

// Signs an EIP-1559 transaction with the user's embedded wallet. Returns the raw signed tx.
export async function signTransaction(walletId, transaction) {
  const url = `${API}/v1/wallets/${walletId}/rpc`;
  const body = { method: "eth_signTransaction", params: { transaction } };
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basic(),
      "privy-app-id": APP_ID,
      "privy-authorization-signature": authSignature(url, body),
      "Content-Type": "application/json",
    },
    body: canon(body),
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Privy signing failed (${r.status}): ${d?.error || d?.message || "unknown"}`);
  const signed = d?.data?.signed_transaction;
  if (!signed) throw new Error("Privy returned no signed transaction");
  return signed;
}
