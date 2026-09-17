// General skills. This is a deliberately small, TYPED hook system (not a generic
// events<<...>>/triggerable/cost/effect trigger bus like src/core/skill.h's TriggerSkill) --
// these hook points cover the 44 generals ported so far. If/when many more generals are ported,
// this should graduate to a real event bus (Room emits named events, skills subscribe); doing
// that now would be speculative infrastructure.
//
// Ported from src/package/standard-{shu,wei,wu,qun}-generals.cpp, Hegemony-only branches
// stripped (they gate on `lord->hasLordSkill("shouyue")`, the dual-general "sworn brothers"
// mechanic, which is out of scope for Role mode). See git history / earlier README milestones
// for the header notes on the first 14 generals (Paoxiao/Wusheng/Ganglie/Longdan/Qingguo/
// Kongcheng/Tieqi/Fankui/Kurou/Qianxun/Kuanggu/Jianxiong/Yingzi/Qixi) -- kept below, unchanged.
//
//   - Paoxiao (Zhang Fei): TargetModSkill, getResidueNum returns 1000 ("unlimited") whenever the
//     player has the skill -- ported as "no Slash-per-turn cap".
//   - Wusheng (Guan Yu): OneCardViewAsSkill, viewFilter requires card->isRed() (Hegemony shouyue
//     branch removes that requirement -- not ported) -- ported as "any red card in hand may be
//     played/used as if it were a Slash".
//   - Ganglie (Xiahou Dun): MasochismSkill::onDamaged judges a card (pattern ".|heart", good=false
//     i.e. "good" = NOT heart); if good, the damage source may discard 2 cards or take 1 damage
//     (now a real choice, see wantsToDiscardForGanglie in controller.ts).
//   - Longdan (Zhao Yun): LongdanVS is OneCardViewAsSkill, bidirectional Slash<->Jink -- ported
//     as-is. lang/vi_VN's `:longdan` describes a newer skill revision with extra bonus clauses
//     this repo's `dev`-branch class doesn't implement -- not ported.
//   - Qingguo (Zhen Ji): OneCardViewAsSkill, filter_pattern ".|black|.|hand", response only --
//     ported as-is (matches lang/vi_VN exactly).
//   - Kongcheng (Zhuge Liang): TriggerSkill on TargetConfirming, cancels Slash/Duel targeting
//     when hand is empty -- simplified from optional invoke to automatic, since it's a
//     defensive effect a player would essentially always want and this repo's Controller ask
//     surface doesn't scale to one named yes/no per general. lang/vi_VN describes a different
//     skill revision -- not ported.
//   - Tieqi (Ma Chao): TriggerSkill on TargetChosen, judges a card, automatic (same reasoning);
//     if red, that Slash can't be dodged. lang/vi_VN describes a different revision -- not ported.
//   - Fankui (Sima Yi): MasochismSkill::onDamaged, take 1 random card from the damage source's
//     hand (matches lang/vi_VN exactly). Equip-card stealing not modeled.
//   - Kurou (Huang Gai): ZeroCardViewAsSkill, once per Play phase: lose 1 hp, draw 2 cards.
//     lang/vi_VN describes a richer revision -- not ported.
//   - Qianxun (Lu Xun): TriggerSkill, compulsory: cancels Snatch targeting against him.
//   - Kuanggu (Wei Yan): compulsory: after dealing damage to a target within distance 1 while
//     wounded, recover 1 hp per point of damage dealt. lang/vi_VN describes a choice (recover or
//     draw); this repo's `dev`-branch only implements recover -- ported as-is.
//   - Jianxiong (Cao Cao): MasochismSkill::onDamaged, obtain the exact damage-dealing card
//     (matches lang/vi_VN exactly); approximated as "top of the discard pile" since this repo's
//     `onDamage` hook doesn't thread the specific card through.
//   - Yingzi (Zhou Yu): DrawCardsSkill, +1 card every Draw phase, automatic (same reasoning).
//   - Qixi (Gan Ning): OneCardViewAsSkill, any black hand card playable/discardable as
//     Dismantlement (matches lang/vi_VN exactly).
//
// Milestone 2.6 batch 4 (30 more generals): the hook system grew substantially in one pass to
// cover this batch -- see each new hook's doc comment below for what it does and which
// general(s) need it. Every optional-invoke skill from the C++ that has NO real strategic cost
// (Frequent-labeled or otherwise "why would you ever decline") is simplified to automatic, same
// precedent as Kongcheng/Tieqi/Yingzi above; skills with a genuine cost (discard/hp/targeting a
// specific player) are gated by the existing generic `askUseSelfAction(player, skillName)` ask
// (originally named for Kurou's Play-phase self action; the name stuck, the shape generalized to
// "wants to invoke this skill" for every reactive/proactive skill added since) and the new
// `askChooseAnyPlayer` ask for skills that pick an unrestricted target. Several C++ classes in
// this batch are STUBS whose real behavior lives in files not included in this repo's dump
// (Duanbing) or reference subsystems this port explicitly doesn't have (multi-card viewAs,
// pindian, judge-area/delayed-tricks, face-up/down state, gender, marks/limit-counters, equip
// stealing) -- those generals/skills are simply not ported; see webport/README.md's Milestone
// 2.6 section for the full per-general blocked list and reasons.

// Post-Milestone-2.6: Guanxing (Zhuge Liang's 2nd skill) ported, closing the gap this file's
// header and webport/README.md previously called out as "needs card-reorder UI". Real Guanxing
// lets you look at the top X cards (X = alive player count, capped at 5) and arrange them in
// ANY order onto the top or bottom of the draw pile; that free-form reorder is simplified down
// to a top/bottom split (pick which revealed cards go to the bottom, the rest stay on top in
// original relative order) -- same "faithful behavior, simplified interaction" precedent as
// Kongcheng/Tieqi/Yingzi above, and still exercises the actual strategic decision (bury bad
// cards vs. keep good ones accessible) without a drag-and-drop UI. See EngineContext's
// peekTop/arrangeTop/askGuanxingBottom (combat.ts) and Room's backing peekTop/arrangeTop
// (room.ts) for the mechanics, and Controller.chooseGuanxingBottom (controller.ts) for the
// human/bot decision surface.

// Post-Milestone-2.6 (cont'd): Guicai (Sima Yi's 2nd skill) ported too, closing another gap
// this file long called "needs judge-area/retrial system". Turns out Guicai's real trigger
// (AskForRetrial, confirmed from upstream src/package/standard-wei-generals.cpp) applies to
// ANY judgment, not specifically delayed-trick judge-area ones -- so it plugs directly into
// the 5 judgments this port already has (Ganglie/Tieqi/Shuangxiong/Leiji/Beige) via a new
// shared `judge()` helper (replacing every raw `ctx.drawTop()` judgment call) and a new
// `onJudgment` skill hook, no judge-area subsystem needed. Bots always decline (no
// alignment-aware AI to judge whether flipping a given judgment helps or hurts its owner);
// humans get a real card-pick-or-decline ask. See EngineContext.askGuicaiRetrial (combat.ts),
// the `judge()` helper right below, and Controller.wantsToUseGuicai (controller.ts).

import { Card, CardKind, Suit } from "./card.js";
import { GamePlayer } from "./player.js";
import { Phase, Role } from "./types.js";
import { alliesOf, isAlly } from "./gamerule.js";
import { EngineContext, SUIT_LABEL_VI, applyDamage, detachCardFrom, effectiveAttackRange, effectiveDistance, findSlashLikeCard, heal, judge, loseHp, resolveSlash } from "./combat.js";
import { resolveArcheryAttack, resolveDuel } from "./trick.js";

