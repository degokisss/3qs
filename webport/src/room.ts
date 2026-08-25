// Authoritative game-state container. Structurally mirrors src/server/room.cpp (Room) +
// src/server/gamerule.cpp (GameRule::onPhaseProceed) for the parts implemented so far:
// per-player phase cycling, draw-pile/discard-pile card flow, and death -> win-condition checks.
// Combat (Slash/Jink/Duel/...) and skills are wired in; delayed tricks/judge-area, armors, and
// several other subsystems are still out of scope -- see webport/README.md roadmap.

import { Card, CardKind, Suit, buildStandardDeck, shuffle } from "./card.js";
import { GamePlayer } from "./player.js";
import { Phase, PHASE_ORDER, Role } from "./types.js";
import { assignRoles, checkWinCondition, WinResult } from "./gamerule.js";
import {
  EngineContext,
  allDismantlementLikeCards,
  allDuelLikeCards,
  allSlashLikeCards,
  findDismantlementLikeCard,
  findDuelLikeCard,
  findSlashLikeCard,
  heal,
  resolveSlash,
} from "./combat.js";
import { GENERALS, GeneralDef, SKILLS } from "./skill.js";
import { Controller, FreeAction, makeBotController, slashCandidates } from "./controller.js";
import {
  dismantlementCandidates,
  duelCandidates,
  resolveAmazingGrace,
  resolveArcheryAttack,
  resolveDismantlement,
  resolveDuel,
  resolveExNihilo,
  resolveGodSalvation,
  resolvePeachSelfHeal,
  resolveSavageAssault,
  resolveSnatch,
  snatchCandidates,
} from "./trick.js";

export class Room {
  readonly players: GamePlayer[];
  drawPile: Card[];
  discardPile: Card[] = [];
  currentIndex = 0;
  turnNumber = 0;
  gameOver: WinResult = null;
  readonly log: string[] = [];
  private readonly rng: () => number;
  private readonly controllers = new Map<string, Controller>();
  private readonly takenGenerals = new Set<string>(); // general names already picked this game -- excluded from future candidate pools
  /** Non-null only while `pickGenerals()` is running: the player whose turn it currently is to
   *  pick a general. Exposed so server.ts can broadcast "whose turn" during selection. */
  pickTurnPlayerId: string | null = null;
  /** Fired right after an equip resolves (weapon/horse) -- see `setLiveUpdateCallback`. */
  private onLiveUpdate: (() => void) | null = null;

  constructor(playerIds: string[], rng: () => number = Math.random) {
    if (playerIds.length < 5 || playerIds.length > 10) {
      throw new Error("identity mode supports 5-10 players");
    }
    this.players = playerIds.map((id) => new GamePlayer(id));
    assignRoles(this.players, rng);
    this.players.forEach((p, i) => (p.seat = i + 1));

    this.rng = rng;
    // Generals are NOT assigned here any more -- see pickGenerals() below (Milestone 6: turn-based
    // selection from 3 candidates, starting with the lord). drawPile is still built now (doesn't
    // depend on any general); initial hands are dealt at the end of pickGenerals() once every
    // player's maxHp is finally known.
    this.drawPile = shuffle(buildStandardDeck(), rng);

    // Room::adjustSeats: turn order (both general-picking and Play-phase turns) starts with the lord.
    const lordIndex = this.players.findIndex((p) => p.role === Role.Lord);
    this.currentIndex = lordIndex;

    for (const player of this.players) this.controllers.set(player.id, makeBotController(rng));
  }

