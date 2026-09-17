// Role assignment + win-condition check for classic Identity mode (Chủ công / Trung thần /
// Phản tặc / Nội gián). Ported conceptually from src/server/gamerule.cpp GameRule::effect's
// BeforeGameOverJudge handler, but the role COUNT TABLE below is the officially published
// Sanguosha role-mode table (sanguosha.cn "mode-info-1"), not QSanguosha-For-Hegemony's
// engine.cpp table -- that table degenerates to 1 lord + (n-1) renegade for "0Xp" modes and is
// not the balanced mode being ported here (see types.ts Role doc comment).
//
// Milestone 23 adds a second section below for Hegemony (国战 / Quốc Chiến) mode: kingdom-team
// assignment (with the official Ambitionist overflow rule) + its own win condition. Both modes
// share a single `isAlly`/`alliesOf` -- see that function's doc comment for how.

import { GamePlayer } from "./player.js";
import { GameMode, Role } from "./types.js";
import { shuffle } from "./card.js";

// [lord, loyalist, rebel, renegade] counts by player count.
const ROLE_COUNTS: Record<number, [number, number, number, number]> = {
  5: [1, 1, 2, 1],
  6: [1, 1, 3, 1],
  7: [1, 2, 3, 1],
  8: [1, 2, 4, 1],
  9: [1, 3, 4, 1],
  10: [1, 3, 4, 2],
};

export function assignRoles(players: GamePlayer[], rng: () => number = Math.random): void {
  const counts = ROLE_COUNTS[players.length];
  if (!counts) {
    throw new Error(`no role table for ${players.length} players (supported: 5-10)`);
  }
  const [lordN, loyalistN, rebelN, renegadeN] = counts;
  const pool: Role[] = [
    ...Array(lordN).fill(Role.Lord),
    ...Array(loyalistN).fill(Role.Loyalist),
    ...Array(rebelN).fill(Role.Rebel),
    ...Array(renegadeN).fill(Role.Renegade),
  ];
  const shuffled = shuffle(pool, rng);
  players.forEach((player, i) => {
    player.role = shuffled[i];
    // roleShown stays false here (GamePlayer's default) -- assignRoles() runs at Room
    // construction time, in the lobby, before any seat is claimed or the match started. The
    // lord's identity only becomes public once the match actually begins; see pickGenerals().
  });
}

/** `winners` holds Role values for Identity mode, living player IDs for Hegemony mode (both are
 *  plain strings on the wire/in the log -- see room.ts's `killPlayer` and `factionLabelVI`
 *  below for how each mode turns its own `winners` shape into a human-readable label). */
export type WinResult = { winners: string[] } | null;

/** Vietnamese display labels for Role, mirroring the client's own `ROLE_LABEL` (public/index.html)
 *  -- used by room.ts to translate the few log lines that embed a raw `player.role`/winners list. */
export const ROLE_LABEL_VI: Record<Role, string> = {
  [Role.Lord]: "Chủ công",
  [Role.Loyalist]: "Trung thần",
  [Role.Rebel]: "Phản tặc",
  [Role.Renegade]: "Nội gián",
};

/**
 * Official Identity-mode win conditions, checked in this exact precedence order:
 * 1. Renegade is the LAST player left alive (everyone else -- Lord, every Loyalist, every
 *    Rebel -- is dead) -> Renegade wins ALONE. This is the Renegade's only win path: survive
 *    everyone else, including outliving the rebels they may have helped kill earlier. In
 *    practice this is almost always the Renegade landing the final blow on the Lord in a 1-on-1
 *    endgame (every Loyalist/Rebel already dead), but the check itself is "am I the sole
 *    survivor", not "did I kill the Lord" -- checked FIRST so it takes precedence over case 2
 *    below whenever the Lord's death happens to be that exact final death.
 * 2. Lord is dead (and case 1 didn't already fire) -> Rebels win, REGARDLESS of who actually
 *    delivered the killing blow -- a Rebel, a Loyalist's friendly fire, a self-inflicted death
 *    with no credited killer, even the Renegade striking early while Rebels/Loyalists are still
 *    alive, all end the game the same way here. The Renegade does NOT also win in this case --
 *    Rebel+Renegade is never a valid win pair; the Renegade's only win is case 1.
 * 3. No Rebels and no Renegade left alive (Lord still alive) -> Lord + Loyalist win.
 * Otherwise the game continues.
 */
