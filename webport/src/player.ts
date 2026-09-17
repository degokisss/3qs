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
  /** Hegemony mode only (stays "" in Identity mode): the paired DEPUTY general's pinyin id/
   *  display name, alongside `general`/`generalName` above which hold the MAIN general of the
   *  pair. Both share `kingdom`; skills/HP/gender are the combined pair (see
   *  `Room.pickGenerals`'s Hegemony branch and `gamerule.ts`'s `combineHegemonyHp`). */
  deputyGeneral = "";
  deputyGeneralName = "";
  gender: "male" | "female" = "male"; // set alongside general from GeneralDef.gender (defaults
  // male -- see skill.ts's GeneralDef doc comment); needed by DoubleSword's opposite-gender check
  private _skills: Skill[] = [];
  /** Hegemony mode only: how many of `_skills` (declaration order) belong to the MAIN general
   *  -- the rest belong to the deputy. Set by `Room.pickGenerals`'s Hegemony branch right after
   *  assigning `skills`; stays 0 everywhere else (Identity mode, or before a Hegemony player's
   *  deputy is drafted), which combined with `deputyGeneral === ""` there means the `skills`
   *  getter below returns the full list unfiltered -- no gating concept applies outside an
   *  actual drafted Hegemony pair. */
  mainSkillCount = 0;
  /** Milestone 23 (Hegemony/Quốc Chiến mode only -- stays "" in Identity mode, which keeps using
   *  `role` above): the player's team key. Team players (Wei/Shu/Wu/Qun) share their kingdom
   *  string ("wei"/"shu"/"wu"/"qun"); an Ambitionist (野心-家 -- a kingdom's overflow player past
   *  the official half-table quota, see gamerule.ts) gets a unique `"ambitionist:<id>"` key so
   *  they never coincidentally ally with anyone, including another Ambitionist. See gamerule.ts's
   *  `isAlly`: a non-empty `faction` always takes precedence over the legacy `role`-based check,
   *  so Identity mode (which never sets this field) is byte-for-byte unaffected. */
  faction = "";
  /** True only for a Hegemony-mode Ambitionist (see `faction` above) -- must eliminate every
   *  other living player alone to win; kept as its own flag (redundant with `faction`'s prefix)
   *  purely so call sites don't need to string-match. */
  isAmbitionist = false;
  /** Hegemony mode only (Milestone 23 addendum "暗置/明置" reveal system, both stay false in
   *  Identity mode): whether the main/deputy general is currently face-up. Both start face-down
   *  -- kingdom (and therefore `faction`/`isAmbitionist` above, which only get assigned the
   *  FIRST time either flips true, see `Room.runHegemonyReveal`) stays unknown to OTHER players
   *  until then. Revealing either general reveals the kingdom (both share one, by construction). */
  mainRevealed = false;
  deputyRevealed = false;
  /** One-shot additive damage bonus armed by a skill (e.g. Luoyi), consumed by the next
   *  applyDamage this player deals, then reset to 0. */
  pendingBonusDamage = 0;
  /** One-shot damage bonus armed by playing Analeptic (Tửu) during the Play phase, consumed by
   *  only the very next SLASH this player plays this turn (see combat.ts's resolveSlash) -- not
   *  generic like `pendingBonusDamage` above, since Analeptic's real card text specifically
   *  boosts a Slash, not any other damage source (Duel/AOE/self-inflicted skill damage). */
  pendingSlashBonusDamage = 0;
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
  /** Names of "limit skills" (hạn định kỹ -- once per GAME, not once per turn) `player` has
   *  already invoked -- e.g. Jiaxu's Luanwu, Mateng's Xiongyi. Never reset mid-game. */
  usedLimitSkills = new Set<string>();
  /** Delayed trick cards currently attached (e.g. Indulgence) -- resolved in placement order
   *  during this player's own Judge phase (Room.runJudgePhase), each removing itself once
   *  resolved (none implemented yet cycle back in). */
  judgeArea: Card[] = [];
  /** Set by a delayed trick's failed Judge-phase judgment (e.g. Indulgence) -- consumed and
   *  cleared the instant this player's own Play phase is reached (Room.runPhase). */
  forcedSkipPlayPhase = false;

  constructor(id: string, maxHp = 4) {
    this.id = id;
    this.maxHp = maxHp;
    this.hp = maxHp;
  }

  get handcardNum(): number {
    return this.hand.length;
  }

  /**
   * Milestone 23 (2nd reveal-TIMING addendum -- skill-availability gating): in Hegemony mode,
   * once a player has drafted a real deputy, only a REVEALED general's skills actually fire --
   * every mechanical consumer across skill.ts/combat.ts/trick.ts/room.ts iterates `player.skills`
   * for real hook-firing, so gating it HERE means every one of those ~40 call sites respects
   * reveal state automatically, with zero call-site changes. Falls through to the full
   * unfiltered list whenever gating doesn't apply: Identity mode (`deputyGeneral` never gets
   * set there) and Hegemony BEFORE a pair is drafted both hit the `!this.deputyGeneral` branch.
   * Use `allSkills` instead when you specifically want the full declared kit regardless of
   * reveal state (e.g. a player's own hero panel, which should show what they drafted even
   * before choosing to reveal it to anyone else -- see server.ts's `personalize`).
   */
  get skills(): Skill[] {
    if (!this.deputyGeneral) return this._skills;
    const active: Skill[] = [];
    if (this.mainRevealed) active.push(...this._skills.slice(0, this.mainSkillCount));
    if (this.deputyRevealed) active.push(...this._skills.slice(this.mainSkillCount));
    return active;
  }
  set skills(value: Skill[]) {
    this._skills = value;
  }
  get allSkills(): Skill[] {
    return this._skills;
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
