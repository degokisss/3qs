// Basic-card combat resolution: Slash -> Jink, dying -> Peach rescue. Structurally mirrors
// Room::useCard/room->activate (src/server/room.cpp) and GameRule's AskForPeaches handling
// (src/server/gamerule.cpp), simplified to the base rules with no equip-skill modifiers yet (no
// Crossbow multi-slash, no Qinggang armor-ignore -- see webport/README.md).
//
// Whether to actually play a held Jink/Peach is now a real per-player decision (ctx.askDodge /
// ctx.askPeach, routed through controller.ts) instead of always-auto-use -- this is what lets a
// human seat choose to save a Jink/Peach for later instead of reflexively spending it.
//
// Milestone 2.6 (batch 3): resolveSlash grew 3 more hook points to cover a wider swath of
// generals in one pass -- onIncomingSlash (nullify/redirect before the Jink check, e.g. Liushan/
// Daqiao), responseCountRequired (Lu Bu's Wushuang: needs 2 Jinks, not 1), onSlashDodged (fired
// on both sides after a successful dodge, e.g. Pangde/Zhangjiao). All 3 are no-ops for any player
// with no matching skill, so the single-Jink/no-redirect path used by every earlier general is
// byte-for-byte unchanged.

import { Card, CardKind, Suit } from "./card.js";
import { GamePlayer } from "./player.js";
import { DamageNature } from "./types.js";
import { isAlly } from "./gamerule.js";

/**
 * Player::distanceTo: `from.fixedDistanceTo` (Ding Feng's Fenxun) short-circuits everything
 * below with an absolute override the instant it's set for this specific `to`, matching the
 * real engine's own `fixed_distance.contains(other)` early-return. Otherwise: shortest
 * seat-circle hop count among currently ALIVE players, adjusted by equipped horses (`to`'s
 * defense horse +1, `from`'s offense horse -1) and by `from`'s skills (e.g. Mashu's
 * `attackDistanceDelta`, same -1-per-point shape as an offense horse) -- floored at 1.
 */
export function effectiveDistance(alive: GamePlayer[], from: GamePlayer, to: GamePlayer): number {
  if (from.fixedDistanceTo.has(to)) return from.fixedDistanceTo.get(to)!;
  const i = alive.indexOf(from);
  const j = alive.indexOf(to);
  const n = alive.length;
  const forward = (j - i + n) % n;
  const seatDistance = Math.min(forward, n - forward);
  const horseDelta = (to.defenseHorse?.horseDelta ?? 0) - (from.offenseHorse ? 1 : 0);
  const skillDelta = from.skills.reduce((sum, skill) => sum + (skill.attackDistanceDelta?.(from) ?? 0), 0);
  return Math.max(1, seatDistance + horseDelta - skillDelta);
}

/** `player`'s real attack range (weapon range, or 1 unequipped), plus SixSwords' ally-synergy
 *  bonus: +1 if another ALIVE ally also wields SixSwords (this repo's "ally" = same Role-mode
 *  side, see gamerule.ts's isAlly -- the closest equivalent to Hegemony's same-kingdom teams
 *  this weapon's real ability keys off). */
export function effectiveAttackRange(alive: GamePlayer[], player: GamePlayer): number {
  const sixSwordsBonus =
    player.weapon?.weaponName === "SixSwords" && alive.some((p) => p.weapon?.weaponName === "SixSwords" && isAlly(player, p))
      ? 1
      : 0;
  return player.attackRange + sixSwordsBonus;
}

/** Detaches `card` from wherever it currently sits on `owner` (hand or one of the 3 equip
 *  slots) -- does NOT decide where it goes next (discard pile vs. the stealer's hand), that's
 *  the caller's job. Fires Xiaoji's onEquipLost for ANY departure from the equip zone (discarded
 *  or snatched away), not just being replaced by a new equip. Shared by trick.ts's Dismantlement/
 *  Snatch and this file's IceSword (both "detach one of an owner's cards, caller decides where
 *  it lands"). */
export async function detachCardFrom(ctx: EngineContext, owner: GamePlayer, card: Card): Promise<void> {
  const handIdx = owner.hand.indexOf(card);
  if (handIdx !== -1) {
    owner.hand.splice(handIdx, 1);
    return;
  }
  if (owner.weapon === card) owner.weapon = null;
  else if (owner.armor === card) owner.armor = null;
  else if (owner.defenseHorse === card) owner.defenseHorse = null;
  else if (owner.offenseHorse === card) owner.offenseHorse = null;
  else return; // defensive no-op: not actually one of owner's cards
  // SilverLion (armor, Milestone 34): heals 1 hp on leaving the equip zone while alive+wounded --
  // fires for ANY equip-zone departure (Dismantlement/Snatch/IceSword alike), matching the real
  // rule's unconditional "after it leaves your equip zone" trigger, not just being replaced by a
  // new armor (see room.ts's `equip` for that other departure path).
  if (card.armorName === "SilverLion" && owner.alive && owner.isWounded()) {
    await heal(ctx, owner, 1);
    ctx.log.push(`${owner.id} hồi 1 máu do Bạch Ngân Sư Tử rời trang bị`);
  }
  for (const skill of owner.skills) await skill.onEquipLost?.(ctx, owner);
}

function takeCard(hand: Card[], kind: CardKind): Card | null {
  const idx = hand.findIndex((c) => c.kind === kind);
  if (idx === -1) return null;
  return hand.splice(idx, 1)[0];
}

/** A real Jink card, or (e.g. Longdan/Qingguo) the first card some skill allows viewing as
 *  Jink, or (Ao Chiến, Hegemony's late-game rule) a held Peach -- once Ao Chiến disables
 *  Peach's rescue/heal effect (see `findRescueCard`'s own `aoChienActive` gate), the real rule
 *  lets it substitute for Slash or Jink instead. */
export function findJinkLikeCard(player: GamePlayer, aoChienActive = false): Card | null {
  const real = player.hand.find((c) => c.kind === CardKind.Jink);
  if (real) return real;
  for (const skill of player.skills) {
    if (!skill.canViewAsJink) continue;
    const viewed = player.hand.find((c) => skill.canViewAsJink!(c, player));
    if (viewed) return viewed;
  }
  if (aoChienActive) {
    const peach = player.hand.find((c) => c.kind === CardKind.Peach);
    if (peach) return peach;
  }
  return null;
}

/** A real Peach or Analeptic card (both heal 1 hp during a dying rescue -- see Analeptic's OTHER,
 *  Play-phase-only damage-boost use in `resolveAnalepticBuff`/`resolveSlash`'s consumption of
 *  `pendingSlashBonusDamage` below), or (e.g. Jijiu) the first card some skill allows viewing as
 *  a Peach. `aoChienActive` (Hegemony's late-game rule): once true, Peach (real OR any
 *  canViewAsPeach substitution -- both are the same "played as Peach" rescue) no longer rescues
 *  at all; Analeptic's rescue is untouched (the real rule only restricts 桃/Peach specifically). */
function findRescueCard(player: GamePlayer, aoChienActive: boolean): Card | null {
  const real = player.hand.find((c) => c.kind === CardKind.Analeptic || (!aoChienActive && c.kind === CardKind.Peach));
  if (real) return real;
  if (aoChienActive) return null;
  for (const skill of player.skills) {
    if (!skill.canViewAsPeach) continue;
    const viewed = player.hand.find((c) => skill.canViewAsPeach!(c, player));
    if (viewed) return viewed;
  }
  return null;
}

/** "peach"/"analeptic" for a REAL Peach or Analeptic card (both are the card's own built-in
 *  rescue ability, not a skill reinterpretation); null for anything else (a genuine viewAs
 *  substitution, e.g. Jijiu's red card) -- resolveDying uses this to log the right card kind
 *  instead of always assuming "peach". */
