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

import { Card, CardKind, Suit } from "./card.js";
import { GamePlayer } from "./player.js";
import { Phase } from "./types.js";
import { alliesOf, isAlly } from "./gamerule.js";
import { EngineContext, applyDamage, effectiveDistance, heal, loseHp } from "./combat.js";

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
}

function isRed(card: Card): boolean {
  return card.suit === Suit.Heart || card.suit === Suit.Diamond;
}

function isBlack(card: Card): boolean {
  return card.suit === Suit.Spade || card.suit === Suit.Club;
}

/** Vietnamese card-suit names for judge-card log lines (Ganglie/Tieqi/Shuangxiong/Leiji/Beige). */
const SUIT_LABEL_VI: Record<Suit, string> = {
  [Suit.Spade]: "Bích",
  [Suit.Heart]: "Cơ",
  [Suit.Club]: "Chuồn",
  [Suit.Diamond]: "Rô",
};

/** Discards a uniformly random card from `player`'s hand, if any. Used by several skills below
 *  that force a discard without a specific-card choice UI (matches the Fankui/Kongcheng
 *  precedent of collapsing "choose which card" down to random). */
function discardRandom(ctx: EngineContext, player: GamePlayer, rng: () => number): Card | null {
  if (player.hand.length === 0) return null;
  const idx = Math.floor(rng() * player.hand.length);
  const [card] = player.hand.splice(idx, 1);
  ctx.discardPile.push(card);
  return card;
}

