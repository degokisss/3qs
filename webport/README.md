# QSanguosha web port — status

Source of truth for porting: `github.com/Mogara/QSanguosha-For-Hegemony` (`dev` branch, C++/Qt,
GPLv3 + MCFR no-commercial code license; art assets in the parent repo are CC BY-NC-ND 4.0 —
non-commercial, no derivatives, self-host only).

## Milestone 0 — DONE (turn state machine + Role mode)

Core turn state machine + Role mode (Chủ công/Trung thần/Phản tặc/Nội gián), no cards/skills yet.

## Milestone 1 — DONE (basic-card combat + equip + core trick cards)

Real Slash/Jink/Peach/Analeptic + 8 trick cards + weapon/horse equip, replacing the placeholder deck.

- `src/types.ts` — `Phase`/`Place`/`Role` enums, ported 1:1 from `src/core/player.h` and
  `src/core/structs.h` names for later cross-checking against the C++ source.
- `src/gamerule.ts` — role-count table + win-condition check. **Not** ported from
  `engine.cpp::getRoles` (that table is degenerate in the public `dev` branch: 1 lord +
  (n-1) renegade, no loyalist/rebel). Uses the officially published Sanguosha role-mode table
  instead (sanguosha.cn `mode-info-1`).
- `src/room.ts` — per-player phase loop (RoundStart→Start→Judge→Draw→Play→Discard→Finish),
  draw/discard-pile flow with reshuffle, auto-equip pass (Weapon/Horse cards equip on hold,
  replacing the previous one into the discard pile), one attempt per held trick kind per turn,
  up to 1 Slash per turn (`Player::getSlashCount()` default), death → win-condition check.
  Mirrors `GameRule::onPhaseProceed` (`src/server/gamerule.cpp`).
- `src/card.ts` — card list + exact per-card suit/point ported 1:1 from this project's actual
  source (`standard-basics.cpp` basicCards(), `standard-tricks.cpp` trickCards(),
  `standard-equips.cpp` equipCards()), not the physical board game's box contents. Deck dealt =
  85 cards: 54 basics (Slash-family 29 incl. Fire/Thunder, Jink 14, Peach 8, Analeptic 3) +
  15 implemented trick cards + 16 equip cards (10 weapons + 6 horses).
- `src/combat.ts` — Slash → Jink resolution, dying → Peach self-rescue, horse-adjusted seat
  distance + weapon-based attack range (`Player::distanceTo`/`getAttackRange`). Naive
  random-target bot policy (no ally/enemy inference -- real alignment-aware AI is
  `lua/ai/*.lua` upstream, deferred).
- `src/trick.ts` — resolves AmazingGrace/GodSalvation/SavageAssault/ArcheryAttack/Duel/
  ExNihilo/Snatch/Dismantlement. **Explicitly excluded** (need the delayed-trick/judge-area
  system or a reactive Nullification counter-play stack, neither built yet): IronChain,
  FireAttack, Collateral, Nullification, HegNullification, AwaitExhausted, KnownBoth,
  BefriendAttacking, Indulgence, SupplyShortage, Lightning. All 4 Standard armors
  (EightDiagram/RenwangShield/Vine/SilverLion) are excluded too (need the trigger/skill system).

- `src/simulate.ts` — smoke tests (`npm run sim`): role distribution, card-conservation
  (now covers equip slots too), scripted win-condition checks, an **emergent** end-to-end game
  (no scripted damage) that reaches a real win via Slash/Jink/Peach + the bot policy alone, and
  a coverage test confirming every implemented equip/trick effect actually fires through real
  play (scans logs across 40 seeds for each kind's marker). All passing.

## Milestone 1.6 — folded into Milestone 2.6 (see below)

- The 11 excluded trick cards + 4 armors above (needs delayed-trick/judge-area system +
  reactive counter-play stack for Nullification).
- Weapon/armor *active abilities* (Crossbow multi-slash, Qinggang armor-ignore, Axe force-hit,
  EightDiagram judgment-dodge, ...) -- currently only numeric range/distance is modeled; these
  need the same event-bus work as scaling past 3 generals (Milestone 2.6), so folded in there.

## Milestone 2 — DONE (3 generals, typed skill hooks)

3 of the 27 Standard generals ported, with a small typed hook system (not yet a generic
events<<.../triggerable/cost/effect trigger bus like `src/core/skill.h`'s `TriggerSkill` -- see
`src/skill.ts` header for why that's deferred).

- `src/skill.ts` — `Skill` interface (`slashLimit`, `canViewAsSlash`, `onDamaged` hooks) +
  3 generals ported from `standard-{shu,wei}-generals.cpp`, Hegemony-only branches (dual-general
  "shouyue" gating) stripped: **Paoxiao** (Zhang Fei, shu, 4hp: no Slash-per-turn cap),
  **Wusheng** (Guan Yu, shu, 5hp: any red hand card playable as Slash), **Ganglie** (Xiahou Dun,
  wei, 4hp: on taking damage, judge a card; if not Heart, the damage source discards 2 or takes
  1 -- source's refusal-to-discard branch simplified to "discard if it has >=2 cards, else take
  damage", since refusal needs alignment-aware AI this milestone doesn't have).
- `src/room.ts` — generals sampled with replacement per player (maxHp/initial hand size now vary
  4/5 by general instead of a flat 4), `triggerOnDamaged` hook wired through `combat.ts`'s
  `applyDamage`, Slash-limit and Slash-like-card search now skill-aware.
- **Bug found and fixed by this milestone's own tests**: `tryPlayOnce` captured a played card's
  hand index before running its effect; Duel's alternating-Slash resolution can splice further
  cards out of the *actor's own* hand mid-resolution (when the actor is pulled in as the
  responder), which shifted indices and caused the played Duel card to be discarded AND left in
  hand (a real duplicate `Card` object reference, caught by `testPhaseCyclingConservesCards`'
  conservation check going 87 != 85). Fixed by having `tryPlayOnce` select the target/validity
  first (pure, no mutation), then splice+discard the played card, then run the effect.
- `src/simulate.ts` — `testGeneralSkillsAppearInPlay`: confirms all 3 generals get assigned and
  each skill's effect fires through real play (multi-slash turn, a non-Slash card resolved as
  Slash, the Ganglie judge log, and its discard-2 branch) across 60 seeds. All 7 tests passing.

## Milestone 2.6 — DONE (44 of 46 investigated Standard generals ported)

14 of 27 Standard generals now ported (up from 3). `skill.ts`'s typed hook system grew to 8
hook points instead of graduating to a full event bus yet -- still cheaper than the generic
bus for the shapes needed so far, see `skill.ts`'s header for why.

- `src/skill.ts` -- `Skill` interface gained `canViewAsJink`, `immuneToSlashAndDuel`, and
  `onSlashTargeted` (fired per attacker skill right after a Slash targets someone, before the
  Jink check -- returning true blocks that Jink outright). 4 more generals ported from
  `standard-{shu,wei}-generals.cpp`: **Longdan** (Zhao Yun, shu, 4hp: a held Slash can be
  played/discarded as Jink and vice versa), **Qingguo** (Zhen Ji, wei, 3hp: a held black card
  can be played/discarded as Jink), **Kongcheng** (Zhuge Liang, shu, 3hp: immune to being
  targeted by Slash/Duel while holding no cards -- simplified from the real optional
  `askForSkillInvoke` to automatic, see `skill.ts`'s header), **Tieqi** (Ma Chao, shu, 4hp: on
  Slash-targeting, judge a card; if red, that Slash can't be dodged -- same optional-to-automatic
  simplification as Kongcheng). lang/vi_VN's `:kongcheng`/`:longdan`/`:tieqi` entries describe a
  different (likely newer) skill revision than what this repo's `dev`-branch C++ actually
  implements for all 3 -- not ported; official skill *names* were kept, descriptions were
  written to match the real ported behavior instead (see `skill.ts` header for specifics).
  Guanxing (Zhuge Liang's 2nd skill, needs card-reorder UI) and Mashu (Ma Chao's 2nd skill, a
  horse-distance modifier) deferred.
- `src/combat.ts` -- `findSlashLikeCard`/new `isImmuneToSlashAndDuel` exported (were/are also
  used by `room.ts`'s own-turn Slash search and `controller.ts`/`trick.ts`'s candidate lists);
  new `findJinkLikeCard` (dodge-side counterpart, viewAs-aware); `resolveSlash` now runs each
  attacker skill's `onSlashTargeted` before the Jink search.
- `src/controller.ts`/`src/trick.ts` -- `slashCandidates`/`duelCandidates` now filter out
  `isImmuneToSlashAndDuel` targets (Kongcheng). `trick.ts`'s `resolveDuel` now sources its
  Slash search through `findSlashLikeCard` (viewAs-aware, e.g. Longdan) instead of a raw
  `CardKind.Slash` check, so Duel's forced exchange respects the same viewAs skills as a normal
  turn.
- `src/simulate.ts` -- `testGeneralSkillsAppearInPlay` expanded to all 7 generals plus Tieqi's
  judge/block markers over 60 seeds; 3 new pure/deterministic tests since Kongcheng's
  hand-empty-dependent filter and Tieqi's judge-draw-dependent block are too rare to reliably
  log-mine: `testKongchengImmunity` (direct `slashCandidates`/`duelCandidates` check),
  `testTieqiBlocksDodge` and `testViewAsJinkDodges` (both drive `resolveSlash` directly with a
  hand-built `EngineContext`, no `Room` needed).

**4 more generals, 3 more hook types.** `skill.ts` gained `immuneToSnatch`, `onDamageDealt`, and
`selfAction`; `combat.ts` gained `loseHp` (a self-inflicted hp loss distinct from damage -- no
`onDamage`/`onDamageDealt` skill trigger, but still runs the dying/Peach-rescue check, crediting
no side: `killerRole` is now `Role | null` everywhere it flows). 4 more generals ported from
`standard-{shu,wei,wu}-generals.cpp`:
- **Fankui** (Sima Yi, wei, 3hp): `onDamaged`, take 1 random card off the damage source's hand
  (matches lang/vi_VN's `:fankui` exactly, unlike the 3 mismatches above). Equip-card stealing
  ("he" in the real rule) not modeled, same hand-only simplification Snatch/Dismantlement use.
- **Kurou** (Huang Gai, wu, 4hp): new `selfAction` hook -- once per Play phase, may lose 1 hp
  then draw 2 cards (`Controller.wantsToUseSelfAction`, gated ahead of the other tricks so any
  cards it draws are available for the rest of the phase). Can kill at 1 hp; that death credits
  no side via the new `loseHp`. lang/vi_VN's `:kurou` describes a richer revision (discard a
  card first, draw 3 not 2, +1 Slash limit) not in this repo's `dev`-branch `KurouCard` -- not
  ported, same newer-revision mismatch pattern as Longdan/Kongcheng/Tieqi.
- **Qianxun** (Lu Xun, wu, 3hp): new `immuneToSnatch` hook, wired into `snatchCandidates`
  (`trick.ts`) the same way Kongcheng gates `slashCandidates`/`duelCandidates`. Only the
  Snatch-immunity half of the real skill is ported; the other half (discard Indulgence on
  entering his judge area) needs the delayed-trick/judge-area system, still out of scope.
- **Kuanggu** (Wei Yan, shu, 4hp): new `onDamageDealt` hook (source-side counterpart to
  `onDamaged`, fired from `applyDamage` for the ATTACKER's skills) -- after dealing damage to a
  target within distance 1 while wounded, automatically recovers 1 hp per point of damage dealt
  (capped at maxHp). lang/vi_VN's `:kuanggu` describes a per-point CHOICE between recovering or
  drawing a card; this repo's `dev`-branch `Kuanggu::effect` only implements the recover branch
  -- ported as-is, same newer-revision mismatch pattern as above.
- `src/server.ts`/`public/index.html` -- new `confirmSelfAction` Yes/No message type for Kurou
  (`{type, actorId, skillName, skillDisplayName, skillDescription}` out, same `askClient()`
  plumbing, defaults to `true` on timeout like the other resource-choice asks), rendered via the
  existing `showConfirm()` using the acting player's own general avatar as the icon (client now
  tracks the latest state snapshot in `lastState` to look up that avatar).
- `src/simulate.ts` -- `testGeneralSkillsAppearInPlay` expanded to 11 generals plus Fankui/Kurou/
  Kuanggu log markers; `testQianxunImmunity` (parallel to `testKongchengImmunity`, direct
  `snatchCandidates` check); `testKurouSelfInflictedDeathCreditsNoKiller` (drives `loseHp`
  directly, proving a self-inflicted death credits no side).
- **Verification:** unit/integration tests above (18/18 passing); a live `ws` client observed a
  real `confirmSelfAction` request with the exact expected shape and successfully answered it
  end-to-end without stalling the server; a second live `ws` client confirmed all 11 generals
  are actually sampled by the running server. Browser screenshot confirmed avatar + skill-panel
  rendering for 4 of the newly ported generals (Long Đảm/Cương Liệt/Khuynh Quốc/Võ Thánh) with no
  layout breakage.
- **Remaining for this milestone:** the other 13 Standard generals, plus Guanxing/Mashu/Duoshi/
  Guicai/Fanjian above. Graduating `skill.ts` to a full event bus is still deferred until a
  general actually needs a hook shape these 14 don't (proactive skills needing target-picking
  UI, skills that modify other players' cards/targets, cross-player pre-damage target choices
  like Jieming/Fangzhu, delayed-trick/judge-area-dependent skills like Guicai/Qianxun's
  Indulgence half, etc.) -- see Milestone 1.6's note for the same boundary on tricks/armors/
  weapon-active-abilities.
- 18 tests total, all passing.

**3 more generals, 2 more hook types.** `skill.ts` gained `canViewAsDismantlement` and
`drawPhaseBonus`; `combat.ts` gained `findDismantlementLikeCard` (viewAs-aware, parallel to
`findSlashLikeCard`); `room.ts`'s `tryPlayTargeted` now takes an optional `findCard` override
(defaults to the old raw-`CardKind` search) so Dismantlement can search viewAs-aware without
touching Snatch/Duel's call sites. 3 more generals ported from
`standard-{wei,wu}-generals.cpp`:
- **Jianxiong** (Cao Cao, wei, 4hp): `onDamaged`, obtain the card that dealt the damage (matches
  lang/vi_VN's `:jianxiong` exactly, unlike several mismatches above). This repo's `onDamage`
  hook doesn't thread the specific damage-dealing card through, so it's approximated as "take
  the top of the discard pile" -- correct in practice, since Slash/Duel/AOE resolution always
  pushes its card there immediately before `applyDamage` runs.
- **Yingzi** (Zhou Yu, wu, 3hp): new `drawPhaseBonus` hook, wired into `room.ts`'s Draw-phase
  card count (default 2, +1 here) -- simplified from the real optional `askForSkillInvoke` to
  automatic, same reasoning as Kongcheng/Tieqi. Zhou Yu's other skill, Fanjian (give a card,
  target guesses its suit), needs a new suit-guessing ask type -- deferred.
