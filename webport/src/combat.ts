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
    if (allFound) {
      ctx.discardPile.push(...spent);
      for (const c of spent) {
        if (c.kind !== CardKind.Jink) ctx.log.push(`${effectiveTarget.id} biến 1 lá bài thành Thiểm (kỹ năng biến hóa)`);
      }
      ctx.log.push(`${effectiveTarget.id} né bằng Thiểm${spent.length > 1 ? ` (x${spent.length})` : ""}`);
      for (const skill of attacker.skills) await skill.onSlashDodged?.(ctx, attacker, effectiveTarget);
      for (const skill of effectiveTarget.skills) await skill.onSlashDodged?.(ctx, attacker, effectiveTarget);
      return;
    }
    // Couldn't complete the required set (e.g. only 1 of Wushuang's 2 jinks): nothing was
    // actually played, so return the tentatively-removed card(s) to hand instead of discarding.
    effectiveTarget.hand.push(...spent);
    ctx.log.push(`${effectiveTarget.id} không đủ ${requiredJinks} lá Thiểm nên chịu đòn`);
  }

  await applyDamage(ctx, effectiveTarget, 1 + analepticBonus, attacker);
}

/**
 * Shared by Slash/Duel/AOE resolution: apply damage, then run the dying/Peach-rescue loop.
 * `source.pendingBonusDamage` (armed by e.g. Luoyi) adds on top of `amount` once, then resets;
 * `target`'s `reduceDamage` skills (e.g. Kongrong's Mingshi) run after that, and can floor the
 * final amount at or below 0 to cancel the hit entirely (no `onDamage`/`onDamageDealt`/dying).
 */
export async function applyDamage(ctx: EngineContext, target: GamePlayer, amount: number, source: GamePlayer): Promise<void> {
  let finalAmount = amount + source.pendingBonusDamage;
  source.pendingBonusDamage = 0;
  for (const skill of target.skills) {
    if (skill.reduceDamage) finalAmount = await skill.reduceDamage(ctx, target, source, finalAmount);
  }
  if (finalAmount <= 0) {
    ctx.log.push(`${target.id} không chịu sát thương (đã giảm về 0)`);
    return;
  }

  target.hp -= finalAmount;
  ctx.log.push(`${target.id} chịu ${finalAmount} sát thương (máu ${target.hp}/${target.maxHp})`);
  await ctx.onDamage?.(target, source);
  await ctx.onDamageDealt?.(source, target, finalAmount);
  if (target.hp <= 0) await resolveDying(ctx, target, source.role, source);
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