async function ganglieOnDamaged(ctx: EngineContext, player: GamePlayer, source: GamePlayer, rng: () => number): Promise<void> {
  if (!source.alive) return;
  const judgeCard = ctx.drawTop();
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
  const judgeCard = ctx.drawTop();
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

function liegongOnSlashTargeted(_ctx: EngineContext, attacker: GamePlayer, target: GamePlayer): boolean {
  return target.handcardNum >= attacker.hp || target.handcardNum <= attacker.attackRange;
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

const qiangxiAction = {
  candidatesFor(alive: GamePlayer[], player: GamePlayer): GamePlayer[] {
    return alive.filter((p) => p !== player && effectiveDistance(alive, player, p) <= player.attackRange);
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
    (p) => p !== defender && p !== attacker && effectiveDistance(ctx.alivePlayers, defender, p) <= defender.attackRange,
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
    discardRandom(ctx, to, rng);
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
    discardRandom(ctx, player, rng);
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
    const judgeCard = ctx.drawTop();
    if (!judgeCard) return;
    player.hand.push(judgeCard);
    player.duelViewAsBlackAllowed = isRed(judgeCard);
    ctx.log.push(`${player.id} phán Song Hùng: ${SUIT_LABEL_VI[judgeCard.suit]} ${judgeCard.point}, nhận vào tay`);
  },
};

function mengjinOnSlashDodged(ctx: EngineContext, attacker: GamePlayer, target: GamePlayer): void {
  if (!discardRandom(ctx, target, ctx.rng)) return;
  ctx.log.push(`${target.id} bỏ 1 lá bài (mengjin)`);
  void attacker;
}

async function leijiOnSlashDodged(ctx: EngineContext, _attacker: GamePlayer, zhangjiao: GamePlayer): Promise<void> {
  if (!(await ctx.askUseSelfAction(zhangjiao, "leiji"))) return;
  const to = await ctx.askChooseAnyPlayer(zhangjiao, ctx.alivePlayers);
  if (!to) return;
  const judgeCard = ctx.drawTop();
  if (!judgeCard) return;
  ctx.discardPile.push(judgeCard);
  ctx.log.push(`${zhangjiao.id} phán Lôi Kích: ${SUIT_LABEL_VI[judgeCard.suit]} ${judgeCard.point}`);
  if (judgeCard.suit === Suit.Spade) await applyDamage(ctx, to, 2, zhangjiao);
}

async function beigeOnDamaged(ctx: EngineContext, player: GamePlayer, source: GamePlayer, rng: () => number): Promise<void> {
  if (player.handcardNum === 0 || !(await ctx.askUseSelfAction(player, "beige"))) return;
  discardRandom(ctx, player, rng);
  const judgeCard = ctx.drawTop();
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
        for (let i = 0; i < 2; i++) discardRandom(ctx, source, rng);
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
  if (discardRandom(ctx, to, rng)) ctx.log.push(`${to.id} bỏ 1 lá bài (sijian)`);
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
  kurou: {
    name: "kurou",
    displayName: "Khổ Nhục",
    description: "Một lần trong giai đoạn ra bài: mất 1 máu, rút 2 lá.",
    selfAction: kurouSelfAction,
  },
  qianxun: {
    name: "qianxun",
    displayName: "Khiêm Tốn",
    description: "Miễn nhiễm với [Đoạt] nhắm vào bạn.",
    immuneToSnatch: () => true,
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
};

export interface GeneralDef {
  name: string;
  /** Official Vietnamese general name (lang/vi_VN/Package/Standard*General.lua), e.g. "Tào Tháo" -- distinct from `name`'s pinyin id, which drives asset filenames and stays untranslated. */
  displayName: string;
  kingdom: string;
  maxHp: number;
  skillNames: string[];
}

// 44 of the ~60 Standard generals in this repo's `dev`-branch source are ported so far -- see
// webport/README.md's Milestone 2.6 section for the full remaining/blocked list and why.
export const GENERALS: GeneralDef[] = [
  { name: "zhangfei", displayName: "Trương Phi", kingdom: "shu", maxHp: 4, skillNames: ["paoxiao"] },
  { name: "guanyu", displayName: "Quan Vũ", kingdom: "shu", maxHp: 5, skillNames: ["wusheng"] },
  { name: "xiahoudun", displayName: "Hạ Hầu Đôn", kingdom: "wei", maxHp: 4, skillNames: ["ganglie"] },
  { name: "zhaoyun", displayName: "Triệu Vân", kingdom: "shu", maxHp: 4, skillNames: ["longdan"] },
  { name: "zhenji", displayName: "Chân Cơ", kingdom: "wei", maxHp: 3, skillNames: ["qingguo"] },
  { name: "zhugeliang", displayName: "Gia Cát Lượng", kingdom: "shu", maxHp: 3, skillNames: ["kongcheng"] }, // Guanxing deferred, needs card-reorder UI
  { name: "machao", displayName: "Mã Siêu", kingdom: "shu", maxHp: 4, skillNames: ["tieqi"] }, // Mashu ported below under pangde/mateng's shared skill
  { name: "simayi", displayName: "Tư Mã Ý", kingdom: "wei", maxHp: 3, skillNames: ["fankui"] }, // Guicai deferred, needs judge-area/retrial system
  { name: "huanggai", displayName: "Hoàng Cái", kingdom: "wu", maxHp: 4, skillNames: ["kurou"] },
  { name: "luxun", displayName: "Lục Tốn", kingdom: "wu", maxHp: 3, skillNames: ["qianxun"] }, // Duoshi deferred, needs a 2nd viewAs-Slash-limit skill slot
  { name: "weiyan", displayName: "Ngụy Diên", kingdom: "shu", maxHp: 4, skillNames: ["kuanggu"] },
  { name: "caocao", displayName: "Tào Tháo", kingdom: "wei", maxHp: 4, skillNames: ["jianxiong"] },
  { name: "zhouyu", displayName: "Chu Du", kingdom: "wu", maxHp: 3, skillNames: ["yingzi"] }, // Fanjian deferred, needs a suit-guessing UI ask
  { name: "ganning", displayName: "Cam Ninh", kingdom: "wu", maxHp: 4, skillNames: ["qixi"] },
  { name: "huangyueying", displayName: "Hoàng Nguyệt Anh", kingdom: "shu", maxHp: 3, skillNames: ["jizhi", "qicai"] },
  { name: "huangzhong", displayName: "Hoàng Trung", kingdom: "shu", maxHp: 4, skillNames: ["liegong"] }, // LiegongRange is Hegemony-lord-only
  { name: "liushan", displayName: "Lưu Thiện", kingdom: "shu", maxHp: 3, skillNames: ["xiangle"] }, // Fangquan deferred, needs phase-skip/extra-turn
  { name: "menghuo", displayName: "Mạnh Hoạch", kingdom: "shu", maxHp: 4, skillNames: ["savageAssaultAvoid", "huoshou"] },
  { name: "zhurong", displayName: "Chúc Dung", kingdom: "shu", maxHp: 4, skillNames: ["savageAssaultAvoid", "juxiang"] }, // Lieren deferred, needs pindian
  { name: "ganfuren", displayName: "Cam Phu Nhân", kingdom: "shu", maxHp: 3, skillNames: ["shushen", "shenzhi"] },
  { name: "zhangliao", displayName: "Trương Liêu", kingdom: "wei", maxHp: 4, skillNames: ["tuxi"] },
  { name: "xuchu", displayName: "Hứa Chử", kingdom: "wei", maxHp: 4, skillNames: ["luoyi"] },
  { name: "guojia", displayName: "Quách Gia", kingdom: "wei", maxHp: 3, skillNames: ["yiji"] }, // Tiandu deferred, needs judge-area
  { name: "dianwei", displayName: "Điển Vi", kingdom: "wei", maxHp: 4, skillNames: ["qiangxi"] },
  { name: "xunyu", displayName: "Tuân Úc", kingdom: "wei", maxHp: 3, skillNames: ["jieming"] }, // Quhu deferred, needs pindian
  { name: "caopi", displayName: "Tào Phi", kingdom: "wei", maxHp: 3, skillNames: ["xingshang"] }, // Fangzhu deferred, needs face-up/down state
  { name: "yuejin", displayName: "Nhạc Tiến", kingdom: "wei", maxHp: 4, skillNames: ["xiaoguo"] },
  { name: "lvmeng", displayName: "Lữ Mông", kingdom: "wu", maxHp: 4, skillNames: ["keji"] },
  { name: "daqiao", displayName: "Đại Kiều", kingdom: "wu", maxHp: 3, skillNames: ["liuli"] }, // Guose deferred, needs Indulgence/judge-area
  { name: "sunshangxiang", displayName: "Tôn Thượng Hương", kingdom: "wu", maxHp: 3, skillNames: ["xiaoji"] }, // Jieyin deferred, needs 2-card viewAs
  { name: "sunjian", displayName: "Tôn Kiên", kingdom: "wu", maxHp: 4, skillNames: ["yinghun"] },
  { name: "lusu", displayName: "Lỗ Túc", kingdom: "wu", maxHp: 3, skillNames: ["haoshi"] }, // Dimeng deferred, needs variable-count viewAs
  { name: "erzhang", displayName: "Trương Chiêu & Trương Hoành", kingdom: "wu", maxHp: 3, skillNames: ["guzheng"] }, // Zhijian deferred, needs equip-onto-another-player
  { name: "huatuo", displayName: "Hoa Đà", kingdom: "qun", maxHp: 3, skillNames: ["jijiu", "qingnang"] },
  { name: "lvbu", displayName: "Lữ Bố", kingdom: "qun", maxHp: 5, skillNames: ["wushuang"] },
  { name: "diaochan", displayName: "Điêu Thuyền", kingdom: "qun", maxHp: 3, skillNames: ["biyue"] }, // Lijian deferred, needs gender attribute
  { name: "yanliangwenchou", displayName: "Nhan Lương & Văn Xú", kingdom: "qun", maxHp: 4, skillNames: ["shuangxiong"] },
  { name: "jiaxu", displayName: "Giả Hủ", kingdom: "qun", maxHp: 3, skillNames: ["weimu"] }, // Wansha/Luanwu deferred, need ally-rescue-suppression/marks
  { name: "pangde", displayName: "Bàng Đức", kingdom: "qun", maxHp: 4, skillNames: ["mashu", "mengjin"] },
  { name: "zhangjiao", displayName: "Trương Giác", kingdom: "qun", maxHp: 3, skillNames: ["leiji"] }, // Guidao deferred, needs judge-area
  { name: "caiwenji", displayName: "Thái Văn Cơ", kingdom: "qun", maxHp: 3, skillNames: ["beige"] }, // Duanchang deferred, needs dual-general head/deputy
  { name: "mateng", displayName: "Mã Đằng", kingdom: "qun", maxHp: 4, skillNames: ["mashu"] }, // Xiongyi deferred, needs marks/limit-counters
  { name: "kongrong", displayName: "Khổng Dung", kingdom: "qun", maxHp: 3, skillNames: ["mingshi"] }, // Lirang deferred, needs a card-pile subsystem
  { name: "tianfeng", displayName: "Điền Phong", kingdom: "qun", maxHp: 3, skillNames: ["sijian", "suishi"] },
];