- **Qixi** (Gan Ning, wu, 4hp): new `canViewAsDismantlement` hook -- any held black card can be
  played/discarded as Dismantlement (matches lang/vi_VN's `:qixi` exactly). Dismantlement
  already has no distance restriction in this engine, so Qixi's real "ignores distance" clause
  needed no separate modeling.
- `src/simulate.ts` -- `testGeneralSkillsAppearInPlay` expanded to 14 generals plus
  Jianxiong/Yingzi/Qixi log markers over the same 60 seeds.
- **Verification:** typecheck clean; 18/18 tests passing (marker count grew, test count didn't --
  no new hand/distance-dependent filter needing a dedicated deterministic test this round).
- **Remaining for this milestone:** the other 13 Standard generals, plus Guanxing/Mashu/Duoshi/
  Guicai/Fanjian above (same list as before this batch).
- 18 tests total, all passing.

**Final batch — 30 more generals (14→44), Milestone 2.6 DONE.** A read-only classification pass
(`grep`/read every remaining Standard general's skill class across `standard-{shu,wei,wu,qun}.cpp`
against this repo's typed hook system) sorted the other 32 assigned generals into 31 PORTABLE
(at least one skill portable via a small new hook) and 15 BLOCKED (every skill needs a genuine
new subsystem: judge-area/delayed-tricks, armor, gender, face-up/down state, marks/limit-counters,
multi-card viewAs, pindian card-compare, dual-general head/deputy show/hide, equip-stealing, or
multi-target/turn-order/phase-skip mechanics). **One correction found while porting:** the initial
pass classified Dingfeng's Duanbing as `PORTABLE_EXISTING` (assumed "Slash within distance 1
can't be dodged", same shape as Tieqi); re-reading its actual `dev`-branch source (`wu.cpp`) shows
`Duanbing::triggerable()` is an empty no-op with a `// Slash::targetFilter()` comment, and
lang/vi_VN's official text confirms the real effect is "after targeting with Slash, may designate
1 more target within distance 1" — a genuine multi-target-Slash extension, needing the same
not-yet-built multi-target Slash resolution as Xiahouyuan's Shensu. **Dingfeng is correctly left
unported**, making the final tally 30 portable + 16 blocked of the 46 investigated generals.
`skill.ts` gained ~20 more hook points (`onIncomingSlash`, `responseCountRequired`,
`onSlashDodged`, `bonusDamage`, `reduceDamage`, `immuneToSavageAssault`, `hijackAoeSource`,
`retainsCardAfterPlay`, `ignoresTrickDistanceLimit`, `onTrickPlayed`, `otherPhaseAction`,
`skipsDiscardPhase`, `onEquipLost`, `onOtherPlayerOverDiscard`, `activeAction`,
`canViewAsPeach`, `canViewAsDuel`, `onHandEmptied`, `onAllyDying`/`onAllyDeath`, `onRecover`,
`onDeathClaimCards`, `otherPlayerFinishReaction`, `immuneToBlackTrick`, `attackDistanceDelta`),
a generic `chooseAnyPlayerTarget` Controller ask, and an ally-concept helper (`gamerule.ts`'s
`alliesOf`, same role/kingdom check `Skill`'s ally-scoped hooks and `Controller`'s ally-filtered
asks share). 30 generals ported across all 4 kingdoms:
- **Shu (6):** Huangyueying (Jizhi/Qicai), Huangzhong (Liegong), Liushan (Xiangle), Menghuo
  (SavageAssaultAvoid/Huoshou), Zhurong (SavageAssaultAvoid/Juxiang), Ganfuren (Shushen/Shenzhi).
- **Wei (7):** Zhangliao (Tuxi), Xuchu (Luoyi), Guojia (Yiji), Dianwei (Qiangxi), Xunyu
  (Jieming), Caopi (Xingshang), Yuejin (Xiaoguo).
- **Wu (6):** Lvmeng (Keji), Daqiao (Liuli), Sunshangxiang (Xiaoji), Sunjian (Yinghun), Lusu
  (Haoshi), Erzhang (Guzheng).
- **Qun (11):** Huatuo (Jijiu/Qingnang), Lvbu (Wushuang), Diaochan (Biyue), Yanliangwenchou
  (Shuangxiong), Jiaxu (Weimu), Pangde (Mashu/Mengjin), Zhangjiao (Leiji), Caiwenji (Beige),
  Mateng (Mashu), Kongrong (Mingshi), Tianfeng (Sijian/Suishi).

  Every general's `GeneralDef` comment documents which sibling skill(s) were deferred and why
  (see `skill.ts`'s `GENERALS` array) -- same one-line-per-deferral convention used since
  Milestone 2's first 3 generals.
- **Bug found and fixed by writing `testWushuangRequiresTwoJinks`:** `combat.ts`'s `resolveSlash`
  tentatively removed cards from hand as it searched for a multi-Jink set (Wushuang needs 2), but
  discarded whatever it had found even when the full set wasn't available -- so a Wushuang target
  holding only 1 of the 2 required Jinks lost that Jink for nothing on a failed dodge attempt.
  Fixed to only discard the spent cards once the full `responseCountRequired` set is confirmed;
  an incomplete attempt now returns the tentatively-removed card(s) to hand untouched, matching
  the real rule that an unplayable response set was never actually played.
- Avatar assets for all 44 generals confirmed present under `image/generals/avatar/`; 2 were
  missing (Erzhang, Yanliangwenchou -- both "combo" generals representing 2 historical figures,
  which the original asset pack only ships as `big`/`small`/`kof`/`fulldual` art, never a
  standalone circular `avatar` crop) and were synthesized by cropping+resizing the top of their
  existing `big` portrait art to the avatar aspect ratio (both figures stay visible). Official
  Vietnamese general/skill names confirmed present in `lang/vi_VN/Package/Standard*General.lua`
  for all 30.
- `src/simulate.ts` -- `testGeneralSkillsAppearInPlay` expanded to all 44 generals and 42 log
  markers (log-mined across 150 seeds). 5 new dedicated deterministic tests for skills too
  passive/rare to reliably log-mine: `testQicaiIgnoresSnatchDistance`, `testMashuReducesDistance`,
  `testSavageAssaultAvoidImmunity`, `testLiegongBlocksJink`, `testWushuangRequiresTwoJinks`
  (the one that caught the bug above). Kongcheng/Qianxun keep their own pre-existing dedicated
  tests. 21 tests total, all passing.
- **Verification, three layers:**
  1. `npx tsc --noEmit` clean; `npm run sim` 21/21 passing.
  2. Live `ws` client: 15 fresh games sampled 41 of the 44 generals (including both synthesized-
     avatar combo generals), confirming the server's real random sampling actually reaches the
     full new roster, not just the type-checked `GENERALS` array.
  3. Real headless-browser run against `public/index.html`: an 8-player game rendered all 8
     avatars correctly (no broken-image fallback triggered) with real Vietnamese skill
     descriptions for newly-ported generals (Mateng/Pangde's Mã Thuật, Caopi's Hình Thưởng,
     Zhuge Liang's Không Thành, Zhou Yu's Anh Tụ), and the live battle log showed a newly-ported
     skill actually firing mid-game (`P3 discards a card (mengjin)`).
- **Remaining unported (16 of 46 investigated):** Pangtong, Wolong, Xiahouyuan, Zhanghe, Xuhuang,
  Caoren, Sunquan, Xiaoqiao, Taishici, Zhoutai, Yuanshao, Jiling, Panfeng, Zoushi, and now
  Dingfeng (see the correction above) -- each needs a genuine new subsystem (judge-area/
  delayed-tricks, armor, gender, face-up/down state, marks/limit-counters, multi-card viewAs,
  pindian, dual-general head/deputy show/hide, equip-stealing, or multi-target/phase-skip
  mechanics), consistent with every other deferred skill noted throughout this milestone.
  Guanxing/Duoshi/Guicai/Fanjian (from the first 14 generals) remain deferred for the same
  reasons noted when they were first documented above.

**Correction found later (checked directly against the real upstream C++ source during
Milestone 23's Hegemony work) -- the "46 investigated" total above was itself stale/wrong.**
Parsing every actual `new General(this, "name", "kingdom", ...)` constructor call across all 4
`standard-{shu,wei,wu,qun}-generals.cpp` files gives exactly **60** Standard generals (15 per
kingdom, not ~11.5), not 46 -- 14 were apparently never even looked at during the original
per-kingdom survey. Diffing that real 60-name list against this repo's actual `GENERALS` array
(44 entries) finds the SAME 15 already named above, plus **1 more that fell through the cracks
of this milestone's own bookkeeping and was never even added to the "unported" list: Liu Bei
(`liubei`, SHU 001, kingdom Shu)** -- his 1 real skill, Rende (仁德: give away any number of hand
cards to another player on your turn; having given away 2+ by the end of your turn draws you a
card), needs a genuine new "give cards away as a non-damage action, arbitrary count, player-
chosen recipient" card-effect type this engine doesn't have yet (closest existing shape is
Dismantlement/Snatch's single-target take, not a give with no card-count cap) -- a real
subsystem gap, not an oversight in classification, just an oversight in TRACKING. **Corrected
total: 44 of 60 real Standard generals ported (not 44 of 46); 16 genuinely unported: Liubei,
Pangtong, Wolong, Xiahouyuan, Zhanghe, Xuhuang, Caoren, Sunquan, Xiaoqiao, Taishici, Zhoutai,
Dingfeng, Yuanshao, Jiling, Panfeng, Zoushi.**

## Milestone 3 — DONE (spectator server, all-bot)

Proves the actual "web" part of the request end to end: the Node game engine now runs behind a
WebSocket server and a browser client renders it live.

- `src/server.ts` — `ws` WebSocket server (`npm run server`, port 8787). Runs one Room, calls
  `playTurn()` every 500ms, broadcasts a JSON snapshot to every connected client. Fog of war:
  `role` is `null` in the snapshot until `roleShown` (mirrors `Player::hasShownRole` --
  spectators can't see hidden identities either).
- `public/index.html` — plain HTML/CSS/JS (no build step) card-table view: 8 player cards with
  HP hearts, role badge (hidden until revealed), general, equipment, hand count, current-turn
  highlight, scrolling log, game-over banner.
- **Verification:** a real `ws` client received correctly shaped, live-updating snapshots. A
  browser-rendered screenshot was blocked at the time by a local Chromium/Playwright version
  mismatch; confirmed working once that was resolved during Milestone 3.5 (see below).

## Milestone 3.5 — DONE (human-controlled seat)

A human can now actually play: claim a seat over WebSocket and control its Slash-target
decisions live, while every other seat stays bot-controlled.

- `src/controller.ts` — `Controller` interface (`chooseSlashTarget`), `makeBotController` (the
  same naive random-target policy every seat used before), `slashCandidates` (extracted from the
  old `botChooseSlashTarget`).
- `src/room.ts` — `playTurn`/`runPhase`/`runPlayPhase`/`runUntilGameOver` are now `async`; the
  Slash-target decision goes through `this.controllers.get(player.id).chooseSlashTarget(...)`
  instead of always calling the bot function directly. That milestone's `Room.setController`
  swapped a seat's decision-maker at runtime (`null` reverts to bot) -- Slash-target was the ONLY
  thing a human seat controlled at the time; equip and which-trick-to-play stayed bot-driven
  even for a claimed seat until Milestone 3.6 (below).
- `src/server.ts` — `makeHumanController(playerId)`: on `chooseSlashTarget`, sends a
  `{type:"chooseSlashTarget", requestId, candidateIds, timeoutMs}` request to the claiming
  client's socket and awaits a correlated `{type:"response", requestId, targetId}` (15s timeout
  -> pass, matching a human just not acting). New message protocol: `{type:"new"}` resets the
  game, `{type:"claim"/"unclaim", playerId}` takes/releases a seat, released automatically on
  disconnect. The turn loop switched from a fixed `setInterval` to a self-rescheduling
  `await room.playTurn(); setTimeout(loop, 500)` -- required once `playTurn()` can pause for
  up to 15s waiting on a human, so turns can never overlap/race.
- `public/index.html` — "Chiếm ghế" (claim) button per living unclaimed seat, a decision banner
  ("`P1: bạn muốn Sát ai?`") with candidate players highlighted as clickable and a "Bỏ qua"
  (pass) button.
- **Bug found and fixed by manual testing**: the client never cleared its local `mySeat` variable
  on "New game", so after a reset it still rendered "this is your seat" for a seat the server had
  already released -- the claim button never reappeared. Fixed by resetting `mySeat`/prompt state
  in the "New game" click handler to match the server-side `releaseSeatsHeldBy` it triggers.
- **Verification, two layers:**
  1. A Node `ws` client claimed a seat, received a `chooseSlashTarget` request, answered with a
     specific target, and the broadcast log showed that EXACT target being slashed.
  2. Real headless-browser (Playwright/gstack `browse`) run: navigated to `public/index.html`,
     clicked "Chiếm ghế" for P1, waited for the decision banner to render, clicked a highlighted
     candidate player card, and confirmed via screenshot + log diff that `P1 slashes P2` (the
     exact card clicked) appeared. Screenshots captured at every step.
- `src/simulate.ts` — `testHumanControllerOverridesBot`: installs a controller that always
  declines to slash on P1, runs a full game, asserts P1 never attacks while every other
  (bot-controlled) seat does.

## Milestone 3.6 — DONE (equip / trick / dodge / peach control)

Expanded the human seat from 1 decision to 5: equip, trick usage (yes/no for the AOE/self
tricks), Slash target, Jink dodge, Peach self-rescue. Manual target selection for
Dismantlement/Snatch/Duel and Duel's forced-Slash exchange were still bot-driven at this point
-- see Milestone 3.7 below and `controller.ts`'s header for the boundary as it stands now.

- `src/controller.ts` -- `Controller` gained `wantsToEquip`, `wantsToPlayTrick`, `wantsToDodge`,
  `wantsToUsePeach`. `Room.setController` now takes `Partial<Controller>` merged over
  `makeBotController`'s defaults, so a seat (or a test) only needs to override what it cares
  about.
- `src/combat.ts` -- `resolveSlash`/`applyDamage`/`resolveDying` are now `async` and ask
  `ctx.askDodge`/`ctx.askPeach` (only when the player actually holds the relevant card) instead
  of always auto-using it. `src/trick.ts`'s `resolveDuel`/`resolveSavageAssault`/
  `resolveArcheryAttack` and `src/skill.ts`'s Ganglie hook became `async` to match (they call
  `applyDamage`). `src/room.ts`'s equip pass and `tryPlayOnce` (trick-card gate) now `await` a
  `wantsToEquip`/`wantsToPlayTrick` check before committing the card.
- `src/server.ts` -- generalized the old single-purpose `chooseSlashTarget` request/response into
  `askClient()`, a small helper reused for 4 new Yes/No message types: `confirmEquip`,
  `confirmTrick`, `confirmDodge`, `confirmPeach` (each `{type, requestId, actorId, ...}` out,
  `{type:"response", requestId, value:boolean}` back). Per-ask timeout fallback: offensive/
  optional actions (Slash, trick) default to declining; protective actions (equip, dodge, peach)
  default to happening, since silently refusing self-protection isn't a sensible "no answer"
  default.
- `public/index.html` -- `showConfirm()` renders a shared Yes/No scroll modal (real card art:
  the specific equip icon, the trick's card image, Jink/Peach art) with "Đồng ý"/"Không" buttons,
  reused by all 4 new prompt types plus the existing Slash-target picker.
- **Verification, three layers:**
  1. `src/simulate.ts`'s `testExpandedControllerHooksRespected`: a controller that declines all
     4 new hooks on P1, across 40 seeds, never equips/self-sources-a-trick/dodges/self-heals in
     the log, while every other (bot, always-accepts) seat still does all 4 normally.
  2. Raw `ws` client: claimed a seat, answered a live sequence of real `confirmEquip` ->
     `confirmTrick` (declined) -> `chooseSlashTarget` -> `confirmDodge` -> ... prompts in order,
     confirming the request/response protocol round-trips correctly for all 4 new types.
  3. Real headless-browser run: claimed a seat, a `confirmEquip` modal rendered with the actual
     weapon's card art and "Đồng ý"/"Không" buttons, clicking "Đồng ý" closed it and the game
     continued to the next live decision. Screenshots captured.

## Milestone 3.7 — DONE (manual target selection for Dismantlement/Snatch/Duel)

A human seat now picks WHO to target with the 3 single-target tricks, not just whether to play
them (Milestone 3.6 only offered yes/no, with the bot always choosing the target internally).

- `src/trick.ts` -- `pickDismantlementTarget`/`pickSnatchTarget`/`pickDuelTarget` (single
  random pick + `rng` param) replaced by `dismantlementCandidates`/`snatchCandidates`/
  `duelCandidates` (return the full legal-target list; no `rng`). The random pick moved into
  `controller.ts`'s bot default.
- `src/controller.ts` -- `Controller` gained `chooseTrickTarget(player, kind, candidates)`,
  parallel to `chooseSlashTarget`. `wantsToPlayTrick` now only covers the AOE/self tricks
  (SavageAssault/ArcheryAttack/GodSalvation/AmazingGrace/ExNihilo), which have no target to pick.
- `src/room.ts` -- new `tryPlayTargeted()` (parallel to `tryPlayOnce`): asks
  `chooseTrickTarget` for a specific player instead of a plain yes/no gate, used for
  Dismantlement/Snatch/Duel.
- `src/server.ts` -- new `chooseTrickTarget` message type (candidate id list out, chosen
  `targetId` back), same `askClient()` plumbing as `chooseSlashTarget`.
- `public/index.html` -- the Slash-target picker UI generalized into `showTargetPicker()` and
  reused for `chooseTrickTarget` (same candidate-highlighting/click mechanism, different
  card-art image and title per trick kind).
- **Verification:**
  1. `src/simulate.ts`'s `testChooseTrickTargetPicksExactPlayer`: a controller that always picks
     the *last* candidate for Duel, across 40 seeds, confirms that exact chosen player's id
     appears in the `P1 duels <id>` log line.
  2. Raw `ws` client: observed real `chooseTrickTarget` requests for both `dismantlement` and
     `duel` with correct candidate-id lists, and confirmed `confirmTrick` (yes/no) still fires
     separately for the AOE tricks (`ex_nihilo`, `savage_assault`) -- proving the kind-based
     split between the two Controller methods works end-to-end over the wire.
- 10 tests total, all passing.

## Milestone 3.8 — DONE (Duel's Slash exchange + Ganglie's discard-or-damage choice)

The last 2 documented gaps from Milestone 3.7 are closed: Duel no longer auto-plays a held
Slash, and Ganglie's damage source no longer auto-discards -- both are now real per-player
decisions.

- `src/controller.ts` -- `Controller` gained `wantsToPlaySlashInDuel` and
  `wantsToDiscardForGanglie`. Bot defaults both to `true`, matching the exact pre-3.8 automatic
  behavior (no behavior change for bot-controlled seats).
- `src/combat.ts` -- `EngineContext` gained `askDuelSlash`/`askGanglieDiscard`, parallel to the
  existing `askDodge`/`askPeach`.
- `src/trick.ts` -- `resolveDuel` now checks `ctx.askDuelSlash(responder)` before taking a held
  Slash; declining (or not holding one) ends the exchange with 1 damage immediately, matching
  the real rule that playing Slash in a Duel is optional even when held.
- `src/skill.ts` -- Ganglie's `onDamaged` now checks `ctx.askGanglieDiscard(source)` (only when
  `source.handcardNum >= 2`) before discarding 2 cards; declining (or having <2 cards) deals 1
  damage instead.
- `src/server.ts` -- 2 new Yes/No message types, `confirmDuelSlash` and `confirmGanglieDiscard`,
  same `askClient()` plumbing, default-to-`true` on timeout (protective/optional-resource
  actions, same policy as dodge/peach).
- `public/index.html` -- both reuse `showConfirm()` with Slash/Dismantlement card art.
- **Verification:**
  1. `src/simulate.ts`'s `testDuelSlashAndGanglieDiscardRespected`: a controller declining both
     on P1, across 60 seeds, never plays a Slash mid-Duel or discards for Ganglie in the log,
     while some other (bot) seat still does each normally.
  2. Raw `ws` client: observed real `confirmDuelSlash` and `confirmGanglieDiscard` requests
     (across two separate runs, since which one fires depends on the random deal) with the
     expected `{type, actorId, requestId, timeoutMs}` shape.
- 11 tests total, all passing.

## Milestone 4 — DONE (multi-room lobby + Vietnamese general names)

`server.ts` no longer runs a single global game shared by every connected client -- a connecting
client starts in a lobby, sees a live list of open rooms, and either creates a new one (5-10
players) or joins an existing one. Also: every player card now shows the general's real
Vietnamese name, not the internal pinyin id.

- `src/skill.ts` -- `GeneralDef` gained `displayName` (the official Vietnamese name from
  `lang/vi_VN/Package/Standard*General.lua`, e.g. `"caocao"` -> `"Tào Tháo"`), populated for all
  44 ported generals. `src/player.ts` -- `GamePlayer` gained `generalName`, set alongside
  `general` in `Room`'s constructor. `src/server.ts`'s snapshot now includes `generalName`;
  `public/index.html` displays it (player card, hero panel) while `general` (the pinyin id)
  stays the source for avatar/asset filenames, which are untranslated.
- `src/server.ts` -- replaced the single module-level `room`/`clients`/`claimedSeats` state with
  a `Map<roomId, GameRoom>` (`id`, `room`, `clients`, `claimedSeats`, `pendingRequests`,
  `loopTimer`) plus a `Map<WebSocket, GameRoom>` tracking which room (if any) each socket is
  watching -- absent from that map means "in the lobby". New message types: `listRooms` (request
  a fresh list), `createRoom` (`{playerCount}`, validated 5-10, matching `gamerule.ts`'s role
  table), `joinRoom` (`{roomId}`), `leaveRoom`. The existing `new`/`claim`/`unclaim`/`response`
  types now resolve against the sender's *current* room instead of a single global one. Every
  room runs its own independent `playTurn()` timer from creation; the room is torn down (timer
  cleared, state dropped) the moment its last watching client leaves, so abandoned rooms don't
  linger. The state snapshot gained an explicit `type:"state"` field (previously untyped,
  distinguished only by NOT matching any of the known prompt-type strings) so the client can
  route it unambiguously against the new `roomList`/`error` message types.
- `public/index.html` -- new lobby panel (room list + player-count selector + "Tạo phòng mới")
  shown before joining a table, toggled against the existing game-table view via `showLobbyView`/
  `showGameView`. Header gained a room-code label and a "Rời phòng" button.
- **Bug found and fixed while verifying the leave-room flow**: the body restructuring for the
  lobby/game-view split accidentally dropped the `#promptOverlay`/`#prompt` divs from the HTML
  (an editing mistake, not a design issue). Every `Controller` prompt handler
  (`showTargetPicker`/`showConfirm`/`answerPrompt`) still referenced the now-missing elements, so
  `showLobbyView()` threw on its very first DOM write (`promptOverlayEl.className = ""` on a
  `null` element) and silently aborted mid-function -- "Rời phòng" looked like it did nothing.
  Root-caused via `window.__trace`-based instrumentation (console capture doesn't reach this
  headless harness) that isolated the exact throwing line; fixed by restoring the missing
  markup. Caught and fixed before shipping, not left as a known issue.
- **Bug found and fixed in `Room.killPlayer`**: a death that cascades from Suishi (Tianfeng: an
  ally of the just-dead player loses 1 hp and can die from it too) re-ran `checkWinCondition` and
  could overwrite an already-correct winner with the wrong one (a `null`-credited cascade death
  after the lord already died hits `checkWinCondition`'s "no credited killer" branch, changing
  `{winners:[Rebel]}` to `{winners:[Rebel,Renegade]}`) -- a real gameplay bug, not just test
  flakiness, since a live match could show the wrong winner banner. Found via
  `testLordAndLoyalistWin` and `testRebelKillsLord` (previously the only 2 tests left unseeded
  from Milestone 1, before generals with cross-player death hooks existed) flaking under
  `Math.random()`. Fixed by only evaluating/assigning `gameOver` while it's still `null`; both
  tests now seeded like the rest of the suite, and a new
  `testCascadingDeathDoesNotOverwriteGameOver` deterministically reproduces the exact cascade
  (Suishi force-assigned onto a 1-hp loyalist ally of the lord) and proves it no longer overwrites
  the correct result -- confirmed to fail against the pre-fix code, then pass after.
- **Verification:**
  1. `npx tsc --noEmit` clean; `npm run sim` 22/22 passing (8 repeated runs, all deterministic).
  2. Live `ws` client: create → a 2nd client sees it in `listRooms` → joins → claims a seat (3rd
     client sees `seatsClaimed` update) → leaves (seat released, room stays alive for the
     creator) → creator also leaves → room no longer listed. Full lifecycle confirmed end to end.
  3. Real headless-browser run: lobby renders with the create-room control; creating a room shows
     the real game table with every player's Vietnamese name (`Triệu Vân`, `Chân Cơ`, `Mã Siêu`,
     ...); clicking "Rời phòng" returns to an empty lobby list. Screenshots captured at each step.
- 22 tests total, all passing.

**Addendum -- waiting room (room no longer auto-plays before anyone is ready).** Originally a
created room started its `playTurn()` loop immediately (inherited unchanged from Milestone 3's
single-global-room design), so bots were already mid-game before any human could claim a seat.
Fixed: a room now sits idle (`GameRoom.started = false`, no `loopTimer` scheduled) as a pure
seat-picker until its creator (`GameRoom.creatorWs`) sends `startGame`; only then does
`scheduleLoop` actually start, and any seat still unclaimed at that point stays bot-controlled as
before. If the creator leaves before starting, another remaining watcher is promoted to creator
so the room never gets stuck with no one able to start it. `"new"` (reset) also drops the room
back into the waiting state (stops the loop, `started = false`) instead of auto-resuming, so
seats can be rearranged before the next game begins. The state snapshot gained `started` and a
per-recipient `isCreator` flag (computed per-socket in `broadcast`/`joinRoom`, since the shared
snapshot body can't vary by recipient on its own); the client shows a "Bắt đầu trận đấu" button
only to the creator while `!started`, and everyone else sees "Đang chờ chủ phòng bắt đầu...".
- **Verification:** live `ws` client confirmed `turnNumber` stays `0` for 2s of pure waiting (no
  bot activity at all pre-start), a non-creator's `startGame` is rejected with an error and
  `started` stays `false`, and the creator's `startGame` flips `started` true with turns
  immediately advancing. Headless-browser screenshots confirm the waiting-room banner + gold
  start button before clicking, and live turn/log activity immediately after.

## Milestone 5 — DONE (full free-hand Play phase for human seats)

Every prior human-controlled seat only ever answered REACTIVE prompts (yes/no on an
auto-selected card, or WHO to target) -- the engine itself always decided WHICH card to try, in
a fixed order (Ex Nihilo -> Dismantlement -> Snatch -> Duel -> Savage Assault -> Archery Attack
-> God Salvation -> Amazing Grace -> Slash), and a human never saw their own actual hand, only
`handcardNum`. This milestone hands the ENTIRE Play phase to the human: real hand-card images,
click any legal card in any order, until they end the phase themselves.

- `src/combat.ts` -- `allSlashLikeCards`/`allDismantlementLikeCards`/`allDuelLikeCards` added
  alongside the existing `findXLikeCard` singular finders: return EVERY real-or-viewAs match
  instead of just the first, since a freeform Play phase must offer every held copy as its own
  choice (real Sanguosha has no "once per kind per turn" cap -- only Slash has an explicit
  limit -- so playing 2 held Ex Nihilo in one turn is legal and now possible, unlike the bot
  path's `tryPlayOnce` which only ever tries each kind once).
- `src/controller.ts` -- new `FreeAction` union (`equip`/`playCard`/`selfAction`/`activeAction`)
  and `Controller.chooseFreeAction?(player, legalActions)`, optional and left undefined by
  `makeBotController` -- bots keep using the original fixed-order pass, byte-for-byte unchanged
  (confirmed: `testGeneralSkillsAppearInPlay`'s 42/42 markers still all fire the same way).
- `src/room.ts` -- `runPlayPhase` now branches on whether `controller.chooseFreeAction` is
  defined. If so, `runFreeformPlayPhase` takes over: `computeLegalActions` builds the full legal
  list fresh each iteration (every Weapon/Horse card, every playable trick/Slash card gated on
  having a legal target, every not-yet-used-this-turn self/active-action skill), asks
  `chooseFreeAction`, resolves whichever one comes back via `resolveFreeAction`, and loops until
  the player declines (ends the phase) or nothing is legal any more. `resolveFreeAction` reuses
  the EXACT SAME `tryPlayOnce`/`tryPlayTargeted`/`tryPlaySlash`/`equip` helpers the fixed
  automatic pass uses (now accepting an optional `explicitCard` to skip the auto-find + the
  now-redundant `wantsToPlayTrick` yes/no ask) -- so Weimu-immunity, hand-emptied hooks,
  onTrickPlayed hooks, and Huoshou/Juxiang's Savage-Assault-card claim all behave identically
  either way, single source of truth.
- `src/server.ts` -- `makeHumanController` gained `chooseFreeAction`, sending a new
  `{type:"chooseFreeAction", actorId, legalActions}` message (each entry tagged with an
  `actionId` index; selfAction/activeAction entries also carry `skillDisplayName`/
  `skillDescription`, same enrichment `confirmSelfAction` already used). The snapshot broadcast
  gained a per-recipient `myHand` (the claiming socket's own actual `Card[]`, computed fresh per
  `ws` in `broadcast`/`joinRoom` alongside the existing per-recipient `isCreator` -- every other
  client still only ever sees `handcardNum`, unchanged fog-of-war for opponents' hands).
- `public/index.html` -- new hand panel: real card images (`image/card/<kind>.png` for
  basics/tricks, `image/equips/<name>.png` for weapons/horses) with a suit-icon + point-number
  overlay, rendered from `state.myHand`. While a `chooseFreeAction` prompt is pending, legal
  cards light up and become clickable (`onclick` sends the matching `actionId`); non-card
  actions (selfAction/activeAction skills) render as buttons in a bar below the hand alongside
  "Kết thúc lượt" (end phase, sends `actionId: null`).
- **Bug found and fixed while verifying live**: the free-action bar could linger showing a
  stale "Kết thúc lượt" prompt after the claiming player's own seat died or the game ended
  (the server's per-ask timeout has no "prompt cancelled" push to the client, matching the same
  pre-existing gap every other reactive prompt type already has). Fixed by clearing
  `pendingFreeAction` in `render()` whenever `gameOver` is true or the claimed seat is no longer
  alive.
- **Verification:**
  1. `npx tsc --noEmit` clean; `npm run sim` 23/23 passing, including a new deterministic
     `testFreeformPlayLetsHumanChooseCardsAndPlayDuplicates` (confirmed to exercise the new
     freeform loop specifically: a scripted controller equips a chosen weapon by id and plays
     BOTH of 2 held Ex Nihilo copies in the same turn -- something the bot-path fixed pass
     structurally cannot do).
  2. Live `ws` client: claimed a seat, confirmed `myHand` arrives as real `Card[]` on join,
     received a real `chooseFreeAction` prompt with an accurate legal-action list matching the
     actual hand, and answering `actionId: null` correctly ended the phase and let the turn
     advance.
  3. Real headless-browser run: hand renders as real card images with suit/point overlays,
     playable cards highlight and are clickable, clicking one visibly changes the hand (a
     Weapon left the hand once equipped) and advances the game log -- confirmed across many
     turns end to end, including the claimed seat's own general dying mid-game (normal combat)
     and the whole game reaching a clean win-condition conclusion with no errors or stalls.
- 23 tests total, all passing.

**Addendum -- 3 real bugs found from live user feedback after the initial hand-UI ship, all
fixed and verified:**

1. **Target picker never actually became clickable.** `renderPlayer()`'s `.candidate`
   class/`onclick` was only ever applied inside `render(state)`, which runs on a `state`
   broadcast -- but `chooseSlashTarget`/`chooseTrickTarget` prompts arrive as their OWN message
   with no accompanying state broadcast, so the player-card DOM stayed exactly as it was
   rendered before the prompt existed (no highlighting, no click handler). Fixed by extracting a
   `renderPlayers()` helper and calling it from `showTargetPicker()` (and again from
   `answerPrompt()` to clear the highlighting once answered), not just from `render()`.
2. **AOE/untargeted cards (Nam Man Nhập Xâm, Vạn Tiễn Tề Phát, ...) looked unplayable.**
   `server.ts`'s `broadcast()` -- which is what sends the client's `myHand` -- only fires once
   per fully COMPLETED turn; but a `chooseFreeAction` ask can fire mid-turn, after that turn's
   own Draw phase already changed the actor's real hand. The client's hand panel was matching
   `legalActions` (fresh, live cardIds) against `lastState.myHand` (stale, pre-Draw-phase-of-
   this-turn), so freshly-drawn cards never appeared as any DOM element at all. Fixed by having
   `chooseFreeAction`'s payload carry the actor's live `hand` directly (the server already has
   the exact `GamePlayer` object in scope right there), and having the client resync
   `lastState.myHand` from it before rendering -- self-consistent by construction, no more
   reliance on the last full-turn broadcast staying fresh.
3. **Seat claiming allowed mid-match** (explicit user request): `claim` now checks
   `gr.started` server-side and rejects with an error once the match is running; the client's
   claim button is gated on `!state.started` so it simply doesn't render for unclaimed seats
   once play has begun (matches the existing "waiting room = seat picker" design).

**Verification:**
- New deterministic test `testFreeformPlayAOECardIsOfferedAndResolves`: seeds the lord's hand
  with a Savage Assault card and empty hands for everyone else, scripts a `chooseFreeAction`
  controller to play it, and asserts it appears in `legalActions`, resolves with NO target
  prompt at all, and deals exactly 1 damage to every other (non-immune) player -- 5 repeated
  runs all pass identically.
- Live WS test: confirmed `claim` now gets rejected with the Vietnamese error message once
  `startGame` has run; confirmed a real `chooseSlashTarget` arrives with correct `candidateIds`
  and resolves correctly when answered; confirmed every `chooseFreeAction.legalActions` cardId
  matched a card actually present in that same message's `hand` field across dozens of turns
  (would have hard-failed the script otherwise).
- Live headless-browser run (real Puppeteer clicks, not simulated DOM events -- this is what
  actually exercises the CSS `pointer-events` chain): played hand cards until a real
  `chooseSlashTarget` prompt appeared, then `tab.click('.player.candidate')` on the real
  highlighted player card -- click succeeded, prompt closed, turn advanced. Screenshot confirmed
  "Nam Man Nhập Xâm" (Savage Assault) rendering with the gold "playable" border in the hand
  panel. Confirmed 0 enabled claim buttons visible anywhere on the table once the match started.
- `npx tsc --noEmit` clean; `npm run sim` 24/24 passing (5 repeated runs, fully deterministic).

## Milestone 6 — DONE (turn-based general selection + own-role visibility)

Generals were previously auto-assigned with zero interaction (one uniform-random pick per
player, silently, at Room construction). This milestone replaces that with a real selection
phase: after `startGame`, each player is dealt 3 not-yet-taken candidate generals and picks one,
turn by turn, starting with the lord and proceeding around the table in seat order -- matching
real Sanguosha's no-duplicate-generals rule and turn-based selection convention. Every player
also now sees their own role the instant the match starts (previously even your own identity was
hidden from you until `roleShown`, same as everyone else's).

- `src/room.ts` -- general assignment + initial hand-dealing moved OUT of the constructor and
  into a new `pickGenerals(onStep?)`: iterates players starting at the already-tracked lord
  index, deals 3 unique not-yet-taken candidates (`candidateGenerals`, tracked via a
  `takenGenerals` set so no two players in one game ever get the same general), asks each
  player's `Controller.chooseGeneral`, assigns kingdom/skills/maxHp/hp, and only deals initial
  hands (`hand.length === maxHp`) once every player has a general. `pickTurnPlayerId` is exposed
  publicly so server.ts can broadcast "whose turn" mid-selection. `playTurn()` gained a guard
  throwing if called before every player has a general -- fails loudly instead of silently
  running with wrong (default) maxHp/empty skills/no hand if a caller forgets to await picking.
- `src/controller.ts` -- new required `chooseGeneral(candidates): Promise<GeneralDef>` on the
  `Controller` interface (unlike `chooseFreeAction`, every controller needs this one, bot and
  human alike, since every player must end up with a general). `makeBotController` picks
  uniformly at random among its 3 candidates via the shared seeded rng.
- `src/server.ts` -- `startGame` now sets `started`, broadcasts immediately (client enters the
  picking screen), then `await`s `room.pickGenerals(() => broadcast(gr))` in a background async
  IIFE (broadcasting before/after every single pick, so watchers see live progress) before
  finally calling `scheduleLoop`. `makeHumanController` gained `chooseGeneral`, sending a new
  `pickGeneral` message (candidates serialized with displayName/kingdom/maxHp/skill text, same
  enrichment pattern as `chooseFreeAction`) with a longer 30s timeout (a deliberate one-time
  pick with skill text to read, not a reactive combat prompt) and an auto-pick-first fallback so
  the game always proceeds even if a claimed seat goes silent. `snapshot()` gained
  `pickingGenerals`/`pickTurnPlayerId`. New `personalize()` (used by both `broadcast()` and
  `joinRoom()`, replacing their old inline per-socket spread) reveals a claiming socket's OWN
  role once `started`, regardless of `roleShown` -- every player always knows their own identity
  in real Sanguosha; only OTHER players stay fogged per the existing `roleShown` rule (the lord's
  role was already public to everyone from `assignRoles`, unaffected).
- `public/index.html` -- new pick-a-general screen: 3 face-down "Tướng ẩn" cards
  (`image/generals/big/anjiang.png`, the original game's own hidden-general art) with a "Lật
  bài" (flip) button each -- clicking reveals full portrait/kingdom/HP/skill text plus a "Chọn
  tướng này" button, a deliberate two-step manual flow (not auto-revealed) per this milestone's
  ask. While it's not your turn, a "Đang chờ X chọn tướng…" placeholder shows (candidates are
  only ever sent to the asked player's own socket, matching hand fog-of-war). The table/hand
  panel are hidden and swapped for this screen for the duration; `renderHero`'s own-role badge
  (already existing UI, just now actually populated) shows the newly-revealed own role right
  next to your general once the real game view returns.
- **Bug found and fixed while verifying live**: `#pickGeneralPanel`'s toggle used
  `element.style.display = picking ? "" : "none"` -- but that ID's own CSS rule sets
  `display: none` as its base style, so clearing the inline style with `""` just fell back to
  that same `none` (a CSS specificity gap, not a JS logic bug): the 3 candidate cards rendered
  correctly into the DOM but stayed invisible. Fixed by using an explicit `"block"` instead of
  `""`.
- **Verification**:
  1. Live multi-socket WS test (5 claimed human seats): pick order exactly matched
     `lord -> next seat -> ... -> lord's own predecessor` (`P3 -> P4 -> P5 -> P1 -> P2` for a
     lord seated at P3); every ask offered exactly 3 candidates; every player ended with a
     unique general (no duplicates); every player saw their OWN role immediately once started
     (`P1: renegade, P2: rebel, P3: lord, P4: loyalist, P5: rebel`) while P2's role specifically
     stayed `null` as seen from P1's AND P3's own broadcasts (fog of war intact for others) yet
     showed `rebel` correctly on P2's own broadcast.
  2. A second live test confirmed a real picked general (`Hạ Hầu Đôn`) matches the final
     assignment exactly, `myHand.length === maxHp` after dealing, and own role (`lord`) visible
     immediately.
  3. A pure-bot live test (no claimed seats) confirmed the real turn loop resumes correctly
     after picking -- `turnNumber` reached 9 with real combat log lines within 5s.
  4. Live headless-browser run: claimed a seat, watched other (bot) players' picks stream into
     the log in real time, reached the real pick-general screen for the claimed seat itself
     (3 face-down cards + "Lật bài"), flipped one (revealed portrait/kingdom/HP/skill text +
     "Chọn tướng này" appeared), picked it, and confirmed the real game view returned cleanly:
     own hero panel showing the picked general with role badge (`Trung Thần`) next to it, hand
     dealt to exactly `maxHp` real cards, the lord's `CHỦ CÔNG` tag publicly visible on their
     seat, and every other seat's role tag correctly absent (still fogged).
  5. `npx tsc --noEmit` clean; `npm run sim` 24/24 passing.


## Milestone 7 — Audit: defense/counter-play mechanics (Sát/Thiểm, Nullification, nội tại)

User asked to verify the "responding to an attack" mechanism -- Slash/Jink, Nullification (Vô
Giải Khả Kích), and passive/innate ("nội tại") skills. Audit result below, plus one real bug
found and fixed, one real regression found and fixed, and one confirmed gap.

**✅ Correct and already covered:**
- Slash → Jink (`resolveSlash` in `src/combat.ts`): asks the SPECIFIC defending player
  (`ctx.askDodge`), not automatic; respects every dodge-related nội tại skill --
  Longdan/Qingguo (view another card as Jink), Kongcheng (immune to Slash/Duel targeting),
  Tieqi/Liegong (block the dodge decision outright), Xiangle/Liuli (nullify/redirect before the
  Jink check), Wushuang (needs 2 Jinks, not 1), Mengjin/Leiji (fire after a successful dodge).
- Duel (Quyết Đấu, `resolveDuel`): real back-and-forth "counter" exchange -- alternates asking
  each side to play a Slash, first to fail/decline takes the damage; also Wushuang-aware.
- Damage-side nội tại: Mingshi/Beige (`reduceDamage`, can floor damage to 0 and cancel the hit
  entirely), Weimu/Biyue (immune to black-suited tricks).

**🐛 Bug found and fixed**: Savage Assault (Nam Man Nhập Xâm) and Archery Attack (Vạn Tiễn Tề
Phát) were auto-discarding a held Slash/Jink to avoid damage with NO ask at all -- denying the
player the real Sanguosha choice to keep the card and take 1 damage instead (the same choice
`resolveSlash`/`resolveDuel` already correctly offer). Fixed:
- `src/combat.ts` -- exported `findJinkLikeCard` (was private); added
  `askSavageAssaultSlash`/`askArcheryAttackJink` to `EngineContext`.
- `src/controller.ts` -- new `wantsToDiscardForSavageAssault`/`wantsToDiscardForArcheryAttack`
  on `Controller`; bots default to `true` (matches the existing greedy card-preservation policy).
- `src/trick.ts` -- `resolveSavageAssault`/`resolveArcheryAttack` now find the held card viewAs-
  aware (`findSlashLikeCard`/`findJinkLikeCard`, so Wusheng/Longdan-style skills work here too)
  and only discard it if the ask returns true; declining still deals the 1 damage.
- `src/server.ts` -- `makeHumanController` gained the 2 new asks (`confirmSavageAssaultSlash`/
  `confirmArcheryAttackJink` messages); `public/index.html` renders them via the existing
  `showConfirm` yes/no overlay with Vietnamese prompt text.
- New deterministic test `testSavageAssaultAndArcheryAttackAreAChoice`: proves declining leaves
  the card unspent AND deals damage, accepting spends it AND avoids damage, for both cards.

**🐛 Regression found and fixed** (unrelated to the audit itself, caught while browser-verifying
it): `<div id="promptOverlay"><div id="prompt"></div></div>` -- the root element EVERY
confirm/target-picker prompt depends on -- had been silently deleted from `public/index.html` by
a stale-line-number edit earlier in Milestone 6's session (a `PUT` using pre-shift line numbers
overwrote that exact line instead of the two misplaced `const` declarations it was meant to
move). `document.getElementById("promptOverlay")` had been returning `null` ever since, meaning
every prompt type silently threw the moment it tried to activate -- undetected because no
browser test in that window happened to trigger a confirm/target-picker dialog. Restored the
markup; re-verified via ~350 real-click browser iterations across 4 live games, observing 10
distinct real prompts resolve correctly end to end (Slash/Duel/Snatch/Dismantlement target
pickers, dying/Peach, self-action skill confirm, dodge confirm, and both new Savage
Assault/Archery Attack discard-choice confirms).

**❌ Confirmed gap: Nullification (Vô Giải Khả Kích) is NOT implemented.** Not in the `CardKind`
enum, not in the dealt deck, no reactive counter-play window of any kind exists for ANY trick
card (Duel, Dismantlement, Snatch, Savage Assault, Archery Attack, God Salvation, Amazing Grace,
Ex Nihilo all resolve with zero chance for another player to cancel them). This has been an
explicitly documented gap since Milestone 1.5 (see `src/card.ts`'s header and `src/trick.ts`'s
module comment) -- it needs a genuinely new subsystem: a delayed-trick/judge-area-style
"reactive stack" that, after a trick card's target(s) are determined but before it resolves,
asks every other player in turn order whether they want to play Nullification against it, then
recursively asks again if one is played (a nullification can itself be nullified), until
everyone passes. This is a substantially larger feature than the fixes above (new card kind,
new resolution-order interception point touching all 8 trick resolvers, new ask/UI flow) and has
not been built -- flagging for an explicit scope decision rather than building it unprompted.
- `npx tsc --noEmit` clean; `npm run sim` 25/25 passing.

## Milestone 8 — DONE (end-of-turn Discard: choose exactly which cards, not arbitrary)

`discardDownToLimit` (the end-of-turn "hand exceeds hp" cleanup) used to always splice off the
first N cards in hand order -- no ask, no choice. This milestone hands that choice to the
player, same "real decision" pattern as Milestone 5's free-hand Play phase.

- `src/controller.ts` -- new required `chooseDiscards(player, count): Promise<Card[]>` on
  `Controller` (every controller needs it, bot and human alike -- someone must always end up
  choosing). Bot default: first `count` held cards (byte-for-byte the old behavior, so bot-only
  games are unaffected).
- `src/room.ts` -- `discardDownToLimit` now asks `chooseDiscards`, then validates the answer
  (exactly `count` DISTINCT cards, all still actually in hand) before discarding them -- falls
  back to the original first-N behavior if a controller returns something invalid, so a
  misbehaving/timed-out response can never desync the discard count.
- `src/server.ts` -- `makeHumanController` gained the ask (`chooseDiscards` message, carrying
  `count` + the live `hand`); fallback on timeout/disconnect matches the bot default (first
  `count` held cards) so the game never stalls on a silent player.
- `public/index.html` -- the hand panel gains a third mode (alongside normal play and free-hand
  Play-phase play): click cards to toggle red "selected for discard" highlighting up to exactly
  `count`, then a "Xác nhận bỏ bài" button (disabled until exactly `count` are selected) confirms.
- New deterministic test `testDiscardChoiceLetsHumanPickWhichCards`: a scripted controller
  deliberately picks the LAST `count` cards (the opposite end from the bot's first-N default)
  and confirms exactly those left the hand -- proves the choice is actually honored, not just
  type-checked.
- **Verification**: live WS test confirmed the server asks with the correct `count`/`hand` and
  discards EXACTLY the submitted card ids (checked by diffing the hand before/after -- a 7-card
  hand asked to shed 4 ended up with precisely the 3 cards NOT selected). Live browser run:
  reached the real discard-selection UI ("Bài trên tay vượt quá số máu — chọn 1 lá để bỏ"),
  confirmed the confirm button starts disabled, enables only once exactly the required count is
  selected (with live red highlighting), and clicking confirm left exactly the un-selected card
  in hand ("Thiểm" kept after discarding "Tửu"). `npx tsc --noEmit` clean; `npm run sim` 26/26
  passing (5 repeated runs, fully deterministic).

## Milestone 9 — DONE (equip shows/applies immediately, not delayed to turn end)

`broadcast(gr)` (the JSON "state" snapshot every client renders from) previously only fired once
per fully COMPLETED turn (`scheduleLoop`). Server-side the equip buff was already 100% live the
instant `player.weapon`/`defenseHorse`/`offenseHorse` was set (`attackRange`/`effectiveDistance`
read them directly, no caching) -- but no client, including spectators and the equipping player's
own table card, ever SAW it until the whole turn finished. Fixed by broadcasting immediately.

- `src/room.ts` -- new `Room.setLiveUpdateCallback(cb)` registers a callback fired at the end of
  `equip()` (the single method both the bot's fixed pass and the human freeform loop funnel
  through), right after the buff is already applied and logged.
- `src/server.ts` -- both places a room's `Room` gets constructed (`createRoom`, and the `"new"`
  reset handler) now call `gr.room.setLiveUpdateCallback(() => broadcast(gr))`, so an equip
  immediately broadcasts the fresh state to every client watching -- not just the equipping
  player's own `chooseFreeAction` hand payload (which already only kept THEIR OWN hand fresh,
  never the table-wide equip icons everyone else sees).
- New deterministic test `testEquipTriggersLiveUpdateCallback`: registers the callback directly
  and confirms it fires exactly once per equip, with `player.weapon` already reflecting the new
  item at the exact moment the callback runs (proves synchronous, not merely "eventually").
- **Verification**: live 2-socket WS test (P1 equipping, a pure spectator watching) confirmed the
  spectator's state broadcast whose log tail is exactly `"P1 equips Fan"` ALREADY carries
  `weapon: "Fan"` in that same message -- not a later one. Live browser run (2 tabs) confirmed
  the table view's equip icons render correctly. `npx tsc --noEmit` clean; `npm run sim` 27/27
  passing.
- **Minor cosmetic issue found and fixed while verifying**: `public/index.html`'s
  `#pickGeneralCards` container kept its stale (now `display:none`-ancestor-hidden) `.generalCard`
  DOM after the picking phase ended instead of clearing `innerHTML` -- invisible to players (the
  panel itself is hidden), only observable by scripts querying the DOM directly. Fixed by clearing
  it alongside `pendingGeneralPick` whenever `render()` sees picking has ended.

## Milestone 9.1 — DONE (broadened Milestone 9's fix: every visible action, not just equip)

User report: playing a card ON ANOTHER PLAYER (e.g. Slash) still didn't show up immediately for
watchers -- Milestone 9 only wired `onLiveUpdate` into `equip()`. Every other state-mutating
action (Slash damage/death, the 8 trick cards, proactive self/active-action skills, and the
end-of-turn Discard) still only became visible once the whole turn finished.

- `src/room.ts` -- added `this.onLiveUpdate?.()` calls after every other place game state
  visibly changes: the end of `tryPlayOnce`/`tryPlayTargeted` (both exit paths, including the
  Weimu-fizzle early return) and `tryPlaySlash` -- the three shared helpers BOTH the bot's fixed
  pass and the human freeform loop (`resolveFreeAction`) funnel every trick card and Slash
  through, so one call site each covers both paths for Slash/Dismantlement/Snatch/Duel/
  ExNihilo/SavageAssault/ArcheryAttack/GodSalvation/AmazingGrace. Also added after every
  self/active-action skill resolution (duplicated in the bot's `runPlayPhase` loop and
  `resolveFreeAction`'s branches, since those aren't behind a shared helper) and after
  `discardDownToLimit` actually discards.
- New deterministic test `testSlashTriggersLiveUpdateCallback` (companion to the equip one):
  confirms the callback fires exactly once for a Slash played on another player, with the
  target's `hp` already reduced at the exact moment the callback runs.
- **Verification**: live 2-socket WS test (a pure spectator watching an all-bot game) found the
  first broadcast whose log tail contained `"P5 slashes P4"` / `"P4 takes 1 damage (hp 2/3)"` --
  that SAME broadcast's `players` array already showed P4 at `hp: 2`, not a later one. Live
  headless-browser run (real Puppeteer clicks, no simulated DOM events -- this is what a real
  user sees) drove a full match to a Slash exchange and confirmed the table/log render correctly
  as combat happens in real time. `npx tsc --noEmit` clean; `npm run sim` 28/28 passing.

## Milestone 10 — DONE (equip icons show their EFFECT, not just their name)

User report: equip icons were only ~16px with a hover-only `title` tooltip carrying just the
internal card name -- no indication anywhere of what a weapon/horse actually DOES (attack range,
distance delta) without reading the log or knowing the card by heart.

- `src/server.ts` -- the state snapshot now also sends `weaponRange` and
  `defenseHorseDelta`/`offenseHorseDelta` alongside the existing name fields, straight from the
  Card's own `weaponRange`/`horseDelta` (the same values `player.ts`'s `attackRange` getter and
  `combat.ts`'s `effectiveDistance` already use server-side) -- not hand-copied constants.
- `public/index.html` -- new shared `equipIcons(p)` helper (used by both the table's per-seat
  cards and the player's own big hero panel, which previously showed NO equip row at all): each
  equip renders as a bigger (28px, up from 16px) icon with an always-visible colored number badge
  overlaid on it -- gold for a weapon's Sát range, blue `+1` for a defense horse (others need +1
  distance to reach you), orange `-1` for an offense horse (your distance to others -1). The
  tooltip now also spells out the effect in Vietnamese, not just the card name.
- **Verification**: live headless-browser run (real clicks) through general selection into real
  combat found `Tào Tháo` equipping Axe/JueYing/SixSwords -- table screenshot confirms the gold
  `2`/blue `+1` badges render legibly at both the table-seat size and the larger own-hero-panel
  size. `npx tsc --noEmit` clean; `npm run sim` 28/28 passing.

## Milestone 11 — DONE (general card + skill text was too small to read)

User report: the pick-a-general candidate cards and every skill name/description (table seats,
pick screen) were cramped and hard to read.

- `public/index.html` -- pure CSS pass, no markup/protocol changes:
  - `.generalCard` (pick-a-general candidates): 168px -> 232px wide, portrait 210px -> 240px
    tall, name 17px -> 20px, meta 10.5px -> 11.5px, body padding 12px -> 15px.
  - Shared `.skillName`/`.skillDesc` (used by BOTH the pick-a-general cards and every table
    seat's skill list): 10.5px -> 12px/11.5px, line-height 1.4 -> 1.45, more breathing margin --
    one change point fixes both screens since they already shared the class.
  - `#table`'s side columns (P4/P8 in an 8p game) widened 190px -> 212px so the now-larger skill
    text has room to wrap without feeling more cramped than the top/bottom seats; `#table`/
    `#myHero`/`#myHandWrap`/`#logWrap` max-width bumped 1180px -> 1280px to match so the whole
    page still lines up as one consistent column. Avatar rings and the player id/general name
    text bumped slightly (54px->58px, 13px->14px, 11px->12px) to stay proportional.
- **Verification**: live headless-browser screenshots of both screens -- the pick-a-general
  screen (3 candidates, multi-skill Điền Phong card) and the in-game table (8 seats, real skill
  text like "Sau khi bị thương, có thể bỏ 1 lá để phán...") -- confirm every skill name and
  description now renders clearly legible, not just technically present. `npx tsc --noEmit`
  clean; `npm run sim` 28/28 passing.

## Milestone 12 — DONE (lord's identity leaked in the lobby, before seating/start)

User report: "chủ công" was tagged from the moment the room was created, visible to everyone in
the waiting room -- before any seat was even claimed, let alone the match started -- while every
other role correctly stayed hidden (`?`) until its own proper reveal moment.

Root cause: `assignRoles()` runs in the `Room` constructor, which fires at `createRoom()` --
i.e. in the LOBBY, the moment someone creates a room, well before "Bắt đầu trận đấu". It was
setting `roleShown = true` for the lord right there, so the state snapshot leaked it immediately.

- `src/gamerule.ts` -- `assignRoles()` no longer special-cases the lord's `roleShown`; every
  player starts hidden (`GamePlayer`'s own default), matching every other role's starting state.
- `src/room.ts` -- `Room.pickGenerals()` (the actual "the match has begun" moment -- called right
  after `server.ts`'s `startGame` handler flips `gr.started = true`) now reveals the lord's role
  as its first action, before dealing the first candidate generals. Real Sanguosha rule (the
  lord's identity is public once the match starts) preserved -- just no longer leaked early.
- `testRoleDistribution` updated: asserts NOBODY is shown right after `new Room(...)` (construction
  time), then that only the lord becomes shown after `pickGenerals()` runs.
- **Verification**: live WS test -- the lobby snapshot (right after `createRoom`) shows
  `role: null` for all 8 seats; even the broadcast immediately after `startGame` (`started: true`,
  before `pickGenerals`'s first step) still shows every role hidden; the lord becomes visible on
  the very next broadcast once picking actually begins. Live browser screenshot of the waiting
  room confirms every seat shows `?`, no "CHỦ CÔNG" tag anywhere before Start. `npx tsc --noEmit`
  clean; `npm run sim` 28/28 passing.

## Milestone 13 — DONE (Amazing Grace was "everyone draws 1", not the real reveal-and-draft)

User report: Amazing Grace (Ngu Coc Phong Dang) should reveal N face-up cards (N = alive player
count), then each player takes turns -- starting from whoever played the card -- picking exactly
ONE of the still-available cards, not everyone silently drawing a random one simultaneously. This
was a known, explicitly documented simplification since Milestone 1.5 (trick.ts's header).

- `src/combat.ts` -- new required `EngineContext.askPickCard(player, candidates): Promise<Card>`.
- `src/controller.ts` -- new required `Controller.choosePickCard`; bot default picks
  `candidates[0]` (matches every other "no preference" bot default, e.g. `chooseDiscards`).
- `src/trick.ts` -- `resolveAmazingGrace` rewritten: draws up to `n` cards face-up into a pool
  (fewer only if the draw pile runs out mid-reveal), then loops player-by-player starting at the
  source and wrapping around the table, asking each to pick one and removing it from the pool.
  Falls back to `pool[0]` if a controller returns something not actually in the pool (same
  defensive pattern as `chooseDiscards`'s count/membership check).
- `src/room.ts` -- wired `askPickCard` into `makeContext()`, delegating to the controller.
- `src/server.ts` -- new `choosePickCard` human ask, sending the full revealed `cards` pool;
  timeout/disconnect falls back to the first card (matches the bot default).
- `public/index.html` -- new `choosePickCard` prompt: a wider overlay (`#prompt:has(#pickCardOptions)`)
  showing every still-available card as a clickable face-up option (image + label), no "Bỏ qua"
  (real Sanguosha requires the player whose turn it is to take exactly one, not decline).
- New deterministic test `testAmazingGraceIsATurnOrderDraft`: every player's `choosePickCard`
  deliberately picks the LAST pool card (not the bot's own "first" default) and records order/
  pool size/chosen id; asserts exactly 8 picks, starting at the card's user, wrapping the table
  in seat order, the pool shrinking by exactly 1 each turn, and all 8 chosen cards distinct.
- **Verification**: the deterministic test above proves the server-side draft logic. Live
  browser check (real clicks): injected a `choosePickCard` message directly into the running
  client, confirmed the prompt renders every revealed card as a clickable face-up option with
  the correct title/card count, and that clicking one sends exactly
  `{ type: "response", requestId, cardId }` and closes the prompt -- matching the exact shape
  `server.ts`'s `askClient` interpret function expects. (A full real-game WS run wasn't a
  reliable verification path here -- Amazing Grace is 2 of 85 cards and needs both a lucky draw
  and the bot's `wantsToPlayTrick` to fire in the same real-time session; the deterministic test
  plus the direct client-side proof together already cover both ends of the wire.) `npx tsc
  --noEmit` clean; `npm run sim` 29/29 passing.

## Milestone 14 — DONE (target-picker overlay made legal targets hard to see)

User report (with screenshot): the dim modal overlay behind a target-picker prompt (Slash/Duel/
etc.) made the whole table equally dark, so it was hard to tell which players were actually
legal targets -- the `.candidate` styling only added a border, with a glow shown on `:hover`
only, easy to miss under a 70%-black overlay.

- `public/index.html` (CSS only, no protocol changes):
  - `.player.candidate` now gets an ALWAYS-ON pulsing red glow (`@keyframes candidatePulse`),
    not just on hover -- unmistakable even before the mouse moves.
  - New `.player.noncandidate` (dimmed + grayscaled) applied to every player who is NOT a legal
    target while a prompt is pending, EXCEPT the acting player themself (stays full brightness
    for context) -- a real spotlight effect instead of "everyone equally dark."
  - `#promptOverlay.picking` (used only by `showTargetPicker`, i.e. Slash/trick target prompts)
    dims the backdrop less (0.4 vs the confirm-dialogs' 0.7) so the above highlighting reads
    clearly through it; confirm/equip/dodge/peach-style prompts (no board relevance) keep the
    original heavier dim.
- **Verification**: live browser check -- rendered a real 8-seat table with a `chooseTrickTarget`
  (Duel) prompt naming 3 of 8 as candidates. Screenshot confirms the 3 candidates glow with a
  vivid red highlight, the other 4 fade into the background, and the acting player's own card
  stays fully visible. Clicking a highlighted candidate sent exactly
  `{ type: "response", requestId, targetId }` and closed the prompt. `npx tsc --noEmit` clean;
  `npm run sim` 29/29 passing.

## Milestone 15 — DONE (target-picker box still covered/blocked candidate cards)

User report (with screenshot): Milestone 14 made legal targets glow, but the prompt box itself
was still centered on the viewport -- landing directly on top of whichever player card sat
nearest the middle of the table (often a candidate), visually and physically blocking it (the
box is `pointer-events:auto`, so a candidate hidden underneath couldn't be clicked either).

- `public/index.html` (CSS only): `showTargetPicker`'s prompt (Slash/trick target picking) no
  longer centers on the viewport. `#promptOverlay.picking` now docks it as a slim horizontal
  banner (icon + title + sub + Bỏ qua, all in one row) pinned to the BOTTOM of the viewport
  (`align-items: flex-end`) instead of the middle -- confirm/equip/dodge/peach/pick-card prompts
  are unaffected (still centered, since they don't need to coexist with a visible table). Chose
  bottom-docking over top-docking after measuring the real layout: the gap between the header and
  the table's top row is too small (~18px) to fit even a slim banner without still clipping the
  top-row seats; the bottom of the viewport has no such constraint regardless of how much content
  (hero panel, hand, hand-count) sits above the table that turn.
- **Verification**: `npx tsc --noEmit` clean; `npm run sim` 29/29 passing. Confirmed via computed
  geometry (`getBoundingClientRect`) in a live headless-browser render that the repositioned
  banner no longer overlaps any of the 8 player cards, before finalizing the bottom-dock choice.
  A final post-fix screenshot re-check hit a headless-browser tool/daemon outage unrelated to
  this repo (`browser: open` timed out repeatedly even after killing stale `omp.browser.headless`
  Chrome processes) -- the fix itself is a single, well-understood CSS positioning change
  (`align-items`/`padding-bottom` on a `position:fixed` flex container), and the underlying
  candidate-highlight mechanism it wraps (Milestone 14) was already screenshot-verified unchanged.

## Milestone 16 — DONE (click-to-draw pile + own-role privacy toggle)

Two user requests: (1) the Draw phase gave no interaction at all -- cards just silently appeared
in hand every turn; wanted a face-down draw-pile card in the middle of the table you click to
draw, like a physical deck. (2) a toggle to hide your OWN role, so someone sitting/looking near a
shared screen can't read it off just by glancing over.

### Click-to-draw pile
- `src/controller.ts` -- new required `Controller.wantsToDrawNow(player, count): Promise<void>`;
  bot default resolves immediately (no pause, byte-for-byte unchanged bot behavior/turn speed).
- `src/room.ts` -- `runPhase`'s `Phase.Draw` case now `await`s `wantsToDrawNow` BEFORE calling
  `drawCards`, and fires `onLiveUpdate` right after (same "broadcast the moment it actually
  happens" pattern as every other action since Milestone 9.1) so a human's own draw-pile click is
  immediately visible to spectators/other seats too, not just at turn-end.
- `src/server.ts` -- new `confirmDrawCard` human ask sending `{ actorId, count }`; times out to
  auto-draw (matches the bot default) so an idle/disconnected human never stalls the table.
- `public/index.html` -- a clickable face-down draw-pile card (`image/system/card-back.png`)
  overlays the table's center emblem exactly while a `confirmDrawCard` prompt for MY seat is
  pending, with an always-on pulsing gold glow and a "Rút N lá" label; clicking sends the ack.
  Everywhere else (not my Draw phase, or I'm a bot/spectator) it stays hidden and the normal
  emblem/turn indicator shows through.
- New deterministic test `testDrawPhaseAsksBeforeDrawing`: proves `wantsToDrawNow` is asked
  exactly once, with the correct card count, and the hand-size snapshot captured AT ask time
  still matches the pre-draw count (i.e. the ask genuinely precedes `drawCards`, not just
  logged after the fact).
- **Verification**: live 1-socket WS test with a deliberate 800ms delay before responding to the
  first `confirmDrawCard` -- the state broadcasts during that window all show the pre-draw hand
  count (3) unchanged; the instant the delayed response is sent, the very next broadcast jumps to
  the post-draw count (5 = 3+2), proving the server genuinely blocks the real draw on the human's
  answer, not racing ahead regardless of it. `npx tsc --noEmit` clean; `npm run sim` 30/30 passing.

### Own-role privacy toggle
- `public/index.html` only (pure client-side render toggle, no protocol change -- the server
  already only ever reveals a claiming socket's own role to that socket; this just controls
  whether THIS TAB chooses to display what it already received). New header button (👁/🙈,
  preference persisted in `localStorage`) masks the role text/color/icon specifically for
  `p.id === mySeat` in both the table's own seat card and the big hero panel -- every other
  player's role display is completely unaffected by the toggle.
- **Verification**: unit-tested the exact masking expressions (extracted verbatim from the
  shipped file) against both a "self" and an "other player" input -- confirms hiding masks the
  role label, its color-coded CSS class, AND the lord/renegade icon together (no partial leak via
  any one of the three), and that toggling never touches another player's role display. (A full
  click-through browser screenshot hit the same headless-browser tool outage noted in Milestone
  15 -- unrelated to this change; every other verification layer above is unaffected by it.)

## Milestone 17 — DONE (Peach: proactive self-heal + ally rescue)

User report: "lá đào có thể dùng trong lượt để hồi máu cho bản thân" (Peach should be usable
during your own turn to heal yourself), plus real Sanguosha's other Peach behavior this port was
still missing: when a player is dying, every OTHER alive player (not just the dying player
themself) should get a chance to spend their own held Peach to save them, in turn order starting
right after the dying player.

### Proactive self-heal
- `src/trick.ts` -- new `resolvePeachSelfHeal(ctx, player)`: heals 1 hp, logs it.
- `src/room.ts` -- `computeLegalActions` now offers every held Peach as a `playCard` action
  whenever `player.isWounded()`; `resolveFreeAction`'s switch gained a `CardKind.Peach` case
  (spend the card, heal, live-update). This is the ONLY path a claimed human seat needs --
  freeform play already lists/resolves every action generically, no protocol change required.
- `src/controller.ts` -- new `Controller.wantsToUsePeachSelfHeal(player)`, bot default `false`:
  the fixed automatic bot pass declines it (preserves the pre-existing "bots never proactively
  burn Peach/Analeptic outside a real dying emergency" behavior other tests already depend on);
  a small bot-pass loop in `room.ts` wires the hook for parity/testability even though real
  human seats never reach it (they always have `chooseFreeAction`, which skips the fixed pass).
- New deterministic test `testFreeformPlayLetsHumanSelfHealWithPeach`: wounds the lord by 1 via
  `damagePlayer`, seeds exactly 1 Peach in hand, drives a real `playTurn()` through a
  `chooseFreeAction` controller, and confirms the card appeared in `legalActions`, healed exactly
  1 hp, left the hand, and logged.

### Ally rescue
- `src/combat.ts` -- new `EngineContext.askPeachForOther(rescuer, dyingPlayer): Promise<boolean>`;
  `resolveDying` rewritten: after the dying player's own self-rescue (`askPeach`) declines/runs
  out, it now loops every OTHER alive player once, in turn order starting right after the dying
  player and wrapping the table, offering each a chance to spend their own held Peach to save
  them -- stops at the first acceptance, repeats the whole self-then-others cycle if still <=0
  hp afterward, and only gives up (recording the death) once nobody at all can or will help.
- `src/controller.ts` -- new `Controller.wantsToUsePeachForOther(rescuer, dyingPlayer)`. Bot
  default `false` (deliberately, unlike every other self-serving ask's `true` default): whether
  to spend YOUR OWN card to save someone ELSE is a genuinely strategic, role-aware decision this
  simple greedy policy doesn't model, and defaulting it to `true` would have made bots spend
  Peaches on allies unconditionally -- breaking `testCascadingDeathDoesNotOverwriteGameOver`'s
  premise (confirmed live: that regression failed until this default was set to `false`).
- `src/server.ts` -- new `confirmPeachForOther` human ask, sending `{ actorId, dyingPlayerId }`;
  times out to `false` (declining), matching the bot default and the existing "offensive/
  optional-resource action" fallback policy.
- `public/index.html` -- new prompt branch showing the dying ally's general name/portrait art
  ("`<Tên tướng>` đang hấp hối! Dùng Đào để cứu đồng minh?"), reusing the existing generic
  `showConfirm` yes/no prompt component.
- New deterministic test `testAllyRescuePeachSavesADyingPlayer`, driven directly through
  `resolveSlash` (pure): dying player declines self-rescue, the first ally in turn order holds a
  Peach but declines, the second accepts -- proves the exact turn order, that a decline doesn't
  stop the loop, that the accepting rescuer's card (and only theirs) is spent, and the correct
  log line/credited outcome.
- **Verification**: `npx tsc --noEmit` clean; `npm run sim` 32/32 passing (including both new
  tests above). Live browser check: injected a `WebSocket` spy via `page.evaluateOnNewDocument`
  to capture the real page's `onmessage` handler before its own `connect()` ran, fed it a
  synthetic `state` broadcast + `confirmPeachForOther` message, and confirmed the rendered prompt
  showed the correct dying player's name ("Tôn Kiên đang hấp hối!") with the Peach card art, and
  that clicking "Đồng ý" sent back the exact expected `{ type: "response", requestId, value:
  true }` payload.

## Milestone 18 — DONE (single-port deploy: server now also serves the client)

User asked how to deploy this for other people to actually play together. Previously the client
(`public/index.html`) had to be opened as a local `file://` page, hardcoded to `ws://<hostname>:
8787` -- fine for same-machine/LAN testing, but unworkable for a real public deployment (no way
to serve the page itself, and `file://` pages can't be reached by anyone else; also no `wss://`
support, which browsers require once the page is served over `https://`).

- `src/server.ts` -- the `WebSocketServer` now attaches to a plain `node:http` server instead of
  listening on its own bare TCP port; that http server also serves `public/index.html` at `/`
  plus this repo's own `image/`/`font/` asset directories (which `index.html` already referenced
  via `../../image`, `../../font` -- unchanged) at `/image/*` and `/font/*`. Static serving is a
  small hand-rolled whitelist (no new dependency): only those 2 prefixes + `/`/`/index.html` are
  ever read from disk, with an explicit path-traversal guard. Net effect: ONE process, ONE port
  (`PORT` env, default 8787) serves everything -- a deployment only ever needs to expose/forward
  that single port, instead of separately hosting static files and the WebSocket API.
- `public/index.html` -- `connect()` now builds the WebSocket URL from the page's OWN
  `location.protocol`/`location.host` (`wss://` automatically when the page itself is served over
  `https://`, same host, no hardcoded port) instead of a hardcoded `ws://<hostname>:8787`. Falls
  back to `ws://localhost:8787` only when there's no `location.host` at all (i.e. still opened
  directly as a local `file://` page for quick dev iteration without even running the server's
  static half).
- **Verification**: `npx tsc --noEmit` clean; `npm run sim` 32/32 passing. Live check: restarted
  the server and confirmed over real HTTP (not `file://`) that `GET /` serves the page (200,
  `text/html`), `GET /image/card/peach.png` and `GET /font/UTMThuPhap.ttf` serve the real assets
  (200, correct `Content-Type`), an unknown path 404s, and a `../../../etc/passwd`-style
  traversal attempt also 404s (blocked, not served). Loaded `http://localhost:8787/` in a real
  browser tab end-to-end and confirmed the status line reads "Đã kết nối" (connected) -- the
  same-origin `wss`/`ws` auto-detection actually works, not just type-checks.

## Milestone 19 — DONE (Analeptic: Slash damage buff + rescue-card parity with Peach)

User asked what Tửu (Analeptic) does, then to implement it -- it existed only as a dealt card
with zero effect (usable as a generic skill-cost payment or discarded when over the hand limit,
nothing else). Real Sanguosha gives it 2 distinct effects, traced from the upstream engine's
`Analeptic::onEffect`/`Slash::onEffect` (`src/package/standard-basics.cpp`,
`src/server/gamerule.cpp`'s `SlashHit` handling): (1) played proactively during your own Play
phase, it arms a +1 damage bonus for the very next Slash you play that turn; (2) played on a
dying player (self or an ally), it heals 1 hp exactly like Peach -- the two effects are
distinguished purely by WHEN it's played (a dying-rescue ask vs. a normal Play-phase action), not
by any player choice.

### Slash damage buff
- `src/player.ts` -- new `pendingSlashBonusDamage` field, separate from the existing
  `pendingBonusDamage` (Luoyi's more general "next damage of any kind"): Analeptic's real card
  text specifically boosts a Slash, not Duel/AOE/self-inflicted skill damage, so it needed its
  own dedicated, narrowly-scoped consumption point instead of reusing the generic one.
- `src/combat.ts` -- `resolveSlash` now reads and clears `attacker.pendingSlashBonusDamage` the
  instant a Slash begins resolving (before the Jink-dodge check even runs, matching the upstream
  `Slash::onEffect`'s consumption timing exactly) and adds it to the final damage amount. A
  dodged or nullified Slash still wastes an already-armed bonus, same as the real rule.
- `src/trick.ts` -- new `resolveAnalepticBuff(ctx, player)`: increments the pending bonus, logs
  it. No once-per-Play-phase cap is enforced (the real rule limits Analeptic itself to 1 use per
  turn) -- deliberately consistent with this engine's existing "no once-per-kind-per-turn cap,
  only Slash has an explicit limit" simplification already used by every other proactive
  trick-like card in the freeform Play phase (ExNihilo, GodSalvation, etc.).
- `src/controller.ts`/`src/room.ts` -- new `Controller.wantsToUseAnalepticBuff`, bot default
  `false` (same reasoning as Milestone 17's `wantsToUsePeachSelfHeal`: bots never proactively
  burn Peach/Analeptic outside a real dying emergency -- an EXISTING test,
  `testDiscardChoiceLetsHumanPickWhichCards`, explicitly depends on this for Analeptic too).
  Wired into `computeLegalActions`/`resolveFreeAction` (unconditional, like ExNihilo) for the
  real human choice, plus a parity/testability-only bot-pass loop that's a no-op in practice
  since the bot always declines.
- New deterministic test `testFreeformPlayLetsHumanBuffSlashWithAnaleptic`: seeds exactly 1
  Analeptic + 1 Slash, drives a real freeform turn playing both in order at an empty-handed
  (guaranteed-hit) target, confirms 2 damage landed (not 1) and the bonus field is fully
  consumed afterward.

### Rescue-card parity with Peach
- `src/combat.ts` -- the old Peach-only `findPeachLikeCard` renamed `findRescueCard` and
  extended to match real Analeptic cards too (not just Peach/viewAs); new `rescueCardLabel`
  helper so `resolveDying`'s log correctly says "analeptic" or "peach" by the REAL card kind
  used, instead of mislabeling a genuine Analeptic rescue as a "views a card as peach (viewAs
  skill)" substitution (that line is now reserved for actual viewAs skills, e.g. Jijiu).
- New deterministic test `testAnalepticSelfRescuesADyingPlayer`: a dying player holding only an
  Analeptic (no Peach) self-rescues, driven directly through `resolveSlash`; confirms survival,
  the card being spent, and the exact log wording ("uses analeptic to recover", not "peach" and
  not a "views a card as" viewAs-substitution line).
- **Regression fix**: `testCascadingDeathDoesNotOverwriteGameOver`'s seeded loyalist could
  randomly hold an Analeptic and now self-rescue from the Suishi cascade (bots always accept
  self-rescue) -- fixed by explicitly clearing that player's hand in the test setup, since the
  test's actual intent (the win-condition-overwrite bug) doesn't depend on what they're holding.
- **Verification**: `npx tsc --noEmit` clean; `npm run sim` 34/34 passing (including both new
  tests above). Live browser check: same `WebSocket`-spy technique as Milestone 17/18 --
  injected a `chooseFreeAction` message with an Analeptic entry in `legalActions`, confirmed the
  hand rendered it as a clickable "Tửu"-labeled card with working card art
  (`GET /image/card/analeptic.png` 200), and that clicking it sent back the exact expected
  `{ type: "response", requestId, actionId }` payload.

## Milestone 20 — DONE (14 more skills ported, closing most "sibling skill deferred" gaps)

User asked to add the missing skills for the remaining generals. `skill.ts`'s `GENERALS` array
documented 21 of the 44 ported generals as missing a sibling skill, each with an inline reason
(needs pindian, judge-area, multi-card viewAs, equip-onto-another-player, etc.). This milestone
recovered the real Vietnamese skill text from this repo's own git history --
`lang/vi_VN/Package/Standard{Shu,Wei,Wu,Qun}General.lua` were tracked before a later "strip
legacy desktop client" commit deleted them from the working tree, but the blobs are still
reachable at the pre-strip commit -- instead of re-guessing from generic Three Kingdoms Kill
domain knowledge the way some of those inline comments originally were. That immediately
surfaced 2 comments that were flat wrong (Cao Cao's Standard kit has no 2nd skill in this
repo's actual localization -- "Hujia" doesn't exist in it at all; Huang Zhong's
"LiegongRange" is a Hegemony-lord-only extension of Liegong itself, not a distinct 2nd
Role-mode skill) and 1 that was overly pessimistic (Duoshi turned out to be an ordinary
immediate AOE trick once the real card text was checked against upstream, not delayed-trick-
dependent -- see below).

**14 skills ported across 13 generals**, all reusing EXISTING generic asks
(`askUseSelfAction`/`askChooseAnyPlayer`/`askPickCard`/`askChooseDiscards`) instead of adding
new Controller/server.ts/client-UI wiring per skill -- zero new WebSocket message types, zero
new client-side prompt branches:
- **Luoshen** (Zhen Ji): new `Phase.Start` `otherPhaseAction` -- repeated self-judgment (reusing
  Guicai's `judge()` helper) while the result stays black and she keeps choosing to continue;
  all black judgment cards collected go to her hand.
- **Fanjian** (Zhou Yu): reveals+gives 1 hand card to a chosen target, who then chooses between
  discarding every hand/equipped card matching that card's suit or losing 1 hp. No suit-
  guessing UI needed (the card is revealed openly) -- a prior comment guessing otherwise was
  wrong.
- **Lieren** (Zhurong) / **Quhu** (Xun Yu): new shared `pindian()` helper (card-point duel) --
  both sides reveal 1 card via `askPickCard` (reused for "pick 1 of your own hand", not just
  Amazing Grace's original draft-pool shape); higher point wins, a tie favors the opponent (the
  side that INITIATED the pindian loses ties, the real rule). New `onSlashDamageDealt` hook
  (Lieren specifically fires after SLASH damage, not any damage, same reasoning as
  KylinBow/DoubleSword/Triblade already being resolved inline in `resolveSlash`).
- **Jieyin** (Sun Shangxiang): discard 2, pick a wounded male player, both heal 1.
- **Dimeng** (Lu Su): pick 2 other players, pay up to X of Lu Su's own cards (X = their hand-
  count difference), swap their hands.
- **Zhijian** (Erzhang): places a held equip card into another player's matching slot, draws 1.
  New `EngineContext.equipPlayer`, wrapping Room's already-recipient-generic private `equip()`.
  Unreachable through normal bot play (the bot's own always-equip pass in `runPlayPhase` spends
  any equip card from hand before a `selfAction` skill gets a turn) -- proven by a dedicated
  test instead of log-mining, same class as Wushuang.
- **Lijian** (Diao Chan): discard 1, pick 2 other male players -- the 2nd-chosen is compelled
  into using Duel against the 1st-chosen, via `resolveDuel` imported directly from `trick.ts`
  (no circular import: `trick.ts` never imports `skill.ts`).
- **Wansha** (Jia Xu): new `suppressesAllyRescue` locked-skill hook -- while it's Jia Xu's own
  turn (`player.phase !== NotActive`), `resolveDying`'s ally-rescue loop is skipped entirely
  (self-rescue unaffected).
- **Luanwu** (Jia Xu): once per GAME (new `GamePlayer.usedLimitSkills` set), every other player
  is compelled to Slash whoever's nearest to them (via `resolveSlash` imported directly from
  `combat.ts`) or lose 1 hp -- their own choice, asked via a synthetic `"luanwu-slash"` prompt
  name (same precedent as Xiaoguo's `"xiaoguo-defend"` ask on a non-owning player).
- **Xiongyi** (Ma Teng): once per game, every ally draws 3; heals 1 if his Role-mode side
  currently has the fewest alive members.
- **Guidao** (Zhang Jiao): reuses Guicai's `onJudgment` retrial hook directly (any judgment,
  not just his own), restricted to discarding a black card. `judge()`'s retrial log line was
  hardcoded to always say "dùng Quỷ Tài" (Guicai's own name) regardless of which skill actually
  triggered it -- fixed to name the real triggering skill's `displayName` dynamically, since
  Guidao now shares the same code path.
- **Lirang** (Kong Rong): new `redirectsOwnDiscard` hook -- may redirect a card of his own
  about to enter the discard pile (via a genuine discard, not being played) straight to another
  player's hand instead. `discardRandom` (shared by 6 skills) and `discardDownToLimit`'s
  over-limit discard now route through a new exported `routeDiscard` helper that checks this;
  proactive self-paid skill costs elsewhere are NOT intercepted (deliberate scope line, not a
  bug -- same "faithful behavior, simplified interaction" precedent used throughout).
- **Duoshi** (Lu Xun): up to 4 times per Play phase, converts a red hand card into playing
  [Await Exhausted] (Dĩ Dật Đãi Lao). Confirmed via a live web search against upstream (三国杀)
  that this is a genuine IMMEDIATE AOE trick (self + all allies each draw 2 then discard 2),
  NOT a delayed trick, despite `card.ts`'s header lumping "AwaitExhausted" into a combined
  "needs delayed-trick/judge-area OR a reactive counter-play stack" exclusion blurb covering 11
  different trick kinds at once. Implemented inline (no new `CardKind`/`trick.ts` resolver/
  `canViewAs*` hook) since no other general ever draws this card for real.
- **Fangquan** (Liu Shan): 2 new structural hooks, since Play-phase-skip and extra-turn-grant
  don't fit the existing per-skill hook shapes. `canSkipPlayPhase` (ask-gated, unlike Keji's
  compulsory `skipsDiscardPhase`) consulted directly in `Room.runPhase`'s `Phase.Play` case.
  `grantsExtraTurn` consulted in the `Phase.Finish` case, pushing the chosen recipient onto a
  new `Room.extraTurnQueue`; `playTurn()` now drains that queue first each call -- an
  extra-turn player never touches `currentIndex`, so the normal rotation resumes exactly where
  it would have otherwise once the queue drains.

**Still genuinely blocked** (unchanged from before, now with corrected reasoning): Guojia's
Tiandu (needs Guo Jia to ever own a delayed-trick judgment -- he has no self-judgment source of
his own, so this needs the delayed-trick/judge-area subsystem `card.ts`'s header explicitly
excludes), Da Qiao's Guose (needs the real Indulgence delayed-trick card, same reason), and Cai
Wenji's Duanchang (needs the dual-general head/deputy mechanic, explicitly out of scope for Role
mode per this file's own header). The other 16 fully-unported Standard generals from Milestone
2.6 remain unchanged.

- 2 existing tests needed adjustment, not because of a bug, but because 2 new compelled-action
  mechanics (Luanwu forcing a Slash, Lijian forcing a Duel) legitimately bypass the exact
  Controller hooks (`chooseSlashTarget`, `wantsToPlayTrick`/`chooseTrickTarget`) 2 pre-existing
  tests asserted a declining seat would therefore never trigger -- both compelled paths are
  real, intentional game behavior, so the tests were tightened to also decline the specific
  compelled prompt rather than deleted or weakened.
- 3 new dedicated deterministic tests for behavior too rare/never-bot-reachable to log-mine:
  `testZhijianEquipsAnotherPlayer`, `testWanshaBlocksAllyRescueDuringOwnTurn` (both during AND
  outside Jia Xu's own turn), `testPindianTieBreakFavorsOpponent`. `testGeneralSkillsAppearInPlay`
  gained markers for the other 13 new skills.
- **Verification, three layers:** (1) `npx tsc --noEmit` clean. (2) `npm run sim` 64/64 passing.
  (3) Live `ws` server: created rooms with 5-10 all-bot seats and drove several full games to
  `gameOver` with zero uncaught errors server-side.

## Milestone 21 — DONE (delayed-trick/judge-area subsystem, closing Guojia's Tiandu)

User asked to close Guojia's remaining gap (Tiandu). Real Tiandu ("after your judgment takes
effect, you may take it") only ever matters when Guo Jia owns a judgment -- and he has no
self-triggered judgment source of his own (Yiji doesn't judge), so this genuinely needed the
delayed-trick/judge-area subsystem this repo explicitly excluded since Milestone 1.6. Rather
than stub it, built the minimum real subsystem: `GamePlayer.judgeArea` (cards currently
attached) + a real Judge phase (`Room.runJudgePhase`, previously a no-op) + Indulgence (Lạc Bất
Tư Thục) as the one delayed trick actually implemented -- confirmed via a live web search
against upstream (三国杀) that it's a genuine delayed trick (unlike Duoshi's AwaitExhausted from
the prior milestone, which turned out NOT to be one).

- `src/card.ts` -- new `CardKind.Indulgence`, 2 real cards added to the dealt deck (Club 6/
  Spade 6, 2 of the real 3-copy Club6/Heart6/Spade6 set -- this repo's dev-branch source only
  carries 2 per this file's own header; suit has no functional effect on the judgment, only the
  freshly drawn card's suit does).
- `src/combat.ts` -- `SUIT_LABEL_VI` and the shared `judge()` retrial helper MOVED here from
  skill.ts (both now exported) so `trick.ts` can share them without a circular import
  (skill.ts already imports `resolveDuel` from trick.ts, so `judge` can't live in either file
  without one). New `disposeJudgmentCard(ctx, judgeOwner, card)`: discards a resolved judgment
  card unless `judgeOwner`'s `claimsOwnJudgment` skill (Tiandu) claims it into hand instead.
  `judge()`'s retrial log line was hardcoded to always say "dùng Quỷ Tài" (Guicai's own name)
  regardless of which skill actually triggered it -- fixed to name the real triggering skill's
  `displayName` dynamically (Guidao already shared this path since the prior milestone; this
  bug was latent until now).
- `src/player.ts` -- new `judgeArea: Card[]` (delayed tricks currently attached) and
  `forcedSkipPlayPhase` (armed by a failed Indulgence judgment, consumed the instant the
  owner's own Play phase is reached).
- `src/trick.ts` -- `indulgenceCandidates` (any OTHER player without one already attached --
  real rule: no 2 copies of the same delayed trick in one judge area), `attachIndulgence`
  (respects Qianxun's new `blocksIndulgenceEntry`, see below), `resolveIndulgenceJudgment`
  (Judge-phase resolution: `judge()` + skip-Play-phase-on-non-Heart + `disposeJudgmentCard`;
  the Indulgence card itself always ends up discarded afterward -- this repo's ported revision
  doesn't cycle it back for a 2nd attempt).
- `src/room.ts` -- real `Phase.Judge` handling (`runJudgePhase`: resolves every card in
  `judgeArea`, in placement order); new `tryPlayDelayedTrick` (like `tryPlayTargeted`, but
  ATTACHES instead of discarding -- shares the same Weimu black-trick-immunity gate); wired
  into both the bot's fixed pass and the human freeform path
  (`computeLegalActions`/`resolveFreeAction`); `Phase.Play` now checks `forcedSkipPlayPhase`
  before Fangquan's optional skip.
- `src/skill.ts` -- **Tiandu** (Guojia): `claimsOwnJudgment` hook, reuses the generic
  `askUseSelfAction` ask, zero new wiring. **Qianxun's (Lu Xun) 2nd clause**, newly relevant
  now that Indulgence actually exists: new `blocksIndulgenceEntry` hook -- an Indulgence
  targeting him is discarded immediately instead of ever attaching (his existing Snatch
  immunity was the only clause modeled before, since the 2nd one had nothing to apply to).
- `src/controller.ts`/`src/library.ts` -- `DISCARD_IMPORTANCE`/`KIND_INFO` are
  `Record<CardKind, …>`, so both needed an Indulgence entry to keep compiling; `public/
  index.html`'s `TRICK_LABEL` too, for a real Vietnamese name instead of the raw kind string
  (the `image/card/indulgence.png` asset already shipped, unused until now).
- 2 existing tests needed adjustment (not bugs): `testAmazingGraceIsATurnOrderDraft` (seed 1's
  lord turned out to be Xun Yu, whose Quhu -- from the prior milestone -- also calls
  `choosePickCard` for its pindian reveal; rewrote the test to extract the contiguous run of
  picks whose pool sizes count down `n, n-1, …, 1`, instead of assuming every recorded call
  belongs to the AmazingGrace draft); `totalCardsInPlay`/`DECK_SIZE` updated for the 2 new
  cards and to include `judgeArea` in the conservation sum (a card sitting in a judge area
  wasn't counted by hand/equip/draw-pile/discard-pile).
- 3 new dedicated deterministic tests (Tiandu's precondition -- Guojia both owning a judgment
  AND accepting the claim -- is too rare an intersection to log-mine reliably, same class as
  Zhijian/Wansha): `testIndulgenceSkipsPlayPhaseOnFailedJudgment` (non-Heart arms the skip,
  Heart doesn't), `testTianduClaimsOwnJudgmentCard`, `testQianxunBlocksIndulgenceEntry`.
  `testGeneralSkillsAppearInPlay` gained an `indulgence` marker (log-mines fine now that any
  general can hold+play it, unlike Tiandu's rarer intersection).
- **Verification, three layers:** (1) `npx tsc --noEmit` clean. (2) `npm run sim` 67/67
  passing. (3) Live `ws` server: 5 real all-bot games to completion/near-completion, zero
  uncaught errors; every one logged a real Indulgence judgment and Play-phase skip in actual
  gameplay, confirming the whole pipeline (not just isolated unit tests).

**Post-Milestone-21: Guose (Da Qiao) too, closing the other gap this subsystem was built for.**
User asked to also close Da Qiao's gap. Real Guose ("during your Play phase, you may convert a
held Diamond card into playing [Indulgence]") turned out nearly free once the delayed-trick
plumbing above existed -- just a viewAs hook, same shape as Wusheng/Qixi/Jijiu:
- `src/combat.ts` -- new `findIndulgenceLikeCard`/`allIndulgenceLikeCards`, the same pair
  pattern every other viewAs-eligible trick kind already has (Dismantlement/Duel/Slash).
- `src/skill.ts` -- new `canViewAsIndulgence` hook; **Guose** registered on Da Qiao:
  `canViewAsIndulgence: (card) => card.suit === Suit.Diamond`.
- `src/room.ts` -- `tryPlayDelayedTrick` was missing the "biến 1 lá bài thành X (kỹ năng biến
  hóa)" viewAs log line every other `tryPlay*` method already has (harmless while only real
  Indulgence cards existed to play; a latent gap, not a new bug) -- added. Bot fixed pass now
  finds Indulgence via `findIndulgenceLikeCard` (real card OR Guose's Diamond conversion);
  `computeLegalActions` now offers every real-or-viewAs-eligible card via
  `allIndulgenceLikeCards`, matching Dismantlement/Duel's existing freeform-play treatment.
- New deterministic test `testGuoseLetsADiamondCardBePlayedAsIndulgence` (pure, same shape as
  the existing Qicai/Wushuang viewAs proofs); `testGeneralSkillsAppearInPlay` gained an
  `indulgenceViewAs` marker (log-mines fine, same reliability class as Guose's Diamond supply).
- **Verification:** `npx tsc --noEmit` clean; `npm run sim` 69/69 passing; 3 more live `ws`
  server games to completion, zero errors.

**Only 2 of the 44 ported generals remain genuinely incomplete now:** Cao Pi's Fangzhu (needs
face-up/down state) and Cai Wenji's Duanchang (needs the dual-general head/deputy mechanic,
out of scope for Role mode).

## Milestone 22 — DONE (optional display name, so players can tell each other apart)

User asked for a way to set a name before entering a room, to identify who's who -- every seat
was only ever labeled "P1".."P10", with no way to tell which real person was behind which one.

- `src/server.ts` -- new `displayNames: Map<WebSocket, string>` (keyed by socket, not room, so
  it survives leaving/rejoining a room without re-entering it; capped at 24 chars). New
  `"setName"` message (works from the lobby or mid-room, like `"listLibrary"` -- no room/seat
  required): sets or clears the name, then re-broadcasts the current room's state if the socket
  is watching one. Cleaned up on disconnect (`ws.on("close")`) to avoid an unbounded leak across
  reconnects. `snapshot()`'s per-player payload gained `playerName`: whatever name the socket
  holding that seat (`gr.claimedSeats.get(p.id)`) has set, or `null` for bot/empty/nameless
  seats -- fully backward compatible, a claimed-but-nameless human just shows the bare P-id like
  before this feature existed.
- `public/index.html` -- a persistent name field in the header (`localStorage`-backed, same
  convention as the existing `hideOwnRole`/`soundEnabled`/`fxEnabled` toggles), committed on
  blur/Enter (not every keystroke, to avoid spamming `setName` + a room-wide re-broadcast per
  character typed) and re-sent on every fresh connection (the server only knows it per live
  socket). Shown: prominently in each seat card (`Minh` with a small secondary `P1` tag,
  replacing the bare id), in the pre-start "Đã có người" claimed-seat label, in "Đang điều
  khiển"/"Đang đi"/"Đang chờ ... chọn tướng" status text, and substituted into the battle log
  text itself (every whole-word P-id occurrence annotated, e.g. "P1 xuất Sát vào P2" ->
  "Minh (P1) xuất Sát vào P2") via a new `namedLog` helper.
- **Security note:** this is the first feature where genuinely free-form user-typed text (not
  server-owned game data) flows into an `innerHTML` template string (the seat card, the
  claimed-seat label) -- unescaped, a malicious player's name could have injected markup/script
  into every other client watching that room (stored XSS). New `escapeHtml` helper (a
  `textContent`-into-`div.innerHTML` round-trip) wraps `p.playerName` at both `innerHTML` call
  sites. Every other `nameFor`/`namedLog` use case only ever assigns to `.textContent`
  (inherently HTML-injection-safe), so no escaping needed there.
- **Verification:** `npx tsc --noEmit` clean; `npm run sim` 69/69 passing (server.ts changes
  don't touch the engine, no regressions). Live checks: a real headless-browser session setting
  a name and claiming a seat rendered exactly `Minh <span class="seatIdTag">P1</span>` in the
  actual seat card DOM; a 2-real-WebSocket-client script proved cross-client visibility (client
  B, no name set, sees client A's `playerName: "Minh"` for the seat A claimed) and live
  re-broadcast on rename (B receives `playerName: "MinhV2"` the instant A calls `setName` again,
  no reconnect needed).

## Milestone 23 — DONE (Hegemony / Quốc Chiến mode: kingdom-team foundation)

User asked to add Quốc Chiến (国战 / Hegemony) as a full second game mode. Real Hegemony is a
substantially bigger ruleset than Identity mode took 22 milestones to reach: the modern official
rules (confirmed against gltjk.com/sanguosha/rules, the 3.0 rulebook, and Mogara's own
`QSanguosha-For-Hegemony` README) add a dual-general (主将/副将) system with face-down/face-up
(暗置/明置) kingdom reveal, 珠联璧合 paired-general bonuses, 阵法技 formation skills, 围攻/队列
pincer/formation positional mechanics, and a late-game "Ao Chiến" (鏖战) Peach restriction -- each
a genuinely separate subsystem, several bigger than any single milestone this repo has shipped so
far. This milestone ships the real, playable CORE of Hegemony end to end -- kingdom-team setup,
the official Ambitionist overflow rule, faction-based ally/win-condition logic, full server+client
wiring -- and explicitly defers the rest, same one-line-per-deferral convention used for every
general/skill gap noted throughout this file.

**Ported ruleset** (single-general, kingdom visible from the start -- see "Deferred" below for
exactly what that simplifies away):
- 4 real kingdoms (Wei/Shu/Wu/Qun), each a genuine team -- not "3 kingdoms + a no-team Qun".
- A kingdom's team size is capped at `floor(playerCount/2)` (gltjk.com/sanguosha/rules/glossary/
  guo.html's 明置 entry, independently cross-checked against the modern client's own published
  6/7p-4th-same-kingdom and 8/9p-5th-same-kingdom examples). Whoever would overflow that quota for
  their kingdom becomes an Ambitionist (Dã Tâm Gia) instead: a solo faction of exactly one, allied
  with nobody (not even another Ambitionist), who must eliminate every other living player alone
  to win.
- Win condition: the instant every living player shares one faction, that faction wins -- the
  whole team for Wei/Shu/Wu/Qun, the sole survivor for an Ambitionist. Both are the exact same
  "only one faction left standing" check (`checkHegemonyWinCondition`), no special-case branch.

**Engine (`src/types.ts`/`src/player.ts`/`src/gamerule.ts`/`src/room.ts`):**
- `types.ts` -- new `GameMode` enum (`Identity`/`Hegemony`); `Role` untouched, Identity-only.
- `player.ts` -- `GamePlayer` gained `faction` (team key: a kingdom string for a team player, a
  per-player-unique `"ambitionist:<id>"` for an Ambitionist) and `isAmbitionist`.
- `gamerule.ts` -- new Hegemony section: `KINGDOMS`, `KINGDOM_LABEL_VI`, `AMBITIONIST_LABEL_VI`,
  `assignHegemonyFaction` (the quota/overflow decision for one player, called in pick order),
  `checkHegemonyWinCondition`, `factionLabelVI` (mode-aware per-player log label). `isAlly` now
  checks `faction` FIRST when either side has one set, falling through unchanged to the original
  Role-based partition otherwise -- since Identity mode never sets `faction`, this is a strict
  superset with zero behavior change for existing games (confirmed: all 69 pre-existing tests
  still pass byte-for-byte unseeded). `WinResult.winners` widened from `Role[]` to `string[]`
  (a real Role IS a string at runtime -- string enum -- so this is a pure widening, not a
  behavior change; Identity mode's existing `checkWinCondition` is completely untouched).
- `room.ts` -- `Room`'s constructor takes an optional `mode` (defaults `Identity`, so every
  existing `new Room(...)` call site -- 60+ across simulate.ts -- needed zero changes). Hegemony
  mode skips `assignRoles()` entirely (no Lord/Loyalist/Rebel/Renegade) and starts turn order at a
  random seat instead of the lord's. `pickGenerals()` threads a running per-kingdom count +
  `floor(n/2)` quota through its existing turn-order draft loop, calling `assignHegemonyFaction`
  right after each player's general (and therefore kingdom) is chosen -- no separate "declare a
  kingdom" step, since this port has no hidden-kingdom phase to declare it in (see "Deferred"). The
  Rebel-kill-reward and Lord-kills-Loyalist-punishment blocks in `killPlayer` are explicitly gated
  `this.mode === GameMode.Identity` (they were already inert for Hegemony players, whose `role`
  never gets assigned and stays its harmless default -- but the explicit gate documents that
  instead of relying on it). Every log line that used to embed a raw Role label (`killPlayer`'s
  death line, the per-turn `--- Lượt N: ... ---` banner, `pickGenerals`'s post-draft summary, the
  win-condition line) now goes through `factionLabelVI`/a small mode branch instead.

**Server + client (`src/server.ts`/`public/index.html`):**
- `server.ts` -- `GameRoom` gained a `mode` field, fixed at `createRoom` time from a new
  `{type:"createRoom", mode:"hegemony"|"identity"}` field (defaults `identity` if omitted/
  unrecognized, so old clients/messages keep working unchanged). `startGame` threads `gr.mode`
  into the real `new Room(activeIds, undefined, gr.mode)` construction. `roomSummary()` (lobby
  list) and `snapshot()` (in-room state) both now expose `mode`; `snapshot()`'s per-player payload
  gained `faction`/`isAmbitionist`, and `role` is forced `null` for Hegemony players (they have no
  hidden Role to fog -- Hegemony's own visibility model is kingdom-from-the-start instead).
- `public/index.html` -- new mode toggle (`Vai trò` / `Quốc Chiến`) above "Tạo phòng mới", sent
  with `createRoom`; each lobby room row shows a `.roomMode` badge. New shared `factionBadge(p,
  masked)` helper (mirrors `factionLabelVI` -- same 2-call-site shape: the table player card and
  the own-hero panel) renders Identity's existing Role badge OR Hegemony's kingdom badge (new
  `.role-kingdom` CSS class, colored via the SAME `--kcolor` custom property the avatar ring
  already used per-kingdom) / Ambitionist marker (reuses `.role-renegade`'s purple "solo outsider"
  styling -- no new color needed, the visual metaphor already fit). The win banner now branches on
  `state.mode`: Identity keeps its `Role[]` label join; Hegemony looks up the winning player(s)
  and shows the kingdom label, or `Dã Tâm Gia (<name>)` for an Ambitionist win.

**Tests (`src/simulate.ts`):** 4 new tests, all passing alongside the pre-existing 65 (zero
regressions, confirmed by an unmodified full run before AND after): `testAssignHegemonyFaction
RespectsQuota` (pure -- quota=2, 3rd same-kingdom pick becomes an Ambitionist, a different
kingdom right after is unaffected), `testHegemonyWinCondition` (pure -- team win needs only that
kingdom alive, Ambitionist win needs sole survivorship), `testHegemonyIsAllyUsesFactionNotRole`
(pure -- same faction allies despite differing legacy `role`, 2 different Ambitionists never
ally), `testEmergentHegemonyGameReachesWinCondition` (mirrors the Identity-mode emergent-combat
proof: a REAL `pickGenerals()` draft + naive bot play alone, no scripted damage, across up to 20
seeds of an 8-player table, asserting the quota invariant right after the draft and a real faction
-consistent win by the end).
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 69/69 passing (65
  pre-existing + these 4 new -- confirmed no regressions by an unmodified pre-Hegemony run first).
  (2) Live `ws` client: a real 10-player Hegemony game (`{type:"createRoom", mode:"hegemony"}`)
  ran to a genuine win (`Ngụy thắng`, one surviving Wei player crediting the whole assigned-then-
  eliminated roster correctly) with every log line -- turn banners, deaths, the final result --
  showing kingdom labels, not stale Role labels (a real bug caught and fixed live: the per-turn
  `--- Lượt N ---` banner was still calling the raw `ROLE_LABEL_VI[player.role]` after the other 3
  call sites were already fixed -- found because a live 10p game showed `P4 (Nội gián)` instead of
  a kingdom, fixed by routing it through `factionLabelVI` too, re-verified clean afterward). A
  second live run (6x 5-player games, tightest quota) reproduced a real Ambitionist: P4's 3rd
  same-kingdom pick correctly became `faction: "ambitionist:P4"`, and the log showed P4 killing
  every other player one by one before `Kết thúc ván: Dã Tâm Gia thắng`. (3) Real headless-browser
  run: selected "Quốc Chiến" in the lobby (button highlight confirmed), created a 10-player room,
  bot-filled every seat, started it -- the table rendered real per-kingdom badges (`THỤC`, `QUẦN`,
  `NGỤY`, ...) in place of Role badges with no layout breakage, and the game ran to a real win with
  the banner correctly reading `Quần chiến thắng` and the winning player's card gold-highlighted.
  No console errors observed throughout.
- 69 tests total, all passing.

**Deliberately deferred** (each is a genuinely separate subsystem, consistent with this file's
standing convention -- every one of these is a plausible FUTURE milestone, not a cut corner):
- The face-down/face-up (暗置/明置) kingdom-reveal TIMING mechanic (see the dual-general addendum
  right below, which closes the STAT-COMBINATION half of this gap but not the reveal-timing
  half): both generals (and therefore the kingdom) are visible from the start in this port -- no
  hidden-kingdom bluffing phase, no "reveal main or deputy now, or wait" decision.
- 珠联璧合 (paired-general bonuses for specific named pairs) -- needs per-pair bonus data this
  repo's ported general roster doesn't carry.
- 阵法技 (formation skills), 围攻/队列 (pincer/formation positional mechanics).
- "Ao Chiến" (鏖战, the late-game rule restricting Peach to Slash/Jink-only once ≤4 players remain
  with no kingdom holding >1 survivor) -- not implemented; Peach still heals normally in every
  Hegemony game this port runs, end to end.
- Every general's skill text/hooks are unchanged from Identity mode (the same `skill.ts` roster,
  same 44/46 ported coverage) -- none of the ~15 genuinely Hegemony-exclusive skill clauses this
  file's earlier milestones noted as stripped (gated on `lord->hasLordSkill("shouyue")` etc. --
  see `skill.ts`'s own header) are restored by this milestone; that's tracked separately from the
  game-mode infrastructure this milestone actually ships.

**Addendum -- dual-general (主将/副将) system.** User pointed out real Hegemony has each player
draft 2 SAME-kingdom generals (main + deputy), not 1 -- correct, this was the single-general
simplification the milestone above explicitly flagged as deferred. Closed without needing any
new per-general data: the official rule states each general's OWN Hegemony-card HP is exactly
half their solo/Identity-mode value, and the pair's total is the sum of those halves (confirmed
via live web search against the current rule: "国战体力值是原来武将的一半...体力值计算方法：两名武将
的体力值之和") -- so the combined total derives purely from this repo's EXISTING `GeneralDef.maxHp`
with no lookup table needed: `combineHegemonyHp(hp1, hp2) = floor((hp1+hp2)/2)`, plus a bonus
card draw (not a fractional HP point) when the sum is odd, mirroring the official "1 unpaired
阴阳鱼 ⇒ draw 1" rule -- granted immediately at pick time rather than at a separate reveal moment,
since this port has no reveal phase (see the deferred-list entry above).
- `gamerule.ts` -- new `combineHegemonyHp` (pure, exported for testing). Hegemony header's
  deferred-list entry rewritten (see above) to stop listing the stat-combination system as a gap.
- `player.ts` -- `GamePlayer` gained `deputyGeneral`/`deputyGeneralName`, alongside the existing
  `general`/`generalName` (which now hold the MAIN general of the pair in Hegemony mode).
- `room.ts` -- `candidateGenerals` gained an optional `kingdom` filter (falls back to the full
  remaining pool if that kingdom is exhausted -- a real possibility once several players have
  each drafted 2 generals from a small kingdom, not just a theoretical edge case, so this
  degrade-gracefully path is load-bearing, not defensive filler). `pickGenerals`'s Hegemony
  branch now asks `chooseGeneral` TWICE per player (`role: "main"` then `role: "deputy"`, the
  2nd call's candidates pre-filtered to the main's kingdom) before combining stats: skills are
  the union of both generals' `skillNames`, gender follows the main general (real rule), HP via
  `combineHegemonyHp`. `player.general`/`generalName` are only assigned once BOTH picks land, so
  the room-wide `pickingGenerals` flag (driven by `!p.general`) stays accurate while a deputy
  pick is still pending. Identity mode's single-pick path is untouched (separate `else` branch).
- `controller.ts` -- `Controller.chooseGeneral` gained an optional `role?: "main"|"deputy"`
  param (Hegemony only; bots ignore it, Identity mode never passes it) -- purely so a human ask
  can show which slot is being picked.
- `server.ts` -- `chooseGeneral`'s `pickGeneral` message gained a `role` field (passed straight
  through); `snapshot()`'s per-player payload gained `deputyGeneral`/`deputyGeneralName`.
- `public/index.html` -- the pick-a-general hint text now reads "chọn TƯỚNG CHÍNH"/"chọn TƯỚNG
  PHÓ (cùng thế lực với tướng chính)" for Hegemony's 2 sub-picks (unchanged plain hint for
  Identity's single pick). New shared `generalDisplayName(p)` helper (same 2-call-site pattern as
  `factionBadge`) renders `"Main / Deputy"` in the table player card and the own-hero panel once
  a deputy is assigned, falling back to the plain name otherwise.
- `src/simulate.ts` -- `testCombineHegemonyHp` (pure, all 4 parity cases: even+even exact,
  even+odd floors with a bonus draw, odd+odd re-pairs exact) and
  `testHegemonyDraftPicksSameKingdomPairWithCombinedStats` (a REAL `pickGenerals()` draft across
  8 seeds, asserting every player's pair is 2 distinct same-kingdom generals with skills = union,
  HP = `combineHegemonyHp`, gender = main's).
- **Verification:** (1) `npx tsc --noEmit` clean; `npm run sim` 71/71 passing (69 pre-existing +
  these 2 new). (2) Live `ws` client: a real 10-player Hegemony draft showed every player with a
  real `deputyGeneral` and a combined stat line matching the formula (e.g. `Hứa Chử(4hp) + Nhạc
  Tiến(4hp) → 4hp`, `Hoàng Nguyệt Anh(3hp) + Mạnh Hoạch(4hp) → 3hp`), the log line format changed
  to `"P8 chọn tướng Giả Hủ + Khổng Dung (Quần, 3 máu)"`, and the SAME game played through to a
  real win (`Thục thắng`) with ally/faction logic unaffected. (3) Real headless-browser run:
  claimed P1, the main pick auto-resolved (bot-speed default), the DEPUTY pick screen rendered
  the correct "chọn TƯỚNG PHÓ (cùng thế lực với tướng chính)" hint with 3 face-down candidates;
  flipping one showed a real Shu-kingdom card (matching the main's kingdom); picking it, the
  table/hero panel correctly rendered `"Chúc Dung / Mạnh Hoạch · Thục"` with the union of both
  generals' skills listed, and live play (a real Jink prompt) continued normally afterward.

**Addendum -- Ao Chiến (鏖战) + the face-down/face-up (暗置/明置) reveal-TIMING mechanic.** User
asked to close the remaining documented gaps. Investigated 珠联璧合 (paired-general bonuses) and
阵法技/围攻/队列 (formation skills, pincer/queue positional mechanics) first: grepping this repo's
entire ported `GENERALS`/`SKILLS` roster (44 generals) found zero references to either mechanic
-- no currently-ported general needs them, so there is nothing to wire up without fabricating
bonus-pair/formation data this repo doesn't have (not independently checked against the upstream
C++ source, which isn't vendored here -- if a not-yet-ported general turns out to need one,
that's a new gap to reassess then). The other 2 gaps were genuinely closeable:

- **Ao Chiến (鏖战):** once ≤4 players remain and no faction has more than 1 living member, Peach
  stops rescuing/healing anyone for the rest of the game (real rule: it becomes Slash/Jink-only --
  this port disables the heal effect only, not the Slash/Jink conversion, see below for why).
  - `combat.ts` -- `EngineContext` gained `aoChienActive: boolean`; `findRescueCard` (dying-rescue
    card search, both self- and ally-rescue) takes it as a param -- when true, only Analeptic
    rescues (the real rule targets Peach specifically, not Analeptic's separate rescue-via-heal).
  - `room.ts` -- new `aoChienActive` field (latches true, never resets) + `checkAoChienTrigger()`
    (≤4 alive, no shared faction -- a still-hidden player counts as their OWN distinct faction for
    THIS check specifically, confirmed live: "暗置武将也算不同势力（暗置与暗置武将间也是如此）", unlike
    the win condition which blocks entirely on any hidden player instead), checked after every
    death that doesn't already end the game. Gates the proactive Play-phase Peach self-heal loop
    and the freeform `computeLegalActions` Peach offering; `makeContext` threads `aoChienActive`
    through to every `EngineContext`.
  - **Deliberately not ported:** the "Peach playable as Slash/Jink instead" half -- wiring that
    into `findSlashLikeCard`/`findJinkLikeCard`'s viewAs search (used bidirectionally across many
    flows: bot fixed-pass, freeform legal actions, Duel's forced exchange, dodge search) is a
    separate, riskier change than simply disabling the heal outcome; Peach just becomes inert
    once Ao Chiến triggers, rather than converting into extra Slash/Jink ammo.
  - **Tests:** `testAoChienBlocksPeachRescue` (pure, `loseHp`-driven, with a non-Ao-Chiến control
    case proving it's a real gate, not just a declined ask) and
    `testAoChienTriggersOnlyAtFourDistinctFactionSurvivors` (real `Room`, proves the exact
    boundary: stays off at 4 survivors sharing a faction, triggers the instant they're distinct).

- **暗置/明置 reveal-TIMING mechanic:** both generals now start face-down; a player's kingdom (and
  therefore `faction`/`isAmbitionist`, only assigned the FIRST time either general reveals, using
  the same `assignHegemonyFaction` quota logic -- now moved to Room-instance fields since reveal
  can happen any time, not just during the draft) is unknown to other players until then.
  - `player.ts` -- `GamePlayer` gained `mainRevealed`/`deputyRevealed` (both default false).
  - `controller.ts` -- `Controller` gained `chooseReveal(player, mainHidden, deputyHidden)`; bots
    always reveal everything remaining the instant it's asked (their own first turn) -- no
    bluffing strategy to gain from staying hidden.
  - `room.ts` -- `pickGenerals` no longer assigns `faction`/`isAmbitionist` at all (the draft log
    line no longer names which generals or kingdom were picked, just `"P1 đã chọn xong 2 tướng
    (ẩn cho đến khi lộ diện)"`). New `runHegemonyReveal` (wired into `Phase.RoundStart`): asks
    `chooseReveal` while anything's hidden, assigns faction on the FIRST reveal, logs it, and
    re-checks the win condition right there (a reveal -- not just a death -- can be what finally
    lets an already-converged table conclude, since the win check blocks on any hidden player).
    `killPlayer` now force-reveals + assigns a faction on death too (same "BuryVictim" principle
    `roleShown` already used for Identity mode), BEFORE the win-check that follows in the same
    call. Extracted `checkHegemonyGameEnd()` (win-check + Ao Chiến check) shared between
    `killPlayer` and `runHegemonyReveal` instead of duplicating it.
  - `gamerule.ts` -- `checkHegemonyWinCondition` now returns null while ANY living player has
    `faction === ""` (real rule: "victory conditions can only be assessed once all characters
    have determined their force"), EXCEPT a sole survivor wins immediately regardless of reveal
    state (a deliberate simplification protecting against a real soft-lock: a human who never
    reveals would otherwise block their own trivial win with nobody left to contest it).
    `factionLabelVI` gained an "Ẩn" (hidden) label for the still-undetermined case.
  - `server.ts` -- `snapshot()`'s per-player payload now redacts `general`/`generalName` (gated
    on `mainRevealed`), `deputyGeneral`/`deputyGeneralName` (gated on `deputyRevealed`), and
    `kingdom`/`faction`/`isAmbitionist`/`skills` (gated on EITHER reveal, since they share one
    kingdom) to `null`/`""`/`[]` for every OTHER client -- real fog-of-war, not just a client-side
    display toggle. `personalize()` always overrides the claiming socket's OWN entry with the
    real underlying values regardless of reveal state (same pattern Identity mode's `role`
    already used) -- every player always knows their own drafted generals, even before choosing
    to reveal them to anyone else.
  - **Deliberately not ported:** skill AVAILABILITY is NOT gated by which general is revealed --
    both generals' skills are always active from the moment they're drafted. The real rule
    requires revealing a general before using its abilities; gating that needs threading a reveal
    check through the ~30 existing skill-hook call sites across `skill.ts`/`combat.ts`/`room.ts`,
    a separate, much larger change than the reveal-TIMING/visibility layer actually shipped here.
  - `public/index.html` -- new `.avatarHidden`/`.heroAvatarHidden` placeholder ("?" in a dark
    circle) shown whenever `p.general`/`p.deputyGeneral` is null; `generalDisplayName` shows
    "Ẩn" per still-hidden slot ("Ẩn / Ẩn", "Chân Cơ / Ẩn", etc.) -- checks the actual field
    presence rather than the reveal flag directly, since `personalize()` always sends the
    claiming socket's own true names regardless of reveal state (gating on the flag itself would
    have wrongly shown "Ẩn" for your own not-yet-revealed-to-OTHERS pair too -- a real bug caught
    live: the own-hero panel showed "Ẩn / Ẩn" for a player who had already drafted real generals,
    fixed by switching the condition, re-verified clean afterward). New `showRevealPrompt`
    (mirrors `showConfirm`'s style): one toggle button per still-hidden general plus a confirm/
    "Giữ kín" (stay hidden) button, multiple may be toggled before confirming (real rule allows
    revealing both at once).
  - **Tests:** `testHegemonyRevealTiming` (real `Room`: a bot reveals everything on its own first
    turn while every other untouched player stays hidden; a controller that always declines stays
    hidden through its own turn; death force-reveals + assigns a faction even with no prior
    turn), plus `testEmergentHegemonyGameReachesWinCondition` extended to assert every player is
    fully hidden right after `pickGenerals` and fully revealed by game-over.
  - **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 74/74 passing
    (71 pre-existing + these 3 new). (2) Live `ws` client: a real 10-player game's spectator view
    showed every player's `general`/`kingdom`/`faction` as `null`/`null`/`""` right after the
    draft, and fully revealed (`mainRevealed`/`deputyRevealed` both true, real kingdoms/winners)
    by game-over -- confirming the win-condition gate actually forced full reveal before
    concluding. (3) Real headless-browser run, claimed seat: drafted 2 real generals, the OWN
    hero panel showed the true names immediately (pre-fix bug caught and fixed here, see above);
    the RoundStart `chooseReveal` prompt rendered with per-general toggle buttons and the correct
    hint text; declining (timeout) correctly left `mainRevealed: false`; every OTHER (bot) player
    card rendered the `?` placeholder avatar + "Ẩn / Ẩn" + `?` kingdom badge; the battle log
    showed zero name/kingdom leaks during the draft (`"P2 đã chọn xong 2 tướng (ẩn cho đến khi lộ
    diện)"` for every player, `"Bắt đầu ván đấu: mọi tướng đều ẩn, sẽ lộ diện dần khi từng người
    vào lượt của mình"` as the summary).

**Addendum -- skill-availability gating + Peach-as-Slash/Jink (closing the last 2 documented
gaps).** User asked to close everything still marked deferred. The 2 remaining real gaps
(珠联璧合 paired bonuses, 阵法技/围攻/队列 formation skills) stayed blocked -- still zero references
in the entire 44-general ported roster, still no fabricatable data. The other 2 were closeable:

- **Skill availability gated by reveal state.** Real rule: a hidden general's abilities can't be
  used until it's revealed. Closed without touching any of the ~40 existing mechanical call
  sites across `skill.ts`/`combat.ts`/`trick.ts`/`room.ts` that iterate `player.skills` --
  `player.ts`'s `skills` became a computed GETTER instead of a plain field: backed by a new
  private `_skills` + `mainSkillCount` (which of the declared kit's entries belong to the main
  general, set by `Room.pickGenerals`'s Hegemony branch right after assigning `skills`), it
  returns only the revealed general(s)' slice once a real `deputyGeneral` is drafted, and falls
  through to the full unfiltered list otherwise (Identity mode never sets `deputyGeneral`, so
  it's a strict superset with zero behavior change there -- confirmed by the full existing suite
  passing unmodified). New `allSkills` getter always returns the full declared kit regardless of
  reveal state, for the one legitimate case that needs it: a player's own hero panel (`server.ts`
  `personalize()`'s own-seat override now sends `real.allSkills`, not `real.skills` -- you always
  know your own drafted kit, you just can't USE the hidden half yet, same asymmetry already built
  for general names/kingdom). `snapshot()`'s per-OTHER-player skills field was simplified to just
  `p.skills.map(...)` (no more separate `kingdomKnown` condition needed -- the getter is already
  precisely gated per-general, strictly more accurate than the old all-or-nothing check).
  - A real bug caught live during verification (see below) while testing this: none needed --
    this one worked correctly on the first live pass, since the getter-based design meant every
    consumer inherited correct behavior automatically with no call-site logic to get wrong.
  - **Test:** `testHegemonySkillsGatedByReveal` (pure): empty while both hidden, exactly the
    main's skills once main reveals, the full union once both do; `allSkills` always full;
    a no-deputy player is never gated. `testHegemonyDraftPicksSameKingdomPairWithCombinedStats`
    updated to assert `skills` is empty and `allSkills` holds the union right after the draft
    (before this addendum it asserted `skills` held the union directly, since gating didn't
    exist yet).

- **Peach playable as Slash/Jink once Ao Chiến disables its heal.** `combat.ts`'s
  `findSlashLikeCard`/`findJinkLikeCard`/`allSlashLikeCards` all gained an `aoChienActive`
  parameter (default `false`) that makes a held Peach match, threaded through every real
  gameplay call site: `resolveSlash`'s dodge search (both the first Jink and Wushuang-style
  multi-Jink loop), `Room`'s bot fixed-pass Slash search (`tryPlaySlash`) and freeform legal-
  action offering (`computeLegalActions`), `trick.ts`'s Duel forced-Slash exchange, Savage
  Assault's discard-or-take-damage choice, Archery Attack's discard-Jink-or-take-damage choice,
  and Jiaxu's Luanwu forced-Slash (`skill.ts`). Reused the exact same `EngineContext.aoChienActive`
  field the heal-disable half (`findRescueCard`) already had; `Room` methods without a `ctx` in
  scope read `this.aoChienActive` directly.
  - **Bug found and fixed while implementing this:** a line-numbered edit targeting stale
    (pre-shift) line numbers landed a duplicate `allSlashLikeCards` definition and orphaned the
    back half of `findDismantlementLikeCard`/`allDismantlementLikeCards`, breaking the file's
    syntax. Caught immediately by the very next `tsc --noEmit` (which is exactly why every edit
    in this log is followed by one) before it ever reached a test run or live server; fixed by
    re-reading the corrupted region fresh and reconstructing it in one clean replacement, then
    re-verified with a full `tsc` + `npm run sim` pass before continuing.
  - **Test:** `testAoChienLetsPeachSubstituteForSlashAndJink` (pure): a bare held Peach is never
    Slash/Jink-like without Ao Chiến, and always found (both `find*` and `all*`) with it active.
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 76/76 passing (74
  pre-existing + these 2 new). (2) Live `ws` server: a real 6-player game reached a genuine
  `aoChienActive: true` state and the subsequent log showed the heal-block still holding (a
  player reached 0 hp and died with no `dùng Đào để hồi phục`/rescue line despite the earlier
  Ao-Chiến trigger); a separate full 10-player run completed with zero uncaught errors despite
  the new threading across `combat.ts`/`room.ts`/`trick.ts`/`skill.ts`. (3) Real headless-browser
  run: claimed a seat, drafted a real pair, confirmed via `lastState` that the OWN hero panel's
  `skills` array held both generals' full skill list even with `mainRevealed`/`deputyRevealed`
  both still `false` (proving `allSkills` -- not the gated `skills` -- drives the own-seat
  display), and the panel rendered correctly on screen (both generals' names, all 3 skills'
  descriptions, the RoundStart reveal prompt underneath) with no visual breakage.

**Addendum -- checked against the REAL upstream source (`github.com/Mogara/QSanguosha-For-
Hegemony`, `dev` branch), not just this repo's own ported subset.** User asked to check the
actual upstream C++ repo directly rather than rely on secondary research. Fetched and grepped
`src/core/general.{h,cpp}`, `src/package/formation.{h,cpp}`, `src/package/standard-{shu,wei,wu,
qun}-generals.cpp`, `src/server/room.cpp`, `src/server/gamerule.cpp` directly. Findings:

- **珠联璧合 (companion pairs) turned out to be REAL and extractable, overturning the prior
  "no fabricatable data" conclusion.** `General::addCompanion()`/`isCompanionWith()` in
  `core/general.h`/`.cpp` confirm the mechanic; grepping all 4 `standard-*-generals.cpp` files'
  `addCompanion()` calls found 19 raw pairs, of which **9 have BOTH sides in this port's
  44-general roster** (the rest pair a ported general with an unported one, e.g. Liu Bei/Sun
  Quan/Pang Tong/Xiahou Yuan/Yuan Shao -- correctly excluded, since the bonus needs both halves
  of your OWN drafted pair to be companions with each other): `zhugeliang↔huangyueying`,
  `zhaoyun↔liushan`, `huangzhong↔weiyan`, `menghuo↔zhurong`, `caocao↔dianwei`, `caocao↔xuchu`,
  `caopi↔zhenji`, `zhouyu↔huanggai`, `lvbu↔diaochan`. Ported as `gamerule.ts`'s
  `COMPANION_PAIRS` + `isCompanionPair()`.
- **The exact bonus mechanic and its exact TRIGGER MOMENT**, found in `gamerule.cpp`'s
  `GeneralShown` case: the instant `player->hasShownAllGenerals()` (both main+deputy revealed),
  (a) if `general1->isCompanionWith(general2)`, offer a one-time choice: recover 1 hp (only
  while wounded) OR draw 2 cards OR decline; (b) if the pair's combined HP left an unpaired half
  (`max_hp % 2`), separately offer a one-time optional draw-1 choice. This REVISES this port's
  prior simplification (the odd-half bonus draw used to be automatic, granted silently at
  draft/initial-hand time) -- now correctly moved to the real trigger moment and made a real
  choice, and the companion bonus (previously entirely unimplemented) is now added.
- **The HP formula (`combineHegemonyHp`) was independently CONFIRMED exact**, not just
  plausible: `room.cpp`'s setup does `max_hp = general1->getMaxHpHead() +
  general2->getMaxHpDeputy(); setMaxHp(max_hp / 2); setPlayerMark("HalfMaxHpLeft", max_hp % 2)`
  -- both `getMaxHp{Head,Deputy}` resolve to the general's own plain printed HP at initial setup,
  i.e. exactly this repo's existing `GeneralDef.maxHp`. No code change needed here, just
  certainty the existing formula was always correct.
- **Still out of scope, now confirmed via real source instead of just "not found in this repo's
  own roster":** `src/package/formation.cpp` (53KB, genuinely real, substantial) covers 阵法技
  (formation skills) for generals that are NOT any of the 44 already ported here -- porting them
  means porting whole new generals from scratch, a different kind of gap than "wire up a
  mechanic the existing roster already needs". Kingdom-wide LORD-SKILL bonuses (`shouyue` etc.,
  gated on `lord->hasLordSkill(...) && lord->hasShownGeneral1()`) are a genuinely separate
  Hegemony-only subsystem (a kingdom's "lord" general grants a team-wide passive once shown) --
  confirmed real, still out of scope.

**Implementation:**

- `gamerule.ts` -- `COMPANION_PAIRS` (the 9 tuples above) + `isCompanionPair(mainGeneral,
  deputyGeneral): boolean` (checks both orderings, matching upstream's own bidirectional
  `getCompanions()` search). `combineHegemonyHp`'s doc comment updated with the exact upstream
  citation; its formula itself was unchanged (already correct).
- `controller.ts` -- 2 new `Controller` methods: `chooseCompanionBonus(player, canRecover):
  Promise<"recover"|"draw"|"cancel">` and `wantsHalfMaxHpBonusDraw(player): Promise<boolean>`.
  Bot defaults: recover if wounded and eligible else draw; always accept the half-hp draw.
- `room.ts` -- removed the old automatic bonus-draw-at-draft-time mechanic (`bonusDrawPlayerIds`
  set, +1 initial hand card) from `pickGenerals`'s Hegemony branch entirely. New private
  `resolveHegemonyRevealBonuses(player)`, called from `runHegemonyReveal` exactly once, right
  after a reveal completes `mainRevealed && deputyRevealed` (and only if the game didn't just
  end from that same reveal) -- resolves the companion bonus via `isCompanionPair` + the ask,
  then the half-hp bonus via `combineHegemonyHp(...).bonusDraw` + the ask, mirroring
  `gamerule.cpp`'s `GeneralShown` handler's own order and conditions exactly.
- `server.ts` -- 2 new human-controller ask handlers (`chooseCompanionBonus`,
  `wantsHalfMaxHpBonusDraw`) following the exact same `askClient` pattern as every other ask;
  fallback-on-timeout/disconnect matches the bot defaults.
- `public/index.html` -- new `showCompanionBonusPrompt()` (3-button: recover-if-eligible/draw/
  decline, mirrors `showRevealPrompt`'s structure) for `chooseCompanionBonus`; `confirmHalfMaxHpDraw`
  reuses the existing generic `showConfirm()` (same as a dozen other yes/no prompts already
  wired) with its own title/copy, added to the `isPromptType` dispatch list.
- **Test:** new `testHegemonyRevealCompletionBonuses` (integration, via a real `Room`): forces a
  specific companion pair (`zhaoyun`+`liushan`, chosen because it's BOTH a real companion pair
  AND leaves a leftover half -- exercises both bonuses from one draft) by having the test
  controller's `chooseGeneral` ignore the offered candidates and return the exact desired
  `GeneralDef` (Room doesn't validate the returned general against what was offered, so this is
  a legitimate way to pin down an otherwise-random draft for a test); asserts both asks fire
  with the correct `canRecover` (false undamaged, true once wounded via `damagePlayer`), the
  recover choice heals exactly 1 hp, and a control case (`huangzhong`+`zhurong`, neither a
  companion pair nor leftover-half) asks neither.
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 77/77 passing (76
  pre-existing unmodified + this 1 new). (2) Live `ws` server, scripted against the real running
  process (not simulate.ts): repeated real games found and confirmed all 3 log lines actually
  fire -- `"P7 rút 1 lá (thể lực lẻ nửa)"` (half-hp draw), `"P8 hồi 1 máu (珠联璧合)"` (companion
  recover), `"P1 rút 2 lá (珠联璧合)"` (companion draw). (3) A separate ws script claimed a real
  seat (the human-controller path, `server.ts`'s `askClient`, not the bot-controller path used
  above) and received a real `chooseCompanionBonus` message from the live server with the exact
  shape the browser UI's `showCompanionBonusPrompt` reads (`canRecover: true, mainGeneralName:
  "Mạnh Hoạch", deputyGeneralName: "Chúc Dung", requestId, timeoutMs`), responded with the same
  `{type:"response", choice:"recover"}` shape the real UI sends, and the server accepted it --
  confirming the exact network contract the new prompt UI depends on, end to end.

## Milestone 24 — DONE (5 more generals against the REAL upstream roster: Liu Bei/Pang Tong/Sun Quan/Xiao Qiao/Yuan Shao, 44→49 of 60)

User asked "are generals actually complete against the real upstream data" (`Tướng đã đầy đủ so
với data gốc chưa?`), then, once shown the answer was no, asked to port ALL 16 real gaps found.
Investigated all 16 by fetching and reading their exact skill implementations directly from
`standard-{shu,wei,wu,qun}-generals.cpp` (not guessed): **every one of the 16 needs at least one
genuinely new subsystem** this engine doesn't have -- Nullification (无懈可击, the anti-trick
counter-play card), Iron Chain (连环), Fire Attack (火攻), an Armor equip CATEGORY (a 3rd equip
slot beyond Weapon/Horse), a private hidden-pile dying-immunity mechanic (不屈/Buqu), the ability
to RE-HIDE an already-revealed general (Hegemony's own reveal-timing, Milestone 23, only ever
goes hidden->shown, never back), a "discard to skip a phase, then use a card outside the normal
flow" mechanic, a per-player distance-override mechanic distinct from the existing flat
attack-distance-delta hook, and a reactive (not player-initiated) equip-move-or-discard trigger.
Given that reality, shipped the 5 that needed EITHER an existing subsystem or nothing new at
all, as a first batch; the other 11 are analyzed and documented below, not silently dropped.

- **Liu Bei (Nhân Đức/Rende, shu, 4hp).** New "give-away-cards" subsystem: `Controller`/
  `EngineContext` gained `chooseAnyHandCards(player, min, max)` (`controller.ts`/`room.ts`'s
  `askAnyHandCards`) -- a generic "freely pick [min,max] of your own hand cards" ask, distinct
  from the existing fixed-count `chooseDiscards` (also reused below by Zhiheng and Luanji).
  During Play phase, give any number of hand cards to a chosen player; **verified exactly
  against `RendeCard::use` in the real upstream source** (not the ambiguous localized flavor
  text, which reads like "draw a card" but isn't): a per-turn cumulative mark crossing from <3
  to >=3 given this turn, while wounded, recovers 1 hp -- collapsed to "this single invocation
  gave 3+" (same "once per Play phase" simplification as every other proactive `selfAction` in
  this file).
- **Pang Tong (Niết Bàn/Niepan, shu, 3hp).** New `Skill.cheatsDeath` hook, checked inside
  `resolveDying` (combat.ts) right alongside the normal Peach-family self-rescue check: once per
  GAME (`player.usedLimitSkills`, an existing once-per-game marker Set already used by
  Luanwu/Xiongyi -- no new marker system needed), while dying, may discard hand+equip+judge
  area, recover to `min(3, maxHp)`, and draw 3. Real rule's "clear chained status, force
  face-up" clause dropped -- neither chains nor a per-turn face state exist in this engine's
  scope. Pang Tong's other skill, Lianhuan, needs the Iron Chain trick card (still not ported,
  see below).
- **Sun Quan (Chế Hành/Zhiheng, wu, 4hp).** Needed NO new subsystem at all once
  `askAnyHandCards` existed: once per Play phase, discard up to `maxHp` freely-chosen hand
  cards, draw that many back. Real rule's "may also spend your Treasure equip once you've
  discarded `maxHp` hand cards" clause dropped -- this engine only models Weapon/Horse equips,
  no Treasure slot (see card.ts's header).
- **Xiao Qiao (Hồng Nhan/Hongyan, wu, 3hp).** New `Skill.filtersOwnJudgment` hook (self-only,
  distinct from the existing broadcast `onJudgment` retrial hook Guicai/Guidao use): wired into
  `judge()` (combat.ts) right after the fresh draw -- her own judgment card, if a Spade, may be
  reinterpreted as a Heart by mutating the freshly-drawn `Card` object's suit in place (safe,
  since it's never shared/aliased). Confirmed against the real upstream `Hongyan` class
  (`FinishRetrial` event, `judge->card->getSuit()==Spade` check) -- the localized text describes
  a DIFFERENT/newer revision (a 2nd clause about +1 max hand size with a Heart equipped) this
  repo's `dev`-branch class doesn't implement, same "port the real behavior, not the newer
  localized text" precedent as Longdan/Kongcheng/Tieqi/Kurou etc. Her other skill, Tianxiang
  (damage transfer), needs a redirect-incoming-damage-to-another-player mechanic, not ported.
- **Yuan Shao (Loạn Kích/Luanji, qun, 4hp).** Reused `askAnyHandCards` (min=2,max=2) +
  `SKILLS`'s new self-action pattern: any 2 SAME-SUIT hand cards may be discarded together as
  Archery Attack (the AOE trick this engine already has, `resolveArcheryAttack`) -- same "no
  dedicated multi-card viewAs UI, folded into a self-action ask" precedent as Spear's existing
  2-card-as-Slash. Real upstream text's 2 extra clauses (can't reuse a suit already spent this
  turn this way; an ally who Jinks it may draw 1) aren't in the actual `Luanji` C++ class read
  from source -- not ported, same newer-localized-text-vs-real-class mismatch pattern as Hongyan
  above.
- **Test:** `testNiepanCheatsDeathOnce` and `testHongyanFiltersOwnSpadeJudgmentToHeart` (both
  pure, dedicated -- these 2 are genuinely too rare to reliably log-mine, matching the existing
  Kongcheng/Qianxun/Wushuang/Tiandu precedent); `testGeneralSkillsAppearInPlay` expanded to 49
  generals + 3 new markers (`rende`/`zhiheng`/`luanji`, all 3 fired naturally across the
  existing 150-seed range). A real pre-existing test-fragility bug was exposed (not caused) by
  the roster growing from 44->49: `testFreeformPlayAOECardIsOfferedAndResolves` assumed a flat 1
  damage per Savage-Assault-hit player, but the seeded draft can now land Kong Rong (Mingshi,
  -1 flat reduction) on any seat -- fixed to compute the SAME `reduceDamage` chain `applyDamage`
  itself runs, instead of assuming a flat 1. A 2nd fragility: `testExpandedControllerHooksRespected`
  flagged Luanji's `resolveArcheryAttack`-sourced log line as a "P1 sourced a trick despite
  declining every trick" violation, since Luanji bypasses `wantsToPlayTrick` (it's gated by
  `wantsToUseSelfAction`, which that test's `declineAll` controller never overrides) -- fixed by
  extending the test's existing "compelled" exception (already there for Lijian's forced Duel)
  to also cover Luanji's self-action-sourced Archery Attack.
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 79/79 passing (77
  pre-existing, 2 fixed for roster-size fragility, 2 new dedicated tests). (2) Live `ws` server:
  repeated real Identity-mode games found and confirmed 4 of the 5 new skills' log lines firing
  for real (`"P8 giao 5 lá bài cho P6 (rende)"`, `"P3 phát động Niết Bàn: ..."`, `"P3 bỏ 4 lá
  rồi rút lại 4 lá (zhiheng)"`, `"P7 dùng 2 lá cùng chất như Vạn Tiễn Tề Phát (luanji)"`);
  Hongyan never fired live in ~35 games (expected -- needs Xiao Qiao specifically to own one of
  the 5 judgment-producing skills' judgment AND draw a Spade, the same rarity class as Tiandu),
  covered instead by its dedicated pure test. (3) Real headless-browser run: avatar assets
  confirmed present on disk for all 5 (`image/generals/avatar/{liubei,pangtong,sunquan,
  xiaoqiao,yuanshao}.png`, no synthesis needed unlike Erzhang/Yanliangwenchou back in Milestone
  2.6); claimed a seat, added bots, started a real game, drove the general-pick screen through 2
  full flip-reveal-flip cycles (didn't land one of the 5 new generals this particular random
  draft, but confirmed the pick UI renders arbitrary `GeneralDef` entries generically with no
  per-general special-casing, so the same code path that correctly renders Kong Rong/Guo Jia/
  Cai Wenji renders the 5 new ones identically) with no broken images or layout, all the way
  through picking a general and entering the table.

**Remaining 3 of the 16 real gaps (after Milestone 26 ported the other 3 below), each still
genuinely blocked on a specific unbuilt subsystem:**

- **Wolong (Khổng Minh, shu, 3hp; Zhuge Liang's alternate persona card, `wolong` != `zhugeliang`
  -- a real, distinct Standard-package general with 3 different skills).** Huoji needs the Fire
  Attack trick card; Kanpo needs Nullification (无懈可击) PLUS the reactive counter-play stack
  every trick resolution would need to thread through (declare-a-trick -> give everyone a window
  to Nullify it, chainable); Bazhen needs an Armor equip CATEGORY (Eight Diagram specifically) --
  a 3rd equip slot this engine's `player.ts` doesn't have (only `weapon`/`defenseHorse`/
  `offenseHorse`). All 3 of his skills independently need a different unbuilt subsystem.
- **Zhou Tai (wu).** Buqu -- a private hidden card-pile "secretly survive at <=0 hp" mechanic
  (draw N cards face-down into a pile; if no 2 share a rank, silently treat as not-dying; the
  pile clears on recovery or gets checked again after a failed rescue) -- among the most
  structurally involved individual skills in the entire real ruleset, genuinely its own
  subsystem, not a small hook.
- **Zou Shi (qun).** Huoshui (while active, disables every OTHER player's ability to voluntarily
  reveal a hidden general) directly targets Milestone 23's OWN reveal-timing simplification: this
  port only ever asks a player to reveal at the START of THEIR OWN turn (`Phase.RoundStart`), so
  there's no window during Zou Shi's turn where another player's reveal ask is even being
  resolved for Huoshui to intercept -- blocked by this port's own architecture, not a missing
  subsystem per se. Qingcheng (discard an equip to re-hide one of a fully-shown target's 2
  generals) needs the ability to RE-HIDE an already-revealed general, which Milestone 23's
  reveal-timing system doesn't support (`mainRevealed`/`deputyRevealed` only ever go
  false->true) -- a genuinely different gap than Cao Ren's Jushou (Milestone 25) turned out to
  need, once Jushou's real effect was traced precisely (a simple single-turn auto-skip, not an
  indefinite re-hide at all).

Subsystem tally across these final 3: Nullification+counter-play-stack (1: Wolong), Iron Chain
(1: Wolong's companion Pang Tong still needs it for Lianhuan), Fire Attack (1: Wolong),
Armor equip category (1: Wolong), private hidden-pile dying mechanic (1: Zhoutai),
re-hide-a-revealed-general (1: Zoushi's Qingcheng), reveal-ask-timing architecture (1: Zoushi's
Huoshui) -- each a real, separately-scoped piece of future work, not a single "port the rest"
task.

## Milestone 25 — DONE (5 more generals: Ding Feng/Cao Ren/Pan Feng/Jiling/Xu Huang, 49→54 of 60)

User asked to port more of the 16 real gaps toward full completeness. Investigated the
remaining 11's exact skill implementations (having already done 5 easy ones in Milestone 24) and
found 5 more that needed either an existing subsystem or one genuinely small new one:

- **Ding Feng (Phấn Tấn/Fenxun, wu, 4hp).** New `player.fixedDistanceTo` map + `effectiveDistance`
  short-circuit (combat.ts) -- verified exactly against the real upstream `Player::
  setFixedDistance`/`fixed_distance` map (an ABSOLUTE override, not an additive delta like the
  existing `attackDistanceDelta` hook): discard 1 card, pick another player -- your distance TO
  them becomes fixed at 1 until end of turn (cleared in `Room.playTurn`). His other skill,
  Duanbing, stays unported -- confirmed a real no-op STUB even in the upstream `dev`-branch C++
  itself (Milestone 2.6's own correction already found this), needing multi-target Slash.
- **Cao Ren (Chiếm Thủ/Jushou, wei, 4hp).** New `player.faceDown` flag, checked at the very top
  of `Room.playTurn`: at Finish phase, may draw 3 and become face-down; the ENTIRE next turn is
  auto-skipped (verified exactly against the real upstream `gamerule.cpp`'s RoundStart handler:
  `if (!player->faceUp()) { player->turnOver(); /* skip play() entirely */ }` -- a single-turn
  auto-skip with NO player choice in flipping back, not an indefinite "stay hidden" state as
  initially assumed in Milestone 24's addendum). lang/vi_VN describes a different/newer revision
  (draw X=living-faction-count, use/discard a card, conditionally toggle dual-general shown
  state) -- ported the real `dev`-branch class's simpler effect instead, same mismatch pattern
  as Longdan/Kongcheng/Tieqi/Kurou/Hongyan/Luanji.
- **Pan Feng (Cuồng Phủ/Kuangfu, qun, 4hp).** New broadcast hook `Skill.onSomeoneSlashDamaged`
  (combat.ts's `resolveSlash`, alongside the existing attacker-only `onSlashDamageDealt`) --
  REACTIVE, not player-initiated: whenever ANY Slash damages someone holding an equip, may pick
  one of their equips and either discard it or move it onto his own matching (empty) equip slot.
  Verified against the real upstream `Kuangfu : public TriggerSkill` class (`events << Damage`)
  -- lang/vi_VN describes a completely different skill (triggers on PAN FENG'S OWN Slash
  targeting instead), same mismatch pattern as above; ported the real reactive class.
- **Jiling (Song Nhận/Shuangren, qun, 4hp).** New `makeVirtualSlash()` factory (card.ts) -- a
  free bonus Slash with no backing physical card, matching the real upstream `Slash(Card::
  NoSuit, 0)` exactly; gets a fresh id from the same counter every card uses (so it discards/
  logs identically) but is marked `virtual: true` so card-conservation invariants
  (`simulate.ts`'s `totalCardsInPlay`) correctly exclude it. During Play phase, pindian
  (reusing the EXISTING `pindian()` helper -- Pindian was never actually the blocker for Jiling,
  see Milestone 24's addendum correction above) with a chosen victim; on a win, designate any
  player within his own Slash range who is the victim or an ally of the victim to receive the
  free bonus Slash.
- **Xu Huang (Đoạn Lương/Duanliang, wei, 4hp).** New SupplyShortage (Binh Lương Thốn Đoạn)
  delayed trick -- a 2nd judge-area/delayed-trick kind alongside Indulgence, reusing the exact
  same `judgeArea`/`runJudgePhase` system Indulgence proved out: `card.ts` gained
  `CardKind.SupplyShortage` + the 2 real dealt copies (Spade 10, Club 10, verified exactly
  against the real upstream `trickCards()`); `player.ts` gained `forcedSkipDrawPhase` (mirrors
  `forcedSkipPlayPhase`); `trick.ts` gained `supplyShortageCandidates`/`attachSupplyShortage`/
  `resolveSupplyShortageJudgment` (mirroring the Indulgence trio exactly); new `Skill.
  extraTrickDistance` hook (additive extension to a trick's own target-distance LIMIT, distinct
  from the existing all-or-nothing `ignoresTrickDistanceLimit`) for Duanliang's real +1 reach
  extension, verified against the real upstream `SupplyShortage::targetFilter`'s base distance-1
  cap + `DuanliangTargetMod::getDistanceLimit`'s +1. Any black hand card may be played/discarded
  as SupplyShortage. lang/vi_VN describes a different/newer revision (unlimited distance unless
  real distance >2) -- ported the real `dev`-branch class's flat +1 instead, same mismatch
  pattern as above.

**2 real, pre-existing bugs found and fixed while chasing a card-conservation test failure this
milestone's larger roster exposed (neither caused by this milestone's own new code -- both
predate it, confirmed by reproducing them in isolation):**

1. **Leiji (Zhang Jiao) credited the wrong player.** `resolveSlash` broadcasts `onSlashDodged`
   to BOTH the attacker's and the (dodging) target's skill lists with the identical
   `(attacker, target)` argument pair; `leijiOnSlashDodged`'s 3rd parameter (misleadingly named
   `zhangjiao`) was bound to `target`, not `attacker` -- so whenever Zhang Jiao's own Slash got
   dodged, the code asked/credited the DODGER (who doesn't even hold the skill) instead of Zhang
   Jiao himself. `ctx.askUseSelfAction`/`judge()` have no skill-ownership check (generic asks),
   so this silently "worked" without ever crashing -- it just silently misattributed the
   judgment (log said the wrong player's name) every single time. Fixed by binding to the
   correct (2nd) parameter. Caught because this milestone's roster change shifted a seeded
   draft's random picks onto a seed where Zhang Jiao (leiji+guidao) attacked a Jink-holding
   defender -- the resulting log line (`"P3 phán Lôi Kích"` for a defender that doesn't own
   leiji) looked wrong on inspection.
2. **`attachIndulgence` didn't rewrite a viewAs card's `.kind`.** A card played AS Indulgence via
   a skill (e.g. Daqiao's Guose: any Diamond card) keeps its ORIGINAL `.kind` (e.g. `Slash`)
   when `attachIndulgence` pushes it into `judgeArea` -- but `Room.runJudgePhase`'s dispatch
   keys off `card.kind === CardKind.Indulgence` to decide which resolver to call. A non-
   Indulgence-kind card matches NEITHER branch (Indulgence's nor, now, SupplyShortage's): it
   gets `.shift()`'d out of `judgeArea` (removed) but is never resolved and never reaches
   `discardPile` -- it simply vanishes, permanently, with no trace. Caught directly by
   `testPhaseCyclingConservesCards` (a real Guose-viewed Diamond Slash disappeared from every
   pile/hand/judgeArea after its owner's Judge phase ran) while validating THIS milestone's new,
   structurally-identical `attachSupplyShortage` (which already force-rewrote `.kind` correctly
   from the start, since the bug was fresh in mind while writing it -- prompting a closer look
   at its Indulgence sibling, which revealed it had been missing the same rewrite all along).
   Fixed by applying the same rewrite to `attachIndulgence`.

- **Test:** `testLeijiCreditsTheActualAttackerNotTheDodger` and
  `testAttachIndulgenceRewritesViewAsCardKindSoItActuallyResolves` (both pure, dedicated
  regressions for the 2 bugs above); `testGeneralSkillsAppearInPlay` expanded to 54 generals +
  5 new markers (`fenxun`/`jushou`/`kuangfu`/`shuangren`/`duanliang`, all 5 fired naturally
  across the existing 150-seed range -- no rarity issues this batch, unlike Niepan/Hongyan).
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 81/81 passing (79
  pre-existing + 2 new regression tests; the roster-size-triggered card-conservation failure was
  root-caused to the 2 real bugs above, not a new-code issue, and both are now fixed AND
  regression-tested). (2) Live `ws` server: repeated real Identity-mode games found and
  confirmed all 5 new skills' log lines firing for real (`"P6 bỏ 1 lá, khoảng cách đến P9 cố
  định còn 1 đến hết lượt (fenxun)"`, `"P10 rút 3 lá rồi úp mặt, sẽ tự động bỏ qua lượt kế tiếp
  (jushou)"` followed later by a confirmed `"P3 đang úp mặt, tự động lật lên và bỏ qua lượt này
  (jushou)"` full round-trip, `"P5 bỏ QinggangSword của P9 (kuangfu)"`, `"P7 đấu điểm với P1: 5
  vs 7 (shuangren) -- P1 thắng"`, `"P4 phán Binh Lương Thốn Đoạn: Bích 9"`). (3) Real headless-
  browser run: avatar assets confirmed present on disk for all 5 (no synthesis needed); page
  loads with zero JS errors (this milestone needed no new client UI at all -- every new skill
  reuses existing ask types: `activeAction`/`selfAction`/`otherPhaseAction`/the new
  broadcast-only `onSomeoneSlashDamaged`, none of which need a dedicated prompt component).

## Milestone 26 — DONE (3 more generals: Xiahouyuan/Zhang He/Taishici, 54→57 of 60)

User asked to continue porting toward full completeness (`Tiếp đi`). Investigated the remaining
3's exact skill implementations against the real upstream `dev`-branch C++ and found the
multi-target-Slash gap was smaller than Milestone 24's addendum assumed -- only Taishici's
Tianyi genuinely needs it; Xiahouyuan's Shensu turned out to be single-target after all (rangeless,
not multi-target) once traced precisely:

- **Xiahouyuan (Hạ Hầu Uyên, wei, 4hp).** Shensu: **correction to Milestone 24's addendum** --
  re-reading the real upstream `Shensu`/`ShensuCard` class shows it's single-target throughout
  (via ordinary Slash's own `targetFilter`), just rangeless and phase-skip-triggered; no
  multi-target Slash needed after all, only the "discard to skip a phase, then act outside the
  normal flow" piece. New generic `Skill.skipsPhaseForDiscard`/`onPhaseSkippedForDiscard` hook
  pair (`skill.ts`), wired ONCE into `Room.runPhase` (checked right after `runOtherPhaseActions`,
  before the phase `switch`) so any future skill of this shape needs no `room.ts` changes of its
  own: at Judge-phase start, may (0-cost ask) skip Judge AND Draw (`player.forcedSkipDrawPhase`,
  reusing SupplyShortage's own flag) and immediately fire a rangeless free Slash
  (`makeVirtualSlash()`, reusing Milestone 25's Shuangren factory) at 1 target; at Play-phase
  start, may discard exactly 1 Weapon/Horse card to skip Play phase and fire the same rangeless
  free Slash. Real `Slash::IsAvailable` precondition (must still be able to normally Slash right
  now) simplified out -- the bonus Slash is untracked against the normal per-turn cap anyway,
  matching the real engine's own `"_shensu"`-tagged bypass, so this may rarely offer the skill
  slightly more often than the exact real rule allows.
- **Zhang He (Trương Cáp, wei, 4hp).** Qiaobian, his only Standard skill (`lang/vi_VN`'s text for
  this one actually MATCHES the real `dev`-branch class exactly, a rare exception to this
  session's usual mismatch pattern): may discard exactly 1 card to skip ANY of Judge/Draw/Play/
  Discard phase, via the same generic `skipsPhaseForDiscard` hook above. Draw-phase skip's real
  compensation (pick up to 2 OTHER players with cards, take 1 hand card -- their choice which --
  from EACH) is ported faithfully. Play-phase skip's real compensation (move 1 equip/delayed-
  trick card between 2 OTHER chosen players, with equip-slot/trick-name matching on both ends) is
  **NOT ported** -- a genuinely separate, more involved 3-party-transfer mechanic than anything
  else this port models (no existing "move a card between 2 players, neither the actor"
  precedent); Judge/Play/Discard-phase skips themselves still work (no compensation needed for
  Judge/Discard either, matching the real rule) -- documented as a deliberate partial port,
  consistent with this repo's existing "1 of 2 clauses ported, other documented" precedent.
- **Taishici (Thái Sử Từ, wu, 4hp).** Tianyi -- the one skill that genuinely needed multi-target
  Slash. Once, at Play-phase start (`Skill.otherPhaseAction`), may pindian (reusing the existing
  `pindian()` helper -- Pindian itself was never the blocker, confirmed again this milestone):
  win arms `player.tianyiWonThisTurn` for the REST of the turn (not single-use) -- Slash becomes
  rangeless (new check in `controller.ts`'s `slashCandidates`), the Slash-use limit +1 (`Skill.
  slashLimit`), and every Slash play for the rest of the turn may also hit a 2nd, rangeless
  target via a new scoped `combat.ts` helper `resolveSlashBonusTarget` (independent Jink-dodge +
  damage check reusing the same reduced-pipeline shape Milestone 20's Triblade-splash precedent
  established: no weapon-specific bonus re-triggers, no onIncomingSlash redirect/nullify, no
  Analeptic bonus damage -- those all read as "effects of THE slash card", which this bonus hit
  deliberately isn't, since this engine has no shared multi-target card-use object to hang them
  on); loss arms `player.tianyiLostThisTurn` instead -- may not play ANY Slash (real or viewAs,
  including Spear's 2-card substitute) for the rest of the turn, gated in `Room.tryPlaySlash`/
  `trySpearSlash`/`computeLegalActions`.

**1 real, pre-existing engine bug found and fixed while chasing ANOTHER card-conservation test
failure this milestone's larger roster exposed (predates this milestone's own new code, confirmed
by reproducing it in isolation and tracing it back to `Room.drawOne`, unrelated to any of the 3
skills above):**

1. **A mid-resolution draw-pile reshuffle silently orphaned an already-captured
   `EngineContext.discardPile` reference, permanently losing every card later pushed through it.**
   `Room.makeContext()` snapshots `discardPile: this.discardPile` as a plain array REFERENCE, once
   per call -- and that same reference is held for the rest of whatever resolution is in flight
   (e.g. `judge()` calling `ctx.drawTop()`, which internally reshuffles when the draw pile is
   empty, then `disposeJudgmentCard`/`resolveIndulgenceJudgment`/`resolveSupplyShortageJudgment`
   pushing onto that SAME `ctx.discardPile` afterward, all within the one still-in-flight call).
   `Room.drawOne()`'s reshuffle used to do `this.discardPile = shuffle(this.discardPile, this.rng);
   this.drawPile = ...; this.discardPile = [];` -- a plain REASSIGNMENT, which orphans any
   in-flight snapshot reference: every card later pushed through it lands in a detached array
   nobody else can see, silently vanishing from the game forever. Caught by
   `testPhaseCyclingConservesCards` (89 -> 87, exactly 2 cards) once this milestone's larger
   57-general roster shifted seed 1's random draft onto a game that happened to run the draw pile
   dry exactly during a SupplyShortage Judge-phase judgment (turn 13: judging drew the pile's
   LAST card, triggering the reshuffle mid-resolution, losing both the freshly-drawn judgment
   card and the SupplyShortage card itself). Fixed by mutating `this.discardPile`/`this.drawPile`
   IN PLACE (`.length = 0` + `.push(...)`) instead of reassigning them -- any snapshot reference
   anyone is already holding keeps observing the SAME live arrays. This bug was NOT specific to
   SupplyShortage -- it could equally have hit Indulgence's judgment (present since Milestone 21),
   just needed the exact "draw pile empties out mid-judgment" timing to ever surface; this is the
   first roster/seed combination in this port's history to hit it.

- **Test:** `testTianyiWinArmsRangelessBonusLossBansSlash` (dedicated, pure -- isolates the
  deterministic pindian win/loss branch that log-mining can't reliably force either way; the Slash
  BAN itself is private to `Room` and is instead exercised end-to-end by `testGeneralSkillsAppearInPlay`,
  which also verifies Shensu/Qiaobian/Tianyi's log markers all fire naturally -- no rarity issues
  this batch); `testGeneralSkillsAppearInPlay` expanded to 57 generals + 5 new markers
  (`shensu`/`qiaobianDraw`/`qiaobianSkip`/`tianyiWin`/`tianyiBonus`, 71 of 71 total markers
  observed).
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 82/82 passing (81
  pre-existing + 1 new dedicated test; the roster-size-triggered card-conservation failure was
  root-caused to the 1 real bug above, not a new-code issue, now fixed AND regression-tested by
  the existing `testPhaseCyclingConservesCards`). (2) Live `ws` server: 10 parallel real Hegemony
  games (auto-created rooms, 8 bots each, driven over real WebSocket) found and confirmed all 5
  target markers firing for real (`"P6 phát động Thần Tốc, xuất Sát không giới hạn khoảng cách
  vào P8 (shensu)"`, `"P5 lấy 1 lá của P7 (qiaobian)"`, `"P7 thắng đấu điểm, Sát lượt này không
  giới hạn khoảng cách, +1 lần dùng và +1 mục tiêu (tianyi)"`, `"P7 dùng Sát nhắm thêm mục tiêu
  P3"`), with no server-side errors. (3) Real headless-browser run: library search confirmed all
  3 new generals' catalog entries render correctly (name/kingdom/hp/skill text, avatar image
  loads) via the actual client UI; zero JS console/page errors observed across the whole session
  (library browsing, room creation, seat toggling). This milestone needed no new client UI --
  every new skill reuses existing ask types (`selfAction`/`otherPhaseAction`/the new
  `wantsToUseSelfAction("<skill>-skip")`/`askAnyHandCards` combo for the generic phase-skip ask).

## Milestone 27 — DONE (final 3 generals: Wolong/Zhou Tai/Zoushi, 57→60 of 60 -- full Standard roster)

User asked to check the real upstream repo for any generals still missing, then to port all of
them plus "whatever else is missing" (`Port luôn 3 tướng đó và những thứ còn thiếu đi`). Verified
directly against the live upstream `dev`-branch source (`standard-{shu,wei,wu,qun}-generals.cpp`,
not just this file's own tracking) that exactly 3 of the real 60-general Standard roster remained
unported: Wolong, Zhou Tai, Zoushi.

- **Wolong (Ngọa Long -- Zhuge Liang's alternate identity, shu, 3hp).** Huoji: any held red card
  may be played/discarded as Fire Attack (lang/vi_VN's `:huoji` text matches the real `dev`-branch
  class exactly, a rare exception to this session's usual mismatch pattern). This needed porting
  Fire Attack itself -- previously excluded (card.ts's header) alongside IronChain/Collateral/
  Nullification as "needs the delayed-trick/judge-area system or a reactive counter-play stack" --
  but re-reading its real `onEffect` showed neither is actually required: it's an ordinary
  single-target trick (target reveals 1 of their own hand cards; the attacker may then discard a
  card of the SAME suit to deal 1 Fire damage), both steps expressible through the existing
  generic `askAnyHandCards` ask (min/max 1 for the target's forced reveal, min/max [0,1] for the
  attacker's optional suit-matched discard, validated against the revealed suit afterward --
  same "never forced, mismatch = decline" precedent `controller.ts` documents for Luanji's
  same-suit requirement). New `card.ts` kind (2 copies, Heart 2/Heart 3, verified against the
  real `trickCards()`), new `Skill.canViewAsFireAttack` hook + `combat.ts`'s
  `findFireAttackLikeCard`/`allFireAttackLikeCards` (mirrors Indulgence/SupplyShortage's viewAs
  pair exactly), new `trick.ts`'s `fireAttackCandidates`/`resolveFireAttack`, wired into
  `room.ts`'s bot fixed pass/`computeLegalActions`/freeform dispatch the same 3 places every
  other single-target trick already is.
- **Zhou Tai (Chu Thái, wu, 4hp).** Buqu ("Bất Khuất"): real `dev`-branch behavior (confirmed
  against the actual `Buqu`/`BuquRemove` C++ classes, not lang/vi_VN -- its `:buqu` text
  describes a different, simpler single-general revision: reveal exactly 1 card per dying
  attempt, heal straight to 1 hp on a non-matching point, discard-and-fail on a match -- not
  ported, same "real C++ wins over a mismatched vi_VN revision" precedent set by Longdan/
  Kongcheng/Tieqi/Kurou). The REAL rule: whenever he'd otherwise die (every self/ally Peach
  rescue this dying episode already exhausted), he may draw enough face-down "Sang" (scar) cards
  -- accumulated in a new `player.buquPile` field across repeated dying attempts, never shrinking
  on its own -- to match his current hp deficit; if no two Sang share a point value, he survives
  at his current (possibly negative) hp instead of dying. A shared point value ends the streak
  for real. New `Skill.preventsDeath` hook, consulted by `combat.ts`'s `resolveDying` only once
  every normal rescue attempt has already failed (distinct from the existing once-per-game
  `cheatsDeath` hook, which always heals -- this can fire every single time, never heals, and
  reuses the existing generic `onRecover` hook to discard the whole Sang pile the instant hp
  actually recovers back above 0, matching the real `HpRecover` clear).
- **Zoushi (Trâu Thị, qun, 3hp, female).** Two skills investigated; 1 ported, 1 correctly left
  unported for a genuine engine-architecture reason (not an oversight):
  - **Qingcheng** (ported): once per Play phase, discard 1 held equip card and choose another
    player who has revealed BOTH their generals (Hegemony-mode-only in practice) -- hides their
    main general again (real rule lets the attacker pick which of the 2; this port always
    targets the main slot, same "faithful behavior, simplified interaction" precedent as
    Guanxing's top/bottom split). lang/vi_VN's `:qingcheng` describes a richer 2-stage version
    (discard any black card, with a BONUS 2nd hide if that card happened to be an equip) --
    the real `dev`-branch `Qingcheng` class only implements the simpler single-stage equip-only
    version; ported as the real class implements it. Reuses the existing `selfAction` hook
    shape (same as Zhijian) -- no new Skill/EngineContext plumbing needed.
  - **Huoshui** (NOT ported): the real skill locks every OTHER player out of voluntarily
    revealing a hidden general during Zoushi's own turn. This engine's own reveal-TIMING
    simplification (Milestone 23's addendum, `Room.runHegemonyReveal`) only ever asks a player
    to reveal at the START of THEIR OWN RoundStart -- never during anyone else's turn -- so the
    exact action Huoshui restricts never has an opportunity to happen for anyone but the
    currently active player in the first place. Confirmed by tracing `runHegemonyReveal`'s only
    call site (`room.ts`'s `runPhase`, gated to the player whose own phase is running): there is
    no code path where implementing Huoshui's restriction would ever change observable behavior.
    Same class of genuine unfixable-without-a-bigger-rearchitecture gap as Dingfeng's Duanbing
    (Milestone 26's correction) -- not a subsystem this port lacks, but a real consequence of an
    earlier deliberate simplification this port already made.
- **Test:** `testBuquSurvivesUntilADuplicateScarAppears` (dedicated, pure -- scripts `drawTop()`
  to prove the pile-growth/duplicate-check math exactly: 2 distinct-point scars save him, a 3rd
  matching an existing point kills him for real) and `testQingchengHidesARevealedMainGeneral`
  (dedicated, pure -- Hegemony-pair-fully-revealed-on-both-sides is far too rare an intersection
  to log-mine from ordinary bot play). `testGeneralSkillsAppearInPlay` expanded to all 60
  generals plus a `huojiViewAs` log marker (Fire Attack's viewAs conversion log line, reliably
  observed like every other viewAs skill); its seed range widened 150->200 (`200-399`, from
  `200-349`) after the larger 60-general/91-card roster shifted which existing rare markers a
  fixed seed range happens to hit (a real RNG-stream-shift consequence of adding new drafted
  content, same phenomenon Milestone 26 already documented for its own card-conservation bug,
  not a regression in any of this milestone's own new code).
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 84/84 passing (82
  pre-existing + 2 new dedicated tests). (2) Live production redeploy: restarted the actual
  running server process with this code, confirmed HTTP 200 both locally and through the public
  ngrok tunnel. (3) Real headless-browser run against the live deployed `public/index.html`:
  library search confirmed all 3 new generals' catalog entries (Ngọa Long/Chu Thái/Trâu Thị --
  name/kingdom/hp/skill text, avatar art including Trâu Thị's female portrait) AND the new Fire
  Attack card entry (art/count/rules text) all render correctly with no broken images.

## Milestone 28 — DONE (Lightning/Thiểm Điện, the 3rd delayed trick card)

User asked what's still missing for Hegemony/Quốc Chiến mode specifically (`Còn thiếu những lá
bài nào cho chế độ quốc chiến không?`). Investigated all 13 still-unported trick cards + 4
armors against the real upstream `dev`-branch source AND `lang/vi_VN/Package/StandardPackage.lua`
(recovered from this repo's own git history, same source Milestone 2.6's general-skill text
came from) -- found 3 of the 13 (HegNullification/KnownBoth/BefriendAttacking) are specifically
Hegemony-relevant (their real effects reference "cùng thế lực"/faction or an unrevealed
main/deputy general, concepts that only exist in Hegemony mode), and confirmed IronChain's real
"chain splash" rule lives in `src/server/gamerule.cpp`'s global damage handling (not IronChain's
own card class) -- Fire/Thunder-natured damage to a chained player unchains them and splashes
the SAME damage to every other still-chained player table-wide; this port's `applyDamage` has
never threaded damage nature through at all (Fire/ThunderSlash's `.nature` field is cosmetic
only), so IronChain needs that threading built first -- correctly identified as needing new
plumbing, not attempted this milestone. User then asked to continue porting (`Port tiếp`).

Of the 13, Lightning (Thiểm Điện) turned out to fit the EXISTING judge-area system exactly, the
same discovery pattern as Fire Attack (Milestone 27) and Indulgence/SupplyShortage before it:

- **Lightning (Thiểm Điện).** A delayed trick with `target_fixed = true` in the real source --
  always attaches to whoever plays it, no target choice at all (modeled as a 1-candidate list
  through the existing `tryPlayDelayedTrick` machinery rather than a dedicated no-target path).
  At the owner's own Judge phase: judges a card; Spade 2~9 (verified exactly against the real
  `judge.pattern = ".|spade|2~9"`) deals 3 Thunder damage and discards the card; any other result
  moves the SAME card on to the next alive player's judge area instead of discarding, to be
  judged again at THEIR next Judge phase -- Lightning circulates the table until someone finally
  rolls Spade 2~9. New `trick.ts` `resolveLightningJudgment` is the first of the 3 judge-area
  resolvers that can re-attach instead of always discarding. The 3-damage hit is modeled via
  `loseHp` (not `applyDamage`) -- the real `DamageStruct(this, NULL, target, 3, Thunder)` has NO
  attacking player at all (a natural-disaster hit), which `applyDamage`'s mandatory
  `source: GamePlayer` parameter can't express; `loseHp`'s existing "no source, no
  onDamage/onDamageDealt reactive triggers, still runs the dying/rescue check" shape is the
  closest honest match already in this engine (same precedent as Kurou's self-inflicted hp
  loss). Known deviation: a real target-side `reduceDamage` skill (Kongrong's Mingshi, the only
  one ported) would still apply to a sourceless `DamageStruct` in the true engine; `loseHp`
  bypasses `reduceDamage` entirely -- a narrow, deliberate simplification rather than a broader
  `applyDamage` refactor for one card's edge case. New `card.ts` kind (1 copy, placeholder
  Spade/0 suit/point -- real source constructs it with none either, same precedent as
  AmazingGrace/GodSalvation/ArcheryAttack), wired into `room.ts`'s bot fixed pass/
  `computeLegalActions`/freeform dispatch/`runJudgePhase` the same way Indulgence/SupplyShortage
  already are.
- **Test:** log-mined via `testGeneralSkillsAppearInPlay`'s existing 200-seed loop (2 new
  markers: the judge itself, and specifically the 3-damage hit branch) -- no dedicated test
  needed, unlike Buqu/Qingcheng last milestone, since Lightning is a real deck card every bot
  automatically plays/attaches with no ask gate, making both branches naturally common across
  200 seeds.
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 84/84 passing (all
  pre-existing, `testGeneralSkillsAppearInPlay` now confirms 74/74 markers including both new
  Lightning ones; `testPhaseCyclingConservesCards` confirms the updated 92-card deck total is
  conserved across turns). (2) Live production redeploy: restarted the actual running server
  process with this code, confirmed HTTP 200 both locally and through the public ngrok tunnel.
  (3) Direct catalog inspection (`library.ts`'s `CARD_CATALOG`, the same data the client's card
  library view renders from) confirmed the new Lightning entry -- correct label, count (1), and
  rules text -- alongside the full 32-entry card catalog and 60-general roster staying intact.
- **Still missing, unchanged from this milestone's own investigation above:** IronChain(x3,
  needs damage-nature threading through `applyDamage` first), Collateral(x1, needs a genuinely
  new 2-stage/2-target trick-targeting flow this engine's single-target `chooseTrickTarget`
  contract doesn't have), Nullification(x1)/HegNullification(x2) (need a reactive
  respond-to-a-trick-in-flight counter-play stack), AwaitExhausted(x2, the real card itself --
  Duoshi's viewAs conversion already covers its effect), KnownBoth(x2)/BefriendAttacking(x1)
  (Hegemony-relevant, both also need pieces of the above), and the 4 Standard armors (need the
  judgment-trigger/locked-damage-immunity armor subsystem).

## Milestone 29 — DONE (Collateral/BefriendAttacking, 2 more trick cards)

User asked to continue porting (`Port tiếp`). Milestone 28's own "still missing" list had
classified Collateral as needing "a genuinely new 2-stage/2-target trick-targeting flow this
engine's single-target `chooseTrickTarget` contract doesn't have" and BefriendAttacking as
"Hegemony-relevant, needs pieces of the [Nullification counter-play] above" -- re-investigating
both against the real upstream source found BOTH classifications were too pessimistic:

- **Collateral (Tá Đao Sát Nhân).** Real rule: player picks "A" (another player holding a
  weapon) then "B" (someone within A's own attack range) when playing the card; A is then asked
  to Slash B, and forfeits their equipped weapon straight to the card's player if they decline
  or can't. This DOES need 2 target picks, but not a dedicated 2-stage trick-targeting UI: "A"
  is picked via the existing single-target `chooseTrickTarget` ask (unchanged), and "B" is
  picked with an ordinary `ctx.askChooseAnyPlayer` call NESTED inside the `resolve` callback --
  the same generic ask many skills already use for arbitrary player selection. New
  `trick.ts` `collateralCandidates`/`resolveCollateral`, reusing `findSlashLikeCard`/
  `effectiveAttackRange`/`effectiveDistance`/`detachCardFrom`/`resolveSlash` (all pre-existing).
- **Befriend Attacking (Viễn Giao Cận Công).** Real rule: target must be another player with a
  DETERMINED faction (`hasShownOneGeneral()`) different from the actor's own -- turned out to be
  an ORDINARY single-target trick (target draws 1, then the actor draws 3), just gated on
  Hegemony's `player.faction` field, which already existed since Milestone 23. Hegemony-only in
  practice (Identity mode never assigns `faction`), same "vacuous outside Hegemony, no special
  casing needed" shape as several Hegemony-flavored skills before it. New `trick.ts`
  `befriendAttackingCandidates`/`resolveBefriendAttacking`.
- **1 real, pre-existing bug found and fixed while chasing a card-conservation test failure this
  milestone's larger deck (94 cards) exposed (predates this milestone's own new code -- same
  "newly exposed by a roster/deck-size change" pattern Milestone 26 already hit for a real engine
  bug):** `simulate.ts`'s `totalCardsInPlay` test helper excluded Jiling's virtual Shuangren
  Slash (`card.ts`'s `makeVirtualSlash`, no backing physical card) from the discard pile count
  only -- but a reshuffle (`Room.drawOne`) sweeps the ENTIRE discard pile, virtual cards
  included, back into the draw pile, from which the virtual card could then be drawn into a real
  hand (indistinguishable from a real card at that point) exactly like any other. The helper
  then double-counted it: once via a real bucket (hand/draw pile) it had legitimately entered,
  and it was never excluded from THOSE buckets in the first place. Root-caused by bisecting the
  exact seed/turn against a version of the deck without Collateral/BefriendAttacking (clean),
  then instrumented card-ID-level snapshots around the leaking `selfAction` call (Lu Xun's
  Duoshi, whose multi-target draw/discard loop happened to run right as the pile emptied and
  reshuffled) to trace the extra card down to its exact identity and location. Fixed by
  excluding virtual cards from EVERY bucket the helper sums (hand, judge area, Zhou Tai's Buqu
  pile, draw pile, discard pile), not just discard pile -- this is a test-helper-only fix, not an
  engine change (the real game state was never actually wrong; only the test's accounting was).
  Also fixed, while in the area: `resolveCollateral`'s Slash-card lookup is now re-resolved AFTER
  the `askUseSelfAction` ask (not reused from before it), matching `tryPlayOnce`'s own documented
  "resolve validity after awaits, not before" precedent -- a latent correctness risk for a
  human-controlled seat (never actually exercised by bot-only testing, since bot asks resolve
  immediately with no real interleaving).
- **Test:** `collateralSlash`/`collateralForfeit` markers added to `testGeneralSkillsAppearInPlay`
  (Collateral works in both modes, reliably log-mined across the existing 200-seed Identity-mode
  loop). `testBefriendAttackingRequiresEnemyFactionAndDrawsCards` (dedicated, pure -- Hegemony-
  only in practice, same "too rare an intersection to log-mine" precedent as
  `testQingchengHidesARevealedMainGeneral`).
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 85/85 passing (83
  pre-existing + 1 new dedicated test + `testGeneralSkillsAppearInPlay`'s marker count growing to
  76/76 without a new dedicated test; `testPhaseCyclingConservesCards` confirms the updated
  94-card deck total is conserved across turns, including the virtual-card fix). (2) Live
  production redeploy: restarted the actual running server process with this code, confirmed
  HTTP 200 both locally and through the public ngrok tunnel. (3) Direct catalog inspection
  (`library.ts`'s `CARD_CATALOG`) confirmed both new card entries -- correct label, count (1
  each), and rules text -- alongside the full 34-entry card catalog and 60-general roster staying
  intact.
- **Still missing:** IronChain(x3, needs damage-nature threading through `applyDamage` first --
  see Milestone 28's investigation), Nullification(x1)/HegNullification(x2) (need a reactive
  respond-to-a-trick-in-flight counter-play stack), AwaitExhausted(x2, the real card itself --
  Duoshi's viewAs conversion already covers its effect), KnownBoth(x2) (needs a private
  per-player info channel -- this engine's `ctx.log` is a single shared public channel), and the
  4 Standard armors (need the judgment-trigger/locked-damage-immunity armor subsystem).

## Milestone 30 — DONE (AwaitExhausted/IronChain, closing out Milestone 28's "still missing" list)

User asked to keep porting and also add a rules/how-to-play section per game mode (`Port luôn
đi, thêm phần luật chơi cho từng chế độ nữa`). This entry covers the porting half; the rules UI
is Milestone 31 below. Both remaining cards from Milestone 29's "still missing" list turned out
tractable:

- **Await Exhausted (Dĩ Dật Đãi Lao).** Milestone 29 had wrongly classified this as already
  fully covered by Lu Xun's Duoshi viewAs conversion -- re-checked against the real card class
  (`src/package/standard-tricks.cpp`'s `AwaitExhausted`) and it's a genuinely separate DEALT
  card (Heart 11, Diamond 4) with the identical self+allies-draw-2-discard-2 effect, just never
  reachable as a real hand card before this milestone. New `trick.ts`
  `awaitExhaustedCandidates`/`resolveAwaitExhausted`, reusing Duoshi's already-ported effect
  shape verbatim but wired as a real `tryPlayOnce` card.
- **Iron Chain (Thiết Tác Liên Hoàn).** Needed damage-nature threading through `applyDamage`
  first, exactly as Milestone 28 predicted. Added a `nature` parameter (`combat.ts`, defaulting
  to `DamageNature.Normal`) and a `chained` boolean field on `GamePlayer`. Real rule: 1-2
  targets or discard-1-to-draw-1 recast; simplified to always-exactly-1-target with no recast
  (same "faithful behavior, simplified interaction" precedent as Guanxing's top/bottom split) --
  toggles the target's `chained` state. The actual payoff is in `applyDamage`: any Fire/Thunder
  (`DamageNature.Fire`/`DamageNature.Thunder`) hit against a chained player now unchains them
  AND splashes the identical damage to every OTHER still-chained player, who each also unchain
  from it. Traced a real bug mid-implementation against the actual upstream handler
  (`src/server/gamerule.cpp`'s `DamageComplete`): the unchain check fires unconditionally per
  damage instance (including splash-caused instances), but only the ORIGINAL, non-splash hit is
  allowed to trigger a further splash -- an `isChainSplash` recursion guard gates only the
  latter, not the former (an earlier draft wrongly gated both on the same flag, which would have
  left splash recipients still marked "chained" after being hit, contradicting the card's own
  name). `resolveSlash` now threads `slashCard.nature` through; `resolveFireAttack` (Milestone
  27's Fire Attack) now correctly passes `DamageNature.Fire` for the first time -- previously
  landed as ordinary `Normal` damage, a latent gap this milestone's nature-threading closed as a
  side effect, not a new deliberate scope item.
- **1 real, pre-existing test bug found and fixed** (same "newly exposed by this milestone's own
  new code" pattern as the last two milestones): `testExpandedControllerHooksRespected` started
  failing because Panfeng's Kuangfu skill (Milestone 26) can call `ctx.equipPlayer()` to hand an
  equip card to ANY player -- including the test's "declined every equip" seat -- entirely
  bypassing `wantsToEquip`, the same class of gap Erzhang's Zhijian already needed a carve-out
  for. `Room.equip()`'s own "X trang bị Y" log line fires BEFORE the assigning skill's own
  summary line (opposite order from the existing Lijian/Luanji "compelled trick" carve-out,
  which looks at the PREVIOUS line), so the fix checks the NEXT log line for a `(kuangfu)`/
  `(zhijian)` suffix instead.
- **Test:** `awaitExhaustedUse`/`ironChainToggle` markers added to `testGeneralSkillsAppearInPlay`.
  New dedicated `testIronChainSplashesElementalDamageAndUnchainsEveryoneHit`, driven directly
  through `applyDamage` (too specific an interaction -- elemental damage landing while 2+
  players are simultaneously chained -- to reliably log-mine from ordinary bot play): confirms
  the original target unchains+splashes, the splash recipient takes identical damage and ALSO
  unchains but does NOT re-splash, an unchained bystander is untouched, and `Normal`-nature
  damage never triggers any of it.
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 86/86 passing (84
  pre-existing + 1 new dedicated test + `testGeneralSkillsAppearInPlay`'s marker count growing to
  78/78 without a new dedicated test); `testPhaseCyclingConservesCards` confirms the updated
  99-card deck total is conserved across turns. (2) Live production redeploy: restarted the
  actual running server process with this code, confirmed HTTP 200 both locally and through the
  public ngrok tunnel. (3) Direct catalog inspection (`library.ts`'s `CARD_CATALOG`) confirmed
  both new card entries -- correct label, count (2 and 3 respectively), and rules text --
  alongside the full 36-entry card catalog and 60-general roster staying intact.
- **Still missing:** Nullification(x1)/HegNullification(x2) (need a reactive
  respond-to-a-trick-in-flight counter-play stack), KnownBoth(x2) (needs a private per-player
  info channel -- this engine's `ctx.log` is a single shared public channel), and the 4 Standard
  armors (need the judgment-trigger/locked-damage-immunity armor subsystem). With this
  milestone, every OTHER Standard trick/equip card that doesn't need one of those 3 subsystems is
  now ported.

## Milestone 31 — DONE (Luật chơi: a rules/how-to-play panel for each game mode)

The other half of the same request above (`thêm phần luật chơi cho từng chế độ nữa`): a
reachable-anytime reference panel explaining each mode's actual rules, mirroring the existing
"Thư viện" (Library) panel's UX so it needed no new interaction pattern:

- **New header button + overlay** (`public/index.html`): "Luật chơi" sits next to "Thư viện",
  opening `#rulesOverlay`/`#rulesPanel` -- same `libraryOverlay`/`libraryHeader`/`libraryTab` CSS
  classes as the Library panel (zero new overlay/tab chrome needed), 2 tabs ("Vai Trò" for
  Identity mode, "Quốc Chiến" for Hegemony mode). Unlike the Library, this content is entirely
  STATIC (2 template-literal constants, `RULES_IDENTITY_HTML`/`RULES_HEGEMONY_HTML`) -- no new
  WebSocket message type, since the rules text never depends on game/server state.
- **Content is written to match this port's ACTUAL implemented rules, not the full upstream
  ruleset** -- cross-checked line-by-line against `gamerule.ts`'s real logic, not paraphrased
  from memory: the exact `ROLE_COUNTS` table (5-10 players) and `checkWinCondition`'s 3-case
  precedence order for Identity mode; the exact Ambitionist `floor(playerCount/2)` quota rule,
  the hidden/reveal timing mechanic (`runHegemonyReveal`), the companion-pair +
  leftover-half-HP reveal bonuses (`resolveHegemonyRevealBonuses`, `combineHegemonyHp`), the Ao
  Chiến trigger condition and its Peach-disable/Peach-as-Slash-or-Jink substitution, and the
  single-faction win condition for Hegemony mode. Each panel ends with a note pointing to the
  Library for full per-card/per-general detail rather than duplicating it.
- **Verification:** `npx tsc --noEmit` clean (script embedded in `index.html` re-parsed
  standalone via `new Function()` to confirm no syntax error, since it isn't part of the
  TypeScript build); live browser check (Playwright via `browser.open` against the redeployed
  production server) confirmed: the button opens the overlay, both tabs render their distinct
  intended Vietnamese content (spot-checked full text length + opening paragraph of each), the
  close button restores the overlay to hidden, and the pre-existing Library panel still opens
  and closes independently afterward (no shared-state regression from reusing its CSS classes).

## Milestone 32 — DONE (Hegemony: 12-player cap + real "phát 5, chọn 2" general draft)

User reported the real Quốc Chiến rule: max table size is 12 (not 10), and each player drafts
their pair from 5 dealt generals, not two separate 3-candidate rounds.

- **`src/room.ts`** -- the constructor's player-count bound is now per-mode: Identity mode stays
  5-10 (its `ROLE_COUNTS` role table, `gamerule.ts`, still only covers that range), Hegemony mode
  is now 5-12 (it has no role table -- `hegemonyKingdomQuota` is `floor(playerCount/2)`, already
  well-defined for any size). `pickGenerals`'s Hegemony branch now deals exactly 5 unfiltered
  (any-kingdom) candidates in ONE `candidateGenerals(5)` call, asks for the main general from
  those 5, then asks for the deputy from the 4 that remain -- filtered to the main's own kingdom
  first (falls back to all 4 if none share it). The 3 (or more) never-picked generals are never
  added to `takenGenerals`, so they return to the shared pool for later players, matching the
  real rule's "trả lại" behavior. `candidateGenerals` gained an optional `pool` param so the
  deputy round can deal from the SAME 5-card deal instead of re-sampling a fresh pool.
- **`src/server.ts`** -- `MAX_PLAYERS` split into `MAX_PLAYERS_IDENTITY` (10) and
  `MAX_PLAYERS_HEGEMONY` (12); `createRoom` and the `"new"` reset handler now size the
  placeholder Room's display slots per the room's actual mode (and construct it WITH that mode,
  since `Room`'s own validation is now per-mode too -- previously the placeholder was always
  built Identity-typed regardless of the room's real mode, which only worked because both modes
  shared one 5-10 bound).
- **`public/index.html`** -- the seat table grows a `top5`/`bot5` slot pair (12 seats total),
  toggled on via a `#table.mode-hegemony` CSS class (wider 7-column grid; the extra slots are
  `display:none` outside it so they don't fall back to grid auto-placement) set from `render()`
  based on `state.mode`. `SLOT_ORDER` split into `SLOT_ORDER_10`/`SLOT_ORDER_12`, chosen per
  mode in `renderPlayers()`. The lobby's waiting-room ready-count (`0/10 -- cần tối thiểu 5`) is
  now `${activeCount}/${state.players.length}`, so it reads `/12` in a Hegemony room instead of
  a hardcoded `/10`. The general-pick hint text for the `"main"`/`"deputy"` roles now says "5
  tướng được phát" / "trong các tướng còn lại" instead of the old "3 tướng" wording (Identity
  mode's own single-pick hint is untouched -- it still deals 3). The Hegemony rules panel
  (`RULES_HEGEMONY_HTML`) now states the 5-12 player range and the phát-5-chọn-2 draft mechanic.
- **Verification:** a throwaway script confirmed the new per-mode bounds (`Room` constructs at
  exactly 12 for Hegemony/10 for Identity, throws one past each) and that 10 seeds of a
  12-player Hegemony draft always end with every player holding both a main AND a deputy
  general. Live browser check (a real server instance, `browser.open`) against a freshly created
  Hegemony room confirmed: the table renders all 12 named seat slots; claiming P1, bot-filling
  the rest, and starting the match asked P1 for a main general from exactly 5 candidates (mixed
  kingdoms); picking Tào Tháo (Ngụy) then asked for a deputy from exactly the 2 Ngụy generals
  left in that same 5-card deal (Trương Liêu, Chân Cơ) -- confirming the "same 5, not a fresh
  3+3 deal" mechanic end to end; the resulting player record showed
  `general: caocao / deputyGeneral: zhangliao / kingdom: wei` with both generals' skills unioned
  onto the player. `npx tsc --noEmit` shows the same pre-existing unrelated error count as
  before this change (an in-progress Nullification feature elsewhere in the tree).

## Milestone 33 — DONE (Nullification/HegNullification/KnownBoth: the last 3 Standard trick cards)

User asked to check carefully whether any Quốc Chiến (Hegemony)-relevant cards were still
missing (`Có những lá bài chức năng hay quân lệnh nào chưa được port cho quốc chiến không, check
kỹ xem`). Investigation: cross-checked this port's own deck against the real upstream
`trickCards()`/`equipCards()` lists directly (34 trick cards + 20 equip cards upstream vs. this
port's 16 trick kinds + 16 equip kinds at the time) -- confirmed the gap was exactly
Nullification(x1)/HegNullification(x2)/KnownBoth(x2) (all 3 trick cards) plus the 4 Standard
armors (equip, unrelated to Hegemony specifically), nothing else. Also confirmed HegNullification
is NOT just "more copies of Nullification" -- the real card (`lang/vi_VN`'s official text) adds a
genuine Hegemony-exclusive choice: block just the target, or their WHOLE kingdom at once. User
then asked to port all 3 (`Port cả 3 lá cùng lúc`).

- **Nullification/HegNullification (Vô Giải Khả Kích / Vô Giải Khả Kích - Quốc).** Needed a
  genuinely new subsystem: a reactive "respond to a trick in flight" counter-play window --
  every trick card in this port up to now resolved immediately, with no interruption point.
  Built as `Room.resolveNullificationWindow`/`offerNullification` (private, recursive): any
  alive player holding a Nullification-kind card may play it right before a trick's effect
  applies against a specific target; the played card is itself immediately counter-nullifiable
  by a FURTHER Nullification (odd chain depth cancels the original effect, even depth --
  including 0 responders -- doesn't), matching the real upstream `gamerule.cpp`'s
  `isCanceled`/`_askForNullification` recursive shape. Confirmed directly against the real
  source that every existing trick kind in `standard-tricks.cpp` is `cancelable` by default (no
  card opts out) -- so the window applies UNIFORMLY: offered once per whole card use at
  `tryPlayOnce`/`tryPlayTargeted`/`tryPlayDelayedTrick`'s single choke point for every trick kind
  except the 2 AOE cards (SavageAssault/ArcheryAttack), which get REAL per-target granularity
  instead (they already looped per-player in trick.ts) via a new `EngineContext.askNullification`
  callback -- that's also where HegNullification's real "single target vs. their whole kingdom"
  scope choice actually matters: choosing "all" auto-shields every other still-untouched
  same-faction target from the rest of that SAME AOE resolution, no new ask needed for each.
- **KnownBoth (Tri Bỉ Tri Kỉ).** Needed the other genuinely new subsystem: a private per-player
  info channel -- the whole point of the card is privately showing ONLY its user either the
  target's hand or one of their still-hidden generals, and `ctx.log` is a single shared PUBLIC
  channel every player/spectator sees identically, confirmed structurally incapable of this.
  Built `Room.setPrivateRevealCallback` (mirrors the existing `setLiveUpdateCallback` hook
  exactly) wired by server.ts straight to a new one-way `notifyClient` helper (like `askClient`
  but no response/requestId expected) that sends a message to just the viewing player's own
  socket, entirely bypassing the shared broadcast snapshot; the client renders it as a
  short-lived corner toast. Real rule's recast (discard the card for 1 draw instead of
  targeting) is dropped, same "faithful behavior, simplified interaction" precedent already used
  for IronChain's own recast (Milestone 30).
- **Full human-interactive support, not just the bot path**: `wantsToNullify`,
  `chooseHegNullificationScope`, and `chooseKnownBothOption` are all wired into
  `server.ts`'s `makeHumanController` with real client dialogs (`confirmNullification` reuses
  the existing yes/no `showConfirm`; `chooseHegNullificationScope`/`chooseKnownBothOption` get
  new 2-and-N-button choice prompts modeled on the existing companion-bonus prompt) -- a claimed
  human seat gets the real decision, not a silent bot-policy fallback, matching every other
  Controller method this port has ported so far.
- **1 real TS compiler quirk found and worked around** (not a bug in this port's logic): a
  discriminated union (`PrivateReveal`, `{kind:"hand";cards:Card[]}|{kind:"general";...}`) whose
  "hand" variant nests an ARRAY of objects that ALSO happen to have their own unrelated `kind`
  field (`Card.kind: CardKind`) makes TypeScript's discriminant-narrowing collapse the outer
  union to `never` at the exact `payload.kind === "hand"` check -- confirmed via a minimal
  standalone repro (isolated down to the literal field-name collision, independent of this
  port's own code). Worked around in the one test that hit it with an explicit
  `as Extract<PrivateReveal, {kind:"hand"}>` cast instead of relying on inline narrowing.
- **1 real, pre-existing test bug found and fixed** (same "newly exposed by this milestone's own
  deck-size/RNG-stream shift" pattern as the last several milestones):
  `testHegemonyDraftPicksSameKingdomPairWithCombinedStats` asserted every drafted main+deputy
  pair must share a kingdom -- but `Room.candidateGenerals`'s own doc comment already documents
  a real fallback (falls back to the full unfiltered 4 leftover candidates if NONE of them share
  the main's kingdom, so no player is ever left with zero deputy choices); this port's larger
  104-card deck shifted seed 1's RNG stream just enough to make P2 hit that exact documented
  fallback for the first time (confirmed directly: seed 1's P2 drafts menghuo/Thục then falls
  back to zhanghe/Ngụy). The test's invariant was too strict relative to the real algorithm's
  own contract -- fixed to assert the always-true parts (`player.kingdom` follows the MAIN
  general specifically; distinct generals; correct combined stats/skill union/gender) plus an
  aggregate check that the primary same-kingdom rule still fires for the clear majority of
  pairs (30/48 across the 8 seeds), not the real engine code, which was already correct.
- **Test:** 3 new dedicated tests (too rare/specific an intersection -- a SPECIFIC responder
  holding a SPECIFIC 1-in-104 card at exactly the right moment -- to reliably log-mine from
  ordinary bot play, same precedent as `testBefriendAttackingRequiresEnemyFactionAndDrawsCards`):
  `testNullificationCancelsATrickCardsEffect` (a real Room turn, rigged hands, proves a Duel
  never resolves and both cards end up discarded+logged), `testHegNullificationCanShieldAWhole
  FactionFromAoe` (a real Hegemony Room turn, seat order guarantees allyA's SavageAssault hit
  resolves before allyB's, proving the "all" scope auto-shields allyB with no new ask while a
  different-faction enemy still takes the hit normally), `testKnownBothRevealsPrivatelyNotIn
  PublicLog` (pure, driven directly through `resolveKnownBoth`, proves the reveal reaches
  `ctx.revealPrivately` addressed to the actor and NEVER appears in `ctx.log`).
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 89/89 passing (86
  pre-existing + 3 new dedicated tests, including the 1 test-brittleness fix above);
  `testPhaseCyclingConservesCards` confirms the updated 104-card deck total is conserved across
  turns. (2) Live production redeploy: restarted the actual running server process with this
  code, confirmed HTTP 200 both locally and through the public ngrok tunnel. (3) Live browser
  check (Playwright via `browser.open` against the redeployed production server): opened the
  in-client Library, confirmed all 3 new cards render with their correct Vietnamese
  labels/descriptions among a 39-entry card catalog (23 basic/trick kinds + 10 weapons + 6
  horses) and the full 60-general roster staying intact.
- **Still missing:** the 4 Standard armors (EightDiagram/RenwangShield/Vine/SilverLion -- need
  the judgment-trigger/locked-damage-immunity armor subsystem, unrelated to Hegemony
  specifically). With this milestone, every Standard trick card is now ported -- the ENTIRE
  Standard card pool (basics + tricks) matches the real upstream source exactly, with only the
  4 armors remaining in the whole `standard-equips.cpp`/`standard-tricks.cpp` pool.

## Milestone 34 — DONE (EightDiagram/RenwangShield/Vine/SilverLion: the 4 Standard armors)

User asked to check for any remaining missing trick/functional cards for Quốc Chiến
(`Check xem còn bài cẩm nang hay chức năng nào thiếu bên chế độ quốc chiến không`) -- confirmed
all 19 trick kinds now match upstream exactly (Milestone 33 closed the last gap); only the 4
Standard armors (equip, not trick) remained unported. User then said to build them
(`Xây luôn`).

- **Real upstream mechanics researched directly from source** (`src/package/standard-equips.h`/
  `standard-equips.cpp`, `Mogara/QSanguosha-For-Hegemony` `dev` branch, cross-checked against
  the official `lang/vi_VN` text): EightDiagram (Bát Quái Trận) is NOT compulsory -- when asked
  to play Jink, may judge instead; red counts as a played Jink. RenwangShield (Nhân Vương Thuẫn)
  is compulsory (locked) -- a black-suited Slash has NO effect on the wielder at all (full
  nullify, no Jink needed). Vine (Đằng Giáp) is compulsory -- SavageAssault/ArcheryAttack and
  ordinary Normal-nature Slash have no effect; Fire-natured damage taken instead +1. SilverLion
  (Bạch Ngân Sư Tử) is compulsory -- any single damage instance >1 becomes 1; after it leaves
  the wielder's equip zone (while alive), heal 1 hp.
- **New `player.armor` equip slot** (`GamePlayer`, alongside the existing weapon/defenseHorse/
  offenseHorse) plus `CardKind.Armor`/`Card.armorName` -- a player can equip at most 1 armor at
  a time, which makes any "2 armors at once" ordering question moot (Vine and SilverLion, or
  any pair, can never coexist on the same player).
- **RenwangShield/Vine's Slash-nullify** lives in `resolveSlash` specifically (not
  `applyDamage`) -- a `SlashEffected`-equivalent short-circuit that only fires for the actual
  Slash card resolution (matches the real engine's `Global_NonSkillNullify`), checked against
  `effectiveTarget` (not `target`) so a Liushan/Daqiao redirect still checks the NEW target's
  own armor; confirmed this correctly excludes Triblade splash and Tianyi bonus-hit paths (which
  call `applyDamage` directly, bypassing `resolveSlash` entirely).
- **Vine's SavageAssault/ArcheryAttack immunity** lives in `trick.ts`'s per-target AOE loops --
  the wearer is skipped outright (`continue`), never even offered the discard-a-card choice,
  same short-circuit shape as the existing skill-based `immuneToSavageAssault` check.
- **SilverLion/Vine's damage-amount effects** (cap to 1, +1 Fire) live in the shared
  `applyDamage` choke point -- must apply to EVERY damage source (Slash/Duel/AOE/skill-inflicted/
  chain-splash alike), not just Slash, matching the real `DamageInflicted` event's universal
  scope (same architectural precedent as IronChain's own chain-splash logic already living
  there).
- **SilverLion's heal-on-loss** fires from BOTH real departure paths: `room.ts`'s `equip()`
  (replaced by a newly-equipped armor) and `combat.ts`'s `detachCardFrom` (Dismantlement/Snatch/
  IceSword) -- heals exactly 1 hp only while alive and still wounded, matching the real
  "sau khi rời khỏi vùng trang bị của bạn, hồi 1 máu" wording exactly (no condition on HOW it
  left).
- **EightDiagram simplified to "backup dodge only"**: offered ONLY when no real/viewAs Jink was
  found (not a full 3-way choice to also gamble away a held real Jink for value) -- a real,
  deliberate simplification, documented in-code and in the library catalog entry, matching the
  "faithful behavior, simplified interaction" precedent already used for IronChain's dropped
  recast (Milestone 30). Gated on the same `dodgeBlocked`/`requiredJinks > 0` check real Jinks
  use (Tieqi/Liegong's dodge-block also blocks EightDiagram, since the card's own text says it
  "counts as playing a Jink"). Axe's force-through offer applies uniformly to any dodge method
  (real Jink or EightDiagram alike), matching the real rule (no distinction by dodge source).
- **Full human-interactive support**: new `askUseEightDiagram`/`wantsToUseEightDiagram` wired
  into `server.ts`'s `makeHumanController` with a real client dialog (`confirmEightDiagram`,
  reusing the existing `showConfirm` pattern) -- a claimed human seat gets the real choice, not
  a silent bot-policy fallback.
- **A real, pre-existing engine bug found and fixed** (same "newly exposed by this milestone's
  own deck-size/RNG-stream shift" pattern as several prior milestones): `resolveSavageAssault`/
  `resolveArcheryAttack`'s per-target AOE loop kept applying damage/reactive-skill effects to
  LATER targets even after an EARLIER target's death had already ended the game -- e.g. a Savage
  Assault's 3rd of 7 targets dying completed the Hegemony win condition (freezing the winners
  list at that instant), but the loop's still-pending 4th-7th targets kept taking damage
  afterward, and a Ganglie-triggered reactive hit killed ANOTHER already-declared "winner" with
  nothing left to re-run `checkWinCondition` -- the frozen winners list no longer matched who
  was actually still alive by the time the match truly settled. Found live via
  `testEmergentHegemonyGameReachesWinCondition` (seed 1's larger 108-card deck shifted the RNG
  stream onto exactly this scenario). Fixed with a new `EngineContext.isGameOver()` accessor,
  consulted at the top of both AOE loops -- once the game has ended, no further target in the
  SAME card's resolution is touched.
- **Several other equip-zone-generic sites updated to recognize armor alongside weapon/horse**,
  found by grepping every existing `weaponName ?? horseName`-shaped fallback and
  `CardKind.Weapon || CardKind.Horse`-shaped check in the codebase: Niepan's full equip-zone
  discard, Kuangfu's equip-pick candidates + own-slot-empty check, Shensu's `equipOnly` discard
  cost, Qingcheng's equip-card-in-hand filter, `DISCARD_IMPORTANCE`/`choosePlayerCard`'s bot
  policy, and every client-side `cardImageSrc`/`cardLabel`/`isEquip` check in `index.html`.
- **Test:** 4 new dedicated tests (armor mechanics are too specific/locked to reliably
  log-mine from ordinary bot play): `testEightDiagramJudgesABackupDodge` (red judgment dodges,
  non-red takes the hit), `testRenwangShieldBlocksOnlyBlackSuitedSlash` (black slash fully
  nullified with the jink-dodge ask never even firing, red slash connects normally),
  `testVineBlocksNormalDamageAmplifiesFireDamage` (normal Slash/SavageAssault/ArcheryAttack all
  nullified -- the discard-a-card ask never fires for SavageAssault -- fire Slash connects with
  +1 damage), `testSilverLionCapsDamageAndHealsOnLoss` (a 3-damage hit caps to 1, leaving the
  equip zone while wounded heals exactly 1 hp, no overheal at full hp).
- **Verification, three layers:** (1) `npx tsc --noEmit` clean; `npm run sim` 93/93 passing (89
  pre-existing + 4 new dedicated tests), including the win-condition-cascade bug fix above and
  the updated 108-card `DECK_SIZE`/`totalCardsInPlay` (now counting the armor slot). (2) Live
  production redeploy: restarted the actual running server process with this code, confirmed
  HTTP 200 both locally and through the public ngrok tunnel, then drove a real bot-only game
  over the live WebSocket API end to end and confirmed a bot actually equipped RenwangShield by
  turn 3 with the `armor` field correctly present in the broadcast snapshot. (3) Live browser
  check (against the redeployed production server): opened the in-client Library, confirmed all
  4 new armors render with correct Vietnamese descriptions, real card art, and correct counts
  among a 43-entry card catalog (23 basic/trick kinds + 10 weapons + 6 horses + 4 armors).
- **Fully closed:** this was the last remaining gap in the whole Standard card pool -- every
  basic, trick, AND equip card in the real upstream `standard-basics.cpp`/`standard-tricks.cpp`/
  `standard-equips.cpp` now has a ported, playable equivalent in this port (108/108 cards).

## Milestone 35 — DONE (Zang Ba/Tang Bá + Hengjiang, the first general ported OUTSIDE the 60-general Standard roster)

User pointed out Zang Ba was missing; upon investigation he isn't a Standard-package general at
all -- confirmed against upstream `src/package/momentum.cpp` (`WEI 023`), one of several
Hegemony-specific supplementary general packs (alongside `formation.cpp`/`transformation.cpp`/
`jiange-defense.cpp`/`strategic-advantage.cpp`) that ship extra generals/equips for Quốc Chiến
specifically, never part of the 60-general Standard set this port completed at Milestone 27.
User asked to port him anyway.

- **`src/skill.ts`** -- `zangba` added to `GENERALS` (kingdom wei, 4 hp, companion Zhang Liao),
  clearly commented as sourced from `momentum.cpp` rather than Standard so the roster's own
  "60 Standard generals" claim stays accurate (Zang Ba is #61, explicitly outside that count).
  His skill **Hengjiang (橫江/Hoành Giang)** is a real `MasochismSkill`: each time he takes
  damage he may weaken whoever is CURRENTLY mid-turn by -1 max hand size for the rest of their
  turn (stacks per hit); if that debuff never actually forces them to discard by the time their
  turn ends, Zang Ba draws 1 card as compensation. Ported as `hengjiangOnDamaged`, gated by the
  existing generic `askUseSelfAction` ask (bots always take it, matching every other optional
  masochism-style skill's bot default). Real upstream fires once per POINT of damage
  (`MasochismSkill`'s own per-point trigger loop); this port's `onDamaged` hook has no `amount`
  parameter at all (same simplification every other masochism skill here already makes, e.g.
  Fankui/Jianxiong), so it invokes at most once per hit -- a documented, not silent, scope line.
- **`src/player.ts`** -- 2 new dedicated per-player fields (matching this file's existing
  precedent of narrowly-scoped fields like `tianyiWonThisTurn`, not a generic marks bag):
  `hengjiangMark` (the live -1-per-stack hand-limit debuff, now subtracted in the `maxCards`
  getter) and `hengjiangDiscardedThisTurn` (set by `discardDownToLimit` the instant the debuff
  actually forces a real discard -- read once at that same turn's end to decide the
  compensation draw). Both reset at the start of each of that player's own turns and again
  unconditionally when that turn ends, matching the real rule's TurnStart/HengjiangFail timing;
  never carry across turns.
- **`src/combat.ts`** -- `EngineContext` gained `currentPlayer` (whoever's turn it currently
  is) -- the first skill hook here that needs "the active player" as a concept distinct from
  attacker/defender/self, since Hengjiang's real target is whoever is mid-turn when Zang Ba
  happens to take damage (which can be a completely different player's Slash/Duel/AOE).
- **`src/room.ts`** -- `makeContext` now threads `this.players[this.currentIndex]` through as
  `currentPlayer`; `playTurn` resets both new fields alongside the existing turn-scoped ones
  (`tianyiWonThisTurn` etc.) and, right after the phase loop finishes (genuine turn-end, mirrors
  upstream's `EventPhaseChanging` to `NotActive`), checks `hengjiangMark`/
  `hengjiangDiscardedThisTurn` on the just-finished turn's owner: awards the alive Zang Ba
  (found by general/deputyGeneral name -- he's unique, so no id needs threading through) exactly
  1 draw when warranted, then always clears the mark.
- **`src/gamerule.ts`** -- `COMPANION_PAIRS` gained `["zhangliao", "zangba"]` (confirmed against
  upstream's own `zangba->addCompanion("zhangliao")`); the header comment's stale "9 pairs"/
  "44-general roster" phrasing (never updated since an earlier milestone actually grew the
  roster to 60) corrected in the same pass since this edit touched the exact same array.
- **Verification:** a throwaway script confirmed (1) `zangba` is registered wei/4hp and
  companion-paired with `zhangliao`; (2) a hand-built `EngineContext` + `combat.ts`'s real
  `applyDamage` shows Zang Ba taking damage marks the CURRENT player (not the attacker, not Zang
  Ba himself) with `hengjiangMark = 1` and `maxCards` drops by exactly 1; (3) replaying the
  turn-end check draws Zang Ba exactly 1 card when no discard was forced, and (4) exactly 0 when
  one was. A separate throwaway integration script ran 3 full bot-vs-bot Hegemony games (8
  players, `runUntilGameOver`) where Zang Ba was actually drafted, each completing 29-49 turns
  with no crash. `npx tsc --noEmit` clean.

## Milestone 36 — DONE (4 more Hegemony-specific generals: Li Dian/Chen Wu·Dong Xi/Jiang Wan·Fei Yi/Xu Sheng; full audit of all 5 supplementary packages)

User asked to check for and port every remaining missing general, AND to re-check the skills of
already-ported generals against the same "expansion pack" source files (`Check và port tất cả
các tướng còn thiếu đi, check cả skill các tướng trong bảng mở rộng cho các tướng hiện tại
luôn`). Read all 5 upstream Hegemony-specific supplementary packages in full
(`momentum.cpp`/`formation.cpp`/`transformation.cpp`/`jiange-defense.cpp`/
`strategic-advantage.cpp`, ~8700 lines of real C++ total) to build a complete inventory before
touching any code.

- **Re-check of already-ported generals:** none of the 5 packages ADD or MODIFY a skill on any
  general already in this port's roster -- each package only ever introduces brand-new
  generals (or, for `strategic-advantage.cpp`, brand-new equipment). No existing general needed
  a skill update.
- **4 new generals ported**, each chosen because their FULL real kit maps onto hooks this engine
  already has, or onto a small hook added following an exact existing precedent:
  - **Li Dian (Lý Điển, Wei, 3hp, momentum.cpp, companion Nhạc Tiến)** -- Wangxi (Vong Khích):
    whenever he deals OR takes damage, he and the other combatant may each draw 1 -- both
    directions reuse the EXISTING `onDamaged`/`onDamageDealt` hooks, zero new engine surface.
    His 1st skill Xunxun is deferred: real upstream reveals the top 4 draw-pile cards and splits
    them into a FIXED 2-to-hand/2-to-bottom, which doesn't match this engine's existing Guanxing
    ask (`askGuanxingBottom`, an arbitrary-count-to-bottom split) closely enough to reuse
    faithfully.
  - **Chen Wu·Dong Xi (Trần Vũ Đổng Tập, Wu, 4hp, momentum.cpp)** -- Duanxie (Đoạn Tiết): once
    per Play phase, chain another not-yet-chained player AND himself (`activeAction`, reusing
    the existing `chained` field from Milestone 30's Iron Chain). Fenming (Phấn Mệnh): at his
    own Finish phase, if chained, force every currently-chained player (himself included) to
    discard 1 card of his choosing (`otherPhaseAction` at `Phase.Finish` -- already fires for
    every phase value, no wiring change needed -- plus a new `forcedDiscardOne` helper mirroring
    Dismantlement/Snatch's own candidate-build-then-`askPickPlayerCard` pattern).
  - **Jiang Wan·Fei Yi (Tưởng Uyển Phí Y, Shu, 3hp, formation.cpp)** -- Shengxi (Sinh Tức): if
    you dealt no damage during your own Play phase, draw 2 at Discard-phase start (a new
    `dealtDamageInPlayPhase` player field, set by a `onDamageDealt` hook and read by an
    `otherPhaseAction` at `Phase.Discard` -- fires BEFORE that phase's own over-limit check,
    matching upstream's "Play phase just ended" timing exactly). Shoucheng (Thủ Thành): when an
    ALLY's hand hits 0 outside their own turn, may have them draw 1 -- needed a genuinely new
    broadcast hook (`onAllyHandEmptied`, wired into `Room.checkHandEmptied` alongside the
    existing self-only `onHandEmptied`, gated on the emptied player's last-recorded `.phase`
    being `NotActive`), built on the exact same broadcast-to-every-ally pattern `onAllyDeath`/
    `onAllyDying` already established.
  - **Xu Sheng (Từ Thịnh, Wu, 4hp, formation.cpp, companion Đinh Phụng)** -- Yicheng (Nghĩa
    Thành): whenever an ally (or himself) is targeted by a Slash, may have them draw 1 then
    optionally discard 1 of their own choosing. Needed another new broadcast hook
    (`onAllySlashTargeted`), wired into `combat.ts`'s `resolveSlash` right after the real target
    is finalized (past any Liushan/Daqiao redirect and armor-nullify check) but BEFORE the
    Jink-dodge exchange -- matching upstream's `TargetConfirmed` timing exactly. The optional
    discard reuses the existing generic `askAnyHandCards(player, 0, 1)` ask verbatim.
  - 2 new companion pairs added to `gamerule.ts`'s `COMPANION_PAIRS`: Li Dian/Nhạc Tiến, Xu
    Sheng/Đinh Phụng (both already-ported generals).
- **Everything else investigated stays deferred, each for a concrete, specific reason** (not a
  blanket "too hard"):
  - **`momentum.cpp` (Wei/Shu/Wu/Qun generals beyond Zang Ba/Li Dian):** Ma Dai's Qianxi needs a
    card-USE-RESTRICTION subsystem (`setPlayerCardLimitation`) this engine has no equivalent
    of. Mi Furen's Guixiu needs "hide a revealed general back down" (this port's reveal is
    one-way by design -- Milestone 23); her Cunsi needs skill-transfer + voluntary self-general-
    removal. Sun Ce's Yingyang needs **pindian** (card-number comparison duels) -- explicitly
    listed since Milestone 2.6 as a subsystem this port doesn't have; his Hunshang needs dynamic
    runtime skill acquire/detach (temporarily granting/revoking a DIFFERENT skill class). Dong
    Zhuo's Baoling needs "voluntarily remove your OWN general mid-game" (a structural change to
    the dual-general/reveal system). Zhang Ren's Fengshi is a `BattleArraySkill`
    (阵法技/围攻/队列) -- the exact category already excluded in this README's "What's actually
    implemented" section ("formation skills... a genuinely separate package of unported
    generals"). `lord_zhangjiao`'s Hongfa is `attached_lord_skill` (a kingdom-wide skill only
    the Identity-mode Lord seat gets) -- this Hegemony port has no "lord" role concept per
    player at all.
  - **`formation.cpp` (beyond Jiang Wan·Fei Yi/Xu Sheng):** Deng Ai's Tuntian is a 3-trigger-
    skill chain (Tuntian/TuntianPostpone/TuntianGotoField) building a "field" card pile via a
    reactive judge fired on losing cards during OTHER players' turns, with its own postpone/
    timing bookkeeping -- a genuinely new subsystem disproportionate to one general. Cao Hong's
    Heyi and Jiang Wei's Tianfu are both `BattleArraySkill`s (same excluded formation category
    as Zhang Ren above); Jiang Wei also needs a per-general deputy-maxHp-adjustment override
    (`setDeputyMaxHpAdjustedValue`). Jiang Qin's Niaoxiang is the same formation category. Yu
    Ji's Qianhuan needs a new personal card pile PLUS a generic "cancel one specific target of
    an in-flight card" hook (distinct from this port's existing Slash-only nullify/redirect
    hooks). He Taihou's Zhendu needs "force ANOTHER player to use a specific card
    (Analeptic) on themselves" -- no such compulsion mechanic exists. `lord_liubei`'s
    Jizhao/Shouyue are lord-only, same reason as `lord_zhangjiao` above.
  - **`transformation.cpp` (9 generals: Xun You, Empress Bian, Li Guo, Zuo Ci, Sha Moke, Ma Su,
    Ling Tong, Lü Fan, `lord_sunquan`):** the ENTIRE package is built around
    `room->transformDeputyGeneral(player)` -- randomly swapping a player's deputy general
    mid-game -- a wholly new subsystem (new state, new UI, new interaction with the existing
    face-down/face-up reveal-timing mechanic) that every one of its 9 generals depends on for at
    least one skill. None are portable without building that subsystem first.
  - **`jiange-defense.cpp` (13 `jg_`-prefixed characters, several literally named `_machine`
    e.g. the 4 Divine Beast constructs):** this is an entirely separate SCENARIO game mode
    (剑阁防线/Kiếm Các Phòng Tuyến), not standard draftable Quốc Chiến generals at all -- out of
    scope regardless of any subsystem work, matching how this port never implemented the
    scenario-mode system to begin with.
  - **`strategic-advantage.cpp`:** contains ZERO generals -- 3 new weapons/armor only (Blade/
    Halberd/Breastplate). Not applicable to "tướng còn thiếu" (missing generals); a distinct
    future ask about missing equipment, not addressed here.
- **Verification:** a throwaway script confirmed every mechanic in isolation (Wangxi's mutual
  draw both directions via a real `applyDamage`/`onDamageDealt` call; Duanxie's `candidatesFor`
  + chain-both-sides `run`; Fenming discarding from every chained player while sparing an
  unchained bystander; Shengxi's gate correctly flips on `onDamageDealt`; Shoucheng drawing the
  ally whose hand emptied; Yicheng's draw+optional-discard via a real `resolveSlash` call). A
  separate throwaway integration script ran 8 full bot-vs-bot 8-player Hegemony games
  (`runUntilGameOver`) covering all 4 new generals in various pairings (including a real Li
  Dian/Nhạc Tiến companion draft), each completing 28-80 turns with no crash. `npx tsc --noEmit`
  clean.

## Milestone 37 — DONE (2 more Hegemony-specific generals, partial ports: Ma Dai/He Taihou)

User asked to keep porting (`Port thêm đi`). Re-scanned the Milestone 36 deferred list for any
general blocked by only ONE of their 2 skills, where the other skill was independently portable
-- found 2, ported each keeping only the portable half (same "faithful behavior, simplified
interaction" precedent Milestone 36 already applied to Li Dian: full general drafted, one real
skill missing with the reason documented inline).

- **Ma Dai (Mã Đại, Shu, 4hp, momentum.cpp, companion Mã Siêu)** -- ported with `mashu`
  (Mã Thuật) alone, an already-shared reusable skill instance (Pang De/Ma Teng/Ma Chao all
  already use the exact same skill object) -- zero new code, one `GENERALS` entry + one
  `COMPANION_PAIRS` entry. His 2nd skill Qianxi stays deferred: needs a card-USE-RESTRICTION
  subsystem (`setPlayerCardLimitation` -- forbid a specific suit/color pattern for a target
  until end of turn) this engine has no equivalent of.
- **He Taihou (Hà Thái Hậu, Qun, 3hp, formation.cpp)** -- ported with a NEW Qiluan (Khởi Loạn):
  whenever she causes a kill, she may draw 3. This needed one genuinely new hook, `onKill(ctx,
  self, killed, rng)`, fired on the credited killer's own skills from `Room.killPlayer` --
  placed right alongside the existing Identity-only Rebel-kill-reward/Lord-punish-mistaken-kill
  logic already living there, but deliberately mode-agnostic (fires in both Identity and
  Hegemony, unlike its 2 neighbors). Real upstream actually delays the draw-offer until the end
  of the killer's own NEXT turn; collapsed to an immediate offer right after the kill lands --
  same precedent as collapsing Hengjiang/Wangxi's per-point-of-damage asks down to once per
  event. Her 2nd skill Zhendu stays deferred: needs "force ANOTHER player to use a specific
  card (Analeptic) on themselves", no such compulsion mechanic exists in this engine.
- **Verification:** a throwaway script confirmed Qiluan draws exactly 3 on a credited kill, then
  ran 6 full bot-vs-bot 8-player Hegemony games where Ma Dai or He Taihou was actually drafted
  (including a real He Taihou-credited kill firing `onKill` through the genuine
  `Room.killPlayer` path, not a mocked hook), each completing 28-80 turns with no crash. Live
  Library check over a real WebSocket connection: 67 generals total, both new entries render
  with correct kingdom/hp/skill text. `npx tsc --noEmit` clean.

## Milestone 38 — DONE (2 more Hegemony-specific generals: Mi Furen/Sun Ce)

User asked to keep porting (`Port thêm đi`). Re-scanned the Milestone 36/37 deferred list once
more for skills blocked by a narrow, well-scoped gap rather than a genuinely new subsystem --
found 2 more.

- **Mi Furen (Mi Phu Nhân, Shu, 3hp, formation.cpp)** -- ported with a NEW Guixiu (Quy Tú):
  draws 2 the instant either of her generals reveals. Needed one new hook,
  `onGeneralRevealed(ctx, self)`, wired into `Room.runHegemonyReveal` right after the
  main/deputy reveal flags flip -- computed as a set-difference of `player.skills` before vs.
  after (so it correctly fires only for the skills whose visibility JUST changed, regardless of
  whether Mi Furen was drafted as someone's main or deputy). Her 2nd skill Cunsi stays deferred
  -- needs skill-transfer + voluntary self-general-removal, same reason Dong Zhuo's Baoling
  stayed deferred at Milestone 36. Real upstream's OTHER Guixiu clause (heal 1 on her general
  being forcibly removed) is a silent no-op here since this port has no general-removal
  mechanic at all -- documented inline, not a bug.
- **Sun Ce (Tôn Sách, Wu, 4hp, momentum.cpp, companions Chu Du/Thái Sử Từ/Đại Kiều)** -- ported
  with a NEW Jiang (Cương): whenever he plays OR is targeted by a Duel or a RED Slash, he may
  draw 1. Needed 2 hook changes: extended the existing `onAllySlashTargeted` (Milestone 36) with
  the actual `slashCard` so a skill can check its suit, and added a brand-new
  `onAllyDuelTargeted(ctx, self, target, source)` broadcast wired into `resolveDuel`'s very
  start (Duel has no redirect/armor-nullify step to wait past, unlike Slash). His other 2 skills
  stay deferred: Yingyang needs **pindian** (card-number comparison duels -- explicitly listed
  as an unimplemented subsystem since Milestone 2.6); Hunshang needs dynamic runtime skill
  acquire/detach (temporarily granting/revoking a DIFFERENT skill class mid-game).
- 3 new companion pairs added to `gamerule.ts`'s `COMPANION_PAIRS`: Sun Ce/Chu Du, Sun Ce/Thái
  Sử Từ, Sun Ce/Đại Kiều (all 3 already-ported Standard generals).
- **Verification:** a throwaway script confirmed Guixiu draws exactly 2 via the real
  `onGeneralRevealed` hook; Jiang draws exactly 1 when Sun Ce is targeted by a RED Slash or a
  Duel (through the genuine `resolveSlash`/`resolveDuel` functions) but draws 0 on a BLACK
  Slash -- proving the suit gate actually works, not just present. A separate integration
  script ran 6 full bot-vs-bot 8-player Hegemony games with Mi Furen or Sun Ce drafted, each
  completing 25-80 turns with no crash. Live Library check over a real WebSocket connection: 69
  generals total, both new entries render with correct text. `npx tsc --noEmit` clean.

## Milestone 39 — DONE (Yingyang/Zhendu round out Sun Ce/He Taihou's kits; fixed a real Identity-mode draft leak)

User asked to keep porting (`Làm tiếp`). While researching, discovered `pindian` -- which
Milestone 36-38's own README entries repeatedly cited as "unimplemented since Milestone 2.6" --
was ACTUALLY added later (a shared `pindian()` helper already backs Zhurong's Lieren and Xun
Yu's Quhu): that earlier claim was simply stale, never re-checked once the real implementation
landed. This reopened Sun Ce's previously-deferred Yingyang. Also found and fixed a real
regression while running the full `npm run sim` suite for the first time since Milestone 35
(every milestone since had only been checked with this session's own scoped throwaway scripts,
never the actual project test suite -- `testGeneralSkillsAppearInPlay` caught it immediately).

- **Yingyang (Sun Ce's 2nd skill)** -- whenever Sun Ce is a party to ANY pindian (either side),
  he may adjust his own effective comparison point by +3 or -3. Required generalizing the
  shared `pindian()` helper itself with a new `onPindianVerifying(ctx, self, isInitiator)`
  broadcast fired on both sides' skills right after cards are revealed but before the win/loss
  compare -- Lieren/Quhu (the 2 existing pindian consumers) are unaffected since neither defines
  the new hook. Sun Ce's kit is now 2 of his real 3 skills (Jiang from Milestone 38, Yingyang
  now); Hunshang still deferred -- needs dynamic runtime skill acquire/detach.
- **Zhendu (He Taihou's 1st skill, closing out her kit)** -- discard 1 of your own cards, choose
  another player: they gain the real Analeptic Play-phase damage buff (reusing
  `resolveAnalepticBuff`/`pendingSlashBonusDamage` directly), then immediately take 1 damage
  from He Taihou. Previously deferred as needing "force another player to use a specific card";
  on closer inspection, applying the buff directly and following with the damage is
  behaviorally equivalent to upstream's forced-virtual-card-use approach (this port has no
  card-limitation subsystem that could ever make the forced use fail anyway) -- no new engine
  surface needed at all, just reusing an existing trick-card resolver. He Taihou's real 2-skill
  kit is now fully ported.
- **Real bug found+fixed: Hegemony-specific generals (Milestone 35-38's 9 additions) were
  draftable in IDENTITY mode too.** `Room.candidateGenerals` never filtered by mode, so Zang
  Ba/Li Dian/etc. could appear in a Vai Trò game's 3-candidate pick -- wrong, since upstream's
  `momentum.cpp`/`formation.cpp` are Quốc Chiến-only content. Fixed with a new `GeneralDef.
  hegemonyOnly` flag (set on all 9), filtered out of `candidateGenerals`'s pool whenever
  `this.mode !== GameMode.Hegemony`. `testGeneralSkillsAppearInPlay`'s hardcoded 60-name
  Identity-mode roster assertion (unrelated to this session's own work, never touched before)
  is what caught it -- a reminder that this session's own throwaway verification scripts, while
  each individually rigorous, never substituted for the real project regression suite.
- **Verification:** a throwaway script confirmed `onPindianVerifying` actually fires through a
  real `pindian()` call (exercised via Lieren's own real call site) and that Zhendu's discard→
  buff→damage sequence lands exactly as designed. 6 full bot-vs-bot 8-player Hegemony games with
  Sun Ce or He Taihou drafted (expanded kits) ran 33-80 turns with no crash. `npm run sim`
  (the FULL existing regression suite, not just this session's own scripts) now passes clean --
  `testGeneralSkillsAppearInPlay: 60 generals, 78 of 78 skill markers observed` confirms Identity
  mode is back to exactly the 60 Standard generals, and `testPindianTieBreakFavorsOpponent`
  confirms the `pindian()` refactor didn't disturb Lieren/Quhu's existing behavior. Live Library
  check over a real WebSocket connection: still 69 generals total (this milestone only deepened
  2 existing entries' kits, added none), Sun Ce/He Taihou both render their full 2-skill lists.
  `npx tsc --noEmit` clean.

## Milestone 40 — DONE (card-USE-restriction subsystem, closing out Ma Dai's Tiềm Tập/Qianxi)

User explicitly asked to build this one (`Thêm cho đầy đủ đi` after being shown the full
deferred-item scope assessment and offered "build the card-restriction subsystem, or stop
here" as the choice). This is the first of the deferred blockers actually built rather than
documented-and-skipped -- a real, if narrow, new subsystem, done deliberately (audited every
call site rather than patching a few and hoping) precisely because a half-enforced restriction
would be worse than none.

- **`GamePlayer` gained `handColorForbidden`/`handColorForbiddenBy`** -- while set, the
  restricted player may not USE or RESPOND WITH any HAND card of that color (equipped cards
  stay usable, matching real Sanguosha's own "use,response" scope, not a blanket possession
  ban). `handColorForbiddenBy` tracks who cast it so `Room.playTurn`'s own end-of-turn cleanup
  can clear it on the right player at the right moment (the real rule's duration is "until the
  CASTING player's own turn ends", not the restricted player's).
- **`combat.ts` gained `usableHand(player)`/`isCardUsable(player, card)`** -- the actual
  enforcement point. Audited and patched EVERY hand-card-availability helper in the file
  (`findJinkLikeCard`, `findRescueCard`, `findSlashLikeCard`/`allSlashLikeCards`,
  `findDismantlementLikeCard`/`allDismantlementLikeCards`, `findDuelLikeCard`/
  `allDuelLikeCards`, `findIndulgenceLikeCard`/`allIndulgenceLikeCards`,
  `findSupplyShortageLikeCard`/`allSupplyShortageLikeCards`, `findFireAttackLikeCard`/
  `allFireAttackLikeCards`) to read through `usableHand` instead of raw `player.hand` -- this
  alone covers Slash/Jink/Peach/Analeptic-as-rescue/Duel/Dismantlement/Snatch/Indulgence/
  SupplyShortage/FireAttack, and by extension Savage Assault/Archery Attack's discard-to-avoid
  choices (both already route through the same 2 finders). Then audited `room.ts` for every
  OTHER direct `player.hand` scan used for "what can I use/respond with" and patched each:
  Nullification/HegNullification's response find, `tryPlayOnce`/`tryPlayTargeted`'s default
  `findCard` closures (covers Collateral/BefriendAttacking/IronChain/KnownBoth/Lightning/
  AwaitExhausted/ExNihilo/SavageAssault/ArcheryAttack/GodSalvation/AmazingGrace, none of which
  need a dedicated finder), the bot's own proactive equip/Peach-self-heal/Analeptic-buff loops,
  and `computeLegalActions`'s entire legal-action list (both the equip loop and every direct
  kind-filter) so the human freeform path shows the SAME restricted set the bot respects.
  Deliberately NOT touched: hand count/`maxCards`, `discardDownToLimit`, and every proactive
  SKILL-COST hand scan (Guidao/Duoshi/Zhijian/Qingcheng/Fanjian) -- real Sanguosha's own card
  limitation system scopes to "use,response" of the matched card, not skill costs paid FROM
  hand cards of that color, a different mechanic category entirely.
- **Tiềm Tập/Qianxi (Ma Dai's 2nd skill, closing out his kit)**: at his own Start phase, may
  judge a card (color only), then pick a player at EXACTLY distance 1 -- they're forbidden from
  using/responding with any hand card of that color until Ma Dai's current turn ends.
  `otherPhaseAction` at `Phase.Start`, reusing the existing `judge()`/`effectiveDistance`/
  `askChooseAnyPlayer` helpers -- no new ask types needed, only the restriction machinery above.
- **Verification:** a throwaway script confirmed the restriction end to end --
  `findSlashLikeCard`/`findJinkLikeCard` correctly skip a forbidden-color card and find the
  eligible one instead, `usableHand`/`isCardUsable` agree, and Qianxi's own judge+target+apply
  sequence lands on the right victim. 6 full bot-vs-bot 8-player Hegemony games with Ma Dai
  drafted (his full kit now live, including the restriction firing during real Play/Discard
  phases against real opponents) ran 19-54 turns with no crash. Critically, **the FULL existing
  `npm run sim` regression suite (94 tests) still passes clean** after this invasive multi-file
  refactor touching ~25 call sites across `combat.ts`/`room.ts` -- including
  `testGeneralSkillsAppearInPlay` (60/60 Standard generals + all 78 skill markers still fire in
  Identity mode, confirming the `usableHand` passthrough is a true no-op for every player who
  was never restricted) and `testCrossbowRemovesTheSlashLimitInFreeformPlay`/
  `testSpearOfferedAsFreeformActionEvenWithARealSlashHeld` (the freeform human path's
  `computeLegalActions` rewrite didn't regress anything already covered). Live Library check
  over a real WebSocket connection: still 69 generals total, Ma Dai renders both skills with
  correct Vietnamese text. `npx tsc --noEmit` clean.


## Milestone 41 — DONE (Jiang Wei's Tiaoxin, Cao Hong's Huyuan)

User asked to keep porting (`Tiếp đi`). Continued the "partial port a general on its one
tractable skill, document the rest as deferred" pattern established since Milestone 36's Li
Dian, from `formation.cpp`.

- **Tiaoxin/Khiêu Hấn (Jiang Wei, `shu`, 4 HP)** -- once per Play phase, pick a target within
  Jiang Wei's own effective attack range: that target may respond by actually USING a real
  Slash against Jiang Wei (reusing `resolveSlash` directly -- same "reuse the real card
  resolver instead of faking the effect" precedent as Lijian's Duel-substitution), or, if they
  decline or hold none, Jiang Wei force-discards 1 of their cards of his own choosing (via the
  shared `forcedDiscardOne` helper, already built for Milestone 36's Fenming). Deferred: Yizhi
  (grants Guanxing only while Jiang Wei specifically occupies the DEPUTY slot of a companion
  pair -- no clean "which slot is this skill instance attached to" API exists in the engine
  yet) and Tianfu (a BattleArraySkill/formation-based skill -- same excluded mechanic category
  as Zhang Ren's Fengshi and now Cao Hong's Heyi below). Real upstream also shaves -1 off the
  combined pair's max HP whenever Jiang Wei is deputy (`setDeputyMaxHpAdjustedValue`) -- a
  minor balance nuance, not modeled, not a blocking mechanic.
- **Huyuan/Hộ Viện (Cao Hong, `wei`, 4 HP, companion Cao Nhân/caoren)** -- at his own Finish
  phase, may give 1 held equip card to any other player (reusing `ctx.equipPlayer`, same as
  Zhijian's own equip-gift), then pick a player at EXACTLY distance 1 of the RECIPIENT (not
  necessarily Cao Hong himself) to force a discard from, again via `forcedDiscardOne`. Deferred:
  Heyi and Feiying, both BattleArraySkill (formation) -- the mechanic definition wasn't found in
  either source file read, refusing to guess-implement it.
- No new engine hooks needed -- both skills compose entirely out of existing machinery
  (`resolveSlash`, `ctx.equipPlayer`, `forcedDiscardOne`, `effectiveDistance`/
  `effectiveAttackRange`, `usableHand` for Huyuan's equip-card filter).
- **Verification:** a throwaway script exercised both skills directly -- Tiaoxin's armed-target
  branch confirmed Jiang Wei actually lost HP from a real resolved Slash, its unarmed-target
  branch confirmed a forced discard instead; Huyuan confirmed the chosen recipient's equip zone
  actually received the card and the card left Cao Hong's hand. 6 full bot-vs-bot 8-player
  Hegemony games drafting Jiang Wei and/or Cao Hong (main or deputy slot) ran 38-80 turns with
  no crash. The full existing `npm run sim` regression suite (94 tests) still passes clean --
  no regressions from reusing `resolveSlash`/`equipPlayer` in a new context. Live Library check
  over a real WebSocket connection: 71 generals total (69 -> 71), both new generals render with
  correct Vietnamese skill names/descriptions. `npx tsc --noEmit` clean.

## Milestone 42 — DONE (Dong Zhuo's Hengzheng, Jiang Qin's Shangyi -- completes the momentum.cpp/formation.cpp roster assessment)

User asked to port all remaining generals (`Tiếp tục port các tướng chưa có còn lại`). Went back
to the 2 upstream source files (`momentum.cpp`, `formation.cpp`) and enumerated literally every
`new General(...)` in both, cross-checked against the roster -- the only 3 characters left
untouched were Dong Zhuo, Zhang Ren, and (from `formation.cpp`) Deng Ai/Jiang Qin/Yu Ji. Read
every one of their skill classes end to end before deciding what's portable.

- **Hengzheng (Dong Zhuo, `qun`, 4 HP)** -- at the start of his own Draw phase, if he's
  empty-handed or at exactly 1 HP, may take 1 card (his own choice, hand/equip/judge-area) from
  EVERY other player who holds any. `otherPhaseAction` at `Phase.Draw`. The real skill's scope is
  hand+equip+JUDGE zone ("hej") -- this port is the first to actually reach into
  `GamePlayer.judgeArea` for a steal-like effect (Snatch itself only ever offered hand+equip).
  Deferred: Baoling (only functions while Dong Zhuo is specifically the MAIN/head-slot general
  -- same position-dependent-skill blocker as Jiang Wei's Yizhi) and Benghuai, which Baoling
  dynamically grants via a voluntary discard-his-own-deputy-general choice (the same unbuilt
  "voluntary self-general-removal" subsystem Mi Furen's Cunsi/Sun Ce's Hunshang are already
  deferred for) -- moot without Baoling ever firing.
- **Shangyi (Jiang Qin, `wu`, 4 HP, companion Chu Thái/zhoutai)** -- once per Play phase, pick a
  target with any hand card or a still-hidden general, then choose to either (a) privately view
  their hand and discard 1 BLACK card from it, or (b) privately view one of their still-hidden
  generals. Reuses KnownBoth's exact `askKnownBothChoice`/`revealPrivately` infra (Milestone 31)
  instead of inventing a parallel private-info channel -- zero new engine hooks needed. One
  faithful simplification: real Shangyi's "view a hidden general" branch reveals BOTH still-
  hidden generals at once; this port reuses KnownBoth's own one-slot-at-a-time choice instead.
  Deferred: Niaoxiang, a BattleArraySkill (formation) -- same excluded category as Zhang Ren's
  Fengshi and Cao Hong's Heyi.
- **Zhang Ren stays fully deferred** -- both his skills are blocked: Chuanxin's own effect forces
  the DAMAGED player to choose between "discard all equipment + lose 1 HP" or "remove your own
  deputy general" (the same self-general-removal subsystem above), and that choice isn't
  cleanly reducible to just the first option (dropping it would silently disable the skill
  exactly when a target legitimately has no equipment to discard); Fengshi is BattleArraySkill.
- **Deng Ai stays fully deferred** -- his real kit (Tuntian/TuntianPostpone/TuntianGotoField/
  TuntianDistance/Jixi/Ziliang) is built around a brand new "field" pile: cards judged off his
  own hand/equip losses accumulate in a persistent per-player pile that both reduces his
  effective distance to everyone (read by a `DistanceSkill`) and gets spent by 2 further skills
  as a Snatch-like view-as source -- a genuinely new pile type, a new "any card leaving hand/
  equip" interception point, and a distance-correction hook, all for a skill cluster where the
  other 2 pieces (Jixi, Ziliang) are ADDITIONALLY head/deputy-position-gated (the same blocker
  Jiang Wei's Yizhi and Dong Zhuo's Baoling already hit). Not worth building the whole pile
  subsystem for a skill whose 2 real payoffs are independently blocked anyway.
- **Yu Ji stays fully deferred** -- Qianhuan needs its own new "sorcery" pile (suit-deduplicated,
  filled by a judgment draw whenever an ally is damaged) AND a pre-resolution "remove exactly
  one target from a card's target list before it resolves" hook that doesn't exist yet (distinct
  from the existing reactive `onAllySlashTargeted`/`onAllyDuelTargeted` hooks, which fire AFTER
  targeting is locked in, not before) -- refusing to guess-implement a new interception point.
- **Roster assessment complete**: every `new General(...)` in both `momentum.cpp` and
  `formation.cpp` has now been read and individually resolved -- fully ported, partially ported
  with the rest documented, or fully deferred with a specific reason. Nothing in either file is
  unassessed. The only characters skipped outright are `lord_zhangjiao`/`lord_liubei` (lord-only
  generals -- Hegemony mode has no monarch role at all, so these simply don't apply, not a
  deferred-for-a-reason case).
- **Verification:** a throwaway script confirmed Hengzheng's gate (no-op at full HP with cards
  in hand; fires and takes exactly 1 card from each of 2 other players, including a judge-area
  card, when kongcheng) and Shangyi's both branches (handcards branch privately reveals the
  hand exactly once and discards exactly 1 black card leaving the red one; general branch
  privately reveals the correct hidden general name exactly once). 10 full bot-vs-bot 8-player
  Hegemony games drafting Dong Zhuo and/or Jiang Qin (alongside Jiang Wei/Cao Hong from
  Milestone 41) ran 18-66 turns with no crash. The full existing `npm run sim` regression suite
  (94 tests) still passes clean. Live Library check over a real WebSocket connection: 73
  generals total (71 -> 73), both new generals render with correct Vietnamese skill names/
  descriptions. `npx tsc --noEmit` clean.

## Milestone 43 — DONE (first 4 generals from transformation.cpp: Xun You, Li Guo, Ma Su, Ling Tong)

User asked to keep porting (`Tiếp đi`). With `momentum.cpp`/`formation.cpp` fully assessed
(Milestone 42), moved to `transformation.cpp` -- the package headlined by Zuo Ci's Huashen, a
whole-general skill-ACQUISITION mechanic (pick random unused generals, dynamically gain their
entire non-lord skillset, re-rollable on demand) that's genuinely the "unbuilt deputy-general-
transform subsystem" this package has been deferred for since Milestone 36. Read all 9 generals'
skill classes end to end; 4 of them turned out to have at least 1 real skill that never touches
that subsystem at all.

- **Zhiyu (Xun You, `wei`, 3 HP, companion Tuân Úc/xunyu)** -- after taking damage, draws 1 card;
  if his hand is then a single color (all red or all black), the damage's source discards 1 of
  their own choosing. `onDamaged` reuse (same self-reactive hook as Ganglie/Fankui/Jianxiong).
  Deferred: Qice, a guhuo-style "recast any played trick card as a DIFFERENT trick card type"
  mechanic that ALSO calls `transformDeputyGeneral` on use -- both unbuilt subsystems.
- **Xichou (Li Guo, `qun`, 4 HP, companion Giả Hủ/jiaxu)** -- compulsory: the instant he reveals,
  +2 max HP and heals 2. `onGeneralRevealed` reuse (Milestone 38). Deferred: the rest of the real
  skill -- for the remainder of the game, the FIRST card he plays/responds with each Play phase
  locks a color, and any DIFFERENT-colored card use/response that same phase costs him 1 HP --
  needs a broad per-turn card-color interception across every use/response call site (the same
  scale of sweep Milestone 40's card-restriction subsystem needed), not attempted speculatively.
- **Sanyao + Zhiman (Ma Su, `shu`, 3 HP, no companion in upstream)** -- his full kit, minus one
  bonus clause:
  - Sanyao: ONCE PER GAME (not per turn -- a new `GamePlayer.sanyaoUsed` flag, since every other
    `activeAction` skill so far only needed the engine's existing once-per-Play-phase loop),
    discard 1 card to deal 1 damage to whoever currently has the highest HP among himself and his
    allies.
  - Zhiman: whenever he damages someone else, may mark them (new `GamePlayer.zhimanMarkedBy`);
    the next time he damages that SAME already-marked player, the mark clears and he
    automatically takes 1 of their equipped/judge-area cards (no ask -- matches real upstream's
    payoff half, which has no invoke cost of its own). `onDamageDealt` reuse. Dropped: the real
    payoff's bonus ally deputy-general-transform offer -- same unbuilt subsystem as Qice above.
- **LieFeng (Ling Tong, `wu`, 4 HP, companion Cam Ninh/ganning)** -- whenever ANY of his own
  equipped cards leaves his equip zone (discarded, snatched, destroyed -- matches real
  upstream's unconditional trigger scope), may force 1 other player (his own choice, hand or
  equip) to discard 1 card. `onEquipLost` reuse (Milestone 34's SilverLion hook, already fires
  for every equip-zone departure regardless of reason). Deferred: Xuanlue, a complex once-per-
  game multi-step "steal 1-3 equipped cards from anyone, redistribute them into empty equip
  slots across the whole table" interactive flow -- not attempted this round.
- **Bian Huanghou, Zuo Ci, Sha Moke, Lu Fan stay fully deferred**: Bian Huanghou's Wanwei needs
  the same pre-resolution "cancel myself as a target before a card resolves" hook Yu Ji's
  Qianhuan is already deferred for, and her Yuejian needs a broad "did I use a card targeting
  someone else this turn" interception; Zuo Ci's Huashen/Xinsheng ARE the package's namesake
  transform subsystem; Sha Moke's entire "jili" skill is one compound mechanic split across 3
  classes (an always-on extra-Slash-target `TargetModSkill` this engine has no framework for,
  inseparable from its card-draw payoff -- porting only the draw half would misrepresent a
  general players know for BOTH halves); Lu Fan's Diaodu is a complex chained multi-player
  equip-give flow and Diancai needs broad off-turn card-loss tracking. `lord_sunquan` is
  lord-only -- Hegemony mode has no monarch role at all, so it simply doesn't apply, same as
  `lord_zhangjiao`/`lord_liubei` from the previous 2 packages.
- **Verification:** a throwaway script exercised all 5 new skill functions directly -- Zhiyu's
  monochrome-vs-mixed hand branches, Xichou's reveal bonus, Sanyao's once-per-game gate (never
  offers a target again after first use) and damage-to-highest-HP-ally targeting, Zhiman's
  mark-then-payoff 2-hit sequence (equip taken only on the SECOND hit from the SAME source), and
  LieFeng's equip-departure trigger. 10 full bot-vs-bot 8-player Hegemony games drafting Xun You/
  Li Guo/Ma Su/Ling Tong ran 23-80 turns with no crash. The full existing `npm run sim`
  regression suite (94 tests) still passes clean. Live Library check over a real WebSocket
  connection: 77 generals total (73 -> 77), all 4 render with correct Vietnamese skill names/
  descriptions. `npx tsc --noEmit` clean.

## Milestone 44 — DONE (new pre-resolution target-cancel hook, unlocks Bian Huanghou's Wanwei)

User asked to keep porting (`Tiếp tục đi`). With every general in `momentum.cpp`/`formation.cpp`/
`transformation.cpp` individually assessed (Milestones 42-43), the remaining 4 (Bian Huanghou,
Zuo Ci, Sha Moke, Lu Fan) were each blocked on a genuinely new subsystem. Explicitly asked the
user which one to invest in (matching Milestone 40's precedent of asking before building
something wide-reaching rather than silently picking) -- user chose the target-cancel hook.

- **New `Skill.onTrickTargetCancelling` hook**: fired on a Dismantlement/Snatch TARGET's own
  skills right before either card resolves against them, one skill at a time; the first truthy
  return cancels the whole card. Both cards are single-target-only in this engine, so "remove
  this one target" and "the card fizzles" are the same outcome -- no need for a fully generic
  multi-target-splicing subsystem to serve what currently calls this. Wired into
  `trick.ts`'s `resolveDismantlement`/`resolveSnatch`, right at their top, before either
  function does anything else.
- **Wanwei (Bian Huanghou, `wei`, 3 HP, companion Tào Tháo/caocao)** -- when Dismantlement or
  Snatch targets her, she may pay a card to cancel herself as its target: Dismantlement, discard
  1 of her own cards; Snatch, give 1 of her own cards to whoever used it (matches the real
  rule's flavor difference between the 2 costs exactly). Deferred: Yuejian, her other real skill
  (an ally who targeted someone else this turn gets a raised hand-size limit at their own
  Discard phase) -- needs a broad "did I use a card targeting someone else this turn"
  interception across every card-use call site, not attempted this round.
- **Yu Ji's Qianhuan is now blocked on ONE less thing**: the target-cancel mechanic it needs is
  no longer missing, but its OWN version is broader (any single-target non-equip/non-skill card,
  not just Dismantlement/Snatch; reacts on behalf of an ALLY, not self; paid from a dedicated new
  "sorcery" pile, not hand cards) -- deliberately didn't over-generalize this round's hook to
  guess at that shape speculatively. Yu Ji stays deferred pending the sorcery pile.
- **Zuo Ci, Sha Moke, Lu Fan, and `lord_sunquan` stay fully deferred** -- unrelated blockers this
  milestone doesn't touch: Huashen is the package's namesake deputy-general-transform mechanic
  (and would ALSO need the still-unbuilt position-dependent-skill-grant API on top, since
  acquired skills attach to whichever slot Zuo Ci occupies); Sha Moke's Jili is one compound
  mechanic needing an always-on extra-Slash-target framework this engine hardcodes against
  (`resolveSlash` assumes exactly 1 target throughout); Lu Fan needs a multi-player equip-give
  flow and broad off-turn card-loss tracking; `lord_sunquan` is lord-only.
- **Verification:** a throwaway script exercised `resolveDismantlement`/`resolveSnatch` directly
  -- Wanwei cancels both (discard branch for Dismantlement, give-away branch for Snatch,
  confirmed the card lands in the right place each way), declining lets the card resolve
  normally, and a player WITHOUT Wanwei is completely unaffected (true no-op regression check on
  the new hook's empty-skills path). 8 full bot-vs-bot 8-player Hegemony games drafting Bian
  Huanghou ran 21-72 turns with no crash. Because this touches the shared resolution path both
  Dismantlement AND Snatch use for EVERY player in EVERY game mode, the full existing `npm run
  sim` regression suite (94 tests) was run and still passes clean -- confirms the new hook is a
  true no-op for the other 76 generals. Live Library check over a real WebSocket connection: 78
  generals total (77 -> 78), Bian Huanghou renders with correct Vietnamese skill name/
  description. `npx tsc --noEmit` clean.

## Milestone 45 — DONE (new multi-target-Slash subsystem, unlocks the target-count half of Sha Moke's Jili)

User asked to keep porting (`Tiếp tục`). With Bian Huanghou's blocker resolved (Milestone 44),
asked again which of the 3 remaining generals' subsystems to invest in -- user picked the
multi-target-Slash framework for Sha Moke's Jili. Mid-build, discovered Jili is actually a
COMPOUND skill split across 3 upstream classes (JiliTM: extra targets from weapon range;
JiliRecord + Jili: mark non-skill cards played/responded this Play phase, draw that many when
the count hits the weapon's range exactly) -- the 2nd half needs the SAME broad "every card
played or responded with" interception already deferred for Xichou/Yuejian/Diancai, so this
milestone only delivers the 1st half (the actual "multi-target Slash" ask), not the whole skill.
Corrected that scope honestly rather than silently stretch the deliverable to match the
original framing.

- **New multi-target-Slash subsystem** -- this engine hardcoded Slash to exactly 1 target
  throughout `resolveSlash` and every call site until now:
  - `Skill.extraSlashTargets?(ctx, player): number` -- how many EXTRA targets `player` may pick
    for a single Slash use right now, on top of the normal 1.
  - `combat.ts`'s `maxSlashTargets(ctx, player)` -- sums every skill's contribution + 1.
  - `Controller.chooseExtraSlashTargets(actor, primary, candidates, maxExtra)` -- asks for
    0..`maxExtra` ADDITIONAL distinct targets beyond the primary (already chosen the normal way
    via `chooseSlashTarget`). Bot policy: greedy, always fills every extra slot available.
    Human policy: a new `chooseExtraSlashTargets` WS message + a toggle-multi-select-then-
    confirm client prompt (`showExtraSlashTargetsPicker`, mirrors the reveal prompt's "click
    several buttons then confirm" pattern) -- new, but not click-tested live in a browser this
    round (every other verification below IS exercised end to end; this one narrow prompt's
    client wiring is checked by syntax validation only, and a human seat without it working
    would just silently fall back to the bot's own greedy policy via the existing
    `{...makeBotController(), ...humanPartial}` merge -- never broken, at worst less clever).
  - `room.ts`'s `maybeResolveExtraSlashTargets` -- called right after `resolveSlash` resolves
    the primary target in BOTH `tryPlaySlash` and `trySpearSlash`; the SAME played card then
    resolves again against each extra target too (a target-COUNT modifier, not extra physical
    cards -- matches the real rule exactly).
- **Jili (Sha Moke, `shu`, 4 HP, no companion in upstream)** -- while wielding a weapon, may
  target up to (1 + that weapon's range) players with a single Slash use. Deferred: the card-
  count-tracking draw payoff described above -- needs the broad per-turn interception, not
  attempted this round.
- **Zuo Ci and Lu Fan stay fully deferred**, along with `lord_sunquan` (lord-only) -- unchanged
  from Milestone 44's assessment.
- **Verification:** a throwaway script confirmed `maxSlashTargets` directly (weaponless = 1,
  weapon range N = 1+N, and critically that a player WITHOUT Jili is completely unaffected by
  their own weapon range), then ran the FULL engine end to end -- a real `Room.tryPlaySlash`
  call with Sha Moke wielding a range-2 weapon actually dealt damage to 3 distinct targets
  (1 primary + 2 extras) from a SINGLE physical Slash card consumed exactly once from hand. 8
  full bot-vs-bot 8-player Hegemony games drafting Sha Moke ran 22-78 turns with no crash.
  Because this touches the shared Slash-resolution path used by EVERY Slash in EVERY game mode,
  the full existing `npm run sim` regression suite (94 tests) was run and still passes clean --
  confirms the new subsystem is a true no-op for the other 78 generals. Live Library check over
  a real WebSocket connection: 79 generals total (78 -> 79), Sha Moke renders with correct
  Vietnamese skill name/description. `npx tsc --noEmit` clean; the client's new JS was also
  syntax-validated (`new Function(...)` on the extracted script block).

## Milestone 46 — DONE (Pang Tong's Lianhuan -- a stale-documentation catch, not a new subsystem)

User asked to keep porting (`Tiếp tục`) but picked "switch to a different webport category, not
more general porting" once told the only 2 remaining generals (Zuo Ci, Lu Fan) each need 2
separate large subsystems. Went hunting through every OTHER already-ported general's own
documented deferred-skill reasons instead, looking for anything whose blocker had quietly become
stale since it was originally written. Found one: Pang Tong's Lianhuan was deferred with "needs
the Iron Chain trick card (not ported)" -- but the Iron Chain trick card was actually built back
in Milestone 30 (it's been playable by every OTHER general as a real physical card ever since);
nobody had gone back to wire Lianhuan's `viewAs` conversion up to it. A real gap, not a new
subsystem -- same "reuse over reinvention" category as every other partial-port completion this
session, just triggered by documentation archaeology instead of upstream source reading.

- **New `Skill.canViewAsIronChain` hook** + `combat.ts`'s `findIronChainLikeCard`/
  `allIronChainLikeCards` -- exact same shape as every other `canViewAsX`/`findXLikeCard` pair
  already in the file (Dismantlement/Duel/Indulgence/SupplyShortage). Wired into `room.ts`'s
  fixed-pass IronChain call (now passes a real `findCard` override instead of defaulting to
  "real card only") and the freeform legal-actions builder (now `allIronChainLikeCards` instead
  of a raw `hand.filter`).
- **Lianhuan (Pang Tong, `shu`, 3 HP)** -- any Club-suited hand card may be played or responded
  with as if it were IronChain. Pang Tong's kit is now COMPLETE (Niết Bàn + Liên Hoàn, both his
  real skills).
- **Verification:** a throwaway script confirmed `findIronChainLikeCard`/`allIronChainLikeCards`
  respect the new gate (a Club card is found for a Lianhuan-holder, the same card is invisible
  to a player without the skill), then drove a real `Room.tryPlayTargeted` call end to end -- a
  Club-suited Peach actually got played as IronChain, chained exactly 1 player, and was spent
  from hand. 6 full bot-vs-bot 6-player Identity games drafting Pang Tong ran 17-60 turns with
  no crash (exercising the real automatic-pass `playTurn` route, not just the hand-rolled call
  above). The full existing `npm run sim` regression suite (94 tests) still passes clean. Live
  Library check over a real WebSocket connection: still 79 generals total (no new general this
  time, an existing one got completed) -- Pang Tong now shows both skills with correct
  Vietnamese names/descriptions. `npx tsc --noEmit` clean.

## Milestone 47 — DONE (Li Dian's Xunxun -- a small dedicated ask, not a stretch of Guanxing)

User asked to keep going (`Làm đi`) after the Lianhuan documentation catch. Kept auditing every
other already-ported general's deferred-skill reasons for anything genuinely small and buildable
now, rather than more speculative large subsystems. Found Li Dian's Xunxun: deferred as "needs a
reveal-4/split-exactly-2-to-hand-2-to-bottom ask Guanxing's own arrange-ask doesn't match" --
re-read Xunxun's real upstream source (`momentum.cpp`) to confirm exactly HOW it differs from
Guanxing (Guanxing only ever rearranges the pile, cards never leave it; Xunxun sends exactly 2 of
the 4 revealed cards to HAND, permanently leaving the pile) and built the small dedicated ask the
original assessment said was missing, instead of trying to force-fit Guanxing's existing one.

- **New `askXunxunKeep`/`resolveXunxunSplit` EngineContext hooks** (`combat.ts`) + matching
  `Controller.chooseXunxunKeep` (bot: keeps the 2 most valuable of the 4, reusing
  `pickLeastImportantCards`; human: a new WS ask, fallback keeps the first 2 on disconnect since
  the skill's own invoke already committed to a mandatory split by the time this ask fires) +
  `Room.resolveXunxunSplit` (a new small primitive, deliberately NOT built on top of `arrangeTop`
  -- that one assumes every peeked card gets placed back somewhere in the pile, which doesn't
  hold once some of them leave for hand instead).
- **Xunxun (Li Dian, `wei`, 3 HP, companion Nhạc Tiến/yuejin)** -- at his own Draw phase, may
  peek the top 4 cards of the draw pile, keep exactly 2 into hand, bury the other 2 at the
  bottom. Li Dian's kit is now COMPLETE (Vong Khích + Tuần Tuần, both his real skills).
- **Verification:** a throwaway script drove a real `Room` with a hand-seeded draw pile end to
  end -- confirmed the exact 4 peeked cards split correctly (the 2 chosen landed in hand in the
  right order, the other 2 ended up buried at the bottom, and a 5th unpeeked card underneath
  stayed completely untouched), and that declining the initial ask is a true no-op on both hand
  and pile. 6 full bot-vs-bot 8-player Hegemony games drafting Li Dian ran 12-68 turns with no
  crash. The full existing `npm run sim` regression suite (94 tests) still passes clean. Live
  Library check over a real WebSocket connection: still 79 generals total (an existing one
  completed, not a new draft entry) -- Li Dian now shows both skills with correct Vietnamese
  names/descriptions. `npx tsc --noEmit` clean (also caught and fixed a missing stub in
  `simulate.ts`'s own hand-rolled test `EngineContext`, which doesn't go through `Room.
  makeContext` and needed the 2 new hooks added there too).

## Deploy

This is a single stateless Node process (`src/server.ts`) with everything in memory -- no
database, no build step required at runtime (`tsx` runs the TypeScript directly; `npm run build`
+ `node dist/server.js` also works if you'd rather ship compiled JS). Game rooms are ephemeral
(lost on restart), which is fine for casual play. The only real size consideration is the bundled
asset directories this repo already ships: `image/` (~183MB) + `font/` (~6.3MB), which MUST be
deployed alongside `webport/` (the server reads them via `../image`, `../font`, i.e. one level
above `webport/`) -- don't `.gitignore`/prune them out of whatever you deploy.

Four reasonable options, in order of ongoing cost/control tradeoff:

1. **A free-forever VPS: Oracle Cloud "Always Free"** -- genuinely permanent (not a trial),
   real always-on VM, no sleep/cold-start. 200GB disk (dwarfs the ~190MB of bundled assets), and
   either an ARM Ampere shape (2 OCPU/12GB as of mid-2026, down from 4/24 -- Oracle halved the
   free allocation) or the AMD micro shape (1GB RAM, always available, no capacity contention --
   plenty for this single lightweight Node process). Needs a credit card + phone number to
   verify the account (never charged unless you manually upgrade); the ARM shape sometimes shows
   "out of capacity" in popular regions when provisioning -- the AMD micro shape doesn't have
   that problem. Once you have the VM, follow the exact same steps as "a small VPS" below.

2. **A small VPS you already have/rent** (DigitalOcean, Hetzner, a home server, Oracle's free VM
   above, etc.) -- most control, no cold starts, cheapest to run 24/7:
   - `git clone` the repo, `cd webport && npm install && npm run build`.
   - Run it persistently: `pm2 start dist/server.js --name qsgs` (or a `systemd` unit, or this
     project's own `hub`-style process manager if you're driving it from an agent) with
     `restart: always`.
   - Put a reverse proxy in front for a real domain + automatic HTTPS -- Caddy is the least
     fuss (`example.com { reverse_proxy localhost:8787 }` in a `Caddyfile`, it gets a Let's
     Encrypt cert and proxies both the HTTP page AND the WebSocket upgrade automatically). nginx
     works too but needs the WS `Upgrade`/`Connection` headers forwarded explicitly.
   - Open port 443 (and 80 for the ACME challenge) in the VPS firewall; keep 8787 closed to the
     outside world (only Caddy talks to it, over localhost).

3. **A free-tier PaaS, no VPS setup at all** -- less control, but zero server administration.
   Checked against this app's actual needs (long-lived WebSocket, ~190MB of bundled static
   assets, single always-running process) as of mid-2026:
   - **Railway** -- no card needed to start (30-day $5 trial credit, then $1/month non-rollover
     credit after -- tight but genuinely enough to keep one small service running perpetually).
     Full WebSocket support. Risk: heavy asset traffic (several friends loading avatar/card
     images repeatedly) could burn through the small monthly credit.
   - **Northflank** (free Sandbox) -- 2 services that genuinely never sleep, real long-running
     Node+WebSocket support, closest free PaaS equivalent to a real always-on box. Needs a card
     to verify the account (not charged on the free Sandbox).
   - Avoid **Vercel/Netlify** (serverless functions only, no persistent WebSocket) and be
     wary of tiny-storage free tiers (e.g. Bonto's 256MB cap is too tight against this repo's
     ~190MB of bundled `image/`+`font/` assets).
   - Point whichever platform you pick at this repo with build command
     `cd webport && npm install && npm run build` and start command `node webport/dist/server.js`
     (adjust paths to the platform's working directory). These platforms already terminate
     HTTPS and proxy WebSocket upgrades on the SAME public port automatically -- no reverse-proxy
     config needed, `PORT` is set for you via env var (the server already reads
     `process.env.PORT`). Free tiers that DO sleep an idle service (Render, etc.) cold-start on
     the next request -- fine for "play with friends when you're actually online", less fine for
     a server meant to be always-on/joinable at any time.

4. **A machine you already have running 24/7, no VPS/PaaS/domain at all** -- zero setup cost,
   but the game's uptime is tied to that machine's uptime (sleep, reboot, or the tunnel process
   dying all take it offline). Good fit for "an always-on home PC I already keep running", incl.
   one only reachable via a remote-desktop tool like AnyDesk (no SSH needed -- every command
   below is typed directly into a terminal inside that remote session):
   - Install Node.js LTS + git (Windows: `winget install OpenJS.NodeJS.LTS` and
     `winget install Git.Git`; macOS: `brew install node git`; Linux: your distro's package
     manager), then `git clone` this repo, `cd webport && npm install && npm run build`.
   - Install `ngrok` (Windows: `winget install ngrok.ngrok`; macOS: `brew install ngrok`; Linux:
     see ngrok.com/download) -- a tunnel client that exposes a `localhost` port to a public HTTPS
     URL without opening any port on the machine's own firewall/router (works fine from behind
     NAT/CGNAT, e.g. a home connection with no public IP).
   - Sign up free at `dashboard.ngrok.com/signup` (no card needed), copy the authtoken from
     `dashboard.ngrok.com/get-started/your-authtoken`, run `ngrok config add-authtoken <token>`.
     Optional but recommended: **Domains -> Create Domain** for one free static subdomain (e.g.
     `your-name.ngrok-free.app`) so the link never changes across restarts -- otherwise a plain
     `ngrok http` session gets a new random URL every time.
   - Run the server (`node dist/server.js`, or `npm run server` if keeping the `tsx`/TypeScript
     path instead of building) in one terminal, `ngrok http --domain=your-name.ngrok-free.app
     8787` (or plain `ngrok http 8787` without a static domain) in a second terminal, both left
     open. ngrok prints the public `Forwarding https://...` URL to share.
   - Disconnecting the remote-desktop session does **not** stop either process -- they keep
     running in the still-logged-in OS session. What DOES take the game offline: the machine
     sleeping (Windows: Settings -> System -> Power & battery -> set sleep to Never), a reboot
     (schedule both commands as an "At log on" Task Scheduler job / login item / systemd user
     service to auto-resume), or closing either terminal window.

Either way, once it's reachable at `https://your-domain/`, anyone who opens that URL lands in the
same shared room lobby and can create/join rooms together -- no separate client install, nothing
to configure client-side.

## Run (local dev)

```
npm install
npm run sim      # engine smoke tests
npm run server   # serves the client AND the WebSocket API on :8787 -- open http://localhost:8787/
```