export function checkWinCondition(players: GamePlayer[]): WinResult {
  const alive = players.filter((p) => p.alive);

  if (alive.length === 1 && alive[0].role === Role.Renegade) return { winners: [Role.Renegade] };

  const lordAlive = alive.some((p) => p.role === Role.Lord);
  if (!lordAlive) return { winners: [Role.Rebel] };

  const rebelsAlive = alive.some((p) => p.role === Role.Rebel);
  const renegadeAlive = alive.some((p) => p.role === Role.Renegade);
  if (!rebelsAlive && !renegadeAlive) return { winners: [Role.Lord, Role.Loyalist] };

  return null; // game continues
}

/**
 * "Ally" for skills that reference teammates (e.g. Ganfuren's Shushen, Tianfeng's Suishi).
 * Hegemony mode (Milestone 23) sets every player's `faction` during `pickGenerals` (see this
 * file's Hegemony section below) -- when either side has one, faction equality decides it
 * outright (an empty `faction` never matches another empty one, so an unset player is never
 * accidentally allied). Identity mode never sets `faction`, so it falls through unchanged to
 * the original Role-based partition: Lord+Loyalist are mutual allies, Rebels are mutual allies
 * with each other, Renegade has none (plays solo until the very end).
 */
export function isAlly(a: GamePlayer, b: GamePlayer): boolean {
  if (a === b) return false;
  if (a.faction || b.faction) return a.faction !== "" && a.faction === b.faction;
  if (a.role === Role.Renegade || b.role === Role.Renegade) return false;
  if (a.role === Role.Rebel) return b.role === Role.Rebel;
  return a.role === Role.Lord || a.role === Role.Loyalist ? b.role === Role.Lord || b.role === Role.Loyalist : false;
}

export function alliesOf(player: GamePlayer, alive: GamePlayer[]): GamePlayer[] {
  return alive.filter((p) => isAlly(player, p));
}

// ---------------------------------------------------------------------------------------------
// Hegemony (国战 / Quốc Chiến) mode -- Milestone 23.
//
// Ported ruleset, confirmed against the official rulebook (gltjk.com/sanguosha/rules, the
// modern sanguosha.cn-sourced 3.0 rule set) and Mogara/QSanguosha-For-Hegemony's own README
// (the repo this whole engine is ported from is literally named "For-Hegemony"):
//   - 4 kingdoms (Wei/Shu/Wu/Qun), each a real team -- not just Wei/Shu/Wu vs. a "no team" Qun.
//   - A kingdom's team size is capped at floor(playerCount/2) ("không quá một nửa bàn"). Whoever
//     WOULD be the overflow player past that cap for their kingdom becomes an Ambitionist (Dã
//     Tâm Gia) instead: a solo faction of exactly one, allied with nobody (not even another
//     Ambitionist), who must eliminate every other living player alone to win.
//   - Win condition: once every living player shares one faction, that faction wins (the whole
//     team, for Wei/Shu/Wu/Qun; the sole survivor, for an Ambitionist -- both are literally the
//     same "only one faction left standing" check, see `checkHegemonyWinCondition`).
//
// Deliberately NOT ported (each is a genuinely separate subsystem, same one-line-per-deferral
// convention as every general/skill gap noted elsewhere in this repo). **Addendum 1:** the
// dual-general (主将/副将) stat/kingdom-pairing IS now ported -- each player drafts 2 SAME-kingdom
// generals, HP/skills/gender combine per the real rule (see `combineHegemonyHp` below and
// `Room.pickGenerals`'s Hegemony branch). **Addendum 2:** the face-down/face-up (暗置/明置)
// reveal-TIMING mechanic is now ALSO ported -- both generals start hidden; kingdom (and
// therefore `faction`/`isAmbitionist`, only assigned the FIRST time either general reveals) is
// unknown to other players until then; `checkHegemonyWinCondition` can't conclude while anyone
// alive is still hidden (see `Room.runHegemonyReveal`, `Phase.RoundStart`). **Addendum 3:**
// skill-AVAILABILITY gating IS also now ported -- `GamePlayer.skills` (see player.ts) is itself
// a reveal-gated getter, so every one of the ~40 existing mechanical consumers across skill.ts/
// combat.ts/trick.ts/room.ts respects reveal state automatically, no call-site changes needed;
// `allSkills` is the escape hatch for the few DISPLAY consumers that want the full declared kit
// regardless (a player's own hero panel). **Addendum 4:** "Ao Chiến" (鏖战, the late-game rule
// restricting Peach to Slash/Jink-only once ≤4 players remain with no faction holding >1
// survivor) IS fully ported, INCLUDING the Slash/Jink substitution half (not just the
// heal-disable half) -- `findSlashLikeCard`/`findJinkLikeCard`/`allSlashLikeCards` (combat.ts)
// all take an `aoChienActive` param that makes a held Peach match, threaded through every real
// gameplay call site (resolveSlash's dodge search, Room's bot/freeform Slash search, Duel's
// forced exchange, Savage Assault/Archery Attack's discard-or-take-damage choice, Jiaxu's
// Luanwu). **Addendum 5:** 珠联璧合 (companion pairs) IS now ported too -- turned out NOT to need
// fabricated data after all: read directly off the real upstream source
// (github.com/Mogara/QSanguosha-For-Hegemony, `dev` branch, `src/package/standard-{shu,wei,wu,
// qun}-generals.cpp`'s `addCompanion()` calls + `src/server/room.cpp`'s `GeneralShown`/
// `CompanionEffect` handling in `gamerule.cpp`, which this repo doesn't vendor but IS publicly
// readable). See `COMPANION_PAIRS`/`isCompanionPair` below for the 9 pairs where BOTH sides are
// actually in this port's 44-general roster (many more exist upstream between a ported general
// and an unported one, e.g. Liu Bei/Sun Quan/Pang Tong/Xiahou Yuan/Yuan Shao are companions of
// several ported generals but aren't themselves ported -- correctly excluded, since the bonus
// needs BOTH halves of your own drafted pair to be companions with each other). Still NOT
// ported:
//   - 阵法技 (formation skills), 围攻/队列 (pincer/formation positional mechanics) -- confirmed
//     live against the real upstream source this time (not just grepping what this repo already
//     ported): `src/package/formation.cpp` is a real, substantial (53KB) SEPARATE package, but
//     its generals are NOT any of the 44 already ported here (checked by name) -- porting
//     formation-skill generals means porting NEW generals from scratch, a different kind of gap
//     than "wire up a mechanic the existing roster already needs".
//   - Kingdom-wide LORD-SKILL bonuses (e.g. `lord->hasLordSkill("shouyue")`-gated branches on
//     Paoxiao/Wusheng, stripped since Milestone 2/2.6 -- see skill.ts's header): each kingdom's
//     "lord" general grants a team-wide passive once shown; a genuinely separate Hegemony-only
//     subsystem from everything else in this section (needs a kingdom-lord concept distinct
//     from any individual player identity), confirmed real via the same source dive, still out
//     of scope.