function rescueCardLabel(card: Card): "peach" | "analeptic" | null {
  if (card.kind === CardKind.Peach) return "peach";
  if (card.kind === CardKind.Analeptic) return "analeptic";
  return null;
}

/** A real Slash card, or (e.g. Wusheng/Longdan) the first card some skill allows viewing as
 *  Slash, or (Ao Chiến) a held Peach -- see `findJinkLikeCard`'s doc comment for why. */
export function findSlashLikeCard(player: GamePlayer, aoChienActive = false): Card | null {
  const real = player.hand.find((c) => c.kind === CardKind.Slash);
  if (real) return real;
  for (const skill of player.skills) {
    if (!skill.canViewAsSlash) continue;
    const viewed = player.hand.find((c) => skill.canViewAsSlash!(c, player));
    if (viewed) return viewed;
  }
  if (aoChienActive) {
    const peach = player.hand.find((c) => c.kind === CardKind.Peach);
    if (peach) return peach;
  }
  // Fan (weapon): any ONE held non-Slash card may be played/discarded as if it were a Slash --
  // same single-card viewAs shape as Wusheng/Longdan above, just weapon-gated instead of
  // skill-gated, so it plugs into every existing consumer of this function (Duel exchanges,
  // Savage Assault's discard-a-slash choice, etc.) for free.
  if (player.weapon?.weaponName === "Fan") {
    const nonSlash = player.hand.find((c) => c.kind !== CardKind.Slash);
    if (nonSlash) return nonSlash;
  }
  return null;
}

/** Every real Slash card plus every card a skill allows viewing as Slash (e.g. Wusheng/Longdan)
 *  plus (Ao Chiến) every held Peach -- unlike `findSlashLikeCard`, returns ALL matches, not
 *  just the first, for a freeform Play phase's legal-action list (see room.ts's
 *  `computeLegalActions`). */
export function allSlashLikeCards(player: GamePlayer, aoChienActive = false): Card[] {
  const cards = player.hand.filter((c) => c.kind === CardKind.Slash);
  for (const skill of player.skills) {
    if (!skill.canViewAsSlash) continue;
    for (const c of player.hand) {
      if (c.kind !== CardKind.Slash && skill.canViewAsSlash(c, player) && !cards.includes(c)) cards.push(c);
    }
  }
  if (aoChienActive) {
    for (const c of player.hand) {
      if (c.kind === CardKind.Peach && !cards.includes(c)) cards.push(c);
    }
  }
  if (player.weapon?.weaponName === "Fan") {
    for (const c of player.hand) {
      if (c.kind !== CardKind.Slash && !cards.includes(c)) cards.push(c);
    }
  }
  return cards;
}

/** A real Dismantlement card, or (e.g. Qixi) the first card some skill allows viewing as one. */
export function findDismantlementLikeCard(player: GamePlayer): Card | null {
  const real = player.hand.find((c) => c.kind === CardKind.Dismantlement);
  if (real) return real;
  for (const skill of player.skills) {
    if (!skill.canViewAsDismantlement) continue;
    const viewed = player.hand.find((c) => skill.canViewAsDismantlement!(c, player));
    if (viewed) return viewed;
  }
  return null;
}

/** Every real Dismantlement card plus every card a skill allows viewing as one (e.g. Qixi) --
 *  see `allSlashLikeCards`'s header for why this exists alongside `findDismantlementLikeCard`. */
export function allDismantlementLikeCards(player: GamePlayer): Card[] {
  const cards = player.hand.filter((c) => c.kind === CardKind.Dismantlement);
  for (const skill of player.skills) {
    if (!skill.canViewAsDismantlement) continue;
    for (const c of player.hand) {
      if (c.kind !== CardKind.Dismantlement && skill.canViewAsDismantlement(c, player) && !cards.includes(c)) cards.push(c);
    }
  }
  return cards;
}

/** A real Duel card, or (e.g. Shuangxiong) the first card some skill allows viewing as one. */
export function findDuelLikeCard(player: GamePlayer): Card | null {
  const real = player.hand.find((c) => c.kind === CardKind.Duel);
  if (real) return real;
  for (const skill of player.skills) {
    if (!skill.canViewAsDuel) continue;
    const viewed = player.hand.find((c) => skill.canViewAsDuel!(c, player));
    if (viewed) return viewed;
  }
  return null;
}

/** Every real Duel card plus every card a skill allows viewing as one (e.g. Shuangxiong) -- see
 *  `allSlashLikeCards`'s header for why this exists alongside `findDuelLikeCard`. */
export function allDuelLikeCards(player: GamePlayer): Card[] {
  const cards = player.hand.filter((c) => c.kind === CardKind.Duel);
  for (const skill of player.skills) {
    if (!skill.canViewAsDuel) continue;
    for (const c of player.hand) {
      if (c.kind !== CardKind.Duel && skill.canViewAsDuel(c, player) && !cards.includes(c)) cards.push(c);
    }
  }
  return cards;
}

/** A real Indulgence card, or (e.g. Daqiao's Guose) the first card some skill allows viewing
 *  as one. */
export function findIndulgenceLikeCard(player: GamePlayer): Card | null {
  const real = player.hand.find((c) => c.kind === CardKind.Indulgence);
  if (real) return real;
  for (const skill of player.skills) {
    if (!skill.canViewAsIndulgence) continue;
    const viewed = player.hand.find((c) => skill.canViewAsIndulgence!(c, player));
    if (viewed) return viewed;
  }
  return null;
}

/** Every real Indulgence card plus every card a skill allows viewing as one (e.g. Guose) --
 *  see `allSlashLikeCards`'s header for why this exists alongside `findIndulgenceLikeCard`. */
export function allIndulgenceLikeCards(player: GamePlayer): Card[] {
  const cards = player.hand.filter((c) => c.kind === CardKind.Indulgence);
  for (const skill of player.skills) {
    if (!skill.canViewAsIndulgence) continue;
    for (const c of player.hand) {
      if (c.kind !== CardKind.Indulgence && skill.canViewAsIndulgence(c, player) && !cards.includes(c)) cards.push(c);
    }
  }
  return cards;
}

/** A real SupplyShortage card, or (e.g. Xu Huang's Duanliang) the first card some skill allows
 *  viewing as one. */
export function findSupplyShortageLikeCard(player: GamePlayer): Card | null {
  const real = player.hand.find((c) => c.kind === CardKind.SupplyShortage);
  if (real) return real;
  for (const skill of player.skills) {
    if (!skill.canViewAsSupplyShortage) continue;
    const viewed = player.hand.find((c) => skill.canViewAsSupplyShortage!(c, player));
    if (viewed) return viewed;
  }
  return null;
}

/** Every real SupplyShortage card plus every card a skill allows viewing as one (e.g.
 *  Duanliang) -- see `allSlashLikeCards`'s header for why this exists alongside
 *  `findSupplyShortageLikeCard`. */
export function allSupplyShortageLikeCards(player: GamePlayer): Card[] {
  const cards = player.hand.filter((c) => c.kind === CardKind.SupplyShortage);
  for (const skill of player.skills) {
    if (!skill.canViewAsSupplyShortage) continue;
    for (const c of player.hand) {
      if (c.kind !== CardKind.SupplyShortage && skill.canViewAsSupplyShortage(c, player) && !cards.includes(c)) cards.push(c);
    }
  }
  return cards;
}

/** A real FireAttack card, or (e.g. Wolong's Huoji) the first card some skill allows viewing
 *  as one. */
export function findFireAttackLikeCard(player: GamePlayer): Card | null {
  const real = player.hand.find((c) => c.kind === CardKind.FireAttack);
  if (real) return real;
  for (const skill of player.skills) {
    if (!skill.canViewAsFireAttack) continue;
    const viewed = player.hand.find((c) => skill.canViewAsFireAttack!(c, player));
    if (viewed) return viewed;
  }
  return null;
}

