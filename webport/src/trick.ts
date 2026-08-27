// Resolution for the 8 trick cards implemented so far (see card.ts header for the full list of
// what's deliberately excluded). Ported conceptually from src/package/standard-tricks.cpp's
// onEffect() methods, simplified: no Nullification counter-play window (that card isn't
// implemented).

import { Card, CardKind } from "./card.js";
import { GamePlayer } from "./player.js";
import { EngineContext, applyDamage, detachCardFrom, effectiveDistance, findJinkLikeCard, findSlashLikeCard, heal, isImmuneToSlashAndDuel, isImmuneToSnatch } from "./combat.js";

/** Alive players `actor` could legally target with Dismantlement: not self, has cards in play. */
export function dismantlementCandidates(actor: GamePlayer, alive: GamePlayer[]): GamePlayer[] {
  return alive.filter((p) => p !== actor && p.handcardNum > 0);
}

/** Alive players `actor` could legally target with Snatch: not self, has cards, within distance
 *  1 (ignored if a skill grants `ignoresTrickDistanceLimit`, e.g. Qicai), not immune (Qianxun). */
export function snatchCandidates(actor: GamePlayer, alive: GamePlayer[]): GamePlayer[] {
  const ignoresDistance = actor.skills.some((s) => s.ignoresTrickDistanceLimit?.(CardKind.Snatch));
  return alive.filter(
    (p) =>
      p !== actor &&
      p.handcardNum > 0 &&
      (ignoresDistance || effectiveDistance(alive, actor, p) <= 1) &&
      !isImmuneToSnatch(p),
  );
}

/** Alive players `actor` could legally target with Duel: anyone but self, not immune (Kongcheng). */
export function duelCandidates(actor: GamePlayer, alive: GamePlayer[]): GamePlayer[] {
  return alive.filter((p) => p !== actor && !isImmuneToSlashAndDuel(p));
}

// ---- resolution ----

export function resolveExNihilo(ctx: EngineContext, target: GamePlayer): void {
  ctx.draw(target, 2);
  ctx.log.push(`${target.id} bốc 2 lá (Vô Trung Sinh Hữu)`);
}

/** Every card currently in `owner`'s equip zone (weapon/defense horse/offense horse), in a
 *  stable display order -- shared by Dismantlement/Snatch's candidate list below. */
function equippedCards(owner: GamePlayer): Card[] {
  return [owner.weapon, owner.defenseHorse, owner.offenseHorse].filter((c): c is Card => c !== null);
}

/** Dismantlement/Snatch: `actor` chooses exactly one of `owner`'s cards (hand or equipped) via
 *  `ctx.askPickPlayerCard` -- validates the response is actually one of `candidates`, falling
 *  back to the first one (same defensive pattern as resolveAmazingGrace). */
async function pickOpponentCard(ctx: EngineContext, actor: GamePlayer, owner: GamePlayer, candidates: Card[]): Promise<Card> {
  const chosen = await ctx.askPickPlayerCard(actor, owner, candidates);
  return candidates.find((c) => c.id === chosen.id) ?? candidates[0];
}

export async function resolveDismantlement(ctx: EngineContext, actor: GamePlayer, target: GamePlayer): Promise<void> {
  const candidates = [...target.hand, ...equippedCards(target)];
  if (candidates.length === 0) return;
  const chosen = await pickOpponentCard(ctx, actor, target, candidates);
  await detachCardFrom(ctx, target, chosen);
  ctx.discardPile.push(chosen);
  ctx.log.push(`${target.id} bỏ 1 lá bài (Quá Hạ Sách Kiều)`);
}

export async function resolveSnatch(ctx: EngineContext, source: GamePlayer, target: GamePlayer): Promise<void> {
  const candidates = [...target.hand, ...equippedCards(target)];
  if (candidates.length === 0) return;
  const chosen = await pickOpponentCard(ctx, source, target, candidates);
  await detachCardFrom(ctx, target, chosen);
  source.hand.push(chosen);
  ctx.log.push(`${source.id} cướp 1 lá bài từ ${target.id}`);
}