export interface Skill {
  name: string;
  /** Official Vietnamese skill name, from lang/vi_VN/Package/Standard{Shu,Wei,Wu,Qun}General.lua. */
  displayName: string;
  /**
   * Vietnamese description of the behavior actually implemented below -- NOT always copied
   * verbatim from lang/vi_VN's `:skillname` entries, because several describe a
   * different/newer skill revision than this repo's `dev`-branch C++ actually implements (see
   * the module header above for which ones and why). Describing the real ported behavior here
   * beats reusing text that would overpromise or mismatch what the engine does.
   */
  description: string;
  /** Compulsory rule modifier: minimum total Slash plays allowed this turn (default 1 if absent). */
  slashLimit?(player: GamePlayer): number;
  /** ViewAs: can `card` be played/discarded as if it were a Slash? `player` lets a skill gate on
   *  transient per-player state (e.g. Shuangxiong's judged color); ignore it if not needed. */
  canViewAsSlash?(card: Card, player: GamePlayer): boolean;
  /** ViewAs: can `card` be played/discarded as if it were a Jink? */
  canViewAsJink?(card: Card, player: GamePlayer): boolean;
  /** ViewAs: can `card` be played/discarded as if it were a Dismantlement? */
  canViewAsDismantlement?(card: Card, player: GamePlayer): boolean;
  /** ViewAs: can `card` be played/discarded as if it were a Peach (e.g. Jijiu)? */
  canViewAsPeach?(card: Card, player: GamePlayer): boolean;
  /** ViewAs: can `card` be played/discarded as if it were a Duel (e.g. Shuangxiong)? */
  canViewAsDuel?(card: Card, player: GamePlayer): boolean;
  /** ViewAs: can `card` be played as if it were Indulgence (e.g. Daqiao's Guose, any Diamond)? */
  canViewAsIndulgence?(card: Card, player: GamePlayer): boolean;
  /** True while `player` should be immune to being targeted by Slash/Duel (e.g. Kongcheng). */
  immuneToSlashAndDuel?(player: GamePlayer): boolean;
  /** True while `player` should be immune to being targeted by Snatch (e.g. Qianxun). */
  immuneToSnatch?(player: GamePlayer): boolean;
  /** True while `player` should be immune to a black-suited trick card targeting them (e.g. Weimu). */
  immuneToBlackTrick?(player: GamePlayer): boolean;
  /** True while `player` should be immune to being targeted by Savage Assault (e.g. Menghuo). */
  immuneToSavageAssault?(player: GamePlayer): boolean;
  /**
   * Fired for each of the attacker's skills right after a Slash targets `target`, before the
   * Jink check. Returning true blocks `target` from Jink-ing this specific Slash (e.g. Tieqi).
   */
  onSlashTargeted?(ctx: EngineContext, attacker: GamePlayer, target: GamePlayer): Promise<boolean> | boolean;
  /**
   * Fired for each of the ORIGINAL target's skills before onSlashTargeted, letting the defender
   * nullify the Slash outright (e.g. Liushan's Xiangle) or redirect it to a different player
   * (e.g. Daqiao's Liuli). Returning nothing lets the Slash proceed against the original target.
   */
  onIncomingSlash?(
    ctx: EngineContext,
    attacker: GamePlayer,
    defender: GamePlayer,
  ): Promise<{ nullify?: boolean; redirectTo?: GamePlayer } | void> | { nullify?: boolean; redirectTo?: GamePlayer } | void;
  /** How many Jinks/Slashes `player` needs to produce to dodge a Slash / continue a Duel
   *  exchange (default 1 if absent, e.g. Lu Bu's Wushuang returns 2 for himself). */
  responseCountRequired?(kind: "dodge" | "duel", player: GamePlayer): number;
  /** Fired on both the attacker's and the (possibly redirected) target's skills right after a
   *  Slash is successfully dodged (e.g. Pangde's Mengjin, Zhangjiao's Leiji). */
  onSlashDodged?(ctx: EngineContext, attacker: GamePlayer, target: GamePlayer): Promise<void> | void;
  /** Reactive: called right after `player` takes damage dealt by `source`. */
  onDamaged?(ctx: EngineContext, player: GamePlayer, source: GamePlayer, rng: () => number): Promise<void> | void;
  /** Reactive: called right after `source` deals `amount` damage to `target` (e.g. Kuanggu). */
  onDamageDealt?(ctx: EngineContext, source: GamePlayer, target: GamePlayer, amount: number): Promise<void> | void;
  /** Consulted at the top of `applyDamage`, once per skill of `target`, chained in skill order;
   *  returns the (possibly reduced) damage amount. <=0 cancels the hit entirely (e.g. Mingshi). */
  reduceDamage?(ctx: EngineContext, target: GamePlayer, source: GamePlayer, amount: number): number;
  /** Reactive: called whenever `player` recovers hp, healed or not (e.g. Ganfuren's Shushen). */
  onRecover?(ctx: EngineContext, player: GamePlayer, amount: number): Promise<void> | void;
  /** Proactive, no-target, once-per-Play-phase self ability (e.g. Kurou); gated by
   *  `Controller.wantsToUseSelfAction`. */
  selfAction?(ctx: EngineContext, player: GamePlayer, rng: () => number): Promise<void> | void;
  /** Like `selfAction`, but fires at the start of a phase OTHER than Play (e.g. Ganfuren's
   *  Shenzhi at Start, Zhangliao's Tuxi at Draw) -- same `wantsToUseSelfAction` gate. */
  otherPhaseAction?: { phase: Phase; run(ctx: EngineContext, player: GamePlayer, rng: () => number): Promise<void> | void };
  /** Fired right after the Draw phase's normal draw resolves (e.g. Lusu's forced Haoshi giveaway
   *  when it leaves him over the 5-card soft cap). */
  afterDrawPhase?(ctx: EngineContext, player: GamePlayer, rng: () => number): Promise<void> | void;
  /** Additive modifier to the number of cards drawn during `player`'s own Draw phase (e.g. Yingzi). */
  drawPhaseBonus?(player: GamePlayer): number;
  /** True if `player`'s trick-card plays of `kind` ignore Snatch's distance-1 limit (e.g. Qicai). */
  ignoresTrickDistanceLimit?(kind: CardKind): boolean;
  /** Fired after ANY trick card `player` plays resolves (e.g. Huangyueying's Jizhi: draw 1). */
  onTrickPlayed?(ctx: EngineContext, player: GamePlayer, kind: CardKind): Promise<void> | void;
  /** True if the played Savage Assault card should go to `player`'s hand instead of the discard
   *  pile after resolving (e.g. Zhurong's Juxiang, when someone ELSE played it). */
  claimsUsedSavageAssaultCard?(player: GamePlayer): boolean;
  /** Consulted once at the start of Savage Assault resolution, for every alive player's skills;
   *  a non-null return reassigns damage credit for the whole AOE to that player (e.g. Menghuo's
   *  Huoshou). */
  hijackAoeSource?(ctx: EngineContext, self: GamePlayer, actualUser: GamePlayer): Promise<GamePlayer | null> | GamePlayer | null;
  /** True while `player` should skip their own Discard phase entirely (e.g. Lvmeng's Keji). */
  skipsDiscardPhase?(player: GamePlayer): boolean;
  /** Fired right after `player` loses an equipped card (only re-equip-replacement moves an equip
   *  in this engine) -- e.g. Sunshangxiang's Xiaoji. */
  onEquipLost?(ctx: EngineContext, player: GamePlayer): Promise<void> | void;
  /** Fired on every OTHER alive player's matching skill right after `discardingPlayer`'s own
   *  Discard-phase over-limit discard resolves (e.g. Erzhang's Guzheng). */
  onOtherPlayerOverDiscard?(
    ctx: EngineContext,
    self: GamePlayer,
    discardingPlayer: GamePlayer,
    discardedCards: Card[],
    rng: () => number,
  ): Promise<void> | void;
  /** Generic proactive single-target skill (e.g. Dianwei's Qiangxi, Huatuo's Qingnang): gated by
   *  `wantsToUseSelfAction` then `chooseAnyPlayerTarget` restricted to `candidatesFor`'s list. */
  activeAction?: {
    candidatesFor(alive: GamePlayer[], player: GamePlayer): GamePlayer[];
    run(ctx: EngineContext, player: GamePlayer, target: GamePlayer, rng: () => number): Promise<void> | void;
  };
  /** Additive modifier to `player`'s distance TO other players (positive = closer, same -1-style
   *  shape as an offense horse). Consulted by combat.ts's effectiveDistance (e.g. Mashu). */
  attackDistanceDelta?(player: GamePlayer): number;
  /** Broadcast to every alive player's skills whenever any judgment (Ganglie/Tieqi/Shuangxiong/
   *  Leiji/Beige, via the shared `judge()` helper below) is resolving -- `self` is the reacting
   *  player, `judgeOwner` is whose judgment it is (may equal `self`), `currentCard` is the
   *  judgment's card so far (the fresh draw, or an earlier retrial's replacement). Return a
   *  replacement card from `self.hand` (a "retrial" -- e.g. Sima Yi's Guicai) or null to
   *  decline; `judge()` removes it from hand and voids the overridden card to the discard pile. */
  onJudgment?(
    ctx: EngineContext,
    self: GamePlayer,
    judgeOwner: GamePlayer,
    currentCard: Card,
    reason: string,
  ): Promise<Card | null>;
  /** Fired on `player`'s own skills right after a card they played leaves their hand at 0 count
   *  (e.g. Tianfeng's Sijian). */
  onHandEmptied?(ctx: EngineContext, player: GamePlayer, rng: () => number): Promise<void> | void;
  /** Broadcast to every alive player's skills whenever anyone starts dying / actually dies, so
   *  allies can react (e.g. Tianfeng's Suishi). `self` is the reacting player, never the one
   *  dying/dead. */
  onAllyDying?(ctx: EngineContext, self: GamePlayer, dyingAlly: GamePlayer, rng: () => number): Promise<void> | void;
  onAllyDeath?(ctx: EngineContext, self: GamePlayer, deadAlly: GamePlayer, rng: () => number): Promise<void> | void;
  /** True if `player` claims a just-died player's hand instead of it going to the discard pile
   *  (e.g. Caopi's Xingshang). Purely automatic (no ask) -- see room.ts's killPlayer. */
  claimsDeathCards?: boolean;
  /** Fired on every OTHER alive player's matching skill at `finishingPlayer`'s own Finish phase
   *  (e.g. Yuejin's Xiaoguo). */
  otherPlayerFinishReaction?(ctx: EngineContext, self: GamePlayer, finishingPlayer: GamePlayer, rng: () => number): Promise<void> | void;
  /** Fired on the ATTACKER's skills specifically after a SLASH (not Duel/AOE/skill-inflicted)
   *  they played deals damage -- e.g. Lieren (Zhurong). Distinct from the generic
   *  `onDamageDealt` (fires for every damage source) for the same reason KylinBow/DoubleSword/
   *  Triblade are resolved directly in `resolveSlash` instead of as `onDamageDealt` hooks. */
  onSlashDamageDealt?(ctx: EngineContext, source: GamePlayer, target: GamePlayer): Promise<void> | void;
  /** Fired whenever one of `player`'s OWN cards is about to enter the discard pile via a real
   *  discard action (not being played) -- e.g. Lirang (Kong Rong): may redirect it straight to
   *  another player's hand instead. Only wired into the shared `discardRandom` helper and
   *  `Room.discardDownToLimit`'s over-limit discard (the 2 most common "you discard your own
   *  card(s)" sites); proactive self-paid skill costs elsewhere aren't intercepted -- a
   *  deliberate "faithful behavior, simplified interaction" scope line, not a bug. */
  redirectsOwnDiscard?(ctx: EngineContext, self: GamePlayer, card: Card): Promise<GamePlayer | null>;
  /** True while `self` should block every OTHER alive player from playing Peach to rescue
   *  whoever is currently dying (e.g. Jiaxu's Wansha, active during his own turn) -- self-
   *  rescue is unaffected. Locked/compulsory: no ask. */
  suppressesAllyRescue?(self: GamePlayer): boolean;
  /** True if `player` may choose to skip their own Play phase entirely this turn (e.g.
   *  Liushan's Fangquan) -- gated by `wantsToUseSelfAction`, unlike Keji's compulsory
   *  `skipsDiscardPhase`. */
  canSkipPlayPhase?(player: GamePlayer): boolean;
  /** Fired once right after `player`'s Finish phase resolves normally -- may grant another
   *  player (or `player` themselves) an immediate extra turn inserted before the normal seat
   *  rotation continues (e.g. Liushan's Fangquan, after discarding 1 card). Returns the chosen
   *  recipient or null to decline. */
  grantsExtraTurn?(ctx: EngineContext, player: GamePlayer): Promise<GamePlayer | null>;
  /** Ask: does `judgeOwner` want to claim their own just-resolved judgment card into hand
   *  instead of it going to the discard pile (e.g. Guojia's Tiandu)? Consulted by
   *  `disposeJudgmentCard` (combat.ts), which every `judge()` call site that discards its own
   *  judgment card should route through. Guojia has no self-triggered judgment source of his
   *  own, so this only ever matters when a delayed trick (e.g. Indulgence) lands in HIS judge
   *  area -- see `trick.ts`'s `resolveIndulgenceJudgment`. */
  claimsOwnJudgment?(ctx: EngineContext, judgeOwner: GamePlayer): Promise<boolean>;
  /** True if a delayed trick entering `player`'s judge area should be discarded immediately
   *  instead of actually attaching (e.g. Qianxun's 2nd clause: Lu Xun auto-discards an
   *  Indulgence targeting him, on top of his existing Snatch immunity). Locked/compulsory: no
   *  ask. Consulted only for Indulgence right now (the only delayed trick implemented). */
  blocksIndulgenceEntry?(player: GamePlayer): boolean;
  /** Once-per-game (tracked via `player.usedLimitSkills`) alternative to a Peach-family
   *  self-rescue while dying (e.g. Pang Tong's Niepan): if it fires and returns true, the whole
   *  skill resolved its own recovery/effects internally (the caller just re-checks `player.hp`
   *  afterward, same as a successful Peach loop iteration); returning false means it declined
   *  or wasn't eligible, dying resolution proceeds to the normal ally-rescue round. Consulted
   *  by `resolveDying` right alongside the normal self-rescue-card check. */
  cheatsDeath?(ctx: EngineContext, player: GamePlayer): Promise<boolean>;
  /** Fired once, self-only (only ever consulted for `judgeOwner`'s own skills, unlike the
   *  broadcast `onJudgment` retrial hook above), right after `judge()` draws `judgeOwner`'s own
   *  fresh judgment card -- may mutate `currentCard.suit` in place to reinterpret it for every
   *  downstream consumer (e.g. Xiao Qiao's Hongyan: her own Spade judgment may become a Heart).
   *  A fresh per-judgment `Card` object is always safe to mutate (never shared/aliased). */
  filtersOwnJudgment?(ctx: EngineContext, self: GamePlayer, currentCard: Card): Promise<void>;
}

function isRed(card: Card): boolean {
  return card.suit === Suit.Heart || card.suit === Suit.Diamond;
}

function isBlack(card: Card): boolean {
  return card.suit === Suit.Spade || card.suit === Suit.Club;
}

/** Lirang (Kong Rong): routes `card` (already detached from `player`'s hand/equip by the
 *  caller) to the discard pile, unless some skill of `player`'s redirects it to another
 *  player's hand instead -- see `Skill.redirectsOwnDiscard`'s doc comment for exactly which
 *  discard call sites check this. Exported for `Room.discardDownToLimit`'s over-limit discard
 *  to share the same interception. */
export async function routeDiscard(ctx: EngineContext, player: GamePlayer, card: Card): Promise<void> {
  for (const skill of player.skills) {
    if (!skill.redirectsOwnDiscard) continue;
    const to = await skill.redirectsOwnDiscard(ctx, player, card);
    if (to && to.alive) {
      to.hand.push(card);
      ctx.log.push(`${player.id} giao 1 lá bài bỏ cho ${to.id} (lirang)`);
      return;
    }
  }
  ctx.discardPile.push(card);
}

/** Discards a uniformly random card from `player`'s hand, if any (routed through
 *  `routeDiscard`, so Lirang can intercept it). Used by several skills below that force a
 *  discard without a specific-card choice UI (matches the Fankui/Kongcheng precedent of
 *  collapsing "choose which card" down to random). */
async function discardRandom(ctx: EngineContext, player: GamePlayer, rng: () => number): Promise<Card | null> {
  if (player.hand.length === 0) return null;
  const idx = Math.floor(rng() * player.hand.length);
  const [card] = player.hand.splice(idx, 1);
  await routeDiscard(ctx, player, card);
  return card;
}

async function ganglieOnDamaged(ctx: EngineContext, player: GamePlayer, source: GamePlayer, rng: () => number): Promise<void> {
  if (!source.alive) return;
  const judgeCard = await judge(ctx, player, "ganglie");
  if (!judgeCard) return;
  ctx.discardPile.push(judgeCard);
  ctx.log.push(`${player.id} phán Cương Liệt: ${SUIT_LABEL_VI[judgeCard.suit]} ${judgeCard.point}`);
  if (judgeCard.suit === Suit.Heart) return; // judge "good" (triggers the punishment) means NOT heart

  if (source.handcardNum >= 2 && (await ctx.askGanglieDiscard(source))) {
    const discarded: Card[] = [];
    for (let i = 0; i < 2; i++) {
      const idx = Math.floor(rng() * source.hand.length);
      discarded.push(source.hand.splice(idx, 1)[0]);
    }
    ctx.discardPile.push(...discarded);
    ctx.log.push(`${source.id} bỏ 2 lá bài (ganglie)`);
  } else {
    await applyDamage(ctx, source, 1, player);
  }
}

async function tieqiOnSlashTargeted(ctx: EngineContext, attacker: GamePlayer, target: GamePlayer): Promise<boolean> {
  const judgeCard = await judge(ctx, attacker, "tieqi");
  if (!judgeCard) return false;
  ctx.discardPile.push(judgeCard);
  ctx.log.push(`${attacker.id} phán Thiết Kỵ: ${SUIT_LABEL_VI[judgeCard.suit]} ${judgeCard.point}`);
  if (!isRed(judgeCard)) return false;
  ctx.log.push(`${target.id} không thể né Sát này (tieqi)`);
  return true;
}

async function fankuiOnDamaged(ctx: EngineContext, player: GamePlayer, source: GamePlayer, rng: () => number): Promise<void> {
  if (!source.alive || source.hand.length === 0) return;
  const idx = Math.floor(rng() * source.hand.length);
  const [stolen] = source.hand.splice(idx, 1);
  player.hand.push(stolen);
  ctx.log.push(`${player.id} lấy 1 lá từ ${source.id} (fankui)`);
}