/** Every real FireAttack card plus every card a skill allows viewing as one (e.g. Huoji) --
 *  see `allSlashLikeCards`'s header for why this exists alongside `findFireAttackLikeCard`. */
export function allFireAttackLikeCards(player: GamePlayer): Card[] {
  const cards = player.hand.filter((c) => c.kind === CardKind.FireAttack);
  for (const skill of player.skills) {
    if (!skill.canViewAsFireAttack) continue;
    for (const c of player.hand) {
      if (c.kind !== CardKind.FireAttack && skill.canViewAsFireAttack(c, player) && !cards.includes(c)) cards.push(c);
    }
  }
  return cards;
}

/** True if any of `player`'s skills (e.g. Kongcheng) make them immune to Slash/Duel targeting right now. */
export function isImmuneToSlashAndDuel(player: GamePlayer): boolean {
  return player.skills.some((skill) => skill.immuneToSlashAndDuel?.(player));
}

/** True if any of `player`'s skills (e.g. Qianxun) make them immune to Snatch targeting right now. */
export function isImmuneToSnatch(player: GamePlayer): boolean {
  return player.skills.some((skill) => skill.immuneToSnatch?.(player));
}

/** KnownBoth's private reveal payload (Milestone 31) -- either the target's full hand, or the
 *  name of one of their still-hidden generals (Hegemony mode). Delivered to exactly ONE viewer
 *  via `EngineContext.revealPrivately` below -- never touches `ctx.log`, which every player/
 *  spectator sees identically. */
export type PrivateReveal =
  | { kind: "hand"; ownerId: string; cards: Card[] }
  | { kind: "general"; ownerId: string; generalName: string; slot: "main" | "deputy" };

/** KnownBoth's own choice of what to view about a target -- see `revealPrivately`/`PrivateReveal`
 *  above. "head_general"/"deputy_general" are only ever offered in Hegemony mode (Identity mode
 *  never leaves a general hidden). */
export type KnownBothOption = "handcards" | "head_general" | "deputy_general";

