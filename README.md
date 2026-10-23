# BuddyUp 🫧

Post a "looking for buddies" card — hackathon teammates, a study group, a gym partner — set the number of spots, and let people join until it's full. Every post and every join is recorded on **BOT Chain**, with **Pip**, our little buddy, cheering you on.

- **Live site:** _add the GitHub Pages / custom-domain URL here_
- **Mainnet contract:** `0xCc95bFC98aA3cC93D9c522Db98b686D950d50694` · https://scan.botchain.ai/address/0xCc95bFC98aA3cC93D9c522Db98b686D950d50694
- **Chain:** BOT Chain mainnet, chain ID `677`, RPC `https://rpc.botchain.ai` (testnet: chain ID `968`, RPC `https://rpc.bohr.life`, scan.bohr.life)

## What's in the folder

| Path | What it is |
| --- | --- |
| `index.html` | The whole site: hero, Pip Crew, board, live stats, how it works, safety + FAQ, BOT Chain footer, dialogs |
| `styles.css` | All styling (warm-grey canvas, condensed caps type, pill buttons) |
| `app.js` | Wallet connect, board, create / join / leave / close, `?post=` pages, ethers v6 + demo data layer |
| `config.js` | **One place to edit:** `MAINNET_CONTRACT_ADDRESS` (+ chain/RPC/explorer) |
| `pip/pip.js` | Pip generator — original vector mascot (5 outfits × poses, seats, heads) |
| `contracts/BuddyUp.sol` | The Solidity ^0.8.20 contract (no tokens, payments or admin) |
| `assets/botchain-logo.png`, `assets/botchain-mark.png` | Official BOT Chain wordmark (white, for dark backgrounds) and mark, from botchain.ai |

## Run locally

Open `index.html` through a local server (not `file://`), e.g.:

```bash
python3 -m http.server 8765
# open http://127.0.0.1:8765
```

While `MAINNET_CONTRACT_ADDRESS` in `config.js` is empty the site runs in **demo mode**: seeded posts, data kept in `localStorage`, three switchable demo wallets (banner at the top). Use it to click through the full flow before deploying.

## Deploy the contract

1. Open `contracts/BuddyUp.sol` in Remix, compile with 0.8.20+.
2. Deploy to **testnet** first (chain 968), try the flow, then deploy to **mainnet** (chain 677).
3. Paste the mainnet address into `config.js` → `MAINNET_CONTRACT_ADDRESS`, and into this README. The footer's `0x12AB…9F3C` tile and "View on explorer" link update from that one value, and demo mode switches off.
4. Confirm `NATIVE_CURRENCY` in `config.js` (used only when MetaMask has to add the network).

## Contract rules

- One join per wallet per post; the host can't join their own post.
- Can't join a post that's full, closed or already past its date.
- Leaving is allowed only before the date; it frees the seat. Spots can't change after posting.
- Only an optional public contact handle is stored — no private details.
- Views: `getPost`, `getMembers`, `getPosts(from,count)`, `hostingOf`, `joinedOf`, `stats()` (posts, joins, full posts).
- "Buddies matched" on the home page is computed in the browser: for every full post, its seats + the host.

## Publish

Push the folder to GitHub and enable Pages (root). Add a `CNAME` file for the custom domain.

## Credits

Pip and the Pip Crew are original art. BOT Chain name and logo belong to BOT Chain.
