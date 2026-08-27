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

import { Card, CardKind } from "./card.js";
import { GamePlayer } from "./player.js";
import { Role } from "./types.js";
import { isAlly } from "./gamerule.js";

/**
 * Player::distanceTo: shortest seat-circle hop count among currently ALIVE players, adjusted by
 * equipped horses -- `to`'s defense horse (+1) and `from`'s offense horse (-1) -- and by
 * `from`'s skills (e.g. Mashu's `attackDistanceDelta`, same -1-per-point shape as an offense
 * horse) -- floored at 1.
 */
export function effectiveDistance(alive: GamePlayer[], from: GamePlayer, to: GamePlayer): number {
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
  else if (owner.defenseHorse === card) owner.defenseHorse = null;
  else if (owner.offenseHorse === card) owner.offenseHorse = null;
  else return; // defensive no-op: not actually one of owner's cards
  for (const skill of owner.skills) await skill.onEquipLost?.(ctx, owner);
}

function takeCard(hand: Card[], kind: CardKind): Card | null {
  const idx = hand.findIndex((c) => c.kind === kind);
  if (idx === -1) return null;
  return hand.splice(idx, 1)[0];
}

/** A real Jink card, or (e.g. Longdan/Qingguo) the first card some skill allows viewing as Jink. */
export function findJinkLikeCard(player: GamePlayer): Card | null {
  const real = player.hand.find((c) => c.kind === CardKind.Jink);
  if (real) return real;
  for (const skill of player.skills) {
    if (!skill.canViewAsJink) continue;
    const viewed = player.hand.find((c) => skill.canViewAsJink!(c, player));
    if (viewed) return viewed;
  }
  return null;
}

/** A real Peach or Analeptic card (both heal 1 hp during a dying rescue -- see Analeptic's OTHER,
 *  Play-phase-only damage-boost use in `resolveAnalepticBuff`/`resolveSlash`'s consumption of
 *  `pendingSlashBonusDamage` below), or (e.g. Jijiu) the first card some skill allows viewing as
 *  a Peach. */