/** Shared engine-callback surface for combat.ts and trick.ts card resolution. */
export interface EngineContext {
  alivePlayers: GamePlayer[];
  discardPile: Card[];
  log: string[];
  /** Shared PRNG, for skill hooks that need randomness without threading an `rng` param through
   *  every call site (e.g. picking a random discarded card for Guzheng). */
  rng: () => number;
  draw: (player: GamePlayer, n: number) => void;
  /** Pops one card off the draw pile (reshuffling the discard pile in if needed) without giving
   *  it to any player -- for one-off judgment reveals (e.g. Ganglie). Caller must push it to
   *  discardPile when done inspecting it. */
  drawTop: () => Card | null;
  /** `killer` is the actual player credited with the kill -- present exactly when real combat
   *  knows the specific attacker (Slash/Duel/AOE damage always does); absent for `loseHp`
   *  (a self-inflicted loss credits nobody, e.g. Kurou) and for Room.damagePlayer's test-only
   *  scripted-damage bypass, so kill-rewards keyed off a real killer (e.g. "kill a Rebel, draw
   *  3") don't fire for those paths. */
  onDying: (player: GamePlayer, killer?: GamePlayer) => void;
  /** Fired right after hp is reduced, before the dying/Peach-rescue check -- general skill hooks
   *  on the DAMAGED player (e.g. Ganglie) attach here. */
  onDamage?: (target: GamePlayer, source: GamePlayer) => Promise<void> | void;
  /** Fired right after damage lands, before the dying/Peach-rescue check -- general skill hooks
   *  on the ATTACKING player (e.g. Kuanggu) attach here. */
  onDamageDealt?: (source: GamePlayer, target: GamePlayer, amount: number) => Promise<void> | void;
  /** Does `player` want to play a held Jink against an incoming Slash? Only called when they hold one. */
  askDodge: (player: GamePlayer) => Promise<boolean>;
  /** Nullification/HegNullification counter-play window (Milestone 31): offered once before
   *  `kind` (played by `source`) takes effect against `target` -- `blocked: true` means it got
   *  cancelled (the caller must skip applying the effect to `target`); `shieldFaction`
   *  (Hegemony HegNullification "all" scope only, always null otherwise) means every OTHER
   *  still-untouched target sharing that faction in the SAME AOE resolution should be
   *  auto-skipped too, no new ask. See room.ts's `resolveNullificationWindow` for the actual
   *  recursive chain (a played Nullification is itself counter-nullifiable) -- lives on Room,
   *  not here, since it needs discard-pile/controller access this context already threads
   *  through; this is just the thin callback trick.ts's 2 AOE resolvers (SavageAssault/
   *  ArcheryAttack, the only ones with real per-target granularity -- every other trick kind is
   *  offered a single whole-card-use window directly at room.ts's `tryPlayOnce`/
   *  `tryPlayTargeted`/`tryPlayDelayedTrick`, not through this context at all) actually call. */
  askNullification: (source: GamePlayer, target: GamePlayer, kind: CardKind) => Promise<{ blocked: boolean; shieldFaction: string | null }>;
  /** KnownBoth (Milestone 31): privately reveals `reveal` to `viewer` ONLY -- see
   *  `PrivateReveal`'s own doc comment. A no-op for a bot-controlled seat (nobody is listening
   *  on the other end); wired by `Room.setPrivateRevealCallback` (mirrors the existing
   *  `setLiveUpdateCallback` hook) straight to a one-way message sent to just that viewer's own
   *  socket (server.ts's `notifyClient`), entirely bypassing the shared broadcast snapshot. */
  revealPrivately: (viewer: GamePlayer, reveal: PrivateReveal) => void;
  /** KnownBoth (Milestone 31): `player` picks what to privately view about `target` -- their
   *  hand, or (Hegemony) one of their still-hidden generals. `options` is always non-empty
   *  (trick.ts's `resolveKnownBoth` only calls this when there's something to offer). An
   *  invalid/missing response falls back to `options[0]`. */
  askKnownBothChoice: (player: GamePlayer, target: GamePlayer, options: KnownBothOption[]) => Promise<KnownBothOption>;
  /** Does `player` want to play a held Peach (or Analeptic, which heals identically during a
   *  rescue -- see its OTHER, unrelated Play-phase damage-boost use below) to recover while
   *  dying? Only called when they hold one. */
  askPeach: (player: GamePlayer) => Promise<boolean>;
  /** Does `player` want to play a held Slash to continue a Duel exchange? Only called when they hold one. */
  askDuelSlash: (player: GamePlayer) => Promise<boolean>;
  /** Does `player` want to discard 2 cards (vs. take 1 damage) for Ganglie? Only called when they have >=2 cards. */
  askGanglieDiscard: (player: GamePlayer) => Promise<boolean>;
  /** Does `player` want to invoke `skillName` right now? Generic optional-invoke gate reused by
   *  every proactive/reactive skill added since Milestone 2.6 batch 2 (not just Play-phase self
   *  actions like Kurou any more -- the name stuck, the shape is now "wants to use this skill"). */
  askUseSelfAction: (player: GamePlayer, skillName: string) => Promise<boolean>;
  /** Generic single-target picker with no built-in range/kind filter -- `candidates` is
   *  pre-filtered by the caller (e.g. to allies, or to wounded players). Returns null to decline. */
  askChooseAnyPlayer: (player: GamePlayer, candidates: GamePlayer[]) => Promise<GamePlayer | null>;
  /** Does `player` want to discard a held Slash (vs. take 1 damage) for Savage Assault? Only
   *  called when they hold one -- real Sanguosha makes this the player's choice, not automatic. */
  askSavageAssaultSlash: (player: GamePlayer) => Promise<boolean>;
  /** Does `player` want to discard a held Jink (vs. take 1 damage) for Archery Attack? Only
   *  called when they hold one -- same "player's choice, not automatic" rule as above. */
  askArcheryAttackJink: (player: GamePlayer) => Promise<boolean>;
  /** Amazing Grace: `player`'s turn to take exactly one card from the still-face-up
   *  `candidates` pool. Must return one of `candidates` -- an invalid/missing return falls back
   *  to `candidates[0]` (see trick.ts's resolveAmazingGrace). */
  askPickCard: (player: GamePlayer, candidates: Card[]) => Promise<Card>;
  /** Dismantlement/Snatch (and similarly-shaped "take/discard one of a target's cards" effects):
   *  `player` chooses exactly one of `owner`'s cards from `candidates` -- both hand and equipped
   *  cards are eligible. Must return one of `candidates` -- an invalid/missing return falls back
   *  to `candidates[0]` (see trick.ts's resolveDismantlement/resolveSnatch). See
   *  Controller.choosePlayerCard for the visibility rule enforced at the WS boundary: equip is
   *  always public, hand cards are chosen positionally/blind, matching real Sanguosha. */
  askPickPlayerCard: (player: GamePlayer, owner: GamePlayer, candidates: Card[]) => Promise<Card>;
  /** Kylin Bow (weapon): after a Slash you wielded it with deals damage to a target with at
   *  least 1 horse equipped, you may destroy one of their horse cards. Only called when the
   *  wielder actually has one to destroy. */
  askUseKylinBow: (player: GamePlayer) => Promise<boolean>;
  /** IceSword (weapon): after a Slash you wielded it with WOULD deal damage, you may cancel
   *  that damage entirely and instead pick (as the attacker) up to 2 of the target's cards
   *  (hand or equipped) to discard. Only called when the target actually has >=1 card. */
  askUseIceSword: (player: GamePlayer) => Promise<boolean>;
  /** Axe (weapon): after your Slash gets dodged, you may discard 2 of your OWN cards to force
   *  it to hit anyway. Only called when you actually hold >=2 cards. */
  askUseAxe: (player: GamePlayer) => Promise<boolean>;
  /** EightDiagram (armor, Milestone 34): `player` holds no real/viewAs Jink and is about to
   *  take Slash damage -- invoke the armor's own optional judgment-based backup dodge (red =
   *  dodged)? Only called when they actually have EightDiagram equipped and no Jink was found. */
  askUseEightDiagram: (player: GamePlayer) => Promise<boolean>;
  /** DoubleSword (weapon): after a Slash you wielded it with deals damage to a target of the
   *  OPPOSITE gender, you (the wielder) may invoke it. */
  askUseDoubleSword: (player: GamePlayer) => Promise<boolean>;
  /** DoubleSword follow-up: does the TARGET want to discard 1 of their own (random) cards
   *  instead of letting the wielder draw 1? Only called when they actually hold >=1 card. */
  askDiscardForDoubleSword: (player: GamePlayer) => Promise<boolean>;
  /** Ally rescue: does `rescuer` want to play a held Peach/Analeptic (or viewAs, e.g. Jijiu) to
   *  save `dyingPlayer`? Only called when `rescuer` actually holds one -- asked of every OTHER
   *  alive player, in turn order starting right after the dying player, only once the dying
   *  player's own self-rescue (`askPeach`) has declined or run out. */
  askPeachForOther: (rescuer: GamePlayer, dyingPlayer: GamePlayer) => Promise<boolean>;
  /** Fired once, right when a player's hp first drops to <=0, before the Peach-rescue loop --
   *  broadcast to every OTHER alive player's skills (e.g. Tianfeng's Suishi). */
  onDyingStarted?: (player: GamePlayer) => Promise<void> | void;
  /** Guanxing (Zhuge Liang): peeks at the top `n` cards of the draw pile WITHOUT removing them,
   *  in draw order (index 0 would be drawn next). Simply caps at however many cards are
   *  actually left if the pile is short -- no forced reshuffle-in for this look-ahead-only
   *  effect (kept simple; reshuffling every time the pile runs low mid-peek would be a rare
   *  edge case not worth the extra state churn). */
  peekTop: (n: number) => Card[];
  /** Re-stacks the exact cards a prior `peekTop` call returned: `top` goes back immediately on
   *  top of the remaining pile (drawn soonest, in the given order -- top[0] drawn before
   *  top[1]), `bottom` goes underneath the entire remaining pile (drawn last, in the given
   *  order -- bottom[0] drawn before bottom[1] once the deck gets that deep). `top.length +
   *  bottom.length` must equal the last `peekTop` call's return length. */
  arrangeTop: (top: Card[], bottom: Card[]) => void;
  /** Guanxing: `player` looked at `revealed` (see `peekTop`) and decides which of them go to
   *  the bottom of the pile; everything else stays on top in its original relative order (this
   *  port simplifies Guanxing's real free-form reorder down to a top/bottom split -- see
   *  skill.ts's header for why). Returns the ids of cards to bury; an empty result leaves the
   *  pile exactly as `peekTop` found it. */
  askGuanxingBottom: (player: GamePlayer, revealed: Card[]) => Promise<Set<number>>;
  /** Guicai (Sima Yi): `player` may replace an in-progress judgment's `currentCard` (owned by
   *  `judgeOwner`, for skill `reason`) with a card from their own hand (a "retrial" --
   *  bổ sung phán đoán). Returns the chosen replacement card (already confirmed present in
   *  `player.hand`) or null to decline. Only ever called when `player.hand.length > 0`. */
  askGuicaiRetrial: (player: GamePlayer, judgeOwner: GamePlayer, currentCard: Card, reason: string) => Promise<Card | null>;
  /** Generic "pick exactly `count` cards from your own hand" ask -- reuses the same
   *  Controller method / client UI as the end-of-turn Discard phase (`chooseDiscards`), for
   *  self-paid multi-card costs elsewhere (e.g. Jieyin, Dimeng). Falls back to
   *  `pickLeastImportantCards` on an invalid response, same defensive behavior as the Discard
   *  phase itself. Returns fewer than `count` only if `player` doesn't hold that many. */
  askChooseDiscards: (player: GamePlayer, count: number) => Promise<Card[]>;
  /** Generic "freely pick [min, max] of your own hand cards" ask (e.g. Liu Bei's Rende, Sun
   *  Quan's Zhiheng, Yuan Shao's Luanji) -- see `Controller.chooseAnyHandCards`'s doc comment.
   *  Returns `[]` for any declined/invalid response, never a forced fallback substitution. */
  askAnyHandCards: (player: GamePlayer, min: number, max: number) => Promise<Card[]>;
  /** Zhijian (Erzhang): equips `card` (already detached from its owner's hand by the caller)
   *  onto `target`'s matching slot (weapon, or the appropriate horse by `horseDelta`) --
   *  identical mechanics to a player equipping their own card (discards whatever was there,
   *  fires `onEquipLost` on `target`), just retargetable to someone other than the card's
   *  original owner. */
  equipPlayer: (target: GamePlayer, card: Card) => Promise<void>;
  /** Hegemony mode only (Milestone 23 addendum "Ao Chiến"/鏖战, always false in Identity mode):
   *  once true, Peach no longer rescues/heals anyone for the rest of the game -- instead
   *  (matching the real rule exactly) it becomes playable/discardable as Slash or Jink, see
   *  `findRescueCard`'s own gate for the heal-disable half and `findSlashLikeCard`/
   *  `findJinkLikeCard`/`allSlashLikeCards`'s `aoChienActive` param for the substitution half. */
  aoChienActive: boolean;
  /** True once `Room.gameOver` has been decided (win condition already fired) -- consulted by
   *  SavageAssault/ArcheryAttack's per-target loop (the only 2 resolvers that can span MULTIPLE
   *  sequential kills in one card use) so a later target's death, judgment-triggered reactive
   *  damage (e.g. Ganglie), etc. can never happen AFTER the winners list was already frozen --
   *  a real bug found live (seed 1, Hegemony, Milestone 34's larger deck shifting the RNG
   *  stream onto a game where a Savage Assault's 3rd of 7 targets' death ended the match, but
   *  its still-pending 4th-7th targets kept taking damage/triggering Ganglie afterward, killing
   *  ANOTHER already-declared "winner" with nothing left to re-run checkWinCondition -- the
   *  frozen winners list then no longer matched who was actually still alive). */
  isGameOver: () => boolean;
}

