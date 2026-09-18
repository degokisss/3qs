# QSanguosha — Lãng Khách · Quốc Chiến

A Vietnamese fork of [QSanguosha](https://github.com/Mogara/QSanguosha) / [QSanguosha-For-Hegemony](https://github.com/Mogara/QSanguosha-For-Hegemony) — an open-source fan implementation of the card game **三国杀 (Sān Guó Shā / Tam Quốc Sát)** — playable directly in a browser, no install required.

The whole game (engine, WebSocket server, HTML/JS client) lives in **[`webport/`](webport/)**, a TypeScript implementation of the game rules written from scratch: state machine, cards, skills, combat, role assignment and win conditions.

Two selectable game modes: standard **Role/Identity mode** (身份场) — Lord (Chủ công) + Loyalist (Trung thần) + Rebel (Phản tặc) + Renegade (Nội gián) — and **Hegemony / Quốc Chiến mode** (国战) — 4 kingdom teams (Ngụy/Thục/Ngô/Quần) with the official Ambitionist (Dã Tâm Gia) overflow rule. Identity mode supports 5–10 players; Hegemony mode supports 5–12.

## Play it

```
cd webport
npm install
npm run server   # serves the web client AND the game's WebSocket API, both on :8787
```

Then open `http://localhost:8787/` — anyone on the same network can join at `http://<your-ip>:8787/`. See **[webport/README.md → Deploy](webport/README.md#deploy)** for putting this on a real domain/VPS/PaaS so people outside your LAN can join too.

No build step needed for local dev (`npm run server` runs the TypeScript directly via `tsx`); `npm run build` compiles to `webport/dist/` if you want to ship plain JS instead.

## What's actually implemented

This is an active, ongoing reimplementation of the game rules. Current status, in short:

- Full turn/phase state machine, all 4 roles, 5–10 player tables.
- The complete Standard card pool actually dealt (108 cards: Slash-family, Jink, Peach, Analeptic, 19 trick cards, 20 equips including all 4 Standard armors), real Slash/Jink/Duel/dying-and-Peach-rescue resolution (including ally rescue, not just self-rescue), plus a full reactive Nullification/HegNullification counter-play window (any trick card in flight can be cancelled, itself counter-cancellable) and a private per-player info channel (KnownBoth).
- All 60 real Standard generals (15 per kingdom — verified directly against the upstream C++ source) and their portable skills — the full roster is ported; a small number of individual sibling skills across the roster remain deferred where they need a subsystem this engine genuinely doesn't have (gender/face-up-down state, equip-stealing, ignoring a target's armor specifically, or a re-hiding action this port's own reveal-timing simplification makes unobservable) — see `webport/README.md`'s Milestone 24–27 sections for the exact per-general reasoning. Several real pre-existing engine bugs were found and fixed along the way (Leiji crediting the wrong player, a viewAs-Indulgence card vanishing without a trace, a mid-resolution equip target re-resolution race, a test helper double-counting a virtual card, an AOE resolution outliving an already-decided win condition, and others) — see the milestone log for each one's own root-cause writeup.
- Hegemony/Quốc Chiến mode: kingdom-team setup + the official Ambitionist overflow rule + faction-based ally/win-condition logic + the real dual-general (主将/副將) system (each player drafts 2 same-kingdom generals, HP/skills/gender combine per the official rule) + the face-down/face-up (暗置/明置) reveal-TIMING mechanic (both generals start hidden — real fog-of-war, not just a client-side toggle — until each player chooses to reveal, which is also when their kingdom/Ambitionist status is finally decided, AND when their skills actually become usable — a hidden general's abilities are genuinely inert, not just visually hidden) + "Ao Chiến" (鏖战, once the table narrows to ≤4 distinct factions Peach stops healing and instead becomes playable as Slash or Jink) + 珠联璧合 companion-pair bonuses (a recover-or-draw choice, verified against the real upstream C++ source for the 9 companion pairs where both generals are actually ported here) + the leftover-half-HP bonus draw, both offered at the real trigger moment (the instant a player's 2nd general reveals), selectable per room from the lobby. Not built (checked directly against the real upstream C++ source, not just this repo's own roster): formation skills (阵法技/围攻/队列, a genuinely separate package of unported generals) and kingdom-wide lord-skill team bonuses (e.g. `shouyue`).
- A lobby with multiple concurrent rooms, room codes, claimable seats (any unclaimed seat plays itself via a simple bot), a full turn-order general-pick screen, and an interactive draw-your-own-card / play-your-own-cards flow for claimed seats — not just yes/no prompts.
- A browsable in-client "Thư viện" (Library) reference of every ported general/skill/card, and a "Luật chơi" (Rules) panel explaining each game mode's actual rules — both reachable from the header at any time, no room needed.

For the detailed, milestone-by-milestone engineering log (what was ported from which upstream source file, what was deliberately simplified and why, test coverage, verification evidence) see **[`webport/README.md`](webport/README.md)**.

## License

- **Code**: **GPLv3**, plus Mogara's **Commercial Forbidden Restriction (MCFR)** — see [`LICENSE`](LICENSE) and [`MCFR`](MCFR). In short: free to use/modify/redistribute, **not for commercial use**.
- **Art/audio assets** (`image/`, `hero-skin/`, `audio/`, `font/`): **CC BY-NC-ND 4.0** as shipped by the upstream project — non-commercial, no derivatives, self-host only. Don't redistribute these separately from the project or use them commercially.

This is a non-commercial fan project. 三国杀/Sān Guó Shā is a commercial product of YOKA Games; this project is not affiliated with or endorsed by them.

## Credits

Original QSanguosha / QSanguosha-Hegemony by **Mogara** and contributors (see `lua/about_us.lua`). Vietnamese fork "Lãng Khách" by the credited contributors in that same file. Web port: this repo's `webport/` directory.
