// Milestone 3.5-3.8: pluggable per-player decision-making. Room asks a player's Controller for
// each decision instead of always running the greedy bot policy inline -- this is what lets a
// human take over a seat over WebSocket (server.ts's HumanController) while every other seat
// keeps using the existing bot policy, with NO change to Room's resolution logic itself.
//
// Covered so far: Slash target, target for the 3 single-target tricks (Dismantlement/Snatch/
// Duel), whether to play a held AOE/self trick (SavageAssault/ArcheryAttack/GodSalvation/
// AmazingGrace/ExNihilo -- these have no target to pick, just a yes/no), whether to equip a held
// Weapon/Horse, whether to dodge an incoming Slash with a held Jink, whether to self-rescue with
// a held Peach while dying, whether to play a held Slash when responding in a Duel, whether to
// discard 2 (vs. take 1 damage) for Ganglie. Milestone 5: full free-hand Play phase -- see
// `chooseFreeAction` below -- a human-only opt-in that hands the whole Play phase over to an
// interactive "pick any legal card/action, any order, until you end the phase" loop (room.ts's
// `runFreeformPlayPhase`), reusing every target-selection method above unchanged. Bots never
// define it and keep using the original fixed-order automatic pass (room.ts's `runPlayPhase`
// fallback branch).

import { Card, CardKind, Suit } from "./card.js";
import { GamePlayer } from "./player.js";
import { GeneralDef } from "./skill.js";
import { KnownBothOption, effectiveAttackRange, effectiveDistance, isImmuneToSlashAndDuel } from "./combat.js";
import { isAlly } from "./gamerule.js";

/** One legal thing a player could do right now during a freeform Play phase, computed fresh by
 *  `Room.computeLegalActions` before each `chooseFreeAction` ask. `playCard`'s `cardKind` is
 *  what the card resolves AS (viewAs-aware, e.g. a red card played as Slash via Wusheng), not
 *  necessarily the card's own real kind. */
export type FreeAction =
  | { kind: "equip"; cardId: number }
  | { kind: "playCard"; cardId: number; cardKind: CardKind }
  | { kind: "selfAction"; skillName: string }
  | { kind: "activeAction"; skillName: string }
  | { kind: "spearSlash" };

/** Alive players `actor` could legally Slash: not self, within `actor`'s effective attack range
 *  (weapon range, or 1 unequipped, plus SixSwords' ally bonus -- see combat.ts's
 *  effectiveAttackRange), not immune (Kongcheng). Distance is skipped entirely while
 *  `actor.tianyiWonThisTurn` is set (Taishici's Tianyi: rangeless Slash for the rest of the turn
 *  after winning its pindian). */
export function slashCandidates(alive: GamePlayer[], actor: GamePlayer): GamePlayer[] {
  return alive.filter(
    (p) =>
      p !== actor &&
      (actor.tianyiWonThisTurn || effectiveDistance(alive, actor, p) <= effectiveAttackRange(alive, actor)) &&
      !isImmuneToSlashAndDuel(p),
  );
}

/** Static per-kind "how bad would it be to lose this" score used when nobody made a real
 *  discard choice (a human discard-phase timeout, a misbehaving/timed-out controller, or the
 *  bot's own no-preference default) -- higher score = kept longer, so the LOWEST-scoring cards
 *  in hand are discarded first. Peach/Jink (life-and-death defense) rank highest; single-moment
 *  AOE/self tricks rank lowest. This is deliberately a simple static ranking, not real
 *  situational strategy (e.g. "is this Jink actually needed against a known Slash count") --
 *  it only has to beat "discard an arbitrary first N cards" for the no-real-choice case. */