/** Vietnamese card-suit names for judge-card log lines (Ganglie/Tieqi/Shuangxiong/Leiji/Beige/
 *  Indulgence). Lives here (not skill.ts) so `judge()` below can be shared by both skill.ts
 *  (self-triggered judgments) and trick.ts (delayed-trick judge-area judgments) without a
 *  circular import -- trick.ts already imports from combat.ts, and skill.ts imports from
 *  trick.ts (`resolveDuel`), so `judge` can't live in either of those two without creating a
 *  cycle; combat.ts is the shared base both already depend on. */
export const SUIT_LABEL_VI: Record<Suit, string> = {
  [Suit.Spade]: "Bích",
  [Suit.Heart]: "Cơ",
  [Suit.Club]: "Chuồn",
  [Suit.Diamond]: "Rô",
};

/** Player::judge equivalent: draws the top card as a judgment for `judgeOwner` (skill `reason`,
 *  used only for the retrial log line), then gives every alive player's `onJudgment` skills
 *  (e.g. Sima Yi's Guicai) a chance to replace the result with a card from their own hand -- a
 *  "retrial" (bổ sung phán đoán), which the REAL Sanguosha rule applies to EVERY judgment, not
 *  just delayed-trick judge-area ones, so this wraps every implemented judgment site uniformly
 *  instead of hardcoding Guicai into each one. The original drawn card, and any card
 *  overridden by a later retrial, are immediately voided to the discard pile; only the FINAL
 *  effective card is returned, for the caller to dispose of per their own skill's rule (most
 *  discard it after logging, ideally via `disposeJudgmentCard` below so Tiandu can claim it;
 *  Shuangxiong instead gives it to the judged player's hand unconditionally). Returns null if
 *  the draw pile is exhausted. */
export async function judge(ctx: EngineContext, judgeOwner: GamePlayer, reason: string): Promise<Card | null> {
  let effective = ctx.drawTop();
  if (!effective) return null;
  // Self-only suit reinterpretation (e.g. Xiao Qiao's Hongyan: her own Spade judgment card may
  // become a Heart) -- consulted BEFORE the broadcast onJudgment retrial loop below, since a
  // retrial replaces the card outright while this only reinterprets the same physical one.
  for (const skill of judgeOwner.skills) {
    if (skill.filtersOwnJudgment) await skill.filtersOwnJudgment(ctx, judgeOwner, effective);
  }
  for (const p of ctx.alivePlayers) {
    for (const skill of p.skills) {
      if (!skill.onJudgment || p.hand.length === 0) continue;
      const retrial = await skill.onJudgment(ctx, p, judgeOwner, effective, reason);
      if (!retrial) continue;
      const idx = p.hand.indexOf(retrial);
      if (idx === -1) continue; // defensive: a misbehaving controller named a card not actually held
      p.hand.splice(idx, 1);
      ctx.discardPile.push(effective); // the overridden card is voided
      ctx.log.push(`${p.id} dùng ${skill.displayName}, thay phán quyết bằng ${SUIT_LABEL_VI[retrial.suit]} ${retrial.point}`);
      effective = retrial;
    }
  }
  return effective;
}

/** Disposes of a resolved judgment card (from `judge()` above) to the discard pile, unless
 *  `judgeOwner`'s own skill claims it into their hand instead (e.g. Guojia's Tiandu -- "after
 *  your judgment takes effect, you may take it"). Only relevant when `judgeOwner` actually owns
 *  a `claimsOwnJudgment`-style skill; a no-op discard otherwise. */
export async function disposeJudgmentCard(ctx: EngineContext, judgeOwner: GamePlayer, card: Card): Promise<void> {
  for (const skill of judgeOwner.skills) {
    if (!skill.claimsOwnJudgment) continue;
    if (await skill.claimsOwnJudgment(ctx, judgeOwner)) {
      judgeOwner.hand.push(card);
      ctx.log.push(`${judgeOwner.id} thu lấy kết quả phán xét (tiandu)`);
      return;
    }
  }
  ctx.discardPile.push(card);
}