async function kurouSelfAction(ctx: EngineContext, player: GamePlayer, _rng: () => number): Promise<void> {
  await loseHp(ctx, player, 1);
  if (!player.alive) return; // died from the self-inflicted hp loss; card use never completes
  ctx.draw(player, 2);
  ctx.log.push(`${player.id} dùng Khổ Nhục: mất 1 máu, bốc 2 lá`);
}

async function kuangguOnDamageDealt(ctx: EngineContext, source: GamePlayer, target: GamePlayer, amount: number): Promise<void> {
  if (!source.alive || !source.isWounded()) return;
  if (effectiveDistance(ctx.alivePlayers, source, target) > 1) return;
  const healAmount = Math.min(amount, source.maxHp - source.hp);
  if (healAmount <= 0) return;
  await heal(ctx, source, healAmount);
  ctx.log.push(`${source.id} hồi ${healAmount} máu (kuanggu)`);
}

function jianxiongOnDamaged(ctx: EngineContext, player: GamePlayer): void {
  const card = ctx.discardPile.pop();
  if (!card) return;
  player.hand.push(card);
  ctx.log.push(`${player.id} nhận lá bài vừa bỏ (jianxiong)`);
}

async function jizhiOnTrickPlayed(ctx: EngineContext, player: GamePlayer): Promise<void> {
  ctx.draw(player, 1);
  ctx.log.push(`${player.id} bốc 1 lá (jizhi)`);
}

function liegongOnSlashTargeted(ctx: EngineContext, attacker: GamePlayer, target: GamePlayer): boolean {
  return target.handcardNum >= attacker.hp || target.handcardNum <= effectiveAttackRange(ctx.alivePlayers, attacker);
}

async function xiangleOnIncomingSlash(
  ctx: EngineContext,
  attacker: GamePlayer,
  defender: GamePlayer,
): Promise<{ nullify?: boolean } | void> {
  const basicIdx = attacker.hand.findIndex(
    (c) => c.kind === CardKind.Slash || c.kind === CardKind.Jink || c.kind === CardKind.Peach || c.kind === CardKind.Analeptic,
  );
  if (basicIdx !== -1 && (await ctx.askUseSelfAction(attacker, "xiangle"))) {
    const [paid] = attacker.hand.splice(basicIdx, 1);
    ctx.discardPile.push(paid);
    ctx.log.push(`${attacker.id} bỏ 1 lá cơ bản (xiangle)`);
    return;
  }
  return { nullify: true };
}

async function huoshouHijackAoeSource(ctx: EngineContext, menghuo: GamePlayer, actualUser: GamePlayer): Promise<GamePlayer | null> {
  if (menghuo === actualUser || !(await ctx.askUseSelfAction(menghuo, "huoshou"))) return null;
  return menghuo;
}

async function shushenOnRecover(ctx: EngineContext, player: GamePlayer, amount: number): Promise<void> {
  for (let i = 0; i < amount; i++) {
    const friends = alliesOf(player, ctx.alivePlayers);
    if (friends.length === 0 || !(await ctx.askUseSelfAction(player, "shushen"))) return;
    const to = await ctx.askChooseAnyPlayer(player, friends);
    if (!to) return;
    ctx.draw(to, 1);
    ctx.log.push(`${to.id} bốc 1 lá (shushen)`);
  }
}

const shenzhiAction = {
  phase: Phase.Start,
  async run(ctx: EngineContext, player: GamePlayer): Promise<void> {
    if (player.handcardNum === 0 || !(await ctx.askUseSelfAction(player, "shenzhi"))) return;
    const n = player.handcardNum;
    ctx.discardPile.push(...player.hand.splice(0));
    ctx.log.push(`${player.id} bỏ ${n} lá bài (shenzhi)`);
    if (n >= player.hp) {
      await heal(ctx, player, 1);
      ctx.log.push(`${player.id} hồi 1 máu (shenzhi)`);
    }
  },
};

const tuxiAction = {
  phase: Phase.Draw,
  async run(ctx: EngineContext, player: GamePlayer, rng: () => number): Promise<void> {
    const chosen: GamePlayer[] = [];
    for (let i = 0; i < 2; i++) {
      const candidates = ctx.alivePlayers.filter((p) => p !== player && p.handcardNum > 0 && !chosen.includes(p));
      if (candidates.length === 0 || !(await ctx.askUseSelfAction(player, "tuxi"))) break;
      const to = await ctx.askChooseAnyPlayer(player, candidates);
      if (!to) break;
      chosen.push(to);
      const idx = Math.floor(rng() * to.hand.length);
      const [stolen] = to.hand.splice(idx, 1);
      player.hand.push(stolen);
      ctx.log.push(`${player.id} lấy 1 lá từ ${to.id} (tuxi)`);
    }
  },
};

const luoyiAction = {
  phase: Phase.Draw,
  async run(ctx: EngineContext, player: GamePlayer): Promise<void> {
    if (!(await ctx.askUseSelfAction(player, "luoyi"))) return;
    player.luoyiArmedThisTurn = true;
    player.pendingBonusDamage += 1;
    ctx.log.push(`${player.id} bốc ít hơn 1 lá, sát thương tiếp theo +1 (luoyi)`);
  },
};

async function yijiOnDamaged(ctx: EngineContext, player: GamePlayer): Promise<void> {
  if (!(await ctx.askUseSelfAction(player, "yiji"))) return;
  for (let i = 0; i < 2; i++) {
    const card = ctx.drawTop();
    if (!card) break;
    const to = await ctx.askChooseAnyPlayer(player, ctx.alivePlayers);
    const recipient = to ?? player;
    recipient.hand.push(card);
    ctx.log.push(`${recipient.id} nhận 1 lá được lật (yiji)`);
  }
}

/** Tiandu (Guo Jia): may claim his own just-resolved judgment card into hand instead of it
 *  going to the discard pile -- reuses the generic `askUseSelfAction` ask, no new wiring. */
async function tianduClaim(ctx: EngineContext, judgeOwner: GamePlayer): Promise<boolean> {
  return ctx.askUseSelfAction(judgeOwner, "tiandu");
}

const qiangxiAction = {
  candidatesFor(alive: GamePlayer[], player: GamePlayer): GamePlayer[] {
    return alive.filter((p) => p !== player && effectiveDistance(alive, player, p) <= effectiveAttackRange(alive, player));
  },
  async run(ctx: EngineContext, player: GamePlayer, target: GamePlayer): Promise<void> {
    await loseHp(ctx, player, 1);
    if (!player.alive) return;
    ctx.log.push(`${player.id} dùng Cường Tập lên ${target.id}`);
    await applyDamage(ctx, target, 1, player); // bypasses the Jink check entirely
  },
};

async function jiemingOnDamaged(ctx: EngineContext, player: GamePlayer): Promise<void> {
  if (!(await ctx.askUseSelfAction(player, "jieming"))) return;
  const to = await ctx.askChooseAnyPlayer(player, ctx.alivePlayers);
  if (!to) return;
  const upper = Math.min(5, to.maxHp);
  const x = upper - to.handcardNum;
  if (x > 0) {
    ctx.draw(to, x);
    ctx.log.push(`${to.id} bốc ${x} lá (jieming)`);
  }
}

async function xiaoguoFinishReaction(ctx: EngineContext, yuejin: GamePlayer, finishingPlayer: GamePlayer, rng: () => number): Promise<void> {
  const basicIdx = yuejin.hand.findIndex(
    (c) => c.kind === CardKind.Slash || c.kind === CardKind.Jink || c.kind === CardKind.Peach || c.kind === CardKind.Analeptic,
  );
  if (basicIdx === -1 || !(await ctx.askUseSelfAction(yuejin, "xiaoguo"))) return;
  const [paid] = yuejin.hand.splice(basicIdx, 1);
  ctx.discardPile.push(paid);
  ctx.log.push(`${yuejin.id} bỏ 1 lá cơ bản (xiaoguo)`);

  const equipped = finishingPlayer.weapon || finishingPlayer.defenseHorse || finishingPlayer.offenseHorse;
  if (equipped && (await ctx.askUseSelfAction(finishingPlayer, "xiaoguo-defend"))) {
    const slot: "weapon" | "defenseHorse" | "offenseHorse" = finishingPlayer.weapon
      ? "weapon"
      : finishingPlayer.defenseHorse
        ? "defenseHorse"
        : "offenseHorse";
    ctx.discardPile.push(finishingPlayer[slot]!);
    finishingPlayer[slot] = null;
    ctx.log.push(`${finishingPlayer.id} bỏ 1 lá trang bị (xiaoguo)`);
  } else {
    await applyDamage(ctx, finishingPlayer, 1, yuejin);
  }
  void rng;
}

async function liuliOnIncomingSlash(
  ctx: EngineContext,
  attacker: GamePlayer,
  defender: GamePlayer,
): Promise<{ redirectTo?: GamePlayer } | void> {
  if (defender.handcardNum === 0) return;
  const candidates = ctx.alivePlayers.filter(
    (p) => p !== defender && p !== attacker && effectiveDistance(ctx.alivePlayers, defender, p) <= effectiveAttackRange(ctx.alivePlayers, defender),
  );
  if (candidates.length === 0 || !(await ctx.askUseSelfAction(defender, "liuli"))) return;
  const to = await ctx.askChooseAnyPlayer(defender, candidates);
  if (!to) return;
  const idx = Math.floor(Math.random() * defender.hand.length);
  const [paid] = defender.hand.splice(idx, 1);
  ctx.discardPile.push(paid);
  ctx.log.push(`${defender.id} bỏ 1 lá bài (liuli)`);
  return { redirectTo: to };
}

async function xiaojiOnEquipLost(ctx: EngineContext, player: GamePlayer): Promise<void> {
  ctx.draw(player, 2);
  ctx.log.push(`${player.id} bốc 2 lá (xiaoji)`);
}

const yinghunAction = {
  phase: Phase.Start,
  async run(ctx: EngineContext, player: GamePlayer, rng: () => number): Promise<void> {
    if (!player.isWounded()) return;
    const candidates = ctx.alivePlayers.filter((p) => p !== player);
    if (candidates.length === 0 || !(await ctx.askUseSelfAction(player, "yinghun"))) return;
    const to = await ctx.askChooseAnyPlayer(player, candidates);
    if (!to) return;
    const x = player.maxHp - player.hp;
    ctx.draw(to, x === 1 ? 1 : x);
    await discardRandom(ctx, to, rng);
    ctx.log.push(`${to.id} bốc rồi bỏ bài (yinghun)`);
  },
};

async function haoshiAfterDrawPhase(ctx: EngineContext, lusu: GamePlayer): Promise<void> {
  if (lusu.handcardNum <= 5) return;
  const others = ctx.alivePlayers.filter((p) => p !== lusu);
  if (others.length === 0) return;
  const least = others.reduce((min, p) => Math.min(min, p.handcardNum), Infinity);
  const beggar = others.find((p) => p.handcardNum === least)!;
  const n = Math.floor(lusu.handcardNum / 2);
  const given = lusu.hand.splice(0, n);
  beggar.hand.push(...given);
  ctx.log.push(`${lusu.id} cho ${beggar.id} ${n} lá bài (haoshi)`);
}

async function guzhengOnOtherPlayerOverDiscard(
  ctx: EngineContext,
  erzhang: GamePlayer,
  discardingPlayer: GamePlayer,
  discardedCards: Card[],
  rng: () => number,
): Promise<void> {
  if (discardedCards.length === 0 || !(await ctx.askUseSelfAction(erzhang, "guzheng"))) return;
  const idx = Math.floor(rng() * discardedCards.length);
  const card = discardedCards[idx];
  const pileIdx = ctx.discardPile.indexOf(card);
  if (pileIdx === -1) return;
  ctx.discardPile.splice(pileIdx, 1);
  erzhang.hand.push(card);
  ctx.log.push(`${erzhang.id} lấy lá bài vừa bỏ của ${discardingPlayer.id} (guzheng)`);
}

const qingnangAction = {
  candidatesFor(alive: GamePlayer[]): GamePlayer[] {
    return alive.filter((p) => p.isWounded());
  },
  async run(ctx: EngineContext, player: GamePlayer, target: GamePlayer, rng: () => number): Promise<void> {
    if (player.handcardNum === 0) return;
    await discardRandom(ctx, player, rng);
    await heal(ctx, target, 1);
    ctx.log.push(`${target.id} hồi 1 máu (qingnang)`);
  },
};

const biyueAction = {
  phase: Phase.Finish,
  async run(ctx: EngineContext, player: GamePlayer): Promise<void> {
    if (!(await ctx.askUseSelfAction(player, "biyue"))) return;
    ctx.draw(player, 1);
    ctx.log.push(`${player.id} bốc 1 lá (biyue)`);
  },
};