const DISCARD_IMPORTANCE: Record<CardKind, number> = {
  [CardKind.Peach]: 100,
  [CardKind.Jink]: 90,
  [CardKind.Analeptic]: 60,
  [CardKind.Slash]: 50,
  [CardKind.Weapon]: 45,
  [CardKind.Armor]: 45, // same tier as Weapon -- a real, permanent equip-slot upgrade, not a one-shot trick
  [CardKind.Horse]: 40,
  [CardKind.Duel]: 35,
  [CardKind.Snatch]: 35,
  [CardKind.Dismantlement]: 35,
  [CardKind.SavageAssault]: 30,
  [CardKind.FireAttack]: 30, // single-target, situational (needs a matching-suit card of your own too) -- same tier as SavageAssault/ArcheryAttack/ExNihilo
  [CardKind.ArcheryAttack]: 30,
  [CardKind.ExNihilo]: 30,
  [CardKind.GodSalvation]: 25,
  [CardKind.AmazingGrace]: 25,
  [CardKind.Indulgence]: 20, // delayed trick, no immediate value -- lowest of the trick kinds
  [CardKind.SupplyShortage]: 20, // same reasoning as Indulgence -- another delayed trick
  [CardKind.Lightning]: 15, // delayed trick with a genuine downside (3 damage, or gets passed on to circulate) -- lowest of all, the bot would rather not be holding it
  [CardKind.Collateral]: 30, // single-target, situational (needs a weapon-holding target AND a legal victim within their range) -- same tier as SavageAssault/ArcheryAttack/FireAttack
  [CardKind.BefriendAttacking]: 20, // Hegemony-only in practice (needs a determined enemy faction) -- often simply unplayable, same tier as the delayed tricks
  [CardKind.AwaitExhausted]: 25, // self+allies AOE draw/discard, no target choice needed -- same tier as GodSalvation/AmazingGrace
  [CardKind.IronChain]: 30, // single-target, situational value (only synergizes with Fire/Thunder damage already in play) -- same tier as Collateral/SavageAssault
  [CardKind.Nullification]: 40, // reactive counter-play -- a genuinely scarce answer card, kept longer than most one-shot tricks
  [CardKind.HegNullification]: 40, // same reasoning as Nullification
  [CardKind.KnownBoth]: 20, // pure information, no combat/resource swing -- lowest non-delayed tier, alongside BefriendAttacking
};

/** Trick kinds the bot considers worth spending a Nullification/HegNullification on when they'd
 *  land on itself or an ally (gamerule.ts's isAlly) -- see `wantsToNullify` below. Deliberately
 *  excludes every BENEFICIAL trick (GodSalvation/AmazingGrace/BefriendAttacking/AwaitExhausted/
 *  ExNihilo/KnownBoth's own use against an ally -- wait, KnownBoth genuinely IS information
 *  leakage worth blocking, so it's included) -- this is a coarse approximation, not full
 *  situational awareness (e.g. it can't distinguish an IronChain USE from an IronChain UNCHAIN,
 *  and nullifies both the same way), matching this file's other "beats the no-choice-at-all
 *  baseline, not real strategy" bot precedents. */
const HARMFUL_TRICK_KINDS = new Set<CardKind>([
  CardKind.Duel,
  CardKind.Snatch,
  CardKind.Dismantlement,
  CardKind.Collateral,
  CardKind.IronChain,
  CardKind.FireAttack,
  CardKind.KnownBoth,
  CardKind.SavageAssault,
  CardKind.ArcheryAttack,
  CardKind.Indulgence,
  CardKind.SupplyShortage,
  CardKind.Lightning,
]);

/** Picks exactly `count` cards to discard from `hand` when nobody made a real choice: the
 *  LEAST important cards (by DISCARD_IMPORTANCE) go first, ties broken by original hand order
 *  for determinism. `count` is assumed <= hand.length (callers already guarantee this). */
export function pickLeastImportantCards(hand: Card[], count: number): Card[] {
  return hand
    .map((c, i) => ({ c, i }))
    .sort((a, b) => DISCARD_IMPORTANCE[a.c.kind] - DISCARD_IMPORTANCE[b.c.kind] || a.i - b.i)
    .slice(0, count)
    .map(({ c }) => c);
}