/** Resolves one Slash from `attacker` at `target`: Jink cancels it, otherwise 1 damage + dying check. */
export async function resolveSlash(
  ctx: EngineContext,
  attacker: GamePlayer,
  target: GamePlayer,
  slashCard: Card,
): Promise<void> {
  ctx.discardPile.push(slashCard);
  ctx.log.push(`${attacker.id} xuất Sát vào ${target.id}`);
  attacker.playedSlashThisTurn = true;
  // Analeptic's damage-boost mark ("drank") is consumed the instant a Slash begins resolving --
  // matches the upstream engine's `Slash::onEffect`, which reads/clears it before the Jink-dodge
  // check even runs. A dodged (or nullified) Slash still wastes an already-armed bonus.
  const analepticBonus = attacker.pendingSlashBonusDamage;
  attacker.pendingSlashBonusDamage = 0;

  // Defender's onIncomingSlash (e.g. Liushan's Xiangle: nullify; Daqiao's Liuli: redirect) --
  // evaluated before anything else, since a redirect changes who the rest of resolution targets.
  let effectiveTarget = target;
  for (const skill of target.skills) {
    if (!skill.onIncomingSlash) continue;
    const result = await skill.onIncomingSlash(ctx, attacker, target);
    if (result?.nullify) {
      ctx.log.push(`${target.id} vô hiệu hóa Sát`);
      return;
    }
    if (result?.redirectTo && result.redirectTo.alive && result.redirectTo !== target) {
      ctx.log.push(`${target.id} chuyển hướng Sát sang ${result.redirectTo.id}`);
      effectiveTarget = result.redirectTo;
      break;
    }
  }

  // RenwangShield/Vine (Milestone 34, both "Tỏa định kỹ" -- locked, no ask): a Slash whose
  // effect is nullified outright by the target's own armor never even reaches the Jink-ask --
  // matches the real engine's Global_NonSkillNullify short-circuit (checked against
  // `effectiveTarget`, not `target`, so a Liushan/Daqiao redirect above correctly checks the
  // NEW target's own armor). RenwangShield blocks any BLACK-suited Slash; Vine blocks any
  // Normal-nature Slash (Fire/Thunder still connect -- see applyDamage's own +1 Fire penalty).
  // Known gap: QinggangSword's real "ignores the target's armor" ability isn't ported -- an
  // attacker wielding it should bypass this whole check, but doesn't (see library.ts's
  // WEAPON_DESCRIPTION for the same note surfaced in-client).
  if (
    (effectiveTarget.armor?.armorName === "RenwangShield" && (slashCard.suit === Suit.Spade || slashCard.suit === Suit.Club)) ||
    (effectiveTarget.armor?.armorName === "Vine" && (slashCard.nature ?? DamageNature.Normal) === DamageNature.Normal)
  ) {
    ctx.log.push(
      `${effectiveTarget.id} miễn nhiễm Sát này (${effectiveTarget.armor.armorName === "RenwangShield" ? "nhân vương thuẫn" : "đằng giáp"})`,
    );
    return;
  }

  let dodgeBlocked = false;
  for (const skill of attacker.skills) {
    if (skill.onSlashTargeted && (await skill.onSlashTargeted(ctx, attacker, effectiveTarget))) dodgeBlocked = true;
  }

  // responseCountRequired (e.g. Lu Bu's Wushuang: needs 2 Jinks) -- defaults to 1 for every
  // skill/player that doesn't define it, so this is a no-op for the vast majority of dodges.
  const requiredJinks = dodgeBlocked
    ? 0
    : Math.max(1, ...effectiveTarget.skills.map((s) => s.responseCountRequired?.("dodge", effectiveTarget) ?? 1));
  const firstJink = requiredJinks > 0 ? findJinkLikeCard(effectiveTarget, ctx.aoChienActive) : null;
  // `dodgedVia` unifies the 2 ways a dodge can succeed (a real/viewAs Jink, or EightDiagram's
  // own judgment-based backup below) so the shared post-dodge steps (onSlashDodged broadcast,
  // Axe's force-through offer) only need to be written once, regardless of which one fired.
  let dodgedVia: "jink" | "eightDiagram" | null = null;
  if (firstJink && (await ctx.askDodge(effectiveTarget))) {
    const spent = [firstJink];
    effectiveTarget.hand.splice(effectiveTarget.hand.indexOf(firstJink), 1);
    let allFound = true;
    for (let i = 1; i < requiredJinks; i++) {
      const next = findJinkLikeCard(effectiveTarget, ctx.aoChienActive);
      if (!next) {
        allFound = false;
        break;
      }
      effectiveTarget.hand.splice(effectiveTarget.hand.indexOf(next), 1);
      spent.push(next);
    }
    if (!allFound) {
      // Couldn't complete the required set (e.g. only 1 of Wushuang's 2 jinks): nothing was
      // actually played, so return the tentatively-removed card(s) to hand instead of discarding.
      effectiveTarget.hand.push(...spent);
      ctx.log.push(`${effectiveTarget.id} không đủ ${requiredJinks} lá Thiểm nên chịu đòn`);
    } else {
      ctx.discardPile.push(...spent);
      for (const c of spent) {
        if (c.kind !== CardKind.Jink) ctx.log.push(`${effectiveTarget.id} biến 1 lá bài thành Thiểm (kỹ năng biến hóa)`);
      }
      ctx.log.push(`${effectiveTarget.id} né bằng Thiểm${spent.length > 1 ? ` (x${spent.length})` : ""}`);
      dodgedVia = "jink";
    }
  } else if (
    requiredJinks > 0 &&
    effectiveTarget.armor?.armorName === "EightDiagram" &&
    (await ctx.askUseEightDiagram(effectiveTarget))
  ) {
    // EightDiagram (Bát Quái Trận): optional -- offered only once no real/viewAs Jink was found
    // (a real simplification: the true rule lets a player invoke it even while HOLDING a real
    // Jink, to save the Jink for later; here it's strictly a backup, same "faithful behavior,
    // simplified interaction" precedent as this port's other single-choice-instead-of-a-genuine-
    // strategic-tradeoff simplifications, e.g. IronChain's dropped recast). Judges a card (same
    // shared `judge()` helper as every other judgment, so Guicai retrial etc. still applies);
    // red counts as a successful dodge, matching the real card text exactly.
    const judgeCard = await judge(ctx, effectiveTarget, "eight_diagram");
    if (judgeCard) {
      ctx.log.push(`${effectiveTarget.id} phán Bát Quái Trận: ${SUIT_LABEL_VI[judgeCard.suit]} ${judgeCard.point}`);
      const isRed = judgeCard.suit === Suit.Heart || judgeCard.suit === Suit.Diamond;
      await disposeJudgmentCard(ctx, effectiveTarget, judgeCard);
      if (isRed) {
        ctx.log.push(`${effectiveTarget.id} né bằng Bát Quái Trận`);
        dodgedVia = "eightDiagram";
      }
    }
  }

  if (dodgedVia) {
    for (const skill of attacker.skills) await skill.onSlashDodged?.(ctx, attacker, effectiveTarget);
    for (const skill of effectiveTarget.skills) await skill.onSlashDodged?.(ctx, attacker, effectiveTarget);
    // Axe (weapon): may discard 2 of your OWN cards to force this dodged slash through anyway
    // (a real, EightDiagram-dodged, or viewAs Jink alike -- the real rule doesn't distinguish).
    if (attacker.weapon?.weaponName === "Axe" && attacker.hand.length >= 2 && (await ctx.askUseAxe(attacker))) {
      for (let i = 0; i < 2; i++) {
        const idx = Math.floor(ctx.rng() * attacker.hand.length);
        ctx.discardPile.push(attacker.hand.splice(idx, 1)[0]);
      }
      ctx.log.push(`${attacker.id} bỏ 2 lá bài, buộc Sát trúng đòn (axe)`);
    } else {
      return;
    }
  }
  // IceSword (weapon): may cancel this slash's damage entirely and, in its place, let the
  // attacker pick up to 2 of the target's cards (hand or equip) to discard -- resolved BEFORE
  // applyDamage since it replaces the hit outright, not a reaction to it.
  if (
    attacker.weapon?.weaponName === "IceSword" &&
    (effectiveTarget.hand.length > 0 || effectiveTarget.weapon || effectiveTarget.defenseHorse || effectiveTarget.offenseHorse) &&
    (await ctx.askUseIceSword(attacker))
  ) {
    ctx.log.push(`${attacker.id} dùng Hàn Băng Kiếm: hủy sát thương, bắt ${effectiveTarget.id} bỏ bài thay vào`);
    for (let i = 0; i < 2; i++) {
      const candidates = [effectiveTarget.weapon, effectiveTarget.defenseHorse, effectiveTarget.offenseHorse, ...effectiveTarget.hand].filter(
        (c): c is Card => c !== null,
      );
      if (candidates.length === 0) break;
      const chosen = await ctx.askPickPlayerCard(attacker, effectiveTarget, candidates);
      await detachCardFrom(ctx, effectiveTarget, chosen);
      ctx.discardPile.push(chosen);
    }
    return;
  }

  const damageDealt = await applyDamage(ctx, effectiveTarget, 1 + analepticBonus, attacker, slashCard.nature ?? DamageNature.Normal);
  // Lieren (Zhurong): fired on the ATTACKER's skills specifically after a SLASH (not
  // Duel/AOE/skill-inflicted) they played deals damage -- distinct from the generic
  // `onDamageDealt` (which also fires for every other damage source) for the same reason
  // KylinBow/DoubleSword/Triblade below are resolved here instead of as onDamageDealt hooks.
  if (damageDealt) {
    for (const skill of attacker.skills) await skill.onSlashDamageDealt?.(ctx, attacker, effectiveTarget);
    // Kuangfu (Pan Feng): broadcast to EVERY alive player, not just the attacker -- see
    // Skill.onSomeoneSlashDamaged's own doc comment for why this is separate from the line above.
    for (const p of ctx.alivePlayers) {
      for (const skill of p.skills) await skill.onSomeoneSlashDamaged?.(ctx, p, effectiveTarget);
    }
  }

  // Kylin Bow (weapon): resolved here (Slash-specific), not as a generic onDamageDealt hook,
  // since Duel/AOE damage must NOT trigger it -- the card's official wording is specifically
  // "a Slash you used dealt damage", not "you dealt damage". Runs after applyDamage returns
  // (i.e. after any dying/Peach-rescue already resolved) rather than mid-resolution -- a minor
  // simplification (see this file's other "several optional invokes are simplified" notes);
  // the target's horses are unaffected by their own death either way, so the observable
  // difference is negligible.
  if (damageDealt && attacker.weapon?.weaponName === "KylinBow") {
    const horses = [effectiveTarget.offenseHorse, effectiveTarget.defenseHorse].filter((c): c is Card => c !== null);
    if (horses.length > 0 && (await ctx.askUseKylinBow(attacker))) {
      const destroyed = horses.length === 1 ? horses[0] : await ctx.askPickPlayerCard(attacker, effectiveTarget, horses);
      if (effectiveTarget.offenseHorse?.id === destroyed.id) effectiveTarget.offenseHorse = null;
      if (effectiveTarget.defenseHorse?.id === destroyed.id) effectiveTarget.defenseHorse = null;
      ctx.discardPile.push(destroyed);
      ctx.log.push(`${attacker.id} dùng Kỳ Lân Cung hủy ${destroyed.horseName} của ${effectiveTarget.id}`);
      for (const skill of effectiveTarget.skills) await skill.onEquipLost?.(ctx, effectiveTarget);
    }
  }

  // DoubleSword (weapon): after a slash you wielded it with deals damage to a target of the
  // OPPOSITE gender, you may invoke it -- the target then chooses to discard 1 of their own
  // (random, since this repo has no per-card picker for "any 1 of your own hand" outside the
  // end-of-turn discard-to-limit flow) or, if they can't/won't, you draw 1 instead.
  if (damageDealt && attacker.weapon?.weaponName === "DoubleSword" && attacker.gender !== effectiveTarget.gender) {
    if (await ctx.askUseDoubleSword(attacker)) {
      if (effectiveTarget.hand.length > 0 && (await ctx.askDiscardForDoubleSword(effectiveTarget))) {
        const idx = Math.floor(ctx.rng() * effectiveTarget.hand.length);
        ctx.discardPile.push(effectiveTarget.hand.splice(idx, 1)[0]);
        ctx.log.push(`${effectiveTarget.id} bỏ 1 lá bài (song cổ kiếm)`);
      } else {
        ctx.draw(attacker, 1);
        ctx.log.push(`${attacker.id} rút 1 lá (song cổ kiếm)`);
      }
    }
  }

  // Triblade (weapon): after this slash deals damage, you may pick another player at distance 1
  // from the ORIGINAL target (not yourself) to also take the same 1 damage -- flat 1, not
  // analeptic-boosted, matching the upstream engine's fresh DamageStruct(damage: 1) for the
  // splash hit.
  if (damageDealt && attacker.weapon?.weaponName === "Triblade") {
    const splashCandidates = ctx.alivePlayers.filter(
      (p) => p !== attacker && p !== effectiveTarget && effectiveDistance(ctx.alivePlayers, effectiveTarget, p) === 1,
    );
    if (splashCandidates.length > 0) {
      const splashTarget = await ctx.askChooseAnyPlayer(attacker, splashCandidates);
      if (splashTarget) {
        ctx.log.push(`${attacker.id} dùng Tam Tiêm Đao lan sát thương sang ${splashTarget.id}`);
        await applyDamage(ctx, splashTarget, 1, attacker);
      }
    }
  }
}

