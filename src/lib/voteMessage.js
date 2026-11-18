// Shared by the vote API and the browser so both sign/verify the exact same text.
export function voteMessage(round, address, symbol) {
  return `Nextra Vault vote\nRound: ${round}\nStock: ${symbol}\nWallet: ${address.toLowerCase()}`;
}
