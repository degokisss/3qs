// Card model. The card LIST and exact per-card suit/point are ported 1:1 from this project's
// actual source (src/package/standard-basics.cpp basicCards(), standard-tricks.cpp trickCards(),
// standard-equips.cpp equipCards()) rather than the physical board game's box contents -- this
// software's card pool differs from the boxed Standard set (e.g. only 1 Crossbow, not 2; extra
// cards like AwaitExhausted/KnownBoth/BefriendAttacking not in the original box; only 6 horses,
// not 7).
//
// Only card kinds with resolution logic implemented (combat.ts / trick.ts) are dealt by
// Room. Kinds present in the real source but NOT YET resolvable are explicitly excluded here
// rather than silently dropped:
//   Trick: IronChain(x3), FireAttack(x2), Collateral(x1), Nullification(x1), HegNullification(x2),
//     AwaitExhausted(x2), KnownBoth(x2), BefriendAttacking(x1), Indulgence(x2), SupplyShortage(x2),
//     Lightning(x1) -- all need the delayed-trick/judge-area system or a reactive counter-play
//     stack (respond-with-Nullification-to-a-trick-in-flight), neither of which exists yet.
//   Equip: EightDiagram/RenwangShield/Vine/SilverLion (all 4 Standard armors) -- need the
//     trigger/skill system (judgment-based dodge, locked damage immunity, etc.)
// AmazingGrace/GodSalvation/ArcheryAttack are constructed with no suit/point in the source
// (`new ArcheryAttack` etc.) -- modeled here with a placeholder Spade/0, since no implemented
// mechanic reads their suit yet.

import { DamageNature } from "./types.js";

export enum Suit {
  Spade = "spade",
  Heart = "heart",
  Club = "club",
  Diamond = "diamond",
}

export enum CardKind {
  Slash = "slash",
  Jink = "jink",
  Peach = "peach",
  Analeptic = "analeptic",
  AmazingGrace = "amazing_grace",
  GodSalvation = "god_salvation",
  SavageAssault = "savage_assault",
  ArcheryAttack = "archery_attack",
  Duel = "duel",
  ExNihilo = "ex_nihilo",
  Snatch = "snatch",
  Dismantlement = "dismantlement",
  Weapon = "weapon",
  Horse = "horse",
}

export interface Card {
  id: number;
  kind: CardKind;
  suit: Suit;
  point: number;
  nature?: DamageNature; // Slash only
  weaponName?: string;
  weaponRange?: number; // Weapon only, src/package/standard-equips.cpp Weapon(suit, number, range)
  horseName?: string;
  horseDelta?: number; // Horse only: +1 defensive, -1 offensive
}

let nextId = 0;
function card(kind: CardKind, suit: Suit, point: number, extra: Partial<Card> = {}): Card {
  return { id: nextId++, kind, suit, point, ...extra };
}