/** A 2nd Slash "hit" against `target`, granted by a temporary buff (Taishici's Tianyi: after
 *  winning a pindian, the rest of this turn's Slash plays may also hit an extra, rangeless
 *  target). Simplified from the real engine's single multi-target CardUseStruct (this engine's
 *  `resolveSlash` is strictly 1 attacker : 1 primary target) into an independent 2nd Jink-dodge
 *  + damage check reusing the same reduced-pipeline shape Triblade's splash-damage precedent
 *  above already established: no onIncomingSlash redirect/nullify, no weapon-specific bonus
 *  re-triggers (KylinBow/IceSword/Axe/DoubleSword/another Triblade splash), no Analeptic bonus
 *  damage, no `onSlashDamageDealt`/`onSomeoneSlashDamaged` broadcasts -- those all read as
 *  "effects of THE slash card being played", which this bonus hit deliberately isn't (the real
 *  rule frames it as an extra TARGET of the same card-use, but this engine has no shared
 *  card-use object to hang that on). Unlike Triblade's splash, this respects a real Jink dodge
 *  (including `responseCountRequired`, e.g. against a Wushuang holder), matching Tianyi's
 *  "extra Slash target" semantics more closely than an undodgeable flat hit would. */
export async function resolveSlashBonusTarget(ctx: EngineContext, attacker: GamePlayer, target: GamePlayer): Promise<void> {
  ctx.log.push(`${attacker.id} dùng Sát nhắm thêm mục tiêu ${target.id}`);
  const requiredJinks = Math.max(1, ...target.skills.map((s) => s.responseCountRequired?.("dodge", target) ?? 1));
  const firstJink = findJinkLikeCard(target, ctx.aoChienActive);
  if (firstJink && (await ctx.askDodge(target))) {
    const spent = [firstJink];
    target.hand.splice(target.hand.indexOf(firstJink), 1);
    let allFound = true;
    for (let i = 1; i < requiredJinks; i++) {
      const next = findJinkLikeCard(target, ctx.aoChienActive);
      if (!next) {
        allFound = false;
        break;
      }
      target.hand.splice(target.hand.indexOf(next), 1);
      spent.push(next);
    }
    if (!allFound) {
      target.hand.push(...spent);
      ctx.log.push(`${target.id} không đủ ${requiredJinks} lá Thiểm nên chịu đòn`);
    } else {
      ctx.discardPile.push(...spent);
      ctx.log.push(`${target.id} né bằng Thiểm${spent.length > 1 ? ` (x${spent.length})` : ""}`);
      return;
    }
  }
  await applyDamage(ctx, target, 1, attacker);
}

/**
 * Shared by Slash/Duel/AOE resolution: apply damage, then run the dying/Peach-rescue loop.
 * `source.pendingBonusDamage` (armed by e.g. Luoyi) adds on top of `amount` once, then resets;
 * `target`'s `reduceDamage` skills (e.g. Kongrong's Mingshi) run after that, and can floor the
 * final amount at or below 0 to cancel the hit entirely (no `onDamage`/`onDamageDealt`/dying).
 *
 * `nature` (Milestone 30, defaults `Normal`): Fire/Thunder-natured damage (FireSlash/
 * ThunderSlash's own `.nature`, or Fire Attack's flat 1) unchains ITS OWN target if they were
 * chained -- the original hit AND every recursive splash hit alike (matches the real
 * `DamageComplete`'s unconditional per-instance unchain check). Only the ORIGINAL (non-splash)
 * hit additionally splashes the SAME base `amount` (not `finalAmount` -- each splash target's
 * OWN `reduceDamage` skills apply fresh, matching the real engine copying the original
 * `DamageStruct` and only overwriting `.to`) to every OTHER still-`chained` alive player, via a
 * recursive `applyDamage` call tagged `isChainSplash: true` so a splash hit never re-triggers
 * its own further splash (matches the real `chain_damage.chain = true` / `!damage.chain` guard
 * -- traced into `src/server/gamerule.cpp`'s global `DamageDone`/`DamageComplete` handling, NOT
 * IronChain's own card class). See `player.chained`'s doc comment and `trick.ts`'s
 * `resolveIronChain` for how the chain state itself is toggled.
 */
