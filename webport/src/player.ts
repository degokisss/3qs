// Ported (structurally) from src/core/player.h Player class. Only the subset of fields needed
// to drive the phase state machine + role mode + basic-card combat is included; skills/judge-area
// are deferred to the milestone that ports src/package/standard-{wei,shu,wu,qun}-generals.cpp.

import { Card } from "./card.js";
import type { Skill } from "./skill.js";
import { Phase, Role } from "./types.js";

export class GamePlayer {
  readonly id: string;
  seat = 0;
  hp: number;
  maxHp: number;
  role: Role = Role.Renegade; // overwritten by assignRoles(); default never used as final state
  roleShown = false; // lord is always shown; others hidden until death/reveal (Player::hasShownRole)
  phase: Phase = Phase.NotActive;
  alive = true;
  hand: Card[] = [];
  weapon: Card | null = null;
  defenseHorse: Card | null = null; // +1 delta: seatDistance(attacker -> me) is increased by 1
  offenseHorse: Card | null = null; // -1 delta: seatDistance(me -> target) is decreased by 1
  general = ""; // set by Room from skill.ts's GENERALS; empty until assigned (pinyin id, e.g. "caocao" -- drives asset filenames)
  generalName = ""; // Vietnamese display name (e.g. "Tào Tháo"), set alongside `general` from GeneralDef.displayName
  kingdom = ""; // "wei"/"shu"/"wu"/"qun", set alongside general
  skills: Skill[] = [];
  /** One-shot additive damage bonus armed by a skill (e.g. Luoyi), consumed by the next
   *  applyDamage this player deals, then reset to 0. */
  pendingBonusDamage = 0;
  /** Reset at the start of each of this player's turns; set by combat.ts's resolveSlash after a
   *  successful hit this Play phase -- read by skills like Keji that key off "did I Slash this turn". */
  playedSlashThisTurn = false;
  /** Reset at the start of each turn; set by Luoyi's Draw-phase choice (draw 1 fewer, next
   *  damage +1) -- read back by Luoyi's own `drawPhaseBonus`. */
  luoyiArmedThisTurn = false;
  /** Set by Shuangxiong's Draw-phase judgment (null = not armed); while non-null, a held card
   *  whose black-ness matches this flag may be played/discarded as Duel this turn (cleared each
   *  new turn). true = black cards unlocked, false = red cards unlocked. */
  duelViewAsBlackAllowed: boolean | null = null;

  constructor(id: string, maxHp = 4) {
    this.id = id;
    this.maxHp = maxHp;
    this.hp = maxHp;
  }

  get handcardNum(): number {
    return this.hand.length;
  }

  // Player::getMaxCards(MaxCardsType::Normal) simplifies (absent skills/equip) to current HP.
  get maxCards(): number {
    return Math.max(0, this.hp);
  }

  isWounded(): boolean {
    return this.hp < this.maxHp;
  }

  // Player::getAttackRange: 1 with no weapon, otherwise the equipped weapon's range.
  get attackRange(): number {
    return this.weapon?.weaponRange ?? 1;
  }
}
