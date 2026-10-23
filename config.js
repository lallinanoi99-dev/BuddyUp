// BuddyUp config — the one place to edit after deploying.
window.BUDDYUP_CONFIG = {
  // Paste the BOT Chain MAINNET contract address here after deploying contracts/BuddyUp.sol.
  // While this is empty the site runs in DEMO MODE (posts stored in the browser only, no wallet needed).
  // The footer's shortened address + "View on explorer" link are built from this one value.
  MAINNET_CONTRACT_ADDRESS: "0xCc95bFC98aA3cC93D9c522Db98b686D950d50694",

  CHAIN_ID: 677,
  CHAIN_NAME: "BOT Chain",
  RPC_URL: "https://rpc.botchain.ai",
  EXPLORER_URL: "https://scan.botchain.ai",
  SITE_URL: "https://botchain.ai",
  // Used only for wallet_addEthereumChain. TODO: confirm the real native currency details for BOT Chain.
  NATIVE_CURRENCY: { name: "BOT", symbol: "BOT", decimals: 18 },
};