const shuangxiongAction = {
  phase: Phase.Draw,
  async run(ctx: EngineContext, player: GamePlayer): Promise<void> {
    if (!(await ctx.askUseSelfAction(player, "shuangxiong"))) return;
    const judgeCard = await judge(ctx, player, "shuangxiong");
    if (!judgeCard) return;
    player.hand.push(judgeCard);
    player.duelViewAsBlackAllowed = isRed(judgeCard);
    ctx.log.push(`${player.id} phán Song Hùng: ${SUIT_LABEL_VI[judgeCard.suit]} ${judgeCard.point}, nhận vào tay`);
  },
};

/** Guanxing (Zhuge Liang): automatic (no real cost to declining, same precedent as Kongcheng/
 *  Tieqi/Yingzi above) -- peeks the top X cards of the draw pile (X = number of alive players,
 *  capped at 5) and asks which go to the bottom of the pile; everything else stays on top in
 *  its original relative order. This is a deliberate simplification of the real skill's
 *  free-form "arrange these cards in any order onto the top or bottom of the pile" down to a
 *  top/bottom split -- a full drag-and-drop reorder UI is out of scope (this was exactly
 *  Milestone 2.6's original reason for not porting Guanxing at all; see EngineContext's
 *  peekTop/arrangeTop/askGuanxingBottom doc comments for the mechanics). */
const guanxingAction = {
  phase: Phase.Start,
  async run(ctx: EngineContext, player: GamePlayer): Promise<void> {
    const n = Math.min(ctx.alivePlayers.length, 5);
    const revealed = ctx.peekTop(n);
    if (revealed.length === 0) return;
    const bottomIds = await ctx.askGuanxingBottom(player, revealed);
    const bottom = revealed.filter((c) => bottomIds.has(c.id));
    const top = revealed.filter((c) => !bottomIds.has(c.id));
    ctx.arrangeTop(top, bottom);
    ctx.log.push(`${player.id} Quan Tinh: xem ${revealed.length} lá đầu bộ bài, đặt ${bottom.length} lá xuống đáy`);
  },
};

async function mengjinOnSlashDodged(ctx: EngineContext, attacker: GamePlayer, target: GamePlayer): Promise<void> {
  if (!(await discardRandom(ctx, target, ctx.rng))) return;
  ctx.log.push(`${target.id} bỏ 1 lá bài (mengjin)`);
  void attacker;
}

async function leijiOnSlashDodged(ctx: EngineContext, _attacker: GamePlayer, zhangjiao: GamePlayer): Promise<void> {
  if (!(await ctx.askUseSelfAction(zhangjiao, "leiji"))) return;
  const to = await ctx.askChooseAnyPlayer(zhangjiao, ctx.alivePlayers);
  if (!to) return;
  const judgeCard = await judge(ctx, zhangjiao, "leiji");
  if (!judgeCard) return;
  ctx.discardPile.push(judgeCard);
  ctx.log.push(`${zhangjiao.id} phán Lôi Kích: ${SUIT_LABEL_VI[judgeCard.suit]} ${judgeCard.point}`);
  if (judgeCard.suit === Suit.Spade) await applyDamage(ctx, to, 2, zhangjiao);
}

async function beigeOnDamaged(ctx: EngineContext, player: GamePlayer, source: GamePlayer, rng: () => number): Promise<void> {
  if (player.handcardNum === 0 || !(await ctx.askUseSelfAction(player, "beige"))) return;
  await discardRandom(ctx, player, rng);
  const judgeCard = await judge(ctx, player, "beige");
  if (!judgeCard) return;
  ctx.discardPile.push(judgeCard);
  ctx.log.push(`${player.id} phán Bi Ca: ${SUIT_LABEL_VI[judgeCard.suit]} ${judgeCard.point}`);
  switch (judgeCard.suit) {
    case Suit.Heart:
      await heal(ctx, player, 1);
      ctx.log.push(`${player.id} hồi 1 máu (beige)`);
      break;
    case Suit.Diamond:
      ctx.draw(player, 2);
      ctx.log.push(`${player.id} bốc 2 lá (beige)`);
      break;
    case Suit.Club:
      if (source.alive) {
        for (let i = 0; i < 2; i++) await discardRandom(ctx, source, rng);
        ctx.log.push(`${source.id} bỏ 2 lá bài (beige)`);
      }
      break;
    case Suit.Spade:
      break; // real rule turns the source face-down; face-up/down state isn't modeled
  }
}

function mingshiReduceDamage(ctx: EngineContext, target: GamePlayer, _source: GamePlayer, amount: number): number {
  if (amount > 0) ctx.log.push(`${target.id} giảm 1 sát thương (mingshi)`);
  return amount - 1;
}

async function sijianOnHandEmptied(ctx: EngineContext, player: GamePlayer, rng: () => number): Promise<void> {
  const candidates = ctx.alivePlayers.filter((p) => p !== player && p.handcardNum > 0);
  if (candidates.length === 0 || !(await ctx.askUseSelfAction(player, "sijian"))) return;
  const to = await ctx.askChooseAnyPlayer(player, candidates);
  if (!to) return;
  if (await discardRandom(ctx, to, rng)) ctx.log.push(`${to.id} bỏ 1 lá bài (sijian)`);
}

async function suishiOnAllyDying(ctx: EngineContext, self: GamePlayer, dyingAlly: GamePlayer): Promise<void> {
  if (!isAlly(self, dyingAlly)) return;
  ctx.draw(self, 1);
  ctx.log.push(`${self.id} bốc 1 lá (suishi)`);
}

async function suishiOnAllyDeath(ctx: EngineContext, self: GamePlayer, deadAlly: GamePlayer): Promise<void> {
  if (!isAlly(self, deadAlly)) return;
  await loseHp(ctx, self, 1);
}
// Post-Milestone-2.6 batch 2: 12 more generals (14 skills) ported, closing most of the
// "sibling skill deferred" gaps the first 44-general pass left behind. Recovered the real
// Vietnamese skill text from this repo's own git history (lang/vi_VN/Package/Standard*General.lua
// was tracked before a later "strip legacy desktop client" commit deleted it from the working
// tree) instead of guessing from generic domain knowledge -- this caught 2 prior comments that
// were flat wrong (Cao Cao's Standard kit has no 2nd skill in this repo's actual localization,
// "Hujia" doesn't exist here; Huang Zhong's "LiegongRange" is Hegemony-lord-only, not a 2nd
// Role-mode skill either -- neither is a real gap) and 1 that was overly pessimistic (Duoshi
// turned out to be an ordinary immediate AOE trick, not delayed-trick-dependent -- see
// `duoshiSelfAction` below). Still blocked, genuinely: Guojia's Tiandu (needs Guo Jia to ever
// own a delayed-trick judgment, which needs the delayed-trick/judge-area subsystem this repo
// explicitly excludes -- see card.ts's header), Da Qiao's Guose (needs the Indulgence delayed-
// trick card, same reason), and Cai Wenji's Duanchang (needs the dual-general head/deputy
// mechanic, explicitly out of scope for Role mode -- see this file's header).

/** Luoshen (Zhen Ji): automatic activation ask (same "no real cost to declining" precedent as
 *  Guanxing/Kongcheng/Tieqi), then judges repeatedly for as long as the result is black AND
 *  she chooses to continue; all black judgment cards collected end up in her hand, the first
 *  non-black one that ends the loop is discarded. */
async function luoshenOtherPhaseAction(ctx: EngineContext, player: GamePlayer): Promise<void> {
  if (!(await ctx.askUseSelfAction(player, "luoshen"))) return;
  const collected: Card[] = [];
  for (;;) {
    const judgeCard = await judge(ctx, player, "luoshen");
    if (!judgeCard) break;
    if (!isBlack(judgeCard)) {
      ctx.discardPile.push(judgeCard);
      break;
    }
    collected.push(judgeCard);
    if (!(await ctx.askUseSelfAction(player, "luoshen"))) break;
  }
  if (collected.length > 0) {
    player.hand.push(...collected);
    ctx.log.push(`${player.id} thu lấy ${collected.length} lá phán xét màu Đen (luoshen)`);
  }
}

/** Fires `player`'s own `onEquipLost` skills (e.g. Sunshangxiang's Xiaoji) `times` times in a
 *  row -- used where several equip slots are lost in one go (e.g. Fanjian discarding multiple
 *  matching-suit equips at once), matching `equip()`'s per-card trigger elsewhere. */
async function notifyEquipLost(ctx: EngineContext, player: GamePlayer, times: number): Promise<void> {
  for (let n = 0; n < times; n++) {
    for (const skill of player.skills) await skill.onEquipLost?.(ctx, player);
  }
}

/** Fanjian (Zhou Yu): reveals+gives 1 hand card to a chosen target; the target then chooses
 *  between discarding every hand/equipped card matching that card's suit (the revealed card
 *  itself just joined their hand, so they always have >=1 card to check -- the real "if they
 *  have hand cards" gate is therefore always satisfied) or losing 1 hp. No suit-guessing is
 *  involved (the card is revealed openly) -- a prior comment guessing this needed "a
 *  suit-guessing UI ask" was wrong; see this file's header. */
async function fanjianSelfAction(ctx: EngineContext, player: GamePlayer): Promise<void> {
  if (player.hand.length === 0) return;
  const candidates = ctx.alivePlayers.filter((p) => p !== player);
  if (candidates.length === 0 || !(await ctx.askUseSelfAction(player, "fanjian"))) return;
  const target = await ctx.askChooseAnyPlayer(player, candidates);
  if (!target) return;
  const revealed = await ctx.askPickCard(player, player.hand);
  player.hand.splice(player.hand.indexOf(revealed), 1);
  target.hand.push(revealed);
  ctx.log.push(`${player.id} lật 1 lá (${SUIT_LABEL_VI[revealed.suit]} ${revealed.point}) và giao cho ${target.id} (fanjian)`);
  const matchesSuit = (c: Card) => c.suit === revealed.suit;
  if (await ctx.askUseSelfAction(target, "fanjian-reveal")) {
    const handMatches = target.hand.filter(matchesSuit);
    for (const c of handMatches) target.hand.splice(target.hand.indexOf(c), 1);
    const equipMatches = [target.weapon, target.defenseHorse, target.offenseHorse].filter((c): c is Card => c !== null && matchesSuit(c));
    if (target.weapon && matchesSuit(target.weapon)) target.weapon = null;
    if (target.defenseHorse && matchesSuit(target.defenseHorse)) target.defenseHorse = null;
    if (target.offenseHorse && matchesSuit(target.offenseHorse)) target.offenseHorse = null;
    ctx.discardPile.push(...handMatches, ...equipMatches);
    await notifyEquipLost(ctx, target, equipMatches.length);
    ctx.log.push(`${target.id} mở bài, bỏ ${handMatches.length + equipMatches.length} lá cùng chất ${SUIT_LABEL_VI[revealed.suit]} (fanjian)`);
  } else {
    await loseHp(ctx, target, 1);
    ctx.log.push(`${target.id} mất 1 máu (fanjian)`);
  }
}

/** Shared pindian ("đấu điểm", card-point duel) for Lieren/Quhu: `initiator` and `opponent`
 *  each reveal 1 card from their own hand -- reusing `askPickCard` (the same generalized "pick
 *  exactly 1 from a candidate list" shape Amazing Grace's picker already has, here given the
 *  player's own hand as the candidate list) rather than adding a dedicated new ask. Higher
 *  point value wins; a tie favors `opponent` (the real rule: the side that INITIATED the
 *  pindian loses ties). Both revealed cards go to the discard pile regardless of outcome. A
 *  card-less `opponent` auto-loses (counted as 0 -- real Sanguosha rule for "nothing to
 *  reveal"); callers already guarantee `initiator.hand.length > 0`. */
async function pindian(ctx: EngineContext, initiator: GamePlayer, opponent: GamePlayer, reason: string): Promise<boolean> {
  const myCard = await ctx.askPickCard(initiator, initiator.hand);
  initiator.hand.splice(initiator.hand.indexOf(myCard), 1);
  ctx.discardPile.push(myCard);
  let oppCard: Card | null = null;
  if (opponent.hand.length > 0) {
    oppCard = await ctx.askPickCard(opponent, opponent.hand);
    opponent.hand.splice(opponent.hand.indexOf(oppCard), 1);
    ctx.discardPile.push(oppCard);
  }
  const won = !oppCard || myCard.point > oppCard.point;
  const oppLabel = oppCard ? `${oppCard.point}` : "(không có bài)";
  ctx.log.push(`${initiator.id} đấu điểm với ${opponent.id}: ${myCard.point} vs ${oppLabel} (${reason}) -- ${won ? initiator.id : opponent.id} thắng`);
  return won;
}

/** Lieren (Zhurong): after dealing Slash damage, may pindian with the target; on a win, takes
 *  1 of the target's cards (hand or equipped) into her own hand. */
async function lierenOnSlashDamageDealt(ctx: EngineContext, source: GamePlayer, target: GamePlayer): Promise<void> {
  if (source.hand.length === 0 || !target.alive) return;
  if (!(await ctx.askUseSelfAction(source, "lieren"))) return;
  if (!(await pindian(ctx, source, target, "lieren"))) return;
  const candidates = [target.weapon, target.defenseHorse, target.offenseHorse, ...target.hand].filter((c): c is Card => c !== null);
  if (candidates.length === 0) return;
  const taken = await ctx.askPickPlayerCard(source, target, candidates);
  await detachCardFrom(ctx, target, taken);
  source.hand.push(taken);
  ctx.log.push(`${source.id} thu lấy 1 lá của ${target.id} (lieren)`);
}

