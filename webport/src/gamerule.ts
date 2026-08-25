// Role assignment + win-condition check for classic Identity mode (Chủ công / Trung thần /
// Phản tặc / Nội gián). Ported conceptually from src/server/gamerule.cpp GameRule::effect's
// BeforeGameOverJudge handler, but the role COUNT TABLE below is the officially published
// Sanguosha role-mode table (sanguosha.cn "mode-info-1"), not QSanguosha-For-Hegemony's
// engine.cpp table -- that table degenerates to 1 lord + (n-1) renegade for "0Xp" modes and is
// not the balanced mode being ported here (see types.ts Role doc comment).

import { GamePlayer } from "./player.js";
import { Role } from "./types.js";
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

export type WinResult = { winners: Role[] } | null;

/** Vietnamese display labels for Role, mirroring the client's own `ROLE_LABEL` (public/index.html)
 *  -- used by room.ts to translate the few log lines that embed a raw `player.role`/winners list. */
export const ROLE_LABEL_VI: Record<Role, string> = {
  [Role.Lord]: "Chủ công",
  [Role.Loyalist]: "Trung thần",
  [Role.Rebel]: "Phản tặc",
  [Role.Renegade]: "Nội gián",
};

/**
 * Mirrors GameRule's BeforeGameOverJudge check for identity mode:
 * - Lord dead -> if killer was Rebel, rebels win; if killer was Renegade, renegade wins alone;
 *   otherwise (lord died to friendly fire/no credited killer) neither side scores a clean win.
 * - No rebels and no renegade left alive -> lord + loyalist win.
 */
export function checkWinCondition(players: GamePlayer[], lordKilledBy: Role | null): WinResult {
  const alive = players.filter((p) => p.alive);
  const lordAlive = alive.some((p) => p.role === Role.Lord);

  if (!lordAlive) {
    if (lordKilledBy === Role.Rebel) return { winners: [Role.Rebel] };
    if (lordKilledBy === Role.Renegade) return { winners: [Role.Renegade] };
    return { winners: [Role.Rebel, Role.Renegade] };
  }

  const rebelsAlive = alive.some((p) => p.role === Role.Rebel);
  const renegadeAlive = alive.some((p) => p.role === Role.Renegade);
  if (!rebelsAlive && !renegadeAlive) return { winners: [Role.Lord, Role.Loyalist] };

  return null; // game continues
}

/**
 * "Ally" for skills that reference teammates in Role mode (e.g. Ganfuren's Shushen, Tianfeng's
 * Suishi): Lord+Loyalist are mutual allies, Rebels are mutual allies with each other, Renegade
 * has none (plays solo until the very end). Real Sanguosha's "ally" concept is native to
 * Hegemony's same-kingdom teams; this is the closest equivalent for classic Identity mode.
 */
export function isAlly(a: GamePlayer, b: GamePlayer): boolean {
  if (a === b) return false;
  if (a.role === Role.Renegade || b.role === Role.Renegade) return false;
  if (a.role === Role.Rebel) return b.role === Role.Rebel;
  return a.role === Role.Lord || a.role === Role.Loyalist ? b.role === Role.Lord || b.role === Role.Loyalist : false;
}

export function alliesOf(player: GamePlayer, alive: GamePlayer[]): GamePlayer[] {
  return alive.filter((p) => isAlly(player, p));
}
