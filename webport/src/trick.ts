// Resolution for the trick cards implemented so far (see card.ts header for the full list of
// what's deliberately excluded). Ported conceptually from src/package/standard-tricks.cpp's
// onEffect() methods. Milestone 31 added the Nullification/HegNullification counter-play
// window: offered once per whole card use at room.ts's `tryPlayOnce`/`tryPlayTargeted`/
// `tryPlayDelayedTrick` for every trick kind BUT the 2 AOE ones below (SavageAssault/
// ArcheryAttack), which get real per-target granularity here instead via `ctx.askNullification`
// -- see combat.ts's `EngineContext.askNullification` doc comment and room.ts's
// `resolveNullificationWindow` for the actual mechanics.

import { Card, CardKind, Suit } from "./card.js";
import { GamePlayer } from "./player.js";
import { DamageNature } from "./types.js";
import { alliesOf } from "./gamerule.js";
import {
  EngineContext,
  KnownBothOption,
  SUIT_LABEL_VI,
  applyDamage,
  detachCardFrom,
  disposeJudgmentCard,
  effectiveAttackRange,
  effectiveDistance,
  findJinkLikeCard,
  findSlashLikeCard,
  heal,
  isImmuneToSlashAndDuel,
  isImmuneToSnatch,
  judge,
  loseHp,
  resolveSlash,
} from "./combat.js";

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
    const firstSlash = findSlashLikeCard(responder, ctx.aoChienActive);
    if (!firstSlash || !(await ctx.askDuelSlash(responder))) {
      await applyDamage(ctx, responder, 1, other);
      return;
    }
    const spent = [firstSlash];
    responder.hand.splice(responder.hand.indexOf(firstSlash), 1);
    let allFound = true;
    for (let i = 1; i < required; i++) {
      const next = findSlashLikeCard(responder, ctx.aoChienActive);
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
  // HegNullification "all" scope (Milestone 31): once a responder shields a whole faction, every
  // OTHER still-untouched target sharing it is auto-skipped for the rest of THIS resolution --
  // no new ask, matching the real rule (`shieldFaction` stays null outside Hegemony mode/without
  // a HegNullification "all" choice, so this never fires in Identity mode).
  let shieldFaction: string | null = null;
  for (const p of ctx.alivePlayers.filter((p) => p !== source && p.alive)) {
    // A prior target this SAME loop already resolved may have ended the game (e.g. their death
    // completed the win condition) -- stop touching any further target instead of continuing to
    // apply damage/reactive-skill effects the frozen winners list can no longer account for.
    if (ctx.isGameOver()) break;
    if (p.skills.some((s) => s.immuneToSavageAssault?.(p))) continue;
    // Vine (armor, Milestone 34): locked, full immunity to this card outright -- not even
    // offered the discard-a-Slash choice, same short-circuit as the skill-based immunity above.
    if (p.armor?.armorName === "Vine") continue;
    if (shieldFaction && p.faction === shieldFaction) continue;
    const nullified = await ctx.askNullification(source, p, CardKind.SavageAssault);
    if (nullified.shieldFaction) shieldFaction = nullified.shieldFaction;
    if (nullified.blocked) continue;
    const slash = findSlashLikeCard(p, ctx.aoChienActive);
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
 *  own choice, not automatic -- same rule as Savage Assault's Slash above. Same per-target
 *  Nullification/HegNullification-faction-shield window as `resolveSavageAssault` above. */
export async function resolveArcheryAttack(ctx: EngineContext, source: GamePlayer): Promise<void> {
  ctx.log.push(`${source.id} dùng Vạn Tiễn Tề Phát`);
  let shieldFaction: string | null = null;
  for (const p of ctx.alivePlayers.filter((p) => p !== source && p.alive)) {
    // Same "a prior target already ended the game" guard as resolveSavageAssault above.
    if (ctx.isGameOver()) break;
    // Vine (armor, Milestone 34): same full immunity as resolveSavageAssault above.
    if (p.armor?.armorName === "Vine") continue;
    if (shieldFaction && p.faction === shieldFaction) continue;
    const nullified = await ctx.askNullification(source, p, CardKind.ArcheryAttack);
    if (nullified.shieldFaction) shieldFaction = nullified.shieldFaction;
    if (nullified.blocked) continue;
    const jink = findJinkLikeCard(p, ctx.aoChienActive);
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

/** Alive players `actor` could legally target with Indulgence: any OTHER player (real
 *  lang/vi_VN text: "Lựa chọn: 1 người khác" -- not self-targetable in this localization),
 *  who doesn't already have one attached (real rule: a judge area can't hold 2 copies of the
 *  SAME delayed trick at once). */
export function indulgenceCandidates(actor: GamePlayer, alive: GamePlayer[]): GamePlayer[] {
  return alive.filter((p) => p !== actor && !p.judgeArea.some((c) => c.kind === CardKind.Indulgence));
}

/** Attaches `card` (Indulgence, already detached from the player's hand by the caller) to
 *  `target`'s judge area -- unless Qianxun's `blocksIndulgenceEntry` auto-discards it on
 *  entry instead (his skill's 2nd clause: it never actually gets to sit in his judge area).
 *  `card.kind` is force-set to `CardKind.Indulgence` here -- a no-op for a real Indulgence
 *  card, but REQUIRED for a Guose-viewed card (whose `.kind` is still whatever Diamond card it
 *  originally was). **Real bug found and fixed while building Milestone 25's SupplyShortage**
 *  (a structurally identical 2nd delayed trick): without this rewrite, `Room.runJudgePhase`'s
 *  `card.kind === CardKind.Indulgence` dispatch check silently fails for a Guose-viewed card --
 *  it gets `.shift()`'d out of `judgeArea` (removed) but matches neither judge-phase branch, so
 *  it's never resolved AND never reaches `discardPile` -- the card just vanishes, permanently,
 *  with no trace. Caught via `testPhaseCyclingConservesCards` (a real card, id 20, a Diamond
 *  Slash Daqiao had viewed as Indulgence via Guose, disappeared from every pile/hand/judgeArea
 *  after its owner's Judge phase ran) -- same "safe to mutate a card once it's committed to a
 *  new role" precedent `attachSupplyShortage` below already uses. */
export function attachIndulgence(ctx: EngineContext, target: GamePlayer, card: Card): void {
  card.kind = CardKind.Indulgence;
  if (target.skills.some((s) => s.blocksIndulgenceEntry?.(target))) {
    ctx.discardPile.push(card);
    ctx.log.push(`${target.id} miễn nhiễm, Lạc Bất Tư Thục vào thẳng chồng bài bỏ (qianxun)`);
    return;
  }
  target.judgeArea.push(card);
  ctx.log.push(`${target.id} nhận Lạc Bất Tư Thục vào vùng phán xét`);
}

/** Indulgence's Judge-phase resolution (Room.runJudgePhase, called once `target`'s turn
 *  reaches its own Judge phase): judges a card (reusing the shared `judge()` helper, so any
 *  retrial skill -- e.g. Guicai/Guidao -- can still intervene); if the result is NOT Heart,
 *  `target` skips their own Play phase this turn. The judgment card is disposed via
 *  `disposeJudgmentCard` (so Guojia's Tiandu can claim it instead of it being discarded); the
 *  Indulgence card itself always ends up in the discard pile afterward -- real Sanguosha
 *  doesn't cycle it back for another attempt, unlike some other delayed tricks. */
export async function resolveIndulgenceJudgment(ctx: EngineContext, target: GamePlayer, card: Card): Promise<void> {
  const judgeCard = await judge(ctx, target, "indulgence");
  if (judgeCard) {
    ctx.log.push(`${target.id} phán Lạc Bất Tư Thục: ${SUIT_LABEL_VI[judgeCard.suit]} ${judgeCard.point}`);
    if (judgeCard.suit !== Suit.Heart) {
      target.forcedSkipPlayPhase = true;
      ctx.log.push(`${target.id} sẽ bỏ qua giai đoạn ra bài lượt này (indulgence)`);
    }
    await disposeJudgmentCard(ctx, target, judgeCard);
  }
  ctx.discardPile.push(card);
}

/** Alive players `actor` could legally target with SupplyShortage: not self, no existing
 *  SupplyShortage already attached, and within the card's real base distance-1 limit
 *  (extended by `extraTrickDistance`, e.g. Xu Huang's Duanliang: +1) -- verified exactly
 *  against the real upstream `SupplyShortage::targetFilter`'s own `distance_limit`. */
export function supplyShortageCandidates(actor: GamePlayer, alive: GamePlayer[]): GamePlayer[] {
  const extra = Math.max(0, ...actor.skills.map((s) => s.extraTrickDistance?.(CardKind.SupplyShortage) ?? 0), 0);
  const limit = 1 + extra;
  return alive.filter(
    (p) => p !== actor && !p.judgeArea.some((c) => c.kind === CardKind.SupplyShortage) && effectiveDistance(alive, actor, p) <= limit,
  );
}

/** Attaches `card` (SupplyShortage, already detached from the player's hand by the caller) to
 *  `target`'s judge area. `card.kind` is force-set to `CardKind.SupplyShortage` here -- a no-op
 *  for a real SupplyShortage card, but REQUIRED for a Duanliang-viewed card (whose `.kind` is
 *  still whatever black card it originally was): `Room.runJudgePhase`'s dispatch keys off
 *  `.kind`, and the card is leaving the hand permanently at this point, so rewriting it here is
 *  safe (same "safe to mutate a card once it's committed to a new role" precedent as Hongyan's
 *  in-place `.suit` rewrite). */
export function attachSupplyShortage(ctx: EngineContext, target: GamePlayer, card: Card): void {
  card.kind = CardKind.SupplyShortage;
  target.judgeArea.push(card);
  ctx.log.push(`${target.id} nhận Binh Lương Thốn Đoạn vào vùng phán xét`);
}

/** SupplyShortage's Judge-phase resolution (Room.runJudgePhase, called once `target`'s turn
 *  reaches its own Judge phase): judges a card; if the result is NOT Club, `target` skips their
 *  own Draw phase this turn (verified exactly against the real upstream `SupplyShortage`'s
 *  `judge.pattern = ".|club"` + `takeEffect`'s `target->skip(Player::Draw)`). Mirrors
 *  `resolveIndulgenceJudgment`'s exact shape (shared `judge()`/`disposeJudgmentCard` helpers). */
export async function resolveSupplyShortageJudgment(ctx: EngineContext, target: GamePlayer, card: Card): Promise<void> {
  const judgeCard = await judge(ctx, target, "supply_shortage");
  if (judgeCard) {
    ctx.log.push(`${target.id} phán Binh Lương Thốn Đoạn: ${SUIT_LABEL_VI[judgeCard.suit]} ${judgeCard.point}`);
    if (judgeCard.suit !== Suit.Club) {
      target.forcedSkipDrawPhase = true;
      ctx.log.push(`${target.id} sẽ bỏ qua giai đoạn rút bài lượt này (supply_shortage)`);
    }
    await disposeJudgmentCard(ctx, target, judgeCard);
  }
  ctx.discardPile.push(card);
}

/** Alive players `actor` could legally target with Fire Attack: not self, has >=1 hand card
 *  (real rule: `to_select->isKongcheng()` excludes empty-handed targets; the real rule also
 *  technically allows self-targeting, gated by an obscure "not your own last hand card" clause
 *  -- simplified out here, same self-exclusion precedent as Dismantlement/Snatch above). */
export function fireAttackCandidates(actor: GamePlayer, alive: GamePlayer[]): GamePlayer[] {
  return alive.filter((p) => p !== actor && p.handcardNum > 0);
}

/** Fire Attack (Milestone 27): `target` reveals (keeps) 1 of their own hand cards -- their own
 *  choice which (real rule: `askForCardShow`), via the generic `askAnyHandCards(target, 1, 1)`
 *  ask (never declines: `fireAttackCandidates` already guarantees >=1 card). `source` may then
 *  discard 1 of THEIR OWN hand cards matching the revealed suit (`askAnyHandCards(source, 0, 1)`,
 *  validated against the revealed suit afterward -- a mismatched or declined response is a
 *  decline, same "never forced" precedent `controller.ts` documents for Luanji's same-suit
 *  requirement) to deal 1 damage. */
export async function resolveFireAttack(ctx: EngineContext, source: GamePlayer, target: GamePlayer): Promise<void> {
  if (target.handcardNum === 0) return;
  const revealChoice = await ctx.askAnyHandCards(target, 1, 1);
  const shown = revealChoice.length === 1 && target.hand.includes(revealChoice[0]) ? revealChoice[0] : target.hand[0];
  ctx.log.push(`${target.id} lật 1 lá bài chất ${SUIT_LABEL_VI[shown.suit]} (hỏa công)`);
  if (!source.alive) return;
  const discardChoice = await ctx.askAnyHandCards(source, 0, 1);
  const matching =
    discardChoice.length === 1 && discardChoice[0].suit === shown.suit && source.hand.includes(discardChoice[0])
      ? discardChoice[0]
      : null;
  if (!matching) {
    ctx.log.push(`${source.id} không bỏ được lá cùng chất, hỏa công thất bại`);
    return;
  }
  source.hand.splice(source.hand.indexOf(matching), 1);
  ctx.discardPile.push(matching);
  ctx.log.push(`${source.id} bỏ 1 lá cùng chất, gây 1 sát thương Hỏa cho ${target.id} (hỏa công)`);
  await applyDamage(ctx, target, 1, source, DamageNature.Fire);
}

/** Lightning always targets the player who plays it (real rule: `target_fixed = true`, no
 *  choice at all) -- modeled as a 1-candidate list so it can reuse the existing
 *  `tryPlayDelayedTrick` targeting machinery instead of a dedicated no-target code path. */
export function lightningCandidates(actor: GamePlayer): GamePlayer[] {
  return [actor];
}

/** Attaches `card` (Lightning, already detached from the player's hand by the caller) to
 *  `target`'s (always `target === actor`, see `lightningCandidates`) judge area. */
export function attachLightning(ctx: EngineContext, target: GamePlayer, card: Card): void {
  target.judgeArea.push(card);
  ctx.log.push(`${target.id} nhận Thiểm Điện vào vùng phán xét`);
}

/** Lightning's Judge-phase resolution (Room.runJudgePhase, called once `target`'s turn reaches
 *  its own Judge phase): judges a card; if the result is Spade 2~9 (verified exactly against the
 *  real upstream `Lightning`'s `judge.pattern = ".|spade|2~9"`), `target` takes 3 Thunder damage
 *  and the card is discarded -- otherwise (the "good" outcome for `target`), the SAME card moves
 *  on to the next ALIVE player's judge area instead of being discarded, to be judged again at
 *  THEIR own next Judge phase (real rule: Lightning circulates the table until someone finally
 *  rolls Spade 2~9). Mirrors resolveIndulgenceJudgment/resolveSupplyShortageJudgment's shared
 *  `judge()` shape, but is the only one of the 3 that can re-attach instead of always discarding.
 *  The 3-damage hit itself is modeled via `loseHp` (not `applyDamage`) -- the real
 *  `DamageStruct(this, NULL, target, 3, Thunder)` has NO attacking player at all (a natural-
 *  disaster hit, not credited to anyone), which `applyDamage`'s mandatory `source: GamePlayer`
 *  parameter can't express; `loseHp`'s existing "no source, no onDamage/onDamageDealt reactive
 *  triggers, still runs the dying/rescue check" shape is the closest honest match already in
 *  this engine (same precedent as Kurou's self-inflicted hp loss). Known deviation: a real
 *  target-side `reduceDamage` skill (e.g. Kongrong's Mingshi) would still apply to a sourceless
 *  DamageStruct in the true engine; `loseHp` bypasses `reduceDamage` entirely, so Mingshi (the
 *  only ported `reduceDamage` skill) won't blunt a Lightning hit here -- a narrow, deliberate
 *  simplification rather than a broader `applyDamage` refactor for one card's edge case. */
export async function resolveLightningJudgment(ctx: EngineContext, target: GamePlayer, card: Card): Promise<void> {
  const judgeCard = await judge(ctx, target, "lightning");
  if (judgeCard) {
    ctx.log.push(`${target.id} phán Thiểm Điện: ${SUIT_LABEL_VI[judgeCard.suit]} ${judgeCard.point}`);
    await disposeJudgmentCard(ctx, target, judgeCard);
    if (judgeCard.suit === Suit.Spade && judgeCard.point >= 2 && judgeCard.point <= 9) {
      ctx.discardPile.push(card);
      ctx.log.push(`${target.id} chịu 3 sát thương Lôi từ Thiểm Điện`);
      await loseHp(ctx, target, 3);
      return;
    }
  }
  const idx = ctx.alivePlayers.indexOf(target);
  const next = idx === -1 ? target : ctx.alivePlayers[(idx + 1) % ctx.alivePlayers.length];
  next.judgeArea.push(card);
  ctx.log.push(`${target.id} không trúng Thiểm Điện, lá chuyển sang ${next.id}`);
}

/** Alive players `actor` could legally target with Collateral (the card's real "A" slot, i.e.
 *  `killer` below): not self, has a weapon equipped (real rule: `to_select->getWeapon()`). The
 *  2nd target ("B"/`victim`) is picked from within `killer`'s own attack range by `actor`
 *  *inside* `resolveCollateral` below (`ctx.askChooseAnyPlayer`) rather than via a 2nd
 *  `chooseTrickTarget` ask -- this engine's single-target `chooseTrickTarget` contract already
 *  covers "A"; nesting a 2nd generic player-ask inside the resolve callback reaches the same
 *  real "actor picks both A and B up front" outcome without needing a dedicated 2-stage
 *  trick-targeting UI. */
export function collateralCandidates(actor: GamePlayer, alive: GamePlayer[]): GamePlayer[] {
  return alive.filter((p) => p !== actor && p.weapon !== null);
}

/** Collateral (Tá Đao Sát Nhân, Milestone 29): `source` (who played the card) picks `victim`
 *  ("B") from within `killer`'s ("A", already chosen via `chooseTrickTarget`) own attack range.
 *  `killer` is then offered the choice to Slash `victim` (only if actually legal -- in range,
 *  holds a Slash-like card, `victim` not immune); declining (or being unable) forfeits `killer`'s
 *  equipped weapon straight into `source`'s hand (matches the real rule's `canSlash`-gated ask +
 *  `obtainCard` weapon-forfeit fallback). If `source` has died before this resolves, `killer` is
 *  still offered the Slash but the weapon can never change hands (matches the real
 *  `source->isDead()` branch, which skips the weapon-transfer path entirely either way). */
export async function resolveCollateral(ctx: EngineContext, source: GamePlayer, killer: GamePlayer): Promise<void> {
  const bCandidates = ctx.alivePlayers.filter(
    (p) => p !== killer && effectiveDistance(ctx.alivePlayers, killer, p) <= effectiveAttackRange(ctx.alivePlayers, killer),
  );
  if (bCandidates.length === 0) return;
  const victim = await ctx.askChooseAnyPlayer(source, bCandidates);
  if (!victim) return;

  const canSlashVictim = findSlashLikeCard(killer, ctx.aoChienActive) !== null && !isImmuneToSlashAndDuel(victim);
  let slashed = false;
  if (canSlashVictim && (await ctx.askUseSelfAction(killer, "collateral-slash"))) {
    // Re-fetch (not reused from the pre-ask check above) -- killer's hand may have changed
    // while the ask above was pending (a real risk for a human-controlled seat; harmless for
    // bots, which resolve asks immediately), same "resolve validity after awaits, not before"
    // precedent tryPlayOnce's own doc comment documents for Duel's alternating exchange.
    const card = findSlashLikeCard(killer, ctx.aoChienActive);
    if (card) {
      killer.hand.splice(killer.hand.indexOf(card), 1);
      ctx.log.push(`${source.id} dùng Tá Đao Sát Nhân, buộc ${killer.id} dùng Sát lên ${victim.id}`);
      await resolveSlash(ctx, killer, victim, card);
      slashed = true;
    }
  }
  if (!slashed && source.alive && killer.weapon) {
    const weapon = killer.weapon;
    await detachCardFrom(ctx, killer, weapon);
    source.hand.push(weapon);
    ctx.log.push(`${killer.id} không dùng Sát, giao vũ khí cho ${source.id} (collateral)`);
  }
}

/** Alive players `actor` could legally target with Befriend Attacking (Viễn Giao Cận Công):
 *  another player with a DETERMINED faction (real rule: `hasShownOneGeneral()` on both sides,
 *  i.e. `faction !== ""` -- only ever true in Hegemony mode after at least 1 reveal) different
 *  from `actor`'s own -- Hegemony-only in practice, since Identity mode never assigns `faction`
 *  at all. */
export function befriendAttackingCandidates(actor: GamePlayer, alive: GamePlayer[]): GamePlayer[] {
  if (actor.faction === "") return [];
  return alive.filter((p) => p !== actor && p.faction !== "" && p.faction !== actor.faction);
}

/** Befriend Attacking (Viễn Giao Cận Công, Milestone 29): `target` draws 1 card, then `source`
 *  draws 3. */
export async function resolveBefriendAttacking(ctx: EngineContext, source: GamePlayer, target: GamePlayer): Promise<void> {
  ctx.draw(target, 1);
  ctx.draw(source, 3);
  ctx.log.push(`${target.id} bốc 1 lá, ${source.id} bốc 3 lá (viễn giao cận công)`);
}

/** Await Exhausted (Dĩ Dật Đãi Lao, Milestone 30): `target_fixed = true` in the real source --
 *  always self+allies, no target choice at all -- modeled as a 1-candidate (self) list through
 *  the existing `tryPlayOnce` machinery, same precedent as Lightning's fixed self-target. The
 *  effect itself was already ported (Lu Xun's Duoshi viewAs conversion, `skill.ts`'s
 *  `duoshiSelfAction`) -- this is the same "self+allies draw 2 then discard 2" loop, just
 *  reachable from a real dealt card now instead of only through Duoshi's skill. */
export function awaitExhaustedCandidates(actor: GamePlayer): GamePlayer[] {
  return [actor];
}

export async function resolveAwaitExhausted(ctx: EngineContext, source: GamePlayer): Promise<void> {
  const targets = [source, ...alliesOf(source, ctx.alivePlayers)];
  for (const t of targets) ctx.draw(t, 2);
  for (const t of targets) {
    const n = Math.min(2, t.hand.length);
    if (n === 0) continue;
    const chosen = await ctx.askChooseDiscards(t, n);
    for (const c of chosen) t.hand.splice(t.hand.indexOf(c), 1);
    ctx.discardPile.push(...chosen);
  }
  ctx.log.push(`${source.id} dùng Dĩ Dật Đãi Lao: ${targets.map((t) => t.id).join(", ")} bốc 2 rồi bỏ 2 lá`);
}

/** Iron Chain (Thiết Tác Liên Hoàn, Milestone 30): toggles `target`'s chained state (see
 *  `player.chained`'s doc comment and `combat.ts`'s `applyDamage` header for the splash rule
 *  this feeds). Real rule lets the player pick 1-2 targets at once, or discard the card for 1
 *  card draw ("recast") instead of targeting anyone -- simplified here to always exactly 1
 *  target (no recast), same "faithful behavior, simplified interaction" precedent as Guanxing's
 *  top/bottom split. No self-exclusion (real `targetFilter` allows targeting yourself, e.g. to
 *  intentionally chain yourself alongside an opponent for a splash combo, or to unchain
 *  yourself). */
export function ironChainCandidates(alive: GamePlayer[]): GamePlayer[] {
  return alive;
}

export function resolveIronChain(ctx: EngineContext, target: GamePlayer): void {
  target.chained = !target.chained;
  ctx.log.push(`${target.id} ${target.chained ? "vào" : "thoát"} trạng thái liên hoàn (iron_chain)`);
}

/** Alive players `actor` could legally target with KnownBoth (Tri Bỉ Tri Kỉ): not self, and has
 *  something worth viewing -- hand cards, or (Hegemony) a still-hidden general -- matching the
 *  real `targetFilter`'s `!to_select->isKongcheng() || !to_select->hasShownAllGenerals()`. */
export function knownBothCandidates(actor: GamePlayer, alive: GamePlayer[]): GamePlayer[] {
  return alive.filter(
    (p) => p !== actor && (p.handcardNum > 0 || !p.mainRevealed || (p.deputyGeneral !== "" && !p.deputyRevealed)),
  );
}

/** KnownBoth (Tri Bỉ Tri Kỉ, Milestone 31): `actor` privately views EITHER `target`'s full hand
 *  OR one of `target`'s still-hidden generals (Hegemony mode only -- Identity mode never hides
 *  generals, so only "handcards" is ever offered there) -- their own choice among whatever's
 *  actually available (`knownBothCandidates` already guarantees at least 1 option).  Delivered
 *  via `ctx.revealPrivately`, NEVER `ctx.log` (a single shared PUBLIC channel every player/
 *  spectator sees identically) -- see combat.ts's `PrivateReveal` doc comment. Real rule's
 *  recast (discard for 1 draw instead of targeting) is dropped, same "faithful behavior,
 *  simplified interaction" precedent already used for IronChain's own recast. */
export async function resolveKnownBoth(ctx: EngineContext, actor: GamePlayer, target: GamePlayer): Promise<void> {
  const options: KnownBothOption[] = [];
  if (target.handcardNum > 0) options.push("handcards");
  if (!target.mainRevealed) options.push("head_general");
  if (target.deputyGeneral !== "" && !target.deputyRevealed) options.push("deputy_general");
  if (options.length === 0) return; // defensive: knownBothCandidates already guarantees this never happens
  const choice = await ctx.askKnownBothChoice(actor, target, options);
  const picked = options.includes(choice) ? choice : options[0];
  ctx.log.push(`${actor.id} dùng Tri Bỉ Tri Kỉ lên ${target.id}`);
  if (picked === "handcards") {
    ctx.revealPrivately(actor, { kind: "hand", ownerId: target.id, cards: [...target.hand] });
  } else {
    const slot = picked === "head_general" ? "main" : "deputy";
    ctx.revealPrivately(actor, {
      kind: "general",
      ownerId: target.id,
      generalName: slot === "main" ? target.generalName : target.deputyGeneralName,
      slot,
    });
  }
}