function basicCards(): Card[] {
  const S = Suit.Spade, H = Suit.Heart, C = Suit.Club, D = Suit.Diamond;
  return [
    // Slash (Normal nature), 21 cards
    card(CardKind.Slash, S, 5), card(CardKind.Slash, S, 7), card(CardKind.Slash, S, 8),
    card(CardKind.Slash, S, 8), card(CardKind.Slash, S, 9), card(CardKind.Slash, S, 10),
    card(CardKind.Slash, S, 11),
    card(CardKind.Slash, C, 2), card(CardKind.Slash, C, 3), card(CardKind.Slash, C, 4),
    card(CardKind.Slash, C, 5), card(CardKind.Slash, C, 8), card(CardKind.Slash, C, 9),
    card(CardKind.Slash, C, 10), card(CardKind.Slash, C, 11), card(CardKind.Slash, C, 11),
    card(CardKind.Slash, H, 10), card(CardKind.Slash, H, 12),
    card(CardKind.Slash, D, 10), card(CardKind.Slash, D, 11), card(CardKind.Slash, D, 12),
    // FireSlash, 3 cards
    card(CardKind.Slash, H, 4, { nature: DamageNature.Fire }),
    card(CardKind.Slash, D, 4, { nature: DamageNature.Fire }),
    card(CardKind.Slash, D, 5, { nature: DamageNature.Fire }),
    // ThunderSlash, 5 cards
    card(CardKind.Slash, S, 6, { nature: DamageNature.Thunder }),
    card(CardKind.Slash, S, 7, { nature: DamageNature.Thunder }),
    card(CardKind.Slash, C, 6, { nature: DamageNature.Thunder }),
    card(CardKind.Slash, C, 7, { nature: DamageNature.Thunder }),
    card(CardKind.Slash, C, 8, { nature: DamageNature.Thunder }),
    // Jink, 14 cards
    card(CardKind.Jink, H, 2), card(CardKind.Jink, H, 11), card(CardKind.Jink, H, 13),
    card(CardKind.Jink, D, 2), card(CardKind.Jink, D, 3), card(CardKind.Jink, D, 6),
    card(CardKind.Jink, D, 7), card(CardKind.Jink, D, 7), card(CardKind.Jink, D, 8),
    card(CardKind.Jink, D, 8), card(CardKind.Jink, D, 9), card(CardKind.Jink, D, 10),
    card(CardKind.Jink, D, 11), card(CardKind.Jink, D, 13),
    // Peach, 8 cards
    card(CardKind.Peach, H, 4), card(CardKind.Peach, H, 6), card(CardKind.Peach, H, 7),
    card(CardKind.Peach, H, 8), card(CardKind.Peach, H, 9), card(CardKind.Peach, H, 10),
    card(CardKind.Peach, H, 12), card(CardKind.Peach, D, 2),
    // Analeptic, 3 cards
    card(CardKind.Analeptic, S, 9), card(CardKind.Analeptic, C, 9), card(CardKind.Analeptic, D, 9),
  ];
}

function implementedTrickCards(): Card[] {
  const S = Suit.Spade, H = Suit.Heart, C = Suit.Club, D = Suit.Diamond;
  return [
    card(CardKind.AmazingGrace, S, 0),
    card(CardKind.GodSalvation, S, 0),
    card(CardKind.SavageAssault, S, 13), card(CardKind.SavageAssault, C, 7),
    card(CardKind.ArcheryAttack, S, 0),
    card(CardKind.Duel, S, 1), card(CardKind.Duel, C, 1),
    card(CardKind.ExNihilo, H, 7), card(CardKind.ExNihilo, H, 8),
    card(CardKind.Snatch, S, 3), card(CardKind.Snatch, S, 4), card(CardKind.Snatch, D, 3),
    card(CardKind.Dismantlement, S, 3), card(CardKind.Dismantlement, S, 4), card(CardKind.Dismantlement, H, 12),
  ];
}

// [name, suit, point, range]
const WEAPONS: [string, Suit, number, number][] = [
  ["Crossbow", Suit.Diamond, 1, 1],
  ["DoubleSword", Suit.Spade, 2, 2],
  ["QinggangSword", Suit.Spade, 6, 2],
  ["IceSword", Suit.Spade, 2, 2],
  ["Spear", Suit.Spade, 12, 3],
  ["Axe", Suit.Diamond, 5, 3],
  ["KylinBow", Suit.Heart, 5, 5],
  ["Fan", Suit.Diamond, 1, 4],
  ["SixSwords", Suit.Diamond, 6, 2],
  ["Triblade", Suit.Diamond, 12, 3],
];

// [name, suit, point, delta]
const HORSES: [string, Suit, number, number][] = [
  ["JueYing", Suit.Spade, 5, 1],
  ["DiLu", Suit.Club, 5, 1],
  ["ZhuaHuangFeiDian", Suit.Heart, 13, 1],
  ["ChiTu", Suit.Heart, 5, -1],
  ["DaYuan", Suit.Spade, 13, -1],
  ["ZiXing", Suit.Diamond, 13, -1],
];

function equipCards(): Card[] {
  const weapons = WEAPONS.map(([name, suit, point, range]) =>
    card(CardKind.Weapon, suit, point, { weaponName: name, weaponRange: range }),
  );
  const horses = HORSES.map(([name, suit, point, delta]) =>
    card(CardKind.Horse, suit, point, { horseName: name, horseDelta: delta }),
  );
  return [...weapons, ...horses];
}

/** Full deck actually dealt by Room: basics + the implemented trick/equip subset (85 cards). */
export function buildStandardDeck(): Card[] {
  return [...basicCards(), ...implementedTrickCards(), ...equipCards()];
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
