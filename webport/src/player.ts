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
  /** Milestone 34: the 4th equip slot (Weapon/DefenseHorse/OffenseHorse being the other 3) --
   *  one of the 4 Standard armors (EightDiagram/RenwangShield/Vine/SilverLion), all "Tỏa định
   *  kỹ" (locked skill -- always active, no ask) except EightDiagram's own optional judge. See
   *  combat.ts's `applyDamage`/`resolveSlash` headers for exactly how each one hooks in. */
  armor: Card | null = null;
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
  /** Reset at the start of each turn; set true when Tianyi (Taishici) wins its pindian -- for
   *  the rest of this turn, `player`'s Slash plays are rangeless (see `slashCandidates`'s
   *  `slashRangelessThisTurn` check) and each may also hit a 2nd target (see room.ts's
   *  `maybeResolveTianyiBonusTarget`); stays true all turn (not consumed after one use) --
   *  matches the real "trong lượt này" (for this turn) duration, not a single-use buff. Also
   *  read by Tianyi's own `slashLimit` hook (+1 total Slash plays this turn). */
  tianyiWonThisTurn = false;
  /** Reset at the start of each turn; set true when Tianyi (Taishici) loses its pindian --
   *  `player` may not play ANY Slash (real or viewAs, including Spear's 2-card substitute) for
   *  the rest of this turn. Checked by `tryPlaySlash`/`trySpearSlash`/`computeLegalActions`. */
  tianyiLostThisTurn = false;
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
  /** Set by SupplyShortage's failed Judge-phase judgment (Xu Huang's Duanliang) -- consumed and
   *  cleared the instant this player's own Draw phase is reached (Room.runPhase), same
   *  "forced, no ask" precedent as `forcedSkipPlayPhase` (Indulgence). */
  forcedSkipDrawPhase = false;
  /** Ding Feng's Fenxun: while `to` is a key, this player's distance TO `to` is fixed at the
   *  mapped value (overriding the normal seat-circle calc entirely, matching the real engine's
   *  `Player::setFixedDistance`/`fixed_distance` map) -- one-directional (only affects THIS
   *  player's outgoing distance, not `to`'s distance back), cleared at the start of this
   *  player's next turn (Room.playTurn) or implicitly on death (never read once `!alive`). */
  fixedDistanceTo = new Map<GamePlayer, number>();
  /** Cao Ren's Jushou (据守): while true, this player's ENTIRE next turn is skipped (matches the
   *  real engine's generic face-down/`turnOver()` state -- `Room.playTurn` clears this and
   *  skips straight to the next player instead of running any phase, then this player's turn
   *  after that resumes completely normally, matching the real "auto-flip back up, no player
   *  choice involved" rule confirmed against gamerule.cpp's RoundStart handling). */
  faceDown = false;
  /** Zhou Tai's Buqu (Milestone 27): "Sang" (scar) cards accumulated across repeated dying
   *  attempts -- see skill.ts's `buquPreventsDeath` for how the pile grows and is checked, and
   *  `buquOnRecover` for when it's discarded (the instant hp recovers back above 0). Never used
   *  by any other general. */
  buquPile: Card[] = [];
  /** Iron Chain (Milestone 30): while true, this player takes/splashes chain damage -- see
   *  combat.ts's `applyDamage` header for the exact real "any Fire/Thunder-natured hit on a
   *  chained player unchains them and splashes the SAME damage to every OTHER still-chained
   *  player" rule. Toggled by `trick.ts`'s `resolveIronChain`; never reset elsewhere (matches
   *  the real rule -- stays chained indefinitely until either an elemental hit or another Iron
   *  Chain use clears it). */
  chained = false;
  /** Hengjiang (Zang Ba, momentum.cpp -- a Hegemony-specific supplementary general, NOT one of
   *  the 60 Standard generals): stacking -1 to THIS player's `maxCards` for the rest of THEIR
   *  OWN current turn, applied by Zang Ba's `onDamaged` hook against whoever `EngineContext.
   *  currentPlayer` is at the moment he's damaged. Reset to 0 at the start of each of this
   *  player's own turns (Room.playTurn) and again unconditionally at that same turn's end
   *  (Room.playTurn, right after the Finish phase) -- matches the real rule's TurnStart/
   *  HengjiangFail resets; never carries across turns. */
  hengjiangMark = 0;
  /** Hengjiang (Zang Ba) only: set true the instant `Room.discardDownToLimit` actually forces
   *  THIS player to discard during their own Discard phase this turn (i.e. `hengjiangMark` > 0
   *  really bit). Checked once at that same turn's end: if `hengjiangMark` > 0 but this stayed
   *  false, the debuff never actually cost them a discard, so Zang Ba draws 1 card as
   *  compensation (Room.playTurn) -- matches the real rule's HengjiangDraw reward. Reset
   *  alongside `hengjiangMark` at the start of each of this player's own turns. */
  hengjiangDiscardedThisTurn = false;
  /** Shengxi (Jiang Wan/Fei Yi combined general, formation.cpp -- a Hegemony-specific
   *  supplementary general, NOT one of the 60 Standard generals): set true by Shengxi's own
   *  `onDamageDealt` hook the instant this player deals ANY damage; checked once at the start
   *  of their own Discard phase (Room's `otherPhaseAction` runs before that phase's own
   *  handling) -- still false means "dealt no damage during this Play phase", so Shengxi may
   *  draw 2. Reset at the start of each of this player's own turns. */
  dealtDamageInPlayPhase = false;
  /** Tiềm Tập/Qianxi (Ma Dai, momentum.cpp -- Hegemony-specific, NOT Standard): while non-null,
   *  this player may not USE or RESPOND WITH any HAND card of this color (equipped cards are
   *  unrestricted) -- enforced by combat.ts's `usableHand` helper, consulted at every card-
   *  availability check throughout combat.ts/room.ts (real upstream's `setPlayerCardLimitation`
   *  "use,response" scope). `handColorForbiddenBy` tracks who cast it -- `Room.playTurn`
   *  clears both fields on every player whose restriction was cast BY the just-finished turn
   *  owner (matches the real rule's "until the casting player's OWN turn ends" duration, not
   *  the restricted player's). */
  handColorForbidden: "red" | "black" | null = null;
  handColorForbiddenBy: GamePlayer | null = null;
  /** Sanyao (Ma Su, transformation.cpp -- Hegemony-specific, NOT Standard): once true, Sanyao's
   *  `activeAction` never offers candidates again -- the real skill is once-per-GAME (`!player-
   *  >hasUsed("SanyaoCard")`), not the usual once-per-Play-phase every other `activeAction`
   *  above already gets for free from the engine's own per-phase loop. */
  sanyaoUsed = false;
  /** Zhiman (Ma Su, transformation.cpp -- Hegemony-specific, NOT Standard): the id of the Ma Su
   *  who most recently damaged THIS player and marked them (null if unmarked). The NEXT time
   *  the SAME Ma Su damages this player again, Zhiman's payoff fires and this clears -- see
   *  skill.ts's `zhimanOnDamageDealt`. */
  zhimanMarkedBy: string | null = null;

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

  // Player::getMaxCards(MaxCardsType::Normal) simplifies (absent skills/equip) to current HP,
  // minus any active Hengjiang (Zang Ba) debuff.
  get maxCards(): number {
    return Math.max(0, this.hp - this.hengjiangMark);
  }

  isWounded(): boolean {
    return this.hp < this.maxHp;
  }

  // Player::getAttackRange: 1 with no weapon, otherwise the equipped weapon's range.
  get attackRange(): number {
    return this.weapon?.weaponRange ?? 1;
  }
}