/** Alternating Slash exchange starting with `target`; first to fail to play Slash takes 1 damage.
 *  `responseCountRequired` (e.g. Lu Bu's Wushuang) can require more than 1 Slash per exchange
 *  turn, same shape as resolveSlash's Jink requirement. */
export async function resolveDuel(ctx: EngineContext, source: GamePlayer, target: GamePlayer): Promise<void> {
  ctx.log.push(`${source.id} dùng Quyết Đấu với ${target.id}`);
  let responder = target;
  let other = source;
  while (true) {
    const required = Math.max(1, ...responder.skills.map((s) => s.responseCountRequired?.("duel", responder) ?? 1));
    const firstSlash = findSlashLikeCard(responder);
    if (!firstSlash || !(await ctx.askDuelSlash(responder))) {
      await applyDamage(ctx, responder, 1, other);
      return;
    }
    const spent = [firstSlash];
    responder.hand.splice(responder.hand.indexOf(firstSlash), 1);
    let allFound = true;
    for (let i = 1; i < required; i++) {
      const next = findSlashLikeCard(responder);
      if (!next) {
        allFound = false;
        break;
      }
      responder.hand.splice(responder.hand.indexOf(next), 1);
      spent.push(next);
    }
    ctx.discardPile.push(...spent);
    for (const c of spent) {
      if (c.kind !== CardKind.Slash) ctx.log.push(`${responder.id} biến 1 lá bài thành Sát (kỹ năng biến hóa)`);
    }
    if (!allFound) {
      ctx.log.push(`${responder.id} không đủ ${required} lá Sát nên chịu đòn`);
      await applyDamage(ctx, responder, 1, other);
      return;
    }
    ctx.log.push(`${responder.id} đánh Sát trong Quyết Đấu${spent.length > 1 ? ` (x${spent.length})` : ""}`);
    [responder, other] = [other, responder];
  }
}

/** Savage Assault: `hijackAoeSource` (e.g. Menghuo's Huoshou) can reassign damage credit for the
 *  whole resolution; `immuneToSavageAssault` (e.g. Menghuo/Zhurong's shared avoid skill) skips a
 *  player outright, not even offering them the discard-a-slash choice. Discarding a held Slash
 *  (viewAs-aware, e.g. Wusheng/Longdan) is the player's own choice, not automatic -- they may
 *  prefer to keep it and take the 1 damage instead, same as resolveSlash's Jink/resolveDuel's
 *  Slash asks. */
export async function resolveSavageAssault(ctx: EngineContext, source: GamePlayer): Promise<void> {
  ctx.log.push(`${source.id} dùng Nam Man Nhập Xâm`);
  let creditedSource = source;
  for (const p of ctx.alivePlayers) {
    for (const skill of p.skills) {
      if (!skill.hijackAoeSource) continue;
      const hijacker = await skill.hijackAoeSource(ctx, p, source);
      if (hijacker && hijacker.alive) {
        creditedSource = hijacker;
        ctx.log.push(`${hijacker.id} nhận công dùng Nam Man Nhập Xâm (huoshou)`);
      }
    }
  }
  for (const p of ctx.alivePlayers.filter((p) => p !== source && p.alive)) {
    if (p.skills.some((s) => s.immuneToSavageAssault?.(p))) continue;
    const slash = findSlashLikeCard(p);
    if (slash && (await ctx.askSavageAssaultSlash(p))) {
      p.hand.splice(p.hand.indexOf(slash), 1);
      ctx.discardPile.push(slash);
      if (slash.kind !== CardKind.Slash) ctx.log.push(`${p.id} biến 1 lá bài thành Sát (kỹ năng biến hóa)`);
    } else {
      await applyDamage(ctx, p, 1, creditedSource);
    }
  }
}

/** Archery Attack: discarding a held Jink (viewAs-aware, e.g. Longdan/Qingguo) is the player's
 *  own choice, not automatic -- same rule as Savage Assault's Slash above. */
