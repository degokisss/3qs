# QSanguosha — Lãng Khách · Quốc Chiến

A Vietnamese fork of [QSanguosha](https://github.com/Mogara/QSanguosha) / [QSanguosha-For-Hegemony](https://github.com/Mogara/QSanguosha-For-Hegemony) — an open-source fan implementation of the card game **三国杀 (Sān Guó Shā / Tam Quốc Sát)** — plus a from-scratch **web port** so it can be played in a browser instead of the original Qt/C++ Windows desktop client.

This repo has two very different things in it:

1. **The original desktop game** (repo root) — a compiled Windows build (`QSanguosha.exe` + Qt DLLs), the Lua AI/extension scripts (`lua/`, `extensions/`), and every art/audio asset (`image/`, `hero-skin/`, `audio/`, `font/`). There is **no C++ engine source** in this repo — the game logic itself only exists compiled into `QSanguosha.exe`.
2. **`webport/`** — a complete TypeScript reimplementation of the game engine (state machine, cards, skills, combat, role assignment/win conditions) written from scratch against the upstream C++ source for reference, plus a small WebSocket server and a zero-build-step HTML/JS client. This is what you actually run to play in a browser.

Game mode: standard **Role/Identity mode** (身份场) — Lord (Chủ công) + Loyalist (Trung thần) + Rebel (Phản tặc) + Renegade (Nội gián), 5–10 players.

## Play it

```
cd webport
npm install
npm run server   # serves the web client AND the game's WebSocket API, both on :8787
```

Then open `http://localhost:8787/` — anyone on the same network can join at `http://<your-ip>:8787/`. See **[webport/README.md → Deploy](webport/README.md#deploy)** for putting this on a real domain/VPS/PaaS so people outside your LAN can join too.

No build step needed for local dev (`npm run server` runs the TypeScript directly via `tsx`); `npm run build` compiles to `webport/dist/` if you want to ship plain JS instead.

## What's actually implemented

The web port is an active, ongoing reimplementation — not a 1:1 port of the compiled binary (which isn't possible without the original source). Current status, in short:

- Full turn/phase state machine, all 4 roles, 5–10 player tables.
- The complete Standard card pool actually dealt (85 cards: Slash-family, Jink, Peach, Analeptic, 8 trick cards, 16 equips), real Slash/Jink/Duel/dying-and-Peach-rescue resolution (including ally rescue, not just self-rescue).
- 44 of the 46 investigated Standard generals and their skills (the rest need subsystems — judge-area/delayed tricks, armor, pindian, dual-generals — not built yet; see `webport/README.md` for the exact list and reasoning per general).
- A lobby with multiple concurrent rooms, room codes, claimable seats (any unclaimed seat plays itself via a simple bot), a full turn-order general-pick screen, and an interactive draw-your-own-card / play-your-own-cards flow for claimed seats — not just yes/no prompts.

For the detailed, milestone-by-milestone engineering log (what was ported from which upstream source file, what was deliberately simplified and why, test coverage, verification evidence) see **[`webport/README.md`](webport/README.md)**.

## License

- **Code** (both the original C++ engine this was forked from, and this repo's new TypeScript web port): **GPLv3**, plus Mogara's **Commercial Forbidden Restriction (MCFR)** — see [`LICENSE`](LICENSE) and [`MCFR`](MCFR). In short: free to use/modify/redistribute, **not for commercial use**.
- **Art/audio assets** (`image/`, `hero-skin/`, `audio/`, `font/`): **CC BY-NC-ND 4.0** as shipped by the upstream project — non-commercial, no derivatives, self-host only. Don't redistribute these separately from the project or use them commercially.

This is a non-commercial fan project. 三国杀/Sān Guó Shā is a commercial product of YOKA Games; this project is not affiliated with or endorsed by them.

## Credits

Original QSanguosha / QSanguosha-Hegemony by **Mogara** and contributors (see `lua/about_us.lua`). Vietnamese fork "Lãng Khách" by the credited contributors in that same file. Web port: this repo's `webport/` directory.