/** Quhu (Xun Yu): once per Play phase, may pindian with a player who has more hp than him. On
 *  a win, that player deals 1 damage to a player Xun Yu designates within their own attack
 *  range; on a loss, that player deals 1 damage to Xun Yu instead. */
async function quhuSelfAction(ctx: EngineContext, player: GamePlayer): Promise<void> {
  if (player.hand.length === 0) return;
  const candidates = ctx.alivePlayers.filter((p) => p !== player && p.hp > player.hp);
  if (candidates.length === 0 || !(await ctx.askUseSelfAction(player, "quhu"))) return;
  const target = await ctx.askChooseAnyPlayer(player, candidates);
  if (!target) return;
  if (await pindian(ctx, player, target, "quhu")) {
    const designated = ctx.alivePlayers.filter(
      (p) => p !== target && effectiveDistance(ctx.alivePlayers, target, p) <= effectiveAttackRange(ctx.alivePlayers, target),
    );
    if (designated.length === 0) return;
    const victim = await ctx.askChooseAnyPlayer(player, designated);
    if (!victim) return;
    ctx.log.push(`${target.id} gây 1 sát thương cho ${victim.id} (quhu)`);
    await applyDamage(ctx, victim, 1, target);
  } else {
    ctx.log.push(`${target.id} gây 1 sát thương cho ${player.id} (quhu)`);
    await applyDamage(ctx, player, 1, target);
  }
}

/** Jieyin (Sun Shangxiang): once per Play phase, discard 2 hand cards and pick a wounded male
 *  player -- both of them recover 1 hp. */
async function jieyinSelfAction(ctx: EngineContext, player: GamePlayer): Promise<void> {
  if (player.hand.length < 2) return;
  const candidates = ctx.alivePlayers.filter((p) => p !== player && p.gender === "male" && p.isWounded());
  if (candidates.length === 0 || !(await ctx.askUseSelfAction(player, "jieyin"))) return;
  const target = await ctx.askChooseAnyPlayer(player, candidates);
  if (!target) return;
  const paid = await ctx.askChooseDiscards(player, 2);
  for (const c of paid) player.hand.splice(player.hand.indexOf(c), 1);
  for (const c of paid) await routeDiscard(ctx, player, c);
  await heal(ctx, player, 1);
  await heal(ctx, target, 1);
  ctx.log.push(`${player.id} và ${target.id} hồi 1 máu (jieyin)`);
}

/** Dimeng (Lu Su): once per Play phase, pick 2 other players, discard up to X of Lu Su's own
 *  cards (X = the hand-count difference between the 2 chosen), then swap their hands. */
async function dimengSelfAction(ctx: EngineContext, player: GamePlayer): Promise<void> {
  const candidates = ctx.alivePlayers.filter((p) => p !== player);
  if (candidates.length < 2 || !(await ctx.askUseSelfAction(player, "dimeng"))) return;
  const p1 = await ctx.askChooseAnyPlayer(player, candidates);
  if (!p1) return;
  const p2 = await ctx.askChooseAnyPlayer(player, candidates.filter((p) => p !== p1));
  if (!p2) return;
  const x = Math.min(Math.abs(p1.handcardNum - p2.handcardNum), player.hand.length);
  if (x > 0) {
    const paid = await ctx.askChooseDiscards(player, x);
    for (const c of paid) player.hand.splice(player.hand.indexOf(c), 1);
    for (const c of paid) await routeDiscard(ctx, player, c);
  }
  const tmp = p1.hand;
  p1.hand = p2.hand;
  p2.hand = tmp;
  ctx.log.push(`${p1.id} và ${p2.id} hoán đổi bài trên tay (dimeng)`);
}

/** Zhijian (Erzhang): places a held equip card into another player's matching equip slot
 *  (replacing whatever was there), then draws 1. */
async function zhijianSelfAction(ctx: EngineContext, player: GamePlayer): Promise<void> {
  const equipCards = player.hand.filter((c) => c.kind === CardKind.Weapon || c.kind === CardKind.Horse);
  if (equipCards.length === 0 || !(await ctx.askUseSelfAction(player, "zhijian"))) return;
  const card = await ctx.askPickCard(player, equipCards);
  const candidates = ctx.alivePlayers.filter((p) => p !== player);
  if (candidates.length === 0) return;
  const target = await ctx.askChooseAnyPlayer(player, candidates);
  if (!target) return;
  player.hand.splice(player.hand.indexOf(card), 1);
  await ctx.equipPlayer(target, card);
  ctx.draw(player, 1);
  ctx.log.push(`${player.id} đặt 1 lá trang bị vào vùng của ${target.id}, bốc 1 lá (zhijian)`);
}

/** Lijian (Diao Chan): once per Play phase, discard 1 card and pick 2 other male players --
 *  the second-chosen is treated as using Duel against the first-chosen. */
async function lijianSelfAction(ctx: EngineContext, player: GamePlayer): Promise<void> {
  if (player.hand.length === 0) return;
  const candidates = ctx.alivePlayers.filter((p) => p !== player && p.gender === "male");
  if (candidates.length < 2 || !(await ctx.askUseSelfAction(player, "lijian"))) return;
  const first = await ctx.askChooseAnyPlayer(player, candidates);
  if (!first) return;
  const second = await ctx.askChooseAnyPlayer(player, candidates.filter((p) => p !== first));
  if (!second) return;
  const paid = await ctx.askPickCard(player, player.hand);
  player.hand.splice(player.hand.indexOf(paid), 1);
  ctx.discardPile.push(paid);
  ctx.log.push(`${player.id} dùng Ly Gián: ${second.id} xem như dùng Quyết Đấu với ${first.id} (lijian)`);
  await resolveDuel(ctx, second, first);
}

/** Luanwu (Jia Xu): once per GAME (hạn định kỹ), during a Play phase: every other player
 *  chooses to play a held Slash-like card at whoever is nearest to them (ties asked), or lose
 *  1 hp if they decline/can't. Reuses `askUseSelfAction` with a synthetic per-player prompt
 *  name (same precedent as Xiaoguo's "xiaoguo-defend" ask on the non-owning finishing player). */
async function luanwuSelfAction(ctx: EngineContext, self: GamePlayer): Promise<void> {
  if (self.usedLimitSkills.has("luanwu") || !(await ctx.askUseSelfAction(self, "luanwu"))) return;
  self.usedLimitSkills.add("luanwu");
  ctx.log.push(`${self.id} phát động Loạn Vũ (luanwu)`);
  for (const p of ctx.alivePlayers.filter((x) => x !== self)) {
    if (!p.alive) continue;
    const others = ctx.alivePlayers.filter((o) => o !== p);
    if (others.length === 0) continue;
    const minDist = Math.min(...others.map((o) => effectiveDistance(ctx.alivePlayers, p, o)));
    const nearest = others.filter((o) => effectiveDistance(ctx.alivePlayers, p, o) === minDist);
    const slash = findSlashLikeCard(p, ctx.aoChienActive);
    if (slash && (await ctx.askUseSelfAction(p, "luanwu-slash"))) {
      const target = nearest.length === 1 ? nearest[0] : ((await ctx.askChooseAnyPlayer(p, nearest)) ?? nearest[0]);
      p.hand.splice(p.hand.indexOf(slash), 1);
      if (slash.kind !== CardKind.Slash) ctx.log.push(`${p.id} biến 1 lá bài thành Sát (kỹ năng biến hóa)`);
      await resolveSlash(ctx, p, target, slash);
    } else {
      await loseHp(ctx, p, 1);
    }
  }
}

/** Xiongyi's "which side" key: Lord+Loyalist share one side, Rebels share another, each
 *  Renegade is their own side of 1 -- same grouping `gamerule.ts`'s `isAlly` uses. */
function xiongyiSideKey(p: GamePlayer): string {
  if (p.role === Role.Renegade) return `renegade-${p.id}`;
  if (p.role === Role.Rebel) return "rebel";
  return "lord";
}

/** Xiongyi (Ma Teng): once per GAME, during a Play phase: every ally (and Ma Teng himself)
 *  draws 3; if his side currently has the fewest alive members (tied for fewest counts), he
 *  also recovers 1 hp. */
async function xiongyiSelfAction(ctx: EngineContext, self: GamePlayer): Promise<void> {
  if (self.usedLimitSkills.has("xiongyi") || !(await ctx.askUseSelfAction(self, "xiongyi"))) return;
  self.usedLimitSkills.add("xiongyi");
  const allies = alliesOf(self, ctx.alivePlayers);
  for (const p of [self, ...allies]) ctx.draw(p, 3);
  ctx.log.push(`${self.id} phát động Hùng Dị: đồng minh bốc 3 lá (xiongyi)`);
  const counts = new Map<string, number>();
  for (const p of ctx.alivePlayers) counts.set(xiongyiSideKey(p), (counts.get(xiongyiSideKey(p)) ?? 0) + 1);
  const minCount = Math.min(...counts.values());
  if (counts.get(xiongyiSideKey(self)) === minCount) {
    await heal(ctx, self, 1);
    ctx.log.push(`${self.id} hồi 1 máu (xiongyi)`);
  }
}

/** Guidao (Zhang Jiao): whenever ANY judgment resolves (reusing the same `onJudgment` retrial
 *  hook Guicai introduced -- the real rule applies retrials to every judgment uniformly, not
 *  just this one's owner), may discard 1 black hand card to replace the result. */
async function guidaoOnJudgment(ctx: EngineContext, self: GamePlayer): Promise<Card | null> {
  const blackCards = self.hand.filter(isBlack);
  if (blackCards.length === 0 || !(await ctx.askUseSelfAction(self, "guidao"))) return null;
  return ctx.askPickCard(self, blackCards);
}

/** Lirang (Kong Rong): `redirectsOwnDiscard` -- may give an about-to-be-discarded card of his
 *  own straight to another player instead. See `Skill.redirectsOwnDiscard`'s doc comment for
 *  exactly which discard sites this is wired into. */
async function lirangRedirect(ctx: EngineContext, self: GamePlayer): Promise<GamePlayer | null> {
  const candidates = ctx.alivePlayers.filter((p) => p !== self);
  if (candidates.length === 0 || !(await ctx.askUseSelfAction(self, "lirang"))) return null;
  return ctx.askChooseAnyPlayer(self, candidates);
}

/** Duoshi (Lu Xun): up to 4 times per Play phase, converts a red hand card into playing
 *  [Await Exhausted] (Dĩ Dật Đãi Lao) -- confirmed a genuine immediate AOE trick (targets Lu
 *  Xun and all allies, each draws 2 then discards 2), NOT a delayed trick, despite card.ts's
 *  header lumping "AwaitExhausted" into its combined "needs delayed-trick/judge-area OR a
 *  reactive counter-play stack" exclusion blurb for a batch of 11 different trick kinds -- see
 *  this file's header for how that was confirmed. Implemented directly here (self+allies
 *  draw-then-discard) rather than adding a whole new `CardKind`/`trick.ts` resolver +
 *  `canViewAs*` hook for a card no other general ever draws for real. */
async function duoshiSelfAction(ctx: EngineContext, player: GamePlayer): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const redCards = player.hand.filter(isRed);
    if (redCards.length === 0 || !(await ctx.askUseSelfAction(player, "duoshi"))) break;
    const paid = await ctx.askPickCard(player, redCards);
    player.hand.splice(player.hand.indexOf(paid), 1);
    ctx.discardPile.push(paid);
    const targets = [player, ...alliesOf(player, ctx.alivePlayers)];
    for (const t of targets) ctx.draw(t, 2);
    for (const t of targets) {
      const n = Math.min(2, t.hand.length);
      if (n === 0) continue;
      const chosen = await ctx.askChooseDiscards(t, n);
      for (const c of chosen) t.hand.splice(t.hand.indexOf(c), 1);
      for (const c of chosen) await routeDiscard(ctx, t, c);
    }
    ctx.log.push(`${player.id} chuyển hóa 1 lá Đỏ thành Dĩ Dật Đãi Lao: ${targets.map((t) => t.id).join(", ")} bốc 2 rồi bỏ 2 lá (duoshi)`);
  }
}

/** Fangquan (Liu Shan) part 2: at Finish phase, may discard 1 card to give any player
 *  (including himself) an immediate extra turn, inserted before the normal seat rotation
 *  continues -- see room.ts's `extraTurnQueue`. Part 1 (may skip his own Play phase) is the
 *  trivial `canSkipPlayPhase: () => true` in this skill's registration below. */
async function fangquanGrantsExtraTurn(ctx: EngineContext, player: GamePlayer): Promise<GamePlayer | null> {
  if (player.hand.length === 0 || !(await ctx.askUseSelfAction(player, "fangquan-extra-turn"))) return null;
  const target = await ctx.askChooseAnyPlayer(player, ctx.alivePlayers);
  if (!target) return null;
  const paid = await ctx.askPickCard(player, player.hand);
  player.hand.splice(player.hand.indexOf(paid), 1);
  ctx.discardPile.push(paid);
  ctx.log.push(`${player.id} bỏ 1 lá bài, ${target.id} có thêm 1 lượt (fangquan)`);
  return target;
}