export const KINGDOMS = ["wei", "shu", "wu", "qun"] as const;

export const KINGDOM_LABEL_VI: Record<string, string> = {
  wei: "Ngụy",
  shu: "Thục",
  wu: "Ngô",
  qun: "Quần",
};

export const AMBITIONIST_LABEL_VI = "Dã Tâm Gia";

/** Per-player faction label for log lines: Identity mode's existing Role label, or Hegemony
 *  mode's kingdom name / Ambitionist marker / "Ẩn" (still hidden -- kingdom not yet known,
 *  `faction` still ""). 3 call sites -- room.ts's `killPlayer` death line, its per-turn `---
 *  Lượt N ---` banner, and `pickGenerals`'s post-draft summary line -- all need the SAME
 *  mode+Ambitionist+hidden branch, so it's shared here rather than duplicated. */
export function factionLabelVI(mode: GameMode, player: GamePlayer): string {
  if (mode === GameMode.Hegemony) {
    if (player.isAmbitionist) return AMBITIONIST_LABEL_VI;
    if (player.faction === "") return "Ẩn";
    return KINGDOM_LABEL_VI[player.faction] ?? player.faction;
  }
  return ROLE_LABEL_VI[player.role];
}

/**
 * Hegemony total HP for a main+deputy pair: `floor((soloHp1+soloHp2)/2)`, with an unpaired
 * leftover half (odd `soloHp1+soloHp2`) granting a bonus card draw instead of a fractional HP
 * point. Confirmed EXACTLY against the real upstream source (not just the official rule text):
 * `src/server/room.cpp`'s game-start setup literally does
 * `int max_hp = general1->getMaxHpHead() + general2->getMaxHpDeputy(); player->setMaxHp(max_hp
 * / 2); setPlayerMark(player, "HalfMaxHpLeft", max_hp % 2);` -- where `getMaxHpHead`/
 * `getMaxHpDeputy` both resolve to the general's own plain printed HP at initial setup (no
 * awakening-skill adjustment yet), i.e. exactly this repo's existing `GeneralDef.maxHp`. Real
 * rule difference this port simplifies: `HalfMaxHpLeft`'s bonus draw is actually a CHOICE
 * (`askForSkillInvoke`), and fires the moment a player's SECOND general reveals (not at draft
 * time) -- see `Room.runHegemonyReveal`'s companion-bonus handling, which resolves both this
 * and the companion-pair bonus together at that exact moment, matching
 * `gamerule.cpp`'s `GeneralShown` handler 1:1.
 */