export interface Controller {
  /** Milestone 6: `candidates` is always non-empty (never returns null -- every player must end
   *  up with a general; Room falls back to `candidates[0]` if this somehow returns a falsy value).
   *  `role` (Hegemony mode only, see `Room.pickGenerals`'s Hegemony branch): `"main"` for the
   *  first pick (dealt 5 candidates, any kingdom -- the real 国战 "phát 5, chọn 2" rule),
   *  `"deputy"` for the second (dealt the 4 that remain from that same 5, filtered to the
   *  main's kingdom) -- purely informational, lets a human ask show which slot is being picked;
   *  bots ignore it. */
  chooseGeneral(candidates: GeneralDef[], role?: "main" | "deputy"): Promise<GeneralDef>;
  /** Hegemony mode only (Milestone 23 addendum "暗置/明置" reveal system), asked at the start of
   *  `player`'s own turn while anything is still hidden (`Room.runHegemonyReveal`, `Phase.
   *  RoundStart`) -- `mainHidden`/`deputyHidden` say which slot(s) are still eligible; the
   *  returned `main`/`deputy` say which to reveal THIS turn (either, both, or neither -- staying
   *  hidden is a valid choice with no forced timeout in the real rule). Never asked once both
   *  are already revealed. */
  chooseReveal(player: GamePlayer, mainHidden: boolean, deputyHidden: boolean): Promise<{ main: boolean; deputy: boolean }>;
  /** Hegemony mode only, fires exactly once for `player`, the instant their SECOND general
   *  reveals (`hasShownAllGenerals`, see `Room.runHegemonyReveal`) -- only asked when their
   *  drafted pair is actually a real companion (珠联璧合) pair (`gamerule.ts`'s
   *  `isCompanionPair`). `canRecover` mirrors the real rule's own conditional 3rd choice (only
   *  offered while wounded); the 3rd option is always available as an implicit "decline"
   *  (return `"cancel"` or anything falsy-equivalent -- Room treats any non-"recover"/"draw"
   *  value as a decline). */
  chooseCompanionBonus(player: GamePlayer, canRecover: boolean): Promise<"recover" | "draw" | "cancel">;
  /** Hegemony mode only, fires alongside `chooseCompanionBonus` (same `hasShownAllGenerals`
   *  moment) whenever the pair's combined HP left an unpaired half (`combineHegemonyHp`'s
   *  `bonusDraw`) -- draw 1 card, purely optional. */
  wantsHalfMaxHpBonusDraw(player: GamePlayer): Promise<boolean>;
  /** `candidates` is always non-empty (Room checks first). Return null to decline/pass. */
  chooseSlashTarget(actor: GamePlayer, candidates: GamePlayer[]): Promise<GamePlayer | null>;
  /** Milestone 45 (Sha Moke's JiliTM): when `combat.ts`'s `maxSlashTargets` says `actor` may
   *  Slash more than 1 person right now, asks for 0..`maxExtra` ADDITIONAL distinct targets
   *  beyond `primary` (already chosen via `chooseSlashTarget` above), pulled from `candidates`
   *  (never includes `primary`). The SAME played Slash card resolves against every returned
   *  target too. Return `[]` to Slash only `primary`. */
  chooseExtraSlashTargets(actor: GamePlayer, primary: GamePlayer, candidates: GamePlayer[], maxExtra: number): Promise<GamePlayer[]>;
  /** Room already confirmed `card` is a legal Weapon/Horse to equip right now. */
  wantsToEquip(player: GamePlayer, card: Card): Promise<boolean>;
  /** Dismantlement/Snatch/Duel: `candidates` is always non-empty. Return null to decline. */
  chooseTrickTarget(player: GamePlayer, kind: CardKind, candidates: GamePlayer[]): Promise<GamePlayer | null>;
  /** SavageAssault/ArcheryAttack/GodSalvation/AmazingGrace/ExNihilo: no target to pick, just yes/no. */
  wantsToPlayTrick(player: GamePlayer, kind: CardKind): Promise<boolean>;
  /** `player` holds a Jink and is the target of an incoming Slash. */
  wantsToDodge(player: GamePlayer): Promise<boolean>;
  /** `player` holds a Peach and is at 0 hp (or below) right now. */
  wantsToUsePeach(player: GamePlayer): Promise<boolean>;
  /** `rescuer` holds a Peach and another player is dying right now -- spend it to save THEM
   *  instead of self? Only called when `rescuer` actually holds one. */
  wantsToUsePeachForOther(rescuer: GamePlayer, dyingPlayer: GamePlayer): Promise<boolean>;
  /** Play phase: `player` is wounded and holds a Peach -- play it proactively (not while dying)
   *  to heal 1 hp right now? Real Sanguosha lets this repeat as long as still wounded and still
   *  holding one, no once-per-turn cap (only Slash has an explicit limit). */
  wantsToUsePeachSelfHeal(player: GamePlayer): Promise<boolean>;
  /** Play phase: `player` holds an Analeptic -- play it proactively to arm a +1 damage bonus
   *  for their next Slash this turn? Only called when they hold one; no wounded-state gate
   *  (unlike Peach self-heal, this is a pure offense buff, useful regardless of hp). */
  wantsToUseAnalepticBuff(player: GamePlayer): Promise<boolean>;
  /** `player` holds a Slash and must decide whether to play it to continue a Duel exchange. */
  wantsToPlaySlashInDuel(player: GamePlayer): Promise<boolean>;
  /** `player` (the source of damage to a Ganglie holder) has >=2 cards and can choose to discard
   *  2 instead of taking 1 damage. */
  wantsToDiscardForGanglie(player: GamePlayer): Promise<boolean>;
  /** `player` holds a Slash and was hit by Savage Assault -- discard it (vs. take 1 damage)? */
  wantsToDiscardForSavageAssault(player: GamePlayer): Promise<boolean>;
  /** `player` holds a Jink and was hit by Archery Attack -- discard it (vs. take 1 damage)? */
  wantsToDiscardForArcheryAttack(player: GamePlayer): Promise<boolean>;
  /** Amazing Grace: `player`'s turn to take exactly one card from the still-face-up
   *  `candidates` pool (never empty when asked). */
  choosePickCard(player: GamePlayer, candidates: Card[]): Promise<Card>;
  /** Dismantlement/Snatch: `player` chooses exactly one of `owner`'s cards (hand or equipped)
   *  to take/discard, instead of a random pick -- `candidates` is always non-empty when asked. */
  choosePlayerCard(player: GamePlayer, owner: GamePlayer, candidates: Card[]): Promise<Card>;
  /** Guanxing (Zhuge Liang): `player` looked at `revealed` (top of the draw pile, in draw
   *  order -- revealed[0] would be drawn next) and decides which of them go to the bottom of
   *  the pile; everything else stays on top in its original relative order. Returns the ids of
   *  cards to bury -- an empty set leaves the pile untouched. */
  chooseGuanxingBottom(player: GamePlayer, revealed: Card[]): Promise<Set<number>>;
  /** Xunxun (Li Dian, Milestone 47): `player` looked at `revealed` (`peekTop(4)`, in draw order)
   *  and picks EXACTLY 2 to keep into hand -- the other 2 get buried at the bottom of the pile
   *  via `resolveXunxunSplit`. An invalid/missing response falls back to the first 2. */
  chooseXunxunKeep(player: GamePlayer, revealed: Card[]): Promise<Set<number>>;
  /** Guicai (Sima Yi): `player` may replace an in-progress judgment's `currentCard` (owned by
   *  `judgeOwner`, for skill `reason`) with a card from their own hand (a "retrial"). Return
   *  the chosen card (must be present in `player.hand`) or null to decline. Only ever called
   *  when `player.hand.length > 0`. */
  wantsToUseGuicai(player: GamePlayer, judgeOwner: GamePlayer, currentCard: Card, reason: string): Promise<Card | null>;
  /** End-of-turn Discard phase: `player`'s hand exceeds their card limit by exactly `count`.
   *  Return exactly `count` distinct cards currently in `player.hand` to discard. Room falls
   *  back to `pickLeastImportantCards` if this returns something invalid (wrong length, or
   *  cards not actually held) -- covers a misbehaving or timed-out controller. */
  chooseDiscards(player: GamePlayer, count: number): Promise<Card[]>;
  /** `player` may use `skillName`'s proactive self action (e.g. Kurou) right now; no target to pick. */
  wantsToUseSelfAction(player: GamePlayer, skillName: string): Promise<boolean>;
  /** Kylin Bow (weapon): `player` (the attacker) just dealt Slash damage to a target with at
   *  least 1 horse card equipped -- destroy one of them? Only called when there's actually one
   *  to destroy. */
  wantsToUseKylinBow(player: GamePlayer): Promise<boolean>;
  /** IceSword (weapon): `player` (the attacker) is about to deal Slash damage to a target who
   *  actually holds >=1 card -- cancel the damage and pick up to 2 of their cards to discard
   *  instead? */
  wantsToUseIceSword(player: GamePlayer): Promise<boolean>;
  /** Axe (weapon): `player` (the attacker)'s Slash just got dodged and they hold >=2 cards --
   *  discard 2 to force it to hit anyway? */
  wantsToUseAxe(player: GamePlayer): Promise<boolean>;
  /** EightDiagram (armor, Milestone 34): `player` holds no real/viewAs Jink and is about to
   *  take Slash damage -- invoke the armor's own optional judgment-based backup dodge? Only
   *  called when they actually have EightDiagram equipped and no Jink was found. */
  wantsToUseEightDiagram(player: GamePlayer): Promise<boolean>;
  /** DoubleSword (weapon): `player` (the attacker) just dealt Slash damage to an opposite-gender
   *  target -- invoke it? */
  wantsToUseDoubleSword(player: GamePlayer): Promise<boolean>;
  /** DoubleSword follow-up: does `player` (the TARGET, who holds >=1 card) want to discard 1 of
   *  their own instead of letting the wielder draw 1? */
  wantsToDiscardForDoubleSword(player: GamePlayer): Promise<boolean>;
  /** Spear (weapon): `player` may use exactly 2 of their own hand cards as if they were a
   *  Slash. Return exactly 2 distinct cards currently in `player.hand` to use them; anything
   *  else (empty array, wrong count, cards not actually held) is treated as declining --
   *  UNLIKE `chooseDiscards`, this is never forced, so there's no fallback substitution. */
  chooseSpearCards(player: GamePlayer): Promise<Card[]>;
  /** Generic "freely pick between `min` and `max` (inclusive) of your OWN hand cards" ask --
   *  for skills whose real cost is a player-chosen SUBSET, not a fixed count (e.g. Liu Bei's
   *  Rende: give away any number >=1; Sun Quan's Zhiheng: discard up to maxHp; Yuan Shao's
   *  Luanji: exactly 2 same-suit). Returns a `length` in `[min, max]` to proceed, or anything
   *  outside that range (including empty, when `min > 0`) to decline -- UNLIKE `chooseDiscards`,
   *  never forced, no fallback substitution, same "player's free choice" precedent as
   *  `chooseSpearCards`. Callers that need an extra constraint beyond count (e.g. Luanji's
   *  same-suit requirement) validate it themselves afterward and treat a mismatch as a decline. */
  chooseAnyHandCards(player: GamePlayer, min: number, max: number): Promise<Card[]>;
  /** Generic single-target picker with no built-in filter -- `candidates` is pre-filtered by
   *  the caller. Return null to decline. */
  chooseAnyPlayerTarget(player: GamePlayer, candidates: GamePlayer[]): Promise<GamePlayer | null>;
  /** Draw phase: `player` is about to draw `count` cards from the pile. Resolves once they've
   *  confirmed (e.g. clicked the face-down draw pile) -- lets a human seat draw on their own
   *  timing instead of cards silently appearing in hand. Bots resolve immediately. */
  wantsToDrawNow(player: GamePlayer, count: number): Promise<void>;
  /** If defined (only ever set for a human-controlled seat -- see server.ts's HumanController),
   *  Room hands the ENTIRE Play phase over to `runFreeformPlayPhase` instead of the fixed
   *  automatic pass below: called repeatedly with the full current legal-action list, resolves
   *  whichever one is chosen, and loops until this returns `null` (end phase) or nothing is
   *  legal any more. Left undefined by `makeBotController` -- bots always keep using the
   *  original fixed-order pass, byte-for-byte unchanged. */
  chooseFreeAction?(player: GamePlayer, legalActions: FreeAction[]): Promise<FreeAction | null>;
  /** Nullification/HegNullification counter-play window (Milestone 31): `player` holds a
   *  Nullification-kind card and `kind` (played by `source`) is about to take effect against
   *  `target` -- play it to cancel? Only called when `player` actually holds one. */
  wantsToNullify(player: GamePlayer, kind: CardKind, source: GamePlayer, target: GamePlayer): Promise<boolean>;
  /** HegNullification only: having chosen to nullify, block just `target` ("single") or extend
   *  the block to every other still-untouched player sharing `target`'s Hegemony faction, for
   *  THIS SAME card's remaining AOE hits too ("all")? Only asked when relevant (Hegemony mode,
   *  `target.faction !== ""`). */
  chooseHegNullificationScope(player: GamePlayer, target: GamePlayer): Promise<"single" | "all">;
  /** KnownBoth: `player` picks what to privately view about `target` -- their hand, or
   *  (Hegemony) one of their still-hidden generals. `options` is always non-empty. */
  chooseKnownBothOption(player: GamePlayer, target: GamePlayer, options: KnownBothOption[]): Promise<KnownBothOption>;
}