export async function applyDamage(
  ctx: EngineContext,
  target: GamePlayer,
  amount: number,
  source: GamePlayer,
  nature: DamageNature = DamageNature.Normal,
  isChainSplash = false,
): Promise<boolean> {
  let finalAmount = amount + source.pendingBonusDamage;
  source.pendingBonusDamage = 0;
  for (const skill of target.skills) {
    if (skill.reduceDamage) finalAmount = await skill.reduceDamage(ctx, target, source, finalAmount);
  }
  if (finalAmount <= 0) {
    ctx.log.push(`${target.id} không chịu sát thương (đã giảm về 0)`);
    return false;
  }

  // Vine/SilverLion (Milestone 34, both "Tỏa định kỹ" -- locked, no ask, mutually exclusive
  // since a player can only equip 1 armor at a time): Vine adds +1 to any Fire-natured hit
  // (its own downside, paired with the Normal-Slash/AOE immunity in resolveSlash/
  // resolveSavageAssault/resolveArcheryAttack); SilverLion caps any single damage instance
  // >1 down to exactly 1 -- applies to EVERY damage source (Slash/Duel/AOE/skill-inflicted/
  // chain-splash alike), matching the real DamageInflicted event's universal scope, which is
  // exactly why this lives in the shared `applyDamage` choke point rather than resolveSlash.
  if (target.armor?.armorName === "Vine" && nature === DamageNature.Fire) {
    finalAmount += 1;
    ctx.log.push(`${target.id} nhận thêm 1 sát thương Hỏa (đằng giáp)`);
  } else if (target.armor?.armorName === "SilverLion" && finalAmount > 1) {
    ctx.log.push(`${target.id} giảm ${finalAmount} sát thương còn 1 (bạch ngân sư tử)`);
    finalAmount = 1;
  }

  target.hp -= finalAmount;
  ctx.log.push(`${target.id} chịu ${finalAmount} sát thương (máu ${target.hp}/${target.maxHp})`);
  await ctx.onDamage?.(target, source);
  await ctx.onDamageDealt?.(source, target, finalAmount);

  // Iron Chain (Milestone 30): ANY Fire/Thunder-natured hit unchains its own target -- original
  // hit OR a splash hit alike (matches the real `DamageComplete`'s unconditional unchain check,
  // which runs once per damage instance including recursive splash instances). Only the
  // ORIGINAL (non-splash) hit additionally splashes the SAME base `amount` to every OTHER
  // still-chained player -- gated on `wasChained` (the state BEFORE this unchain), so a lone
  // chained target correctly triggers no splash at all.
  const wasChained = target.chained;
  if (nature !== DamageNature.Normal && wasChained) target.chained = false;
  if (!isChainSplash && nature !== DamageNature.Normal && wasChained) {
    const splashTargets = ctx.alivePlayers.filter((p) => p !== target && p.chained);
    for (const p of splashTargets) {
      ctx.log.push(`${p.id} cũng chịu sát thương do liên hoàn (iron_chain)`);
      await applyDamage(ctx, p, amount, source, nature, true);
    }
  }

  if (target.hp <= 0) await resolveDying(ctx, target, source);
  return true;
}

/** Player::loseHp: reduces hp directly (no `onDamage`/`onDamageDealt` skill triggers -- this
 *  isn't "damage"), still runs the dying/Peach-rescue check. No killer credited: a
 *  self-inflicted loss credits nobody (e.g. Kurou). */
export async function loseHp(ctx: EngineContext, player: GamePlayer, amount: number): Promise<void> {
  player.hp -= amount;
  ctx.log.push(`${player.id} mất ${amount} máu (máu ${player.hp}/${player.maxHp})`);
  if (player.hp <= 0) await resolveDying(ctx, player);
}

/** Player::recover: heals `player` (capped at maxHp) and fires their `onRecover` skill hooks
 *  (e.g. Ganfuren's Shushen) -- shared by Peach-rescue, GodSalvation, and Kuanggu so all 3
 *  recovery sources trigger it uniformly, matching the real rule ("whenever you recover"). */
export async function heal(ctx: EngineContext, player: GamePlayer, amount: number): Promise<void> {
  const healed = Math.min(amount, player.maxHp - player.hp);
  if (healed <= 0) return;
  player.hp += healed;
  for (const skill of player.skills) {
    if (player.alive) await skill.onRecover?.(ctx, player, healed);
  }
}

/**
 * Player::askForPeaches equivalent: while hp <= 0, offer Peach to the dying player first
 * (self-rescue), then -- if they can't or won't -- every OTHER alive player in turn order
 * (starting right after the dying player, wrapping around the table) gets one chance to play
 * their own held Peach to save them. Repeats (self first, then the rescue round) each time hp is
 * still <=0 after a successful save's +1, same as the real "keep asking until >0 or nobody can
 * help" loop, until nobody at all can or will help, then gives up and records the death.
 */
async function resolveDying(ctx: EngineContext, player: GamePlayer, killer?: GamePlayer): Promise<void> {
  ctx.log.push(`${player.id} đang hấp hối (máu ${player.hp})`);
  await ctx.onDyingStarted?.(player);
  while (player.hp <= 0) {
    const selfCard = findRescueCard(player, ctx.aoChienActive);
    if (selfCard && (await ctx.askPeach(player))) {
      player.hand.splice(player.hand.indexOf(selfCard), 1);
      ctx.discardPile.push(selfCard);
      const label = rescueCardLabel(selfCard);
      const vnLabel = label === "analeptic" ? "Tửu" : "Đào";
      if (!label) ctx.log.push(`${player.id} biến 1 lá bài thành Đào (kỹ năng biến hóa)`);
      await heal(ctx, player, 1);
      ctx.log.push(`${player.id} dùng ${vnLabel} để hồi phục (máu ${player.hp}/${player.maxHp})`);
      continue;
    }

    // Niepan-style "cheat death" skills (once-per-game, e.g. Pang Tong): checked right
    // alongside the normal self-rescue card above -- same "player's own choice" precedent.
    let cheatedDeath = false;
    for (const skill of player.skills) {
      if (skill.cheatsDeath && (await skill.cheatsDeath(ctx, player))) {
        cheatedDeath = true;
        break;
      }
    }
    if (cheatedDeath) continue;

    // Wansha (Jiaxu): locked skill -- while it's Jiaxu's own turn, every OTHER alive player is
    // barred from playing Peach to rescue whoever's dying (self-rescue above is unaffected).
    const wanshaActive = ctx.alivePlayers.some((p) => p.skills.some((s) => s.suppressesAllyRescue?.(p)));
    if (wanshaActive) {
      ctx.log.push(`${player.id} không ai có thể cứu (wansha)`);
      break;
    }

    // Self-rescue declined/unavailable -- offer every OTHER alive player one chance each, in
    // turn order starting right after the dying player.
    const dyingIdx = ctx.alivePlayers.indexOf(player);
    const n = ctx.alivePlayers.length;
    let rescued = false;
    for (let i = 1; i < n; i++) {
      const rescuer = ctx.alivePlayers[(dyingIdx + i) % n];
      const card = findRescueCard(rescuer, ctx.aoChienActive);
      if (!card || !(await ctx.askPeachForOther(rescuer, player))) continue;
      rescuer.hand.splice(rescuer.hand.indexOf(card), 1);
      ctx.discardPile.push(card);
      const label = rescueCardLabel(card);
      const vnLabel = label === "analeptic" ? "Tửu" : "Đào";
      if (!label) ctx.log.push(`${rescuer.id} biến 1 lá bài thành Đào (kỹ năng biến hóa)`);
      await heal(ctx, player, 1);
      ctx.log.push(`${rescuer.id} dùng ${vnLabel} cứu ${player.id} (máu ${player.hp}/${player.maxHp})`);
      rescued = true;
      break;
    }
    if (!rescued) break; // nobody could or would help this round -- give up
  }
  if (player.hp <= 0) {
    // Buqu (Zhou Tai, Milestone 27): checked only once every normal self/ally Peach-rescue
    // attempt above has already been exhausted -- see Skill.preventsDeath's doc comment for why
    // this is distinct from `cheatsDeath` (always heals, once-per-game).
    let saved = false;
    for (const skill of player.skills) {
      if (skill.preventsDeath && (await skill.preventsDeath(ctx, player))) {
        saved = true;
        break;
      }
    }
    if (!saved) ctx.onDying(player, killer);
  }
}