/** Rende (Liu Bei): once per Play phase, give any number (>=1) of freely-chosen hand cards to a
 *  chosen other player; if 3+ were given AND Liu Bei is currently wounded, he recovers 1 hp.
 *  Verified exactly against the real upstream source (`RendeCard::use` in
 *  `standard-shu-generals.cpp`, not just the localized flavor text, which is ambiguous/
 *  outdated on this point): `source->getMark("rende") += subcards.length(); if (old < 3 &&
 *  new >= 3 && isWounded()) recover(1)` -- a per-TURN cumulative threshold across possibly
 *  MULTIPLE Rende uses (different target each time), not "2+ in one use -> draw a card" as a
 *  shallower read of the Vietnamese text might suggest. Collapsed to a single invocation per
 *  Play phase (same "once per Play phase" simplification this port already applies to every
 *  other proactive `selfAction` -- Kurou, Dimeng, Lijian, Jieyin, etc.), so the threshold is
 *  just "this one invocation gave away 3+ cards" -- equivalent to the real cumulative rule for
 *  the overwhelmingly common single-target case, at the cost of the rarer split-across-targets
 *  case no longer being able to accumulate toward the threshold. */
async function rendeSelfAction(ctx: EngineContext, player: GamePlayer): Promise<void> {
  if (player.handcardNum === 0 || !(await ctx.askUseSelfAction(player, "rende"))) return;
  const candidates = ctx.alivePlayers.filter((p) => p !== player);
  if (candidates.length === 0) return;
  const to = await ctx.askChooseAnyPlayer(player, candidates);
  if (!to) return;
  const given = await ctx.askAnyHandCards(player, 1, player.handcardNum);
  if (given.length === 0) return;
  for (const c of given) player.hand.splice(player.hand.indexOf(c), 1);
  to.hand.push(...given);
  ctx.log.push(`${player.id} giao ${given.length} lá bài cho ${to.id} (rende)`);
  if (given.length >= 3 && player.isWounded()) {
    await heal(ctx, player, 1);
    ctx.log.push(`${player.id} hồi 1 máu (rende: giao từ 3 lá trở lên)`);
  }
}

/** Niepan (Pang Tong): once per GAME, while dying (hp<=0), may discard everything (hand +
 *  equip + judge area), recover to min(3, maxHp), and draw 3 -- an alternative to a Peach-family
 *  self-rescue, consulted by `resolveDying` (combat.ts) via the `cheatsDeath` hook. Real rule
 *  also clears "chained" status and forces face-up if face-down; neither chains nor a per-turn
 *  face state exist in this engine's scope (Hegemony's own reveal-timing is a DIFFERENT
 *  mechanic, see gamerule.ts's header) -- not modeled, same "faithful behavior, simplified
 *  interaction" precedent as every other skill here that drops a clause this engine has no
 *  concept for. */
async function niepanCheatsDeath(ctx: EngineContext, player: GamePlayer): Promise<boolean> {
  if (player.usedLimitSkills.has("niepan") || !(await ctx.askUseSelfAction(player, "niepan"))) return false;
  player.usedLimitSkills.add("niepan");
  ctx.discardPile.push(...player.hand.splice(0));
  const equipsLost = [player.weapon, player.defenseHorse, player.offenseHorse].filter((c): c is Card => c !== null);
  player.weapon = null;
  player.defenseHorse = null;
  player.offenseHorse = null;
  ctx.discardPile.push(...equipsLost, ...player.judgeArea.splice(0));
  ctx.log.push(`${player.id} phát động Niết Bàn: bỏ hết bài trên tay/trang bị/phán quyết`);
  await heal(ctx, player, Math.min(3, player.maxHp) - player.hp);
  ctx.draw(player, 3);
  ctx.log.push(`${player.id} hồi lên ${player.hp}/${player.maxHp} máu, rút 3 lá (niepan)`);
  for (let i = 0; i < equipsLost.length; i++) {
    for (const skill of player.skills) await skill.onEquipLost?.(ctx, player);
  }
  return true;
}

/** Zhiheng (Sun Quan): once per Play phase, discard up to maxHp freely-chosen hand cards, then
 *  draw that many back -- real upstream's "may also include your Treasure equip once you've
 *  discarded maxHp hand cards" clause needs a Treasure equip slot this engine doesn't have
 *  (only Weapon/Horse are modeled, see card.ts's header); not ported, hand-only. */
async function zhihengSelfAction(ctx: EngineContext, player: GamePlayer): Promise<void> {
  if (player.handcardNum === 0 || !(await ctx.askUseSelfAction(player, "zhiheng"))) return;
  const discarded = await ctx.askAnyHandCards(player, 1, Math.min(player.handcardNum, player.maxHp));
  if (discarded.length === 0) return;
  for (const c of discarded) player.hand.splice(player.hand.indexOf(c), 1);
  ctx.discardPile.push(...discarded);
  ctx.draw(player, discarded.length);
  ctx.log.push(`${player.id} bỏ ${discarded.length} lá rồi rút lại ${discarded.length} lá (zhiheng)`);
}

/** Hongyan (Xiao Qiao): once, self-only -- her own judgment card, if a Spade, may be
 *  reinterpreted as a Heart (mutating the freshly-drawn `Card` object in place, safe since it's
 *  never shared -- see `filtersOwnJudgment`'s own doc comment). Automatic-ask simplification:
 *  a real choice via `askUseSelfAction`, same as every other skill here with a genuine but
 *  situational cost-free decision. Real upstream also gates on "not already shown this skill
 *  this game" (`hasShownSkill`) -- this port has no reveal-state concept for Identity-mode
 *  generals to gate on (that's Hegemony-only, see gamerule.ts's header), so it's simply
 *  available every time her own judgment resolves. */
async function hongyanFiltersOwnJudgment(ctx: EngineContext, self: GamePlayer, currentCard: Card): Promise<void> {
  if (currentCard.suit !== Suit.Spade) return;
  if (!(await ctx.askUseSelfAction(self, "hongyan"))) return;
  currentCard.suit = Suit.Heart;
  ctx.log.push(`${self.id} biến phán quyết thành Cơ (hongyan)`);
}

/** Luanji (Yuan Shao): any 2 hand cards of the SAME suit may be played/discarded together as
 *  Archery Attack. Modeled as a dedicated proactive self-action (this engine's `canViewAs*`
 *  hooks are all single-card, see this file's earlier "multi-card viewAs" scope notes) rather
 *  than a true viewAs -- same "no dedicated multi-card-combo UI, folded into a self-action ask"
 *  precedent as Spear's 2-card-as-Slash (room.ts's `trySpearSlash`). */
async function luanjiSelfAction(ctx: EngineContext, player: GamePlayer): Promise<void> {
  if (player.handcardNum < 2 || !(await ctx.askUseSelfAction(player, "luanji"))) return;
  const chosen = await ctx.askAnyHandCards(player, 2, 2);
  if (chosen.length !== 2 || chosen[0].suit !== chosen[1].suit) return; // declined, or not a same-suit pair -- never forced
  for (const c of chosen) player.hand.splice(player.hand.indexOf(c), 1);
  ctx.discardPile.push(...chosen);
  ctx.log.push(`${player.id} dùng 2 lá cùng chất như Vạn Tiễn Tề Phát (luanji)`);
  await resolveArcheryAttack(ctx, player);
}