export function combineHegemonyHp(soloHp1: number, soloHp2: number): { maxHp: number; bonusDraw: boolean } {
  const totalHalves = soloHp1 + soloHp2;
  return { maxHp: Math.floor(totalHalves / 2), bonusDraw: totalHalves % 2 !== 0 };
}

/**
 * 珠联璧合 (companion) pairs -- read directly off the real upstream source's `addCompanion()`
 * calls (`src/package/standard-{shu,wei,wu,qun}-generals.cpp`), filtered to the 9 pairs where
 * BOTH generals are actually in this port's 44-general roster (a companion bonus needs both
 * halves of your OWN drafted main+deputy pair to be companions with each other -- many more
 * companion links exist upstream between a ported general and an unported one, e.g. Liu Bei,
 * which are correctly excluded here since the other half can never be drafted). Symmetric --
 * `isCompanionPair` checks both directions, matching upstream `General::getCompanions()`'s own
 * bidirectional search.
 */
export const COMPANION_PAIRS: [string, string][] = [
  ["zhugeliang", "huangyueying"],
  ["zhaoyun", "liushan"],
  ["huangzhong", "weiyan"],
  ["menghuo", "zhurong"],
  ["caocao", "dianwei"],
  ["caocao", "xuchu"],
  ["caopi", "zhenji"],
  ["zhouyu", "huanggai"],
  ["lvbu", "diaochan"],
];

export function isCompanionPair(mainGeneral: string, deputyGeneral: string): boolean {
  return COMPANION_PAIRS.some(
    ([a, b]) => (a === mainGeneral && b === deputyGeneral) || (a === deputyGeneral && b === mainGeneral),
  );
}

// Max team size before further same-kingdom players become Ambitionists instead is
// floor(playerCount/2) (gltjk.com/sanguosha/rules/glossary/guo.html's 明置 entry: "当一名角色第一
// 次明置武将牌后，其势力即与此武将牌相同或成为野心家"; the exact "超过总人数一半"/floor(n/2) threshold is
// also independently confirmed by the modern client's own 6/7p-4th-same-kingdom and
// 8/9p-5th-same-kingdom examples, both of which equal floor(n/2)+1st-overflow) -- computed
// inline at Room.pickGenerals's one call site, not worth a named wrapper around one division.

/**
 * Decides ONE player's faction the moment their kingdom becomes known (this port: the instant
 * they pick a general, since there's no separate hidden-kingdom reveal step -- see this
 * section's header). Mutates `kingdomCounts` in place (the running per-kingdom team-size tally
 * `Room.pickGenerals` threads through its whole turn-order pick loop) and returns the faction to
 * assign. Must be called in the SAME order players actually pick in -- the rule is inherently
 * sequential ("whoever overflows the quota" depends on who already claimed a kingdom's slots).
 */
export function assignHegemonyFaction(
  playerId: string,
  kingdom: string,
  kingdomCounts: Record<string, number>,
  quota: number,
): { faction: string; isAmbitionist: boolean } {
  const count = kingdomCounts[kingdom] ?? 0;
  if (count < quota) {
    kingdomCounts[kingdom] = count + 1;
    return { faction: kingdom, isAmbitionist: false };
  }
  return { faction: `ambitionist:${playerId}`, isAmbitionist: true };
}

/**
 * Hegemony win condition: the game ends the instant every still-living player shares a single
 * `faction` -- for a team kingdom that's every one of its living members winning together, for
 * an Ambitionist (whose `faction` is unique to them, see `assignHegemonyFaction`) that's
 * necessarily them alone, matching the official "must eliminate everyone else, sole survivor"
 * rule with no special-case branch needed. Returns the same `WinResult` shape Identity mode
 * uses (`winners` here holds living PLAYER IDS, not Role values -- see room.ts/server.ts, which
 * already treat `winners` as opaque strings for logging/broadcast).
 *
 * Real rule: "victory conditions can only be assessed once all characters have determined their
 * force" -- a still-hidden (unrevealed) living player has `faction === ""` and blocks the check
 * entirely (their force isn't determined yet), UNLESS they're the sole living player: with
 * nobody left to possibly contest it, this port lets them win immediately regardless of reveal
 * state, rather than literally soft-locking the match on a human who declines to ever reveal
 * (see `Room.runHegemonyReveal`'s header for why bots never hit this edge case at all).
 */
export function checkHegemonyWinCondition(players: GamePlayer[]): WinResult {
  const alive = players.filter((p) => p.alive);
  if (alive.length === 0) return null;
  if (alive.length === 1) return { winners: [alive[0].id] };
  if (alive.some((p) => p.faction === "")) return null;
  if (alive.some((p) => p.faction !== alive[0].faction)) return null;
  return { winners: alive.map((p) => p.id) };
}