/** The naive greedy policy every seat used before human control existed: always act when legal. */
export function makeBotController(rng: () => number): Controller {
  const pickRandom = (candidates: GamePlayer[]): GamePlayer | null =>
    candidates.length ? candidates[Math.floor(rng() * candidates.length)] : null;
  return {
    async chooseGeneral(candidates) {
      return candidates[Math.floor(rng() * candidates.length)];
    },
    // Bots have no bluffing strategy -- reveal everything still hidden the instant it's asked
    // (their very first turn, since `Room.runHegemonyReveal` skips the ask once nothing's left).
    async chooseReveal(_player, mainHidden, deputyHidden) {
      return { main: mainHidden, deputy: deputyHidden };
    },
    // Bots always take the resource: recover if wounded (and eligible), otherwise draw.
    async chooseCompanionBonus(player, canRecover) {
      return canRecover && player.isWounded() ? "recover" : "draw";
    },
    async wantsHalfMaxHpBonusDraw() {
      return true;
    },
    async chooseSlashTarget(_actor, candidates) {
      return pickRandom(candidates);
    },
    async chooseExtraSlashTargets(_actor, primary, candidates, maxExtra) {
      const pool = candidates.filter((p) => p !== primary);
      const picks: GamePlayer[] = [];
      while (picks.length < maxExtra && pool.length > 0) {
        const idx = Math.floor(rng() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
      }
      return picks;
    },
    async wantsToEquip() {
      return true;
    },
    async chooseTrickTarget(_player, _kind, candidates) {
      return pickRandom(candidates);
    },
    async wantsToPlayTrick() {
      return true;
    },
    async wantsToDodge() {
      return true;
    },
    async wantsToUsePeach() {
      return true;
    },
    async wantsToUsePeachForOther() {
      return false; // ally-rescue is a genuinely strategic (role-aware) decision this simple
      // greedy bot policy doesn't model -- unlike every other ask above, spending a card here
      // helps someone ELSE, not the bot itself, so it declines by default (a claimed human seat
      // gets the real choice instead, see server.ts's askClient wiring)
    },
    async wantsToUsePeachSelfHeal() {
      return false; // matches the pre-existing bot behavior: the fixed pass never proactively
      // burns a Peach outside a real dying emergency (see room.ts's runPlayPhase)
    },
    async wantsToUseAnalepticBuff() {
      return false; // matches wantsToUsePeachSelfHeal's reasoning: the fixed pass never
      // proactively burns Peach/Analeptic outside a real dying emergency
    },
    async wantsToPlaySlashInDuel() {
      return true;
    },
    async wantsToDiscardForGanglie() {
      return true; // matches the pre-3.8 unconditional-discard-when-possible behavior
    },
    async wantsToDiscardForSavageAssault() {
      return true; // matches the greedy policy's other card-preservation defaults
    },
    async wantsToDiscardForArcheryAttack() {
      return true;
    },
    async choosePickCard(_player, candidates) {
      return candidates[0]; // matches the greedy policy's other no-preference defaults
    },
    async choosePlayerCard(_player, _owner, candidates) {
      // Prefer a known equip card over a blind random hand card -- a visible, usually-valuable
      // resource is worth denying/taking over an unseen one, matching this policy's other
      // "known/valuable resource" preferences (e.g. wantsToDiscardForGanglie).
      return candidates.find((c) => c.kind === CardKind.Weapon || c.kind === CardKind.Horse || c.kind === CardKind.Armor) ?? candidates[0];
    },
    async chooseGuanxingBottom(_player, revealed) {
      // Bury the least valuable half (see pickLeastImportantCards/DISCARD_IMPORTANCE) so the
      // more useful revealed cards stay on top, drawn sooner -- matches this policy's other
      // "known/valuable resource" preferences instead of leaving the pile untouched.
      const buryCount = Math.floor(revealed.length / 2);
      return new Set(pickLeastImportantCards(revealed, buryCount).map((c) => c.id));
    },
    async chooseXunxunKeep(_player, revealed) {
      // Keep the most valuable 2 (bury the rest via pickLeastImportantCards) -- matches
      // chooseGuanxingBottom's own "known/valuable resource" preference, just inverted (this
      // skill sends the KEPT half to hand, not the buried half).
      const buryCount = Math.max(0, revealed.length - 2);
      const buried = pickLeastImportantCards(revealed, buryCount);
      return new Set(revealed.filter((c) => !buried.includes(c)).map((c) => c.id));
    },
    async wantsToUseGuicai() {
      // No alignment-aware AI to judge whether flipping a given judgment helps or hurts
      // `judgeOwner` (same "naive, no ally/enemy inference" limitation as the combat bot) --
      // always declines rather than guess, matching this policy's other no-real-strategy defaults.
      return null;
    },
    async chooseDiscards(player, count) {
      // Discard the least valuable cards (see pickLeastImportantCards) instead of an arbitrary
      // first-N -- matches the greedy policy's other "known/valuable resource" preferences.
      return pickLeastImportantCards(player.hand, count);
    },
    async chooseSpearCards(player) {
      // Sacrifice the 2 least valuable cards (see pickLeastImportantCards) -- matches the
      // greedy policy's other "known/valuable resource" preferences.
      return pickLeastImportantCards(player.hand, 2);
    },
    async chooseAnyHandCards(player, min, max) {
      if (player.hand.length < min) return [];
      const take = Math.min(max, player.hand.length);
      if (take < min) return [];
      // A fixed exact count (min === max) might carry an unstated same-suit requirement the
      // caller validates afterward (e.g. Luanji's exactly-2-same-suit) -- try a same-suit group
      // first so that case doesn't always spuriously fail; falls back to the plain
      // least-valuable-overall pick (matches chooseSpearCards' policy) otherwise.
      if (min === max) {
        const bySuit = new Map<Suit, Card[]>();
        for (const c of player.hand) bySuit.set(c.suit, [...(bySuit.get(c.suit) ?? []), c]);
        for (const group of bySuit.values()) {
          if (group.length >= take) return pickLeastImportantCards(group, take);
        }
      }
      return pickLeastImportantCards(player.hand, take);
    },
    async wantsToUseSelfAction() {
      return true;
    },
    async wantsToUseKylinBow() {
      return true; // matches the greedy policy's other free-advantage defaults (e.g. wantsToUseSelfAction)
    },
    async wantsToUseIceSword() {
      return true; // matches the greedy policy's other free-advantage defaults
    },
    async wantsToUseAxe() {
      return true;
    },
    async wantsToUseEightDiagram() {
      return true; // matches the greedy policy's other free-advantage defaults -- a judged
      // backup dodge is strictly better than certain damage
    },
    async wantsToUseDoubleSword() {
      return true;
    },
    async wantsToDiscardForDoubleSword() {
      return true; // matches wantsToDiscardForGanglie's "prefer to spend own cards over letting
      // the opponent gain a resource" reasoning
    },
    async chooseAnyPlayerTarget(_player, candidates) {
      return pickRandom(candidates);
    },
    async wantsToDrawNow() {
      // bots draw immediately, no pause
    },
    // Nullification/HegNullification (Milestone 31): the bot has no real threat-assessment --
    // it simply protects itself/its allies (gamerule.ts's isAlly) from anything in
    // HARMFUL_TRICK_KINDS, and never bothers spending a scarce answer card on a BENEFICIAL
    // trick (GodSalvation/AmazingGrace/BefriendAttacking/AwaitExhausted/ExNihilo -- none of
    // those are in the set below) even when it's the one playing it. A coarse approximation
    // (e.g. it can't tell an IronChain USE from an IronChain UNCHAIN apart, and nullifies both
    // the same way), matching this policy's other "no deep situational strategy, just beats
    // the no-choice-at-all baseline" precedent (see this file's header on DISCARD_IMPORTANCE).
    async wantsToNullify(player, kind, _source, target) {
      return (target === player || isAlly(player, target)) && HARMFUL_TRICK_KINDS.has(kind);
    },
    async chooseHegNullificationScope() {
      return "all"; // free extra value, matches the greedy policy's other free-advantage defaults
    },
    async chooseKnownBothOption(_player, _target, options) {
      // Prefer revealing a still-hidden general (strictly more strategically useful than a
      // hand peek -- resolves lingering Hegemony fog-of-war) over the hand, matching this
      // policy's other "known/valuable resource" preferences.
      return options.find((o) => o === "head_general" || o === "deputy_general") ?? options[0];
    },
  };
}