export const SKILLS: Record<string, Skill> = {
  paoxiao: {
    name: "paoxiao",
    displayName: "Bào Hao",
    description: "Không giới hạn số lần dùng [Sát] mỗi lượt.",
    slashLimit: () => Infinity,
  },
  wusheng: {
    name: "wusheng",
    displayName: "Võ Thánh",
    description: "Có thể chuyển hoá bất kỳ lá bài chất Đỏ (♥/♦) nào thành [Sát].",
    canViewAsSlash: (card) => card.kind !== CardKind.Slash && card.suit !== Suit.Spade && card.suit !== Suit.Club,
  },
  ganglie: {
    name: "ganglie",
    displayName: "Cương Liệt",
    description: "Khi bị thương, phán 1 lá: nếu không phải chất Cơ, nguồn gây thương phải bỏ 2 lá hoặc chịu 1 sát thương.",
    onDamaged: ganglieOnDamaged,
  },
  longdan: {
    name: "longdan",
    displayName: "Long Đảm",
    description: "Có thể chuyển hoá dùng/đánh ra [Sát] thành [Thiểm], và [Thiểm] thành [Sát].",
    canViewAsSlash: (card) => card.kind === CardKind.Jink,
    canViewAsJink: (card) => card.kind === CardKind.Slash,
  },
  qingguo: {
    name: "qingguo",
    displayName: "Khuynh Quốc",
    description: "Có thể chuyển hoá dùng/đánh ra bất kỳ lá bài chất Đen (♠/♣) nào trên tay thành [Thiểm].",
    canViewAsJink: (card) => card.kind !== CardKind.Jink && (card.suit === Suit.Spade || card.suit === Suit.Club),
  },
  kongcheng: {
    name: "kongcheng",
    displayName: "Không Thành",
    description: "Khi trên tay không còn lá bài nào, miễn nhiễm với [Sát] và [Quyết Đấu] nhắm vào bạn.",
    immuneToSlashAndDuel: (player) => player.handcardNum === 0,
  },
  guanxing: {
    name: "guanxing",
    displayName: "Quan Tinh",
    description:
      "Đầu giai đoạn Chuẩn Bị, xem tối đa 5 lá đầu bộ bài, chọn lá nào đặt xuống đáy bộ bài (còn lại giữ nguyên thứ tự trên đỉnh).",
    otherPhaseAction: guanxingAction,
  },
  tieqi: {
    name: "tieqi",
    displayName: "Thiết Kỵ",
    description: "Khi bạn dùng [Sát] nhắm vào ai đó, phán 1 lá; nếu là chất Đỏ, mục tiêu không thể dùng [Thiểm] để né lá Sát đó.",
    onSlashTargeted: tieqiOnSlashTargeted,
  },
  fankui: {
    name: "fankui",
    displayName: "Phản Quỹ",
    description: "Sau khi bạn nhận sát thương, bạn thu lấy 1 lá ngẫu nhiên trên tay của nguồn sát thương (nếu có).",
    onDamaged: fankuiOnDamaged,
  },
  guicai: {
    name: "guicai",
    displayName: "Quỷ Tài",
    description:
      "Khi có phán đoán bất kỳ đang diễn ra (kể cả của chính bạn), có thể dùng 1 lá trên tay thay thế kết quả phán đoán đó (bổ sung phán đoán).",
    onJudgment: (ctx, self, judgeOwner, currentCard, reason) => ctx.askGuicaiRetrial(self, judgeOwner, currentCard, reason),
  },
  kurou: {
    name: "kurou",
    displayName: "Khổ Nhục",
    description: "Một lần trong giai đoạn ra bài: mất 1 máu, rút 2 lá.",
    selfAction: kurouSelfAction,
  },
  qianxun: {
    name: "qianxun",
    displayName: "Khiêm Tốn",
    description: "Miễn nhiễm với [Đoạt] nhắm vào bạn. Khi [Lạc Bất Tư Thục] tiến vào vùng phán xét của bạn, đưa nó vào thẳng chồng bài bỏ.",
    immuneToSnatch: () => true,
    blocksIndulgenceEntry: () => true,
  },
  kuanggu: {
    name: "kuanggu",
    displayName: "Cuồng Cốt",
    description: "Sau khi bạn gây sát thương cho 1 người trong khoảng cách 1 lúc đang bị thương, hồi 1 máu cho mỗi điểm sát thương đã gây (tối đa đến máu tối đa).",
    onDamageDealt: kuangguOnDamageDealt,
  },
  jianxiong: {
    name: "jianxiong",
    displayName: "Gian Hùng",
    description: "Sau khi bạn nhận sát thương, bạn có thể thu lấy lá gây sát thương cho bạn.",
    onDamaged: jianxiongOnDamaged,
  },
  yingzi: {
    name: "yingzi",
    displayName: "Anh Tư",
    description: "Giai đoạn rút bài, bạn rút thêm 1 lá.",
    drawPhaseBonus: () => 1,
  },
  qixi: {
    name: "qixi",
    displayName: "Kỳ Tập",
    description: "Giai đoạn ra bài, có thể chuyển hoá dùng/đánh ra bất kỳ lá bài chất Đen (♠/♣) nào thành [Sách Kiều].",
    canViewAsDismantlement: (card) => card.kind !== CardKind.Dismantlement && (card.suit === Suit.Spade || card.suit === Suit.Club),
  },
  jizhi: {
    name: "jizhi",
    displayName: "Ki Trí",
    description: "Sau khi bạn dùng 1 lá bài Kế (không phải Kế trì hoãn), rút 1 lá.",
    onTrickPlayed: jizhiOnTrickPlayed,
  },
  qicai: {
    name: "qicai",
    displayName: "Kỳ Tài",
    description: "Các lá bài Kế của bạn không bị giới hạn khoảng cách.",
    ignoresTrickDistanceLimit: () => true,
  },
  liegong: {
    name: "liegong",
    displayName: "Liệt Cung",
    description: "Giai đoạn ra bài, khi bạn dùng [Sát] nhắm vào 1 người có số bài trên tay ≥ máu của bạn, hoặc ≤ tầm đánh của bạn, người đó không thể dùng [Thiểm].",
    onSlashTargeted: liegongOnSlashTargeted,
  },
  xiangle: {
    name: "xiangle",
    displayName: "Hưởng Lạc",
    description: "Khi bạn trở thành mục tiêu của [Sát], người dùng [Sát] phải bỏ 1 lá bài cơ bản, nếu không [Sát] đó vô hiệu với bạn.",
    onIncomingSlash: xiangleOnIncomingSlash,
  },
  savageAssaultAvoid: {
    name: "savageAssaultAvoid",
    displayName: "Miễn Nam Man",
    description: "Miễn nhiễm với [Nam Man Nhập Khấu].",
    immuneToSavageAssault: () => true,
  },
  huoshou: {
    name: "huoshou",
    displayName: "Hoả Thú",
    description: "Khi người khác dùng [Nam Man Nhập Khấu], bạn có thể trở thành nguồn gây sát thương của lá bài đó.",
    hijackAoeSource: huoshouHijackAoeSource,
  },
  juxiang: {
    name: "juxiang",
    displayName: "Cự Tượng",
    description: "Khi người khác dùng [Nam Man Nhập Khấu], sau khi lá đó giải quyết xong, bạn nhận lấy lá bài đó vào tay.",
    claimsUsedSavageAssaultCard: () => true,
  },
  shushen: {
    name: "shushen",
    displayName: "Thục Thân",
    description: "Mỗi khi bạn hồi phục, có thể khiến 1 đồng minh rút 1 lá.",
    onRecover: shushenOnRecover,
  },
  shenzhi: {
    name: "shenzhi",
    displayName: "Thân Trí",
    description: "Giai đoạn chuẩn bị, có thể bỏ toàn bộ bài trên tay; nếu số lá bỏ ≥ máu hiện tại, hồi 1 máu.",
    otherPhaseAction: shenzhiAction,
  },
  tuxi: {
    name: "tuxi",
    displayName: "Đột Tập",
    description: "Giai đoạn rút bài, có thể chọn tối đa 2 người khác có bài, lấy ngẫu nhiên 1 lá từ mỗi người.",
    otherPhaseAction: tuxiAction,
  },
  luoyi: {
    name: "luoyi",
    displayName: "Lạc Dịch",
    description: "Giai đoạn rút bài, có thể rút ít hơn 1 lá; nếu vậy, lần gây sát thương tiếp theo trong lượt này +1.",
    otherPhaseAction: luoyiAction,
    drawPhaseBonus: (player) => (player.luoyiArmedThisTurn ? -1 : 0),
  },
  yiji: {
    name: "yiji",
    displayName: "Di Kế",
    description: "Khi bạn bị thương, có thể lật 2 lá từ chồng rút bài và giao mỗi lá cho 1 người bất kỳ (kể cả bạn).",
    onDamaged: yijiOnDamaged,
  },
  tiandu: {
    name: "tiandu",
    displayName: "Thiên Khiển",
    description: "Sau khi phán xét thuộc vùng phán xét của bạn có hiệu lực, có thể thu lấy kết quả phán xét thay vì để nó vào chồng bài bỏ.",
    claimsOwnJudgment: tianduClaim,
  },
  qiangxi: {
    name: "qiangxi",
    displayName: "Cường Tập",
    description: "Giai đoạn ra bài, có thể mất 1 máu để gây 1 sát thương cho 1 người trong tầm đánh, bỏ qua [Thiểm].",
    activeAction: qiangxiAction,
  },
  jieming: {
    name: "jieming",
    displayName: "Giới Minh",
    description: "Khi bạn bị thương, có thể chọn 1 người bất kỳ để bài trên tay của họ được bổ sung lên tối đa 5 lá (không vượt quá máu tối đa).",
    onDamaged: jiemingOnDamaged,
  },
  xingshang: {
    name: "xingshang",
    displayName: "Hình Thưởng",
    description: "Khi có người khác chết còn bài, bạn nhận toàn bộ bài (trên tay + trang bị) của họ thay vì đưa vào chồng bài bỏ.",
    claimsDeathCards: true,
  },
  xiaoguo: {
    name: "xiaoguo",
    displayName: "Hiệu Quả",
    description: "Giai đoạn kết thúc của người khác, bạn có thể bỏ 1 lá cơ bản; người đó phải bỏ 1 lá trang bị hoặc chịu 1 sát thương từ bạn.",
    otherPlayerFinishReaction: xiaoguoFinishReaction,
  },
  keji: {
    name: "keji",
    displayName: "Khắc Kỷ",
    description: "Nếu bạn không dùng [Sát] trong giai đoạn ra bài, bỏ qua giai đoạn bỏ bài của lượt này.",
    skipsDiscardPhase: (player) => !player.playedSlashThisTurn,
  },
  liuli: {
    name: "liuli",
    displayName: "Lưu Ly",
    description: "Khi bạn trở thành mục tiêu của [Sát], có thể bỏ 1 lá để chuyển mục tiêu sang 1 người khác trong tầm đánh của bạn.",
    onIncomingSlash: liuliOnIncomingSlash,
  },
  guose: {
    name: "guose",
    displayName: "Quốc Sắc",
    description: "Giai đoạn ra bài, có thể chuyển hóa sử dụng 1 lá Rô trên tay thành [Lạc Bất Tư Thục].",
    canViewAsIndulgence: (card) => card.kind !== CardKind.Indulgence && card.suit === Suit.Diamond,
  },
  xiaoji: {
    name: "xiaoji",
    displayName: "Tiêu Tịch",
    description: "Khi trang bị của bạn rời khỏi vùng trang bị, rút 2 lá.",
    onEquipLost: xiaojiOnEquipLost,
  },
  yinghun: {
    name: "yinghun",
    displayName: "Anh Hồn",
    description: "Giai đoạn chuẩn bị, nếu đang bị thương, có thể chọn 1 người khác để họ rút bài rồi bỏ 1 lá.",
    otherPhaseAction: yinghunAction,
  },
  haoshi: {
    name: "haoshi",
    displayName: "Hào Thí",
    description: "Giai đoạn rút bài, rút thêm 2 lá; nếu sau đó bài trên tay > 5, buộc chia nửa số bài cho người có ít bài nhất.",
    drawPhaseBonus: () => 2,
    afterDrawPhase: haoshiAfterDrawPhase,
  },
  guzheng: {
    name: "guzheng",
    displayName: "Cổ Tranh",
    description: "Khi người khác bỏ bài do vượt giới hạn ở giai đoạn bỏ bài, bạn có thể lấy 1 trong số lá đó.",
    onOtherPlayerOverDiscard: guzhengOnOtherPlayerOverDiscard,
  },
  jijiu: {
    name: "jijiu",
    displayName: "Cấp Cứu",
    description: "Có thể chuyển hoá dùng/đánh ra bất kỳ lá bài chất Đỏ (♥/♦) nào thành [Đào].",
    canViewAsPeach: (card) => card.kind !== CardKind.Peach && isRed(card),
  },
  qingnang: {
    name: "qingnang",
    displayName: "Thanh Nang",
    description: "Giai đoạn ra bài, có thể bỏ 1 lá để hồi 1 máu cho 1 người đang bị thương bất kỳ (kể cả bạn).",
    activeAction: qingnangAction,
  },
  wushuang: {
    name: "wushuang",
    displayName: "Vô Song",
    description: "Khi bạn né [Sát] hoặc đáp trả trong [Quyết Đấu], bạn cần 2 lá [Thiểm]/[Sát] thay vì 1.",
    responseCountRequired: () => 2,
  },
  biyue: {
    name: "biyue",
    displayName: "Bế Nguyệt",
    description: "Giai đoạn kết thúc, có thể rút 1 lá.",
    otherPhaseAction: biyueAction,
  },
  shuangxiong: {
    name: "shuangxiong",
    displayName: "Song Hùng",
    description: "Giai đoạn rút bài, có thể phán 1 lá và nhận nó vào tay; trong lượt này, lá chất đối lập màu với lá phán có thể chuyển hoá thành [Quyết Đấu].",
    otherPhaseAction: shuangxiongAction,
    canViewAsDuel: (card, player) =>
      card.kind !== CardKind.Duel &&
      player.duelViewAsBlackAllowed !== null &&
      isBlack(card) === player.duelViewAsBlackAllowed,
  },
  weimu: {
    name: "weimu",
    displayName: "Úy Mộ",
    description: "Miễn nhiễm với lá bài Kế chất Đen (♠/♣) nhắm vào bạn.",
    immuneToBlackTrick: () => true,
  },
  mashu: {
    name: "mashu",
    displayName: "Mã Thuật",
    description: "Khoảng cách từ bạn đến người khác -1.",
    attackDistanceDelta: () => 1,
  },
  mengjin: {
    name: "mengjin",
    displayName: "Mãnh Tiến",
    description: "Sau khi [Sát] của bạn bị né, buộc mục tiêu bỏ 1 lá ngẫu nhiên.",
    onSlashDodged: mengjinOnSlashDodged,
  },
  leiji: {
    name: "leiji",
    displayName: "Lôi Kích",
    description: "Khi bạn né [Sát] bằng [Thiểm], có thể chọn 1 người bất kỳ rồi phán 1 lá; nếu là chất Bích, gây 2 sát thương cho người đó.",
    onSlashDodged: leijiOnSlashDodged,
  },
  beige: {
    name: "beige",
    displayName: "Bi Ca",
    description: "Sau khi bị thương, có thể bỏ 1 lá để phán: Cơ hồi 1 máu, Rô rút 2 lá, Chuồn buộc nguồn gây thương bỏ 2 lá.",
    onDamaged: beigeOnDamaged,
  },
  mingshi: {
    name: "mingshi",
    displayName: "Danh Sĩ",
    description: "Sát thương bạn nhận luôn giảm đi 1 (tối thiểu 0).",
    reduceDamage: mingshiReduceDamage,
  },
  sijian: {
    name: "sijian",
    displayName: "Tứ Gián",
    description: "Khi bài trên tay của bạn hết sau khi dùng 1 lá, có thể chọn 1 người khác có bài để buộc họ bỏ 1 lá.",
    onHandEmptied: sijianOnHandEmptied,
  },
  suishi: {
    name: "suishi",
    displayName: "Tuỳ Thị",
    description: "Khi 1 đồng minh nguy kịch, rút 1 lá. Khi 1 đồng minh chết, mất 1 máu.",
    onAllyDying: suishiOnAllyDying,
    onAllyDeath: suishiOnAllyDeath,
  },
  luoshen: {
    name: "luoshen",
    displayName: "Lạc Thần",
    description: "Đầu lượt, có thể phán liên tục (dừng khi ra lá không phải Đen hoặc bạn không tiếp tục); thu hết các lá Đen đã phán vào tay.",
    otherPhaseAction: { phase: Phase.Start, run: luoshenOtherPhaseAction },
  },
  fanjian: {
    name: "fanjian",
    displayName: "Phản Gián",
    description: "Mỗi lượt 1 lần: lật 1 lá trên tay giao cho 1 người, họ chọn bỏ hết bài cùng chất (tay+trang bị) hoặc mất 1 máu.",
    selfAction: fanjianSelfAction,
  },
  lieren: {
    name: "lieren",
    displayName: "Liệt Nhận",
    description: "Sau khi Sát của bạn gây sát thương, có thể đấu điểm với mục tiêu; thắng thì thu lấy 1 lá của họ.",
    onSlashDamageDealt: lierenOnSlashDamageDealt,
  },
  quhu: {
    name: "quhu",
    displayName: "Vờn Hổ",
    description: "Mỗi lượt 1 lần: đấu điểm với người có nhiều máu hơn bạn; thắng thì họ tự chỉ định gây 1 sát thương trong tầm đánh, thua thì họ gây 1 sát thương cho bạn.",
    selfAction: quhuSelfAction,
  },
  jieyin: {
    name: "jieyin",
    displayName: "Kết Nhân",
    description: "Mỗi lượt 1 lần: bỏ 2 lá trên tay, chọn 1 người nam đang bị thương -- cả hai cùng hồi 1 máu.",
    selfAction: jieyinSelfAction,
  },
  dimeng: {
    name: "dimeng",
    displayName: "Kết Minh",
    description: "Mỗi lượt 1 lần: chọn 2 người khác, bỏ tối đa X lá của bạn (X = chênh lệch bài trên tay giữa 2 người), lệnh họ hoán đổi bài trên tay.",
    selfAction: dimengSelfAction,
  },
  zhijian: {
    name: "zhijian",
    displayName: "Trực Gián",
    description: "Mỗi lượt: đặt 1 lá trang bị trên tay vào vùng trang bị của người khác, rồi rút 1 lá.",
    selfAction: zhijianSelfAction,
  },
  lijian: {
    name: "lijian",
    displayName: "Ly Gián",
    description: "Mỗi lượt 1 lần: bỏ 1 lá, chọn 2 người nam khác -- người chọn sau xem như dùng Quyết Đấu với người chọn trước.",
    selfAction: lijianSelfAction,
  },
  wansha: {
    name: "wansha",
    displayName: "Hoàn Sát",
    description: "Tỏa định kỹ: trong lượt của bạn, người khác không trong trạng thái hấp hối không thể dùng Đào cứu người đang hấp hối.",
    suppressesAllyRescue: (player) => player.phase !== Phase.NotActive,
  },
  luanwu: {
    name: "luanwu",
    displayName: "Loạn Vũ",
    description: "Hạn định kỹ: mỗi người khác chọn dùng Sát với người gần nhất hoặc mất 1 máu.",
    selfAction: luanwuSelfAction,
  },
  xiongyi: {
    name: "xiongyi",
    displayName: "Hùng Dị",
    description: "Hạn định kỹ: đồng minh rút 3 lá; nếu thế lực của bạn ít người nhất (hoặc đồng hạng), hồi 1 máu.",
    selfAction: xiongyiSelfAction,
  },
  guidao: {
    name: "guidao",
    displayName: "Quỷ Đạo",
    description: "Khi phán xét của 1 người có hiệu lực, có thể bỏ 1 lá Đen để thay đổi kết quả phán xét đó.",
    onJudgment: guidaoOnJudgment,
  },
  lirang: {
    name: "lirang",
    displayName: "Lễ Nhượng",
    description: "Khi 1 lá bài của bạn bị bỏ (không phải do đánh ra), có thể giao thẳng cho người khác thay vì vào chồng bài bỏ.",
    redirectsOwnDiscard: lirangRedirect,
  },
  duoshi: {
    name: "duoshi",
    displayName: "Độ Thế",
    description: "Tối đa 4 lần mỗi lượt: chuyển hóa 1 lá Đỏ trên tay thành Dĩ Dật Đãi Lao (bạn và đồng minh rút 2 rồi bỏ 2).",
    selfAction: duoshiSelfAction,
  },
  fangquan: {
    name: "fangquan",
    displayName: "Ủy Quyền",
    description: "Có thể bỏ qua giai đoạn ra bài của mình; cuối lượt có thể bỏ 1 lá để cho 1 người thêm 1 lượt ngay sau lượt này.",
    canSkipPlayPhase: () => true,
    grantsExtraTurn: fangquanGrantsExtraTurn,
  },
  rende: {
    name: "rende",
    displayName: "Nhân Đức",
    description: "Một lần trong giai đoạn ra bài: giao tùy ý số lá trên tay cho 1 người khác; nếu giao từ 3 lá trở lên và bạn đang bị thương, hồi 1 máu.",
    selfAction: rendeSelfAction,
  },
  niepan: {
    name: "niepan",
    displayName: "Niết Bàn",
    description: "Hạn định kỹ: khi đang hấp hối, có thể bỏ hết bài trên tay/trang bị/phán quyết, hồi máu lên 3 (hoặc giới hạn máu nếu thấp hơn) rồi rút 3 lá.",
    cheatsDeath: niepanCheatsDeath,
  },
  zhiheng: {
    name: "zhiheng",
    displayName: "Chế Hành",
    description: "Một lần trong giai đoạn ra bài: bỏ tối đa X lá trên tay (X = giới hạn máu của bạn), rút lại số lá tương ứng.",
    selfAction: zhihengSelfAction,
  },
  hongyan: {
    name: "hongyan",
    displayName: "Hồng Nhan",
    description: "Phán quyết của chính bạn, nếu là chất BÍCH, có thể xem như chất CƠ.",
    filtersOwnJudgment: hongyanFiltersOwnJudgment,
  },
  luanji: {
    name: "luanji",
    displayName: "Loạn Kích",
    description: "Giai đoạn ra bài, có thể chuyển hóa 2 lá trên tay CÙNG CHẤT thành [Vạn Tiễn Tề Phát].",
    selfAction: luanjiSelfAction,
  },
};