function findRescueCard(player: GamePlayer): Card | null {
  const real = player.hand.find((c) => c.kind === CardKind.Peach || c.kind === CardKind.Analeptic);
  if (real) return real;
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

/** A real Slash card, or (e.g. Wusheng/Longdan) the first card some skill allows viewing as Slash. */
export function findSlashLikeCard(player: GamePlayer): Card | null {
  const real = player.hand.find((c) => c.kind === CardKind.Slash);
  if (real) return real;
  for (const skill of player.skills) {
    if (!skill.canViewAsSlash) continue;
    const viewed = player.hand.find((c) => skill.canViewAsSlash!(c, player));
    if (viewed) return viewed;
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
 *  -- unlike `findSlashLikeCard`, returns ALL matches, not just the first, for a freeform Play
 *  phase's legal-action list (see room.ts's `computeLegalActions`). */
export function allSlashLikeCards(player: GamePlayer): Card[] {
  const cards = player.hand.filter((c) => c.kind === CardKind.Slash);
  for (const skill of player.skills) {
    if (!skill.canViewAsSlash) continue;
    for (const c of player.hand) {
      if (c.kind !== CardKind.Slash && skill.canViewAsSlash(c, player) && !cards.includes(c)) cards.push(c);
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

/** True if any of `player`'s skills (e.g. Kongcheng) make them immune to Slash/Duel targeting right now. */
export function isImmuneToSlashAndDuel(player: GamePlayer): boolean {
  return player.skills.some((skill) => skill.immuneToSlashAndDuel?.(player));
}

/** True if any of `player`'s skills (e.g. Qianxun) make them immune to Snatch targeting right now. */
export function isImmuneToSnatch(player: GamePlayer): boolean {
  return player.skills.some((skill) => skill.immuneToSnatch?.(player));
}

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
  /** `killerRole` is null for a self-inflicted loss of hp with no credited attacker (e.g.
   *  Kurou). `killer` is the actual player credited with the kill, present exactly when
   *  `killerRole` is (real Slash/Duel/AOE damage always knows its source) -- absent for
   *  `loseHp` and for Room.damagePlayer's test-only scripted-damage bypass, which only ever has
   *  a role to credit, not a specific player, so kill-rewards keyed off a real killer (e.g. "kill
   *  a Rebel, draw 3") don't fire for those paths. */
  onDying: (player: GamePlayer, killerRole: Role | null, killer?: GamePlayer) => void;
  /** Fired right after hp is reduced, before the dying/Peach-rescue check -- general skill hooks
   *  on the DAMAGED player (e.g. Ganglie) attach here. */
  onDamage?: (target: GamePlayer, source: GamePlayer) => Promise<void> | void;
  /** Fired right after damage lands, before the dying/Peach-rescue check -- general skill hooks
   *  on the ATTACKING player (e.g. Kuanggu) attach here. */
  onDamageDealt?: (source: GamePlayer, target: GamePlayer, amount: number) => Promise<void> | void;
  /** Does `player` want to play a held Jink against an incoming Slash? Only called when they hold one. */
  askDodge: (player: GamePlayer) => Promise<boolean>;
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

  let dodgeBlocked = false;
  for (const skill of attacker.skills) {
    if (skill.onSlashTargeted && (await skill.onSlashTargeted(ctx, attacker, effectiveTarget))) dodgeBlocked = true;
  }

  // responseCountRequired (e.g. Lu Bu's Wushuang: needs 2 Jinks) -- defaults to 1 for every
  // skill/player that doesn't define it, so this is a no-op for the vast majority of dodges.
  const requiredJinks = dodgeBlocked
    ? 0
    : Math.max(1, ...effectiveTarget.skills.map((s) => s.responseCountRequired?.("dodge", effectiveTarget) ?? 1));
  const firstJink = requiredJinks > 0 ? findJinkLikeCard(effectiveTarget) : null;
  if (firstJink && (await ctx.askDodge(effectiveTarget))) {
    const spent = [firstJink];
    effectiveTarget.hand.splice(effectiveTarget.hand.indexOf(firstJink), 1);
    let allFound = true;
    for (let i = 1; i < requiredJinks; i++) {
      const next = findJinkLikeCard(effectiveTarget);
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
      for (const skill of attacker.skills) await skill.onSlashDodged?.(ctx, attacker, effectiveTarget);
      for (const skill of effectiveTarget.skills) await skill.onSlashDodged?.(ctx, attacker, effectiveTarget);
      // Axe (weapon): may discard 2 of your OWN cards to force this dodged slash through anyway.
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

  const damageDealt = await applyDamage(ctx, effectiveTarget, 1 + analepticBonus, attacker);

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

/**
 * Shared by Slash/Duel/AOE resolution: apply damage, then run the dying/Peach-rescue loop.
 * `source.pendingBonusDamage` (armed by e.g. Luoyi) adds on top of `amount` once, then resets;
 * `target`'s `reduceDamage` skills (e.g. Kongrong's Mingshi) run after that, and can floor the
 * final amount at or below 0 to cancel the hit entirely (no `onDamage`/`onDamageDealt`/dying).
 */
export async function applyDamage(ctx: EngineContext, target: GamePlayer, amount: number, source: GamePlayer): Promise<boolean> {
  let finalAmount = amount + source.pendingBonusDamage;
  source.pendingBonusDamage = 0;
  for (const skill of target.skills) {
    if (skill.reduceDamage) finalAmount = await skill.reduceDamage(ctx, target, source, finalAmount);
  }
  if (finalAmount <= 0) {
    ctx.log.push(`${target.id} không chịu sát thương (đã giảm về 0)`);
    return false;
  }

  target.hp -= finalAmount;
  ctx.log.push(`${target.id} chịu ${finalAmount} sát thương (máu ${target.hp}/${target.maxHp})`);
  await ctx.onDamage?.(target, source);
  await ctx.onDamageDealt?.(source, target, finalAmount);
  if (target.hp <= 0) await resolveDying(ctx, target, source.role, source);
  return true;
}

/** Player::loseHp: reduces hp directly (no `onDamage`/`onDamageDealt` skill triggers -- this
 *  isn't "damage"), still runs the dying/Peach-rescue check. `killerRole` is null: a
 *  self-inflicted loss credits no side (e.g. Kurou). */
export async function loseHp(ctx: EngineContext, player: GamePlayer, amount: number): Promise<void> {
  player.hp -= amount;
  ctx.log.push(`${player.id} mất ${amount} máu (máu ${player.hp}/${player.maxHp})`);
  if (player.hp <= 0) await resolveDying(ctx, player, null);
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
async function resolveDying(ctx: EngineContext, player: GamePlayer, killerRole: Role | null, killer?: GamePlayer): Promise<void> {
  ctx.log.push(`${player.id} đang hấp hối (máu ${player.hp})`);
  await ctx.onDyingStarted?.(player);
  while (player.hp <= 0) {
    const selfCard = findRescueCard(player);
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

    // Self-rescue declined/unavailable -- offer every OTHER alive player one chance each, in
    // turn order starting right after the dying player.
    const dyingIdx = ctx.alivePlayers.indexOf(player);
    const n = ctx.alivePlayers.length;
    let rescued = false;
    for (let i = 1; i < n; i++) {
      const rescuer = ctx.alivePlayers[(dyingIdx + i) % n];
      const card = findRescueCard(rescuer);
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
  if (player.hp <= 0) ctx.onDying(player, killerRole, killer);
}