  /** Deals `count` distinct, not-yet-taken candidate generals (Milestone 6). Fewer than `count`
   *  only if the pool is nearly exhausted (44 generals / up to 10 players -- never actually hits
   *  this in practice, but degrades gracefully instead of throwing). */
  private candidateGenerals(count: number): GeneralDef[] {
    const remaining = GENERALS.filter((g) => !this.takenGenerals.has(g.name));
    const picks: GeneralDef[] = [];
    for (let i = 0; i < count && remaining.length > 0; i++) {
      const idx = Math.floor(this.rng() * remaining.length);
      picks.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
    return picks;
  }

  /**
   * Milestone 6: turn-based general selection. Starting with the lord and proceeding around the
   * table in seat order (the same order Play-phase turns use), each player is dealt 3 not-yet-taken
   * candidate generals and picks one via their Controller's `chooseGeneral` -- bots (the default
   * policy) pick immediately with no ask; a claimed human seat is asked over WebSocket
   * (server.ts's HumanController). `onStep`, if given, fires once before each ask (so the caller
   * can broadcast "whose turn now") and once after each assignment (so it can broadcast the
   * result), plus a final time once hands are dealt. MUST complete before `playTurn()` is ever
   * called -- see the guard there.
   */
  async pickGenerals(onStep?: () => void): Promise<void> {
    // Standard rule: the lord's identity is public knowledge once the match begins -- but not
    // before, while the room still sits in the lobby/waiting-room (see gamerule.ts assignRoles).
    const lord = this.players.find((p) => p.role === Role.Lord);
    if (lord) lord.roleShown = true;
    const n = this.players.length;
    for (let step = 0; step < n; step++) {
      const player = this.players[(this.currentIndex + step) % n];
      this.pickTurnPlayerId = player.id;
      onStep?.();
      const candidates = this.candidateGenerals(3);
      const chosen = (await this.controllers.get(player.id)!.chooseGeneral(candidates)) ?? candidates[0];
      this.takenGenerals.add(chosen.name);
      player.general = chosen.name;
      player.generalName = chosen.displayName;
      player.kingdom = chosen.kingdom;
      player.skills = chosen.skillNames.map((s) => SKILLS[s]);
      player.maxHp = chosen.maxHp;
      player.hp = chosen.maxHp;
      this.log.push(`${player.id} chooses ${chosen.displayName}`);
      onStep?.();
    }
    this.pickTurnPlayerId = null;
    for (const player of this.players) {
      player.hand = this.drawPile.splice(0, player.maxHp); // initial hand size == max hp
    }
    this.log.push(`Game start: ${this.players.map((p) => `${p.id}=${p.role}/${p.general}`).join(", ")}`);
    onStep?.();
  }

  /** Swaps in a custom decision-maker for one seat (e.g. a human over WebSocket). Only the given
   *  methods are overridden; anything omitted still falls back to the bot policy. `null` reverts
   *  the seat fully to bot. */
  setController(playerId: string, controller: Partial<Controller> | null): void {
    this.controllers.set(
      playerId,
      controller ? { ...makeBotController(this.rng), ...controller } : makeBotController(this.rng),
    );
  }

  private drawOne(): Card | null {
    if (this.drawPile.length === 0) {
      // Room::getCardFromPile -> swapPile(): reshuffle discard pile back into the draw pile.
      this.drawPile = shuffle(this.discardPile, this.rng);
      this.discardPile = [];
      if (this.drawPile.length === 0) return null; // both piles exhausted
    }
    return this.drawPile.pop()!;
  }

  private drawCards(player: GamePlayer, n: number): void {
    for (let i = 0; i < n; i++) {
      const c = this.drawOne();
      if (!c) return;
      player.hand.push(c);
    }
  }

  private async discardDownToLimit(player: GamePlayer): Promise<void> {
    if (player.skills.some((s) => s.skipsDiscardPhase?.(player))) {
      this.log.push(`${player.id} skips the discard phase (keji)`);
      return;
    }
    const over = player.handcardNum - player.maxCards;
    if (over <= 0) return;
    const chosen = await this.controllers.get(player.id)!.chooseDiscards(player, over);
    // Validate: exactly `over` DISTINCT cards actually still in hand right now -- covers a
    // misbehaving or timed-out controller by falling back to the original arbitrary-first-N
    // behavior instead of ever discarding the wrong count.
    const distinctHeld = [...new Set(chosen)].filter((c) => player.hand.includes(c));
    const discarded = distinctHeld.length === over ? distinctHeld : player.hand.slice(0, over);
    for (const c of discarded) player.hand.splice(player.hand.indexOf(c), 1);
    this.discardPile.push(...discarded);
    this.log.push(`${player.id} discards ${discarded.length} card(s) (hand limit ${player.maxCards})`);

    // Guzheng (Erzhang): every OTHER alive player may claim one of these discarded cards.
    for (const p of this.players.filter((p) => p.alive && p !== player)) {
      for (const skill of p.skills) {
        await skill.onOtherPlayerOverDiscard?.(this.makeContext(this.players.filter((p) => p.alive)), p, player, discarded, this.rng);
      }
    }
    this.onLiveUpdate?.();
  }

  /** Test/debug-only hook until a scripted-damage test needs the real hook pipeline: applies
   *  damage directly, bypassing EngineContext (no onDamage/onDamageDealt/reduceDamage triggers). */
  async damagePlayer(targetId: string, amount: number, sourceRole: Role | null): Promise<void> {
    const target = this.players.find((p) => p.id === targetId);
    if (!target || !target.alive) return;
    target.hp -= amount;
    this.log.push(`${target.id} takes ${amount} damage (hp ${target.hp}/${target.maxHp})`);
    if (target.hp <= 0) await this.killPlayer(target, sourceRole);
  }

  private async killPlayer(player: GamePlayer, killerRole: Role | null): Promise<void> {
    player.alive = false;
    player.roleShown = true; // Player death always reveals role (BuryVictim)

    // Xingshang (Caopi): claims the dead player's hand instead of it going to the discard pile.
    // Automatic (no ask) -- see skill.ts header for why several optional invokes are simplified.
    const claimant = this.players.find((p) => p.alive && p !== player && p.skills.some((s) => s.claimsDeathCards));
    if (claimant && player.hand.length > 0) {
      claimant.hand.push(...player.hand);
      this.log.push(`${claimant.id} claims ${player.id}'s hand (xingshang)`);
    } else {
      this.discardPile.push(...player.hand);
    }
    player.hand = [];
    this.log.push(`${player.id} (${player.role}) dies`);

    if (!this.gameOver) {
      const lordKilledBy = player.role === Role.Lord ? killerRole : null;
      const result = checkWinCondition(this.players, lordKilledBy);
      if (result) {
        this.gameOver = result;
        this.log.push(`Game over: ${result.winners.join("+")} win`);
      }
    }

    // Suishi (Tianfeng): every alive ally of the dead player loses 1 hp.
    const ctx = this.makeContext(this.players.filter((p) => p.alive));
    for (const p of ctx.alivePlayers) {
      for (const skill of p.skills) await skill.onAllyDeath?.(ctx, p, player, this.rng);
    }
  }

  /** Runs every skill.onDamaged hook `target` has (e.g. Ganglie) -- see skill.ts. */
  private async triggerOnDamaged(target: GamePlayer, source: GamePlayer): Promise<void> {
    for (const skill of target.skills) {
      if (target.alive) await skill.onDamaged?.(this.makeContext(this.players.filter((p) => p.alive)), target, source, this.rng);
    }
  }

  /** Runs every skill.onDamageDealt hook `source` has (e.g. Kuanggu) -- see skill.ts. */
  private async triggerOnDamageDealt(source: GamePlayer, target: GamePlayer, amount: number): Promise<void> {
    for (const skill of source.skills) {
      if (source.alive) await skill.onDamageDealt?.(this.makeContext(this.players.filter((p) => p.alive)), source, target, amount);
    }
  }

  /** Suishi (Tianfeng): every alive ally of a player who just started dying draws 1 card. */
  private async triggerOnAllyDying(dyingPlayer: GamePlayer): Promise<void> {
    const ctx = this.makeContext(this.players.filter((p) => p.alive));
    for (const p of ctx.alivePlayers.filter((p) => p !== dyingPlayer)) {
      for (const skill of p.skills) await skill.onAllyDying?.(ctx, p, dyingPlayer, this.rng);
    }
  }

  private makeContext(alive: GamePlayer[]): EngineContext {
    return {
      alivePlayers: alive,
      discardPile: this.discardPile,
      log: this.log,
      rng: this.rng,
      draw: (player, n) => this.drawCards(player, n),
      drawTop: () => this.drawOne(),
      onDying: (dyingPlayer, killerRole) => this.killPlayer(dyingPlayer, killerRole),
      onDyingStarted: (dyingPlayer) => this.triggerOnAllyDying(dyingPlayer),
      onDamage: (target, source) => this.triggerOnDamaged(target, source),
      onDamageDealt: (source, target, amount) => this.triggerOnDamageDealt(source, target, amount),
      askDodge: (player) => this.controllers.get(player.id)!.wantsToDodge(player),
      askPeach: (player) => this.controllers.get(player.id)!.wantsToUsePeach(player),
      askPeachForOther: (rescuer, dyingPlayer) => this.controllers.get(rescuer.id)!.wantsToUsePeachForOther(rescuer, dyingPlayer),
      askDuelSlash: (player) => this.controllers.get(player.id)!.wantsToPlaySlashInDuel(player),
      askGanglieDiscard: (player) => this.controllers.get(player.id)!.wantsToDiscardForGanglie(player),
      askUseSelfAction: (player, skillName) => this.controllers.get(player.id)!.wantsToUseSelfAction(player, skillName),
      askChooseAnyPlayer: (player, candidates) => this.controllers.get(player.id)!.chooseAnyPlayerTarget(player, candidates),
      askSavageAssaultSlash: (player) => this.controllers.get(player.id)!.wantsToDiscardForSavageAssault(player),
      askArcheryAttackJink: (player) => this.controllers.get(player.id)!.wantsToDiscardForArcheryAttack(player),
      askPickCard: (player, candidates) => this.controllers.get(player.id)!.choosePickCard(player, candidates),
    };
  }

  /** Registers a callback fired immediately after an equip resolves. Broadcast() otherwise only
   *  fires once per fully COMPLETED turn (scheduleLoop) -- without this, a newly-equipped
   *  weapon/horse (and its buffs: attack range, distance deltas) wouldn't show up for any client
   *  watching until the whole turn finished, even though the buff is already live server-side
   *  the instant `player.weapon`/`defenseHorse`/`offenseHorse` is set below. */
  setLiveUpdateCallback(cb: (() => void) | null): void {
    this.onLiveUpdate = cb;
  }

  private async equip(player: GamePlayer, equipCard: Card): Promise<void> {
    let replaced: Card | null = null;
    if (equipCard.kind === CardKind.Weapon) {
      replaced = player.weapon;
      player.weapon = equipCard;
    } else if (equipCard.horseDelta === 1) {
      replaced = player.defenseHorse;
      player.defenseHorse = equipCard;
    } else {
      replaced = player.offenseHorse;
      player.offenseHorse = equipCard;
    }
    this.log.push(`${player.id} equips ${equipCard.weaponName ?? equipCard.horseName}`);
    if (replaced) {
      this.discardPile.push(replaced);
      // Xiaoji (Sunshangxiang): draws 2 whenever an equip of hers leaves the equip zone.
      for (const skill of player.skills) {
        await skill.onEquipLost?.(this.makeContext(this.players.filter((p) => p.alive)), player);
      }
    }
    this.onLiveUpdate?.();
  }

  /** Sijian (Tianfeng): fires on `player`'s own skills right when a played card leaves their
   *  hand at 0 count. Checked after every hand-emptying splice site below. */
  private async checkHandEmptied(player: GamePlayer): Promise<void> {
    if (player.handcardNum !== 0) return;
    const ctx = this.makeContext(this.players.filter((p) => p.alive));
    for (const skill of player.skills) await skill.onHandEmptied?.(ctx, player, this.rng);
  }

  /**
   * Plays at most one held copy of `kind`. `selectTarget` is pure (no hand mutation) and picks
   * the target/validity; only if it succeeds do we splice the card out of the hand and push it
   * to the discard pile, THEN call `resolve`. This order matters: Duel's resolution can splice
   * further cards out of the ACTOR's own hand (the alternating Slash exchange), which would
   * invalidate a captured hand index if the played card were removed only afterward.
   */
  private async tryPlayOnce<T>(
    player: GamePlayer,
    kind: CardKind,
    selectTarget: (alive: GamePlayer[]) => T | null,
    resolve: (card: Card, target: T, alive: GamePlayer[]) => void | Promise<void>,
    explicitCard?: Card, // freeform play: card already chosen by the player -- skip auto-find + the wantsToPlayTrick ask
  ): Promise<void> {
    if (this.gameOver || !player.alive) return;
    const idx = explicitCard ? player.hand.indexOf(explicitCard) : player.hand.findIndex((c) => c.kind === kind);
    if (idx === -1) return;
    const alive = this.players.filter((p) => p.alive);
    const target = selectTarget(alive);
    if (target === null) return;
    if (!explicitCard && !(await this.controllers.get(player.id)!.wantsToPlayTrick(player, kind))) return;
    const [card] = player.hand.splice(idx, 1);
    this.discardPile.push(card);
    await this.checkHandEmptied(player);

    // Huoshou/Juxiang (Menghuo/Zhurong): another player may claim the played Savage Assault card
    // once it resolves, instead of it staying in the discard pile.
    if (kind === CardKind.SavageAssault) {
      const claimant = this.players.find(
        (p) => p.alive && p !== player && p.skills.some((s) => s.claimsUsedSavageAssaultCard?.(p)),
      );
      if (claimant) {
        const pileIdx = this.discardPile.indexOf(card);
        if (pileIdx !== -1) {
          this.discardPile.splice(pileIdx, 1);
          claimant.hand.push(card);
          this.log.push(`${claimant.id} takes the savage assault card (juxiang)`);
        }
      }
    }

    await resolve(card, target, alive);
    for (const skill of player.skills) await skill.onTrickPlayed?.(this.makeContext(alive), player, kind);
    this.onLiveUpdate?.();
  }

  /**
   * Like `tryPlayOnce`, but for the single-target tricks: the controller picks WHO from
   * `candidatesFor`'s legal list (or null to decline) instead of a plain yes/no gate.
   */
  private async tryPlayTargeted(
    player: GamePlayer,
    kind: CardKind,
    candidatesFor: (alive: GamePlayer[]) => GamePlayer[],
    resolve: (card: Card, target: GamePlayer, alive: GamePlayer[]) => void | Promise<void>,
    findCard: (player: GamePlayer) => Card | null = (p) => p.hand.find((c) => c.kind === kind) ?? null,
  ): Promise<void> {
    if (this.gameOver || !player.alive) return;
    const card = findCard(player);
    if (!card) return;
    const alive = this.players.filter((p) => p.alive);
    const candidates = candidatesFor(alive);
    if (candidates.length === 0) return;
    const target = await this.controllers.get(player.id)!.chooseTrickTarget(player, kind, candidates);
    if (!target) return;

    // Weimu (Jiaxu): immune to a black-suited trick card targeting them -- the card is still
    // spent (it was legally played), the target just fizzles.
    const blackTrickBlocked =
      (card.suit === Suit.Spade || card.suit === Suit.Club) && target.skills.some((s) => s.immuneToBlackTrick?.(target));

    player.hand.splice(player.hand.indexOf(card), 1);
    this.discardPile.push(card);
    if (card.kind !== kind) this.log.push(`${player.id} views a card as ${kind} (viewAs skill)`);
    await this.checkHandEmptied(player);

    if (blackTrickBlocked) {
      this.log.push(`${target.id} is immune to this ${kind} (weimu)`);
      for (const skill of player.skills) await skill.onTrickPlayed?.(this.makeContext(alive), player, kind);
      this.onLiveUpdate?.();
      return;
    }

    await resolve(card, target, alive);
    for (const skill of player.skills) await skill.onTrickPlayed?.(this.makeContext(alive), player, kind);
    this.onLiveUpdate?.();
  }

  private async tryPlaySlash(player: GamePlayer, explicitCard?: Card): Promise<boolean> {
    if (this.gameOver || !player.alive) return false;
    const slashCard = explicitCard ?? findSlashLikeCard(player);
    if (!slashCard) return false;
    const alive = this.players.filter((p) => p.alive);
    const candidates = slashCandidates(alive, player);
    if (candidates.length === 0) return false;
    const target = await this.controllers.get(player.id)!.chooseSlashTarget(player, candidates);
    if (!target) return false;
    if (slashCard.kind !== CardKind.Slash) this.log.push(`${player.id} views a card as slash (viewAs skill)`);
    player.hand.splice(player.hand.indexOf(slashCard), 1);
    await this.checkHandEmptied(player);
    await resolveSlash(this.makeContext(alive), player, target, slashCard);
    this.onLiveUpdate?.();
    return true;
  }

  private async runPlayPhase(player: GamePlayer): Promise<void> {
    const controller = this.controllers.get(player.id)!;
    if (controller.chooseFreeAction) {
      await this.runFreeformPlayPhase(player, controller as Controller & { chooseFreeAction: NonNullable<Controller["chooseFreeAction"]> });
      return;
    }

    // Equip pass: auto-equip every Weapon/Horse card held, if the controller wants to (free
    // action, no target, no limit -- the bot policy always wants to).
    for (let i = player.hand.length - 1; i >= 0; i--) {
      const c = player.hand[i];
      if (c.kind === CardKind.Weapon || c.kind === CardKind.Horse) {
        if (await controller.wantsToEquip(player, c)) {
          player.hand.splice(i, 1);
          await this.equip(player, c);
          await this.checkHandEmptied(player);
        }
      }
    }

    // Proactive Peach self-heal: real Sanguosha lets a player spend a held Peach on themselves
    // any time during their own turn while wounded. Gated by its own dedicated ask (bots decline
    // by default -- see controller.ts's wantsToUsePeachSelfHeal -- preserving the pre-existing
    // fixed-pass behavior of never proactively burning Peach/Analeptic outside a real dying
    // emergency); a claimed human seat gets the real choice via the freeform path below instead.
    for (let i = player.hand.length - 1; i >= 0 && player.alive && !this.gameOver; i--) {
      if (!player.isWounded()) break;
      const c = player.hand[i];
      if (c.kind !== CardKind.Peach) continue;
      if (!(await controller.wantsToUsePeachSelfHeal(player))) continue;
      player.hand.splice(i, 1);
      this.discardPile.push(c);
      await this.checkHandEmptied(player);
      await resolvePeachSelfHeal(this.makeContext(this.players.filter((p) => p.alive)), player);
      this.onLiveUpdate?.();
    }

    // Proactive self-action skills (e.g. Kurou, Dianwei's Qiangxi, Huatuo's Qingnang): once each
    // per Play phase, gated by wantsToUseSelfAction. Run before the other tricks so any cards
    // drawn (e.g. Kurou's) are available for the rest of the phase.
    for (const skill of player.skills) {
      if (!player.alive || this.gameOver) break;
      if (skill.selfAction) {
        if (await controller.wantsToUseSelfAction(player, skill.name)) {
          await skill.selfAction(this.makeContext(this.players.filter((p) => p.alive)), player, this.rng);
          this.onLiveUpdate?.();
        }
      } else if (skill.activeAction) {
        const alive = this.players.filter((p) => p.alive);
        const candidates = skill.activeAction.candidatesFor(alive, player);
        if (candidates.length === 0) continue;
        if (!(await controller.wantsToUseSelfAction(player, skill.name))) continue;
        const target = await controller.chooseAnyPlayerTarget(player, candidates);
        if (!target) continue;
        await skill.activeAction.run(this.makeContext(alive), player, target, this.rng);
        this.onLiveUpdate?.();
      }
    }

    await this.tryPlayOnce(
      player,
      CardKind.ExNihilo,
      (alive) => alive, // no target selection; always legal
      (_card, alive) => resolveExNihilo(this.makeContext(alive), player),
    );
    await this.tryPlayTargeted(
      player,
      CardKind.Dismantlement,
      (alive) => dismantlementCandidates(player, alive),
      (_card, target, alive) => resolveDismantlement(this.makeContext(alive), target, this.rng),
      (p) => findDismantlementLikeCard(p),
    );
    await this.tryPlayTargeted(
      player,
      CardKind.Snatch,
      (alive) => snatchCandidates(player, alive),
      (_card, target, alive) => resolveSnatch(this.makeContext(alive), player, target, this.rng),
    );
    await this.tryPlayTargeted(
      player,
      CardKind.Duel,
      (alive) => duelCandidates(player, alive),
      (_card, target, alive) => resolveDuel(this.makeContext(alive), player, target),
      (p) => findDuelLikeCard(p),
    );
    await this.tryPlayOnce(
      player,
      CardKind.SavageAssault,
      (alive) => alive,
      (_card, alive) => resolveSavageAssault(this.makeContext(alive), player),
    );
    await this.tryPlayOnce(
      player,
      CardKind.ArcheryAttack,
      (alive) => alive,
      (_card, alive) => resolveArcheryAttack(this.makeContext(alive), player),
    );
    await this.tryPlayOnce(
      player,
      CardKind.GodSalvation,
      (alive) => (alive.some((p) => p.isWounded()) ? alive : null), // don't waste it with nobody hurt
      (_card, alive) => resolveGodSalvation(this.makeContext(alive)),
    );
    await this.tryPlayOnce(
      player,
      CardKind.AmazingGrace,
      (alive) => alive,
      (_card, alive) => resolveAmazingGrace(this.makeContext(alive), player),
    );

    // Slash limit: 1 by default, raised by e.g. Paoxiao (skill.ts).
    let slashesAllowed = 1;
    for (const skill of player.skills) {
      if (skill.slashLimit) slashesAllowed = Math.max(slashesAllowed, skill.slashLimit(player));
    }
    while (slashesAllowed > 0 && player.alive && !this.gameOver) {
      if (!(await this.tryPlaySlash(player))) break;
      slashesAllowed--;
    }
  }

  /**
   * Every currently-legal thing `player` could do right now in a freeform Play phase: every
   * Weapon/Horse card (equip), every playable trick/Slash card (grouped by what it resolves AS,
   * viewAs-aware, gated on having a legal target where one is required), and every not-yet-used
   * self/active-action skill this turn. Unlike the fixed automatic pass, a held kind with
   * multiple copies (e.g. 2 Ex Nihilo) offers each copy as its own action -- real Sanguosha has
   * no "once per kind per turn" cap, only Slash's explicit limit.
   */
  private computeLegalActions(player: GamePlayer, slashesRemaining: number, usedSkillsThisTurn: Set<string>): FreeAction[] {
    const alive = this.players.filter((p) => p.alive);
    const actions: FreeAction[] = [];

    for (const c of player.hand) {
      if (c.kind === CardKind.Weapon || c.kind === CardKind.Horse) actions.push({ kind: "equip", cardId: c.id });
    }

    const addPlayCard = (cards: Card[], cardKind: CardKind) => {
      for (const c of cards) actions.push({ kind: "playCard", cardId: c.id, cardKind });
    };

    if (slashesRemaining > 0 && slashCandidates(alive, player).length > 0) {
      addPlayCard(allSlashLikeCards(player), CardKind.Slash);
    }
    if (dismantlementCandidates(player, alive).length > 0) {
      addPlayCard(allDismantlementLikeCards(player), CardKind.Dismantlement);
    }
    if (snatchCandidates(player, alive).length > 0) {
      addPlayCard(player.hand.filter((c) => c.kind === CardKind.Snatch), CardKind.Snatch);
    }
    if (duelCandidates(player, alive).length > 0) {
      addPlayCard(allDuelLikeCards(player), CardKind.Duel);
    }
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.ExNihilo), CardKind.ExNihilo);
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.SavageAssault), CardKind.SavageAssault);
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.ArcheryAttack), CardKind.ArcheryAttack);
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.GodSalvation), CardKind.GodSalvation);
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.AmazingGrace), CardKind.AmazingGrace);
    if (player.isWounded()) {
      addPlayCard(player.hand.filter((c) => c.kind === CardKind.Peach), CardKind.Peach);
    }

    for (const skill of player.skills) {
      if (usedSkillsThisTurn.has(skill.name)) continue;
      if (skill.selfAction) {
        actions.push({ kind: "selfAction", skillName: skill.name });
      } else if (skill.activeAction && skill.activeAction.candidatesFor(alive, player).length > 0) {
        actions.push({ kind: "activeAction", skillName: skill.name });
      }
    }

    return actions;
  }

  /** Milestone 5: hands `player`'s ENTIRE Play phase to an interactive loop -- present every
   *  legal action, wait for the player to pick one (or decline to end the phase), resolve it,
   *  and repeat. Only reachable when `controller.chooseFreeAction` is defined (human seats). */
  private async runFreeformPlayPhase(
    player: GamePlayer,
    controller: Controller & { chooseFreeAction: NonNullable<Controller["chooseFreeAction"]> },
  ): Promise<void> {
    let slashesAllowed = 1;
    for (const skill of player.skills) {
      if (skill.slashLimit) slashesAllowed = Math.max(slashesAllowed, skill.slashLimit(player));
    }
    let slashesUsed = 0;
    const usedSkillsThisTurn = new Set<string>();

    while (player.alive && !this.gameOver) {
      const legalActions = this.computeLegalActions(player, slashesAllowed - slashesUsed, usedSkillsThisTurn);
      const chosen = await controller.chooseFreeAction(player, legalActions);
      if (!chosen) return; // player ended their Play phase
      if (chosen.kind === "selfAction" || chosen.kind === "activeAction") usedSkillsThisTurn.add(chosen.skillName);
      if (chosen.kind === "playCard" && chosen.cardKind === CardKind.Slash) {
        if (await this.resolveFreeAction(player, chosen)) slashesUsed++;
      } else {
        await this.resolveFreeAction(player, chosen);
      }
    }
  }

  /** Resolves one `FreeAction` chosen via `chooseFreeAction`, reusing the exact same
   *  card-resolution helpers (`tryPlayOnce`/`tryPlayTargeted`/`tryPlaySlash`/`equip`) the fixed
   *  automatic pass uses -- same Weimu/hand-emptied/onTrickPlayed handling either way. Returns
   *  true if a Slash actually resolved (so the caller can decrement its per-turn count). */
  private async resolveFreeAction(player: GamePlayer, action: FreeAction): Promise<boolean> {
    if (action.kind === "equip") {
      const card = player.hand.find((c) => c.id === action.cardId);
      if (!card) return false;
      player.hand.splice(player.hand.indexOf(card), 1);
      await this.equip(player, card);
      await this.checkHandEmptied(player);
      return false;
    }
    if (action.kind === "selfAction") {
      const skill = player.skills.find((s) => s.name === action.skillName);
      if (!skill?.selfAction) return false;
      await skill.selfAction(this.makeContext(this.players.filter((p) => p.alive)), player, this.rng);
      this.onLiveUpdate?.();
      return false;
    }
    if (action.kind === "activeAction") {
      const skill = player.skills.find((s) => s.name === action.skillName);
      if (!skill?.activeAction) return false;
      const alive = this.players.filter((p) => p.alive);
      const candidates = skill.activeAction.candidatesFor(alive, player);
      if (candidates.length === 0) return false;
      const target = await this.controllers.get(player.id)!.chooseAnyPlayerTarget(player, candidates);
      if (!target) return false;
      await skill.activeAction.run(this.makeContext(alive), player, target, this.rng);
      this.onLiveUpdate?.();
      return false;
    }

    // action.kind === "playCard"
    const card = player.hand.find((c) => c.id === action.cardId);
    if (!card) return false;
    switch (action.cardKind) {
      case CardKind.Slash:
        return this.tryPlaySlash(player, card);
      case CardKind.Dismantlement:
        await this.tryPlayTargeted(
          player,
          CardKind.Dismantlement,
          (alive) => dismantlementCandidates(player, alive),
          (_card, target, alive) => resolveDismantlement(this.makeContext(alive), target, this.rng),
          () => card,
        );
        return false;
      case CardKind.Snatch:
        await this.tryPlayTargeted(
          player,
          CardKind.Snatch,
          (alive) => snatchCandidates(player, alive),
          (_card, target, alive) => resolveSnatch(this.makeContext(alive), player, target, this.rng),
          () => card,
        );
        return false;
      case CardKind.Duel:
        await this.tryPlayTargeted(
          player,
          CardKind.Duel,
          (alive) => duelCandidates(player, alive),
          (_card, target, alive) => resolveDuel(this.makeContext(alive), player, target),
          () => card,
        );
        return false;
      case CardKind.ExNihilo:
        await this.tryPlayOnce(player, CardKind.ExNihilo, (alive) => alive, (_c, alive) => resolveExNihilo(this.makeContext(alive), player), card);
        return false;
      case CardKind.SavageAssault:
        await this.tryPlayOnce(
          player,
          CardKind.SavageAssault,
          (alive) => alive,
          (_c, alive) => resolveSavageAssault(this.makeContext(alive), player),
          card,
        );
        return false;
      case CardKind.ArcheryAttack:
        await this.tryPlayOnce(
          player,
          CardKind.ArcheryAttack,
          (alive) => alive,
          (_c, alive) => resolveArcheryAttack(this.makeContext(alive), player),
          card,
        );
        return false;
      case CardKind.GodSalvation:
        // No "someone must be wounded" gate here (unlike the bot pass) -- a human choosing to
        // play it is their own prerogative, even if it heals nobody.
        await this.tryPlayOnce(player, CardKind.GodSalvation, (alive) => alive, (_c, alive) => resolveGodSalvation(this.makeContext(alive)), card);
        return false;
      case CardKind.AmazingGrace:
        await this.tryPlayOnce(
          player,
          CardKind.AmazingGrace,
          (alive) => alive,
          (_c, alive) => resolveAmazingGrace(this.makeContext(alive), player),
          card,
        );
        return false;
      case CardKind.Peach:
        player.hand.splice(player.hand.indexOf(card), 1);
        this.discardPile.push(card);
        await this.checkHandEmptied(player);
        await resolvePeachSelfHeal(this.makeContext(this.players.filter((p) => p.alive)), player);
        this.onLiveUpdate?.();
        return false;
      default:
        return false;
    }
  }

  /** Runs `player`'s own `otherPhaseAction` skills whose `phase` matches, gated by
   *  wantsToUseSelfAction (e.g. Ganfuren's Shenzhi at Start, Zhangliao's Tuxi at Draw). Runs
   *  BEFORE the phase's own default handling, so a hook can mutate state (e.g. Luoyi arming a
   *  reduced Draw-phase count) that the default handling then reads. */
  private async runOtherPhaseActions(player: GamePlayer, phase: Phase): Promise<void> {
    for (const skill of player.skills) {
      if (skill.otherPhaseAction?.phase !== phase || !player.alive || this.gameOver) continue;
      await skill.otherPhaseAction.run(this.makeContext(this.players.filter((p) => p.alive)), player, this.rng);
    }
  }

  /** Xiaoguo (Yuejin): fires on every OTHER alive player's matching skill at `player`'s own
   *  Finish phase. */
  private async runOtherPlayerFinishReactions(player: GamePlayer): Promise<void> {
    const ctx = this.makeContext(this.players.filter((p) => p.alive));
    for (const other of ctx.alivePlayers.filter((p) => p !== player)) {
      for (const skill of other.skills) await skill.otherPlayerFinishReaction?.(ctx, other, player, this.rng);
    }
  }

  private async runPhase(player: GamePlayer, phase: Phase): Promise<void> {
    player.phase = phase;
    await this.runOtherPhaseActions(player, phase);
    switch (phase) {
      case Phase.RoundStart:
      case Phase.Judge: // judging-area resolution deferred until delayed tricks are ported
        break;
      case Phase.Start:
        break;
      case Phase.Draw: {
        // Draw phase card count: 2 by default, raised/lowered by e.g. Yingzi/Luoyi (skill.ts).
        const drawBonus = player.skills.reduce((sum, skill) => sum + (skill.drawPhaseBonus?.(player) ?? 0), 0);
        const drawCount = Math.max(0, 2 + drawBonus);
        await this.controllers.get(player.id)!.wantsToDrawNow(player, drawCount);
        this.drawCards(player, drawCount);
        if (drawBonus !== 0) this.log.push(`${player.id} draws ${2 + drawBonus} card(s) this phase (${drawBonus > 0 ? "yingzi" : "luoyi"})`);
        this.onLiveUpdate?.(); // the human seat's own draw-pile click is otherwise invisible to
        // spectators/other seats until the whole turn finishes -- broadcast the hand right away
        for (const skill of player.skills) {
          await skill.afterDrawPhase?.(this.makeContext(this.players.filter((p) => p.alive)), player, this.rng);
        }
        break;
      }
      case Phase.Play:
        await this.runPlayPhase(player);
        break;
      case Phase.Discard:
        await this.discardDownToLimit(player);
        break;
      case Phase.Finish:
        await this.runOtherPlayerFinishReactions(player);
        break;
      case Phase.NotActive:
        break;
    }
  }

  /** Runs one full player turn (RoundStart..Finish) unless the game already ended mid-turn. */
  async playTurn(): Promise<void> {
    if (this.players.some((p) => !p.general)) {
      throw new Error("Room.pickGenerals() must complete (every player must have a general) before playTurn() runs");
    }
    const player = this.players[this.currentIndex];
    if (!player.alive) {
      this.advanceToNextAlivePlayer();
      return;
    }
    this.turnNumber++;
    this.log.push(`--- Turn ${this.turnNumber}: ${player.id} (${player.role}) ---`);
    player.playedSlashThisTurn = false;
    player.luoyiArmedThisTurn = false;
    player.duelViewAsBlackAllowed = null;
    for (const phase of PHASE_ORDER) {
      if (this.gameOver) return;
      await this.runPhase(player, phase);
    }
    player.phase = Phase.NotActive;
    this.advanceToNextAlivePlayer();
  }

  private advanceToNextAlivePlayer(): void {
    const n = this.players.length;
    for (let step = 1; step <= n; step++) {
      const next = (this.currentIndex + step) % n;
      if (this.players[next].alive) {
        this.currentIndex = next;
        return;
      }
    }
  }

  /** Drives turns until a win condition fires or maxTurns is hit (safety valve for tests). */
  async runUntilGameOver(maxTurns: number): Promise<WinResult> {
    while (!this.gameOver && this.turnNumber < maxTurns) {
      await this.playTurn();
    }
    return this.gameOver;
  }
}