export interface GeneralDef {
  name: string;
  /** Official Vietnamese general name (lang/vi_VN/Package/Standard*General.lua), e.g. "Tào Tháo" -- distinct from `name`'s pinyin id, which drives asset filenames and stays untranslated. */
  displayName: string;
  kingdom: string;
  maxHp: number;
  skillNames: string[];
  /** Historical gender -- needed by DoubleSword's ability (opposite-gender Slash target).
   *  Omitted for the 36 male generals (defaults to male wherever consulted); only the 8
   *  historically female ones set this explicitly. */
  gender?: "female";
}

// 44 of the ~60 Standard generals in this repo's `dev`-branch source are ported so far -- see
// webport/README.md's Milestone 2.6 section for the full remaining/blocked list and why.
export const GENERALS: GeneralDef[] = [
  { name: "zhangfei", displayName: "Trương Phi", kingdom: "shu", maxHp: 4, skillNames: ["paoxiao"] },
  { name: "guanyu", displayName: "Quan Vũ", kingdom: "shu", maxHp: 5, skillNames: ["wusheng"] },
  { name: "xiahoudun", displayName: "Hạ Hầu Đôn", kingdom: "wei", maxHp: 4, skillNames: ["ganglie"] },
  { name: "zhaoyun", displayName: "Triệu Vân", kingdom: "shu", maxHp: 4, skillNames: ["longdan"] },
  { name: "zhenji", displayName: "Chân Cơ", kingdom: "wei", maxHp: 3, skillNames: ["qingguo", "luoshen"], gender: "female" },
  { name: "zhugeliang", displayName: "Gia Cát Lượng", kingdom: "shu", maxHp: 3, skillNames: ["kongcheng", "guanxing"] },
  { name: "machao", displayName: "Mã Siêu", kingdom: "shu", maxHp: 4, skillNames: ["tieqi", "mashu"] },
  { name: "simayi", displayName: "Tư Mã Ý", kingdom: "wei", maxHp: 3, skillNames: ["fankui", "guicai"] },
  { name: "huanggai", displayName: "Hoàng Cái", kingdom: "wu", maxHp: 4, skillNames: ["kurou"] },
  { name: "luxun", displayName: "Lục Tốn", kingdom: "wu", maxHp: 3, skillNames: ["qianxun", "duoshi"] },
  { name: "weiyan", displayName: "Ngụy Diên", kingdom: "shu", maxHp: 4, skillNames: ["kuanggu"] },
  { name: "caocao", displayName: "Tào Tháo", kingdom: "wei", maxHp: 4, skillNames: ["jianxiong"] }, // complete: this repo's actual lang/vi_VN Standard package has no 2nd skill for Cao Cao ("Hujia" doesn't exist in it -- a prior comment guessing it did was wrong, see this file's header)
  { name: "zhouyu", displayName: "Chu Du", kingdom: "wu", maxHp: 3, skillNames: ["yingzi", "fanjian"] },
  { name: "ganning", displayName: "Cam Ninh", kingdom: "wu", maxHp: 4, skillNames: ["qixi"] },
  { name: "huangyueying", displayName: "Hoàng Nguyệt Anh", kingdom: "shu", maxHp: 3, skillNames: ["jizhi", "qicai"], gender: "female" },
  { name: "huangzhong", displayName: "Hoàng Trung", kingdom: "shu", maxHp: 4, skillNames: ["liegong"] }, // complete: LiegongRange is a Hegemony-lord-only extension of this same skill, not a distinct 2nd Role-mode skill
  { name: "liushan", displayName: "Lưu Thiện", kingdom: "shu", maxHp: 3, skillNames: ["xiangle", "fangquan"] },
  { name: "menghuo", displayName: "Mạnh Hoạch", kingdom: "shu", maxHp: 4, skillNames: ["savageAssaultAvoid", "huoshou"] },
  { name: "zhurong", displayName: "Chúc Dung", kingdom: "shu", maxHp: 4, skillNames: ["savageAssaultAvoid", "juxiang", "lieren"], gender: "female" },
  { name: "ganfuren", displayName: "Cam Phu Nhân", kingdom: "shu", maxHp: 3, skillNames: ["shushen", "shenzhi"], gender: "female" },
  { name: "zhangliao", displayName: "Trương Liêu", kingdom: "wei", maxHp: 4, skillNames: ["tuxi"] },
  { name: "xuchu", displayName: "Hứa Chử", kingdom: "wei", maxHp: 4, skillNames: ["luoyi"] },
  { name: "guojia", displayName: "Quách Gia", kingdom: "wei", maxHp: 3, skillNames: ["yiji", "tiandu"] },
  { name: "dianwei", displayName: "Điển Vi", kingdom: "wei", maxHp: 4, skillNames: ["qiangxi"] },
  { name: "xunyu", displayName: "Tuân Úc", kingdom: "wei", maxHp: 3, skillNames: ["jieming", "quhu"] },
  { name: "caopi", displayName: "Tào Phi", kingdom: "wei", maxHp: 3, skillNames: ["xingshang"] }, // Fangzhu still deferred, needs face-up/down state
  { name: "yuejin", displayName: "Nhạc Tiến", kingdom: "wei", maxHp: 4, skillNames: ["xiaoguo"] },
  { name: "lvmeng", displayName: "Lữ Mông", kingdom: "wu", maxHp: 4, skillNames: ["keji"] },
  { name: "daqiao", displayName: "Đại Kiều", kingdom: "wu", maxHp: 3, skillNames: ["liuli", "guose"], gender: "female" },
  { name: "sunshangxiang", displayName: "Tôn Thượng Hương", kingdom: "wu", maxHp: 3, skillNames: ["xiaoji", "jieyin"], gender: "female" },
  { name: "sunjian", displayName: "Tôn Kiên", kingdom: "wu", maxHp: 4, skillNames: ["yinghun"] },
  { name: "lusu", displayName: "Lỗ Túc", kingdom: "wu", maxHp: 3, skillNames: ["haoshi", "dimeng"] },
  { name: "erzhang", displayName: "Trương Chiêu & Trương Hoành", kingdom: "wu", maxHp: 3, skillNames: ["guzheng", "zhijian"] },
  { name: "huatuo", displayName: "Hoa Đà", kingdom: "qun", maxHp: 3, skillNames: ["jijiu", "qingnang"] },
  { name: "lvbu", displayName: "Lữ Bố", kingdom: "qun", maxHp: 5, skillNames: ["wushuang"] },
  { name: "diaochan", displayName: "Điêu Thuyền", kingdom: "qun", maxHp: 3, skillNames: ["biyue", "lijian"], gender: "female" },
  { name: "yanliangwenchou", displayName: "Nhan Lương & Văn Xú", kingdom: "qun", maxHp: 4, skillNames: ["shuangxiong"] },
  { name: "jiaxu", displayName: "Giả Hủ", kingdom: "qun", maxHp: 3, skillNames: ["weimu", "wansha", "luanwu"] },
  { name: "pangde", displayName: "Bàng Đức", kingdom: "qun", maxHp: 4, skillNames: ["mashu", "mengjin"] },
  { name: "zhangjiao", displayName: "Trương Giác", kingdom: "qun", maxHp: 3, skillNames: ["leiji", "guidao"] },
  { name: "caiwenji", displayName: "Thái Văn Cơ", kingdom: "qun", maxHp: 3, skillNames: ["beige"], gender: "female" }, // Duanchang still deferred, needs the dual-general head/deputy mechanic (explicitly out of scope for Role mode, see this file's header)
  { name: "mateng", displayName: "Mã Đằng", kingdom: "qun", maxHp: 4, skillNames: ["mashu", "xiongyi"] },
  { name: "kongrong", displayName: "Khổng Dung", kingdom: "qun", maxHp: 3, skillNames: ["mingshi", "lirang"] },
  { name: "tianfeng", displayName: "Điền Phong", kingdom: "qun", maxHp: 3, skillNames: ["sijian", "suishi"] },
  // Milestone 24 (5 more generals, 44->49 of the real ~60-general roster): user asked to check
  // the real upstream repo directly (github.com/Mogara/QSanguosha-For-Hegemony), which found the
  // "~60" figure itself (not the stale "46" this file's comment above used to say) -- see
  // webport/README.md's Milestone 24 section for the full research + why these 5 (of the 16
  // real gaps found) were the tractable first batch.
  { name: "liubei", displayName: "Lưu Bị", kingdom: "shu", maxHp: 4, skillNames: ["rende"] },
  { name: "pangtong", displayName: "Bàng Thống", kingdom: "shu", maxHp: 3, skillNames: ["niepan"] }, // Lianhuan still deferred, needs the Iron Chain trick card (not ported, see card.ts's header)
  { name: "sunquan", displayName: "Tôn Quyền", kingdom: "wu", maxHp: 4, skillNames: ["zhiheng"] },
  { name: "xiaoqiao", displayName: "Tiểu Kiều", kingdom: "wu", maxHp: 3, skillNames: ["hongyan"], gender: "female" }, // Tianxiang still deferred, needs a damage-transfer mechanic (redirect incoming damage to another player)
  { name: "yuanshao", displayName: "Viên Thiệu", kingdom: "qun", maxHp: 4, skillNames: ["luanji"] },
];