export async function resolveArcheryAttack(ctx: EngineContext, source: GamePlayer): Promise<void> {
  ctx.log.push(`${source.id} dùng Vạn Tiễn Tề Phát`);
  for (const p of ctx.alivePlayers.filter((p) => p !== source && p.alive)) {
    const jink = findJinkLikeCard(p);
    if (jink && (await ctx.askArcheryAttackJink(p))) {
      p.hand.splice(p.hand.indexOf(jink), 1);
      ctx.discardPile.push(jink);
      if (jink.kind !== CardKind.Jink) ctx.log.push(`${p.id} biến 1 lá bài thành Thiểm (kỹ năng biến hóa)`);
    } else {
      await applyDamage(ctx, p, 1, source);
    }
  }
}


export async function resolveGodSalvation(ctx: EngineContext): Promise<void> {
  ctx.log.push("Đào Viên Kết Nghĩa: hồi máu mọi người bị thương");
  for (const p of ctx.alivePlayers) {
    if (p.isWounded()) await heal(ctx, p, 1);
  }
}

/** Peach played proactively (not during a dying rescue): heals the player 1 hp. Real Sanguosha
 *  lets a player play any number of held Peaches on themselves during their own Play phase
 *  while wounded -- no once-per-turn cap (only Slash has an explicit per-turn limit). */
export async function resolvePeachSelfHeal(ctx: EngineContext, player: GamePlayer): Promise<void> {
  await heal(ctx, player, 1);
  ctx.log.push(`${player.id} dùng Đào để hồi phục (máu ${player.hp}/${player.maxHp})`);
}

/** Analeptic (Tửu) played proactively during your own Play phase (not for a dying rescue): arms
 *  a +1 damage bonus for the very next Slash `player` plays this turn -- consumed once that
 *  Slash begins resolving (dodge or not, see combat.ts's resolveSlash), not generic like a
 *  skill's `pendingBonusDamage`, since Analeptic's real card text specifically boosts a Slash,
 *  not any other damage source. No once-per-Play-phase cap is enforced here, matching this
 *  engine's existing "no once-per-kind-per-turn cap, only Slash has an explicit limit"
 *  simplification already used by every other proactive trick-like card in the freeform Play
 *  phase (see room.ts's computeLegalActions header) -- the real rule limits Analeptic itself to
 *  1 use per Play phase; playing a second copy here simply stacks another +1 onto the pending
 *  bonus instead of being rejected.
 */
export function resolveAnalepticBuff(ctx: EngineContext, player: GamePlayer): void {
  player.pendingSlashBonusDamage += 1;
  ctx.log.push(`${player.id} uống Tửu (Sát tiếp theo trong lượt +1 sát thương)`);
}


/** Amazing Grace: reveals `n` cards (n = number of alive players) face-up, then each player in
 *  turn order STARTING FROM `source` (the player who played it) picks exactly one, one at a
 *  time, until the pool is empty -- not a random/simultaneous draw. If the draw pile runs out
 *  partway (rare), fewer cards are revealed than players and the last players in line get none,
 *  same as any other draw-pile-exhaustion case. */
export async function resolveAmazingGrace(ctx: EngineContext, source: GamePlayer): Promise<void> {
  ctx.log.push("Ngũ Cốc Phong Đăng");
  const n = ctx.alivePlayers.length;
  const pool: Card[] = [];
  for (let i = 0; i < n; i++) {
    const card = ctx.drawTop();
    if (!card) break;
    pool.push(card);
  }
  const startIdx = ctx.alivePlayers.indexOf(source);
  for (let i = 0; i < n && pool.length > 0; i++) {
    const player = ctx.alivePlayers[(startIdx + i) % n];
    const chosen = await ctx.askPickCard(player, pool);
    // Validate: the controller must return one of the still-available cards -- falls back to
    // the first one instead of ever picking something not actually in the pool (misbehaving or
    // timed-out controller), same defensive pattern as chooseDiscards's count/membership check.
    const idx = pool.some((c) => c.id === chosen.id) ? pool.findIndex((c) => c.id === chosen.id) : 0;
    const [card] = pool.splice(idx, 1);
    player.hand.push(card);
    ctx.log.push(`${player.id} nhận 1 lá từ Ngũ Cốc Phong Đăng`);
  }
}
