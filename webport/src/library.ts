// Read-only reference data for the client's "Thư viện" (library) view -- lets a player browse
// every ported general's skills and every card kind's rules text without having to look it up
// mid-game. Pure aggregation, no game state: built once from the same sources the game itself
// uses (GENERALS/SKILLS from skill.ts, the real dealt deck from card.ts's buildStandardDeck),
// so counts/ranges/skill text can never drift from what Room actually plays with. Descriptions
// follow skill.ts's established rule: describe the real PORTED behavior, not the full official
// card text, wherever this port simplifies something (see WEAPON_DESCRIPTION's QinggangSword
// entry for the one card whose real ability -- ignoring the target's armor -- still isn't
// ported, a gap now genuinely ABOUT armor rather than armor simply not existing yet, since
// Milestone 34; and ARMOR_DESCRIPTION's EightDiagram entry for its own "no ask while a real
// Jink is held" simplification -- both documented in full at their real implementation site).

import { buildStandardDeck, Card, CardKind } from "./card.js";
import { GENERALS, SKILLS } from "./skill.js";

export interface LibraryGeneral {
  name: string;
  displayName: string;
  kingdom: string;
  maxHp: number;
  gender: "male" | "female";
  skills: { name: string; displayName: string; description: string }[];
}

export interface LibraryCard {
  kind: CardKind;
  /** Weapon/Horse/Armor only -- distinguishes e.g. "Crossbow" from "Axe" within CardKind.Weapon.
   *  Null for every basic/trick kind, which has exactly one catalog entry per CardKind. */
  name: string | null;
  label: string;
  count: number;
  range?: number; // weapon only
  distanceDelta?: number; // horse only: +1 defensive (others see you farther), -1 offensive
  description: string;
}

type BasicOrTrickKind = Exclude<CardKind, CardKind.Weapon | CardKind.Horse | CardKind.Armor>;

const KIND_INFO: Record<BasicOrTrickKind, { label: string; description: string }> = {
  [CardKind.Slash]: {
    label: "Sát",
    description:
      "Cận chiến cơ bản: gây 1 sát thương lên 1 mục tiêu trong tầm đánh, trừ khi mục tiêu dùng [Thiểm] để né. Mặc định mỗi lượt chỉ đánh được 1 lá, trừ khi có Nỏ Liên Hoàn hoặc kỹ năng tướng nâng/bỏ giới hạn.",
  },
  [CardKind.Jink]: {
    label: "Thiểm",
    description: "Dùng để né 1 lá [Sát] nhắm vào bạn, huỷ toàn bộ sát thương của đòn đó.",
  },
  [CardKind.Peach]: {
    label: "Đào",
    description:
      "Hồi 1 máu. Có thể tự dùng khi đang bị thương trong giai đoạn Ra Bài, hoặc dùng để tự cứu/cứu đồng minh khi đang hấp hối (máu ≤ 0).",
  },
  [CardKind.Analeptic]: {
    label: "Tửu",
    description:
      "Tự dùng trong giai đoạn Ra Bài: lá [Sát] tiếp theo bạn đánh trong lượt này +1 sát thương. Cũng có thể dùng để tự cứu khi đang hấp hối, hồi 1 máu như [Đào].",
  },
  [CardKind.AmazingGrace]: {
    label: "Ngũ Cốc Phong Đăng",
    description:
      "Lật úp số lá bằng số người chơi còn sống lên giữa bàn; lần lượt từng người (bắt đầu từ người dùng bài) chọn đúng 1 lá, cho đến khi hết.",
  },
  [CardKind.GodSalvation]: {
    label: "Đào Viên Kết Nghĩa",
    description: "Mọi người chơi đang bị thương hồi 1 máu.",
  },
  [CardKind.SavageAssault]: {
    label: "Nam Man Nhập Xâm",
    description: "Mọi người chơi khác phải bỏ 1 lá [Sát] đang cầm, nếu không sẽ chịu 1 sát thương.",
  },
  [CardKind.ArcheryAttack]: {
    label: "Vạn Tiễn Tề Phát",
    description: "Mọi người chơi khác phải bỏ 1 lá [Thiểm] đang cầm, nếu không sẽ chịu 1 sát thương.",
  },
  [CardKind.Duel]: {
    label: "Quyết Đấu",
    description:
      "Chọn 1 người chơi bất kỳ để đấu tay đôi: hai bên lần lượt bỏ ra 1 lá [Sát], ai không còn lá để bỏ ra chịu 1 sát thương.",
  },
  [CardKind.ExNihilo]: {
    label: "Vô Trung Sinh Hữu",
    description: "Bốc thêm 2 lá bài.",
  },
  [CardKind.Snatch]: {
    label: "Thuận Thủ Khiên Dương",
    description: "Cướp đúng 1 lá bài (trên tay hoặc trang bị) của 1 người chơi trong tầm 1.",
  },
  [CardKind.Dismantlement]: {
    label: "Quá Hạ Sách Kiều",
    description: "Buộc 1 người chơi bất kỳ bỏ đúng 1 lá bài (trên tay hoặc trang bị) do bạn chọn.",
  },
  [CardKind.Indulgence]: {
    label: "Lạc Bất Tư Thục",
    description:
      "Bài công cụ thời gian: đặt vào vùng phán xét của 1 người khác. Giai đoạn phán xét của họ, họ phán 1 lá; nếu không phải chất Cơ, họ bỏ qua giai đoạn ra bài lượt đó.",
  },
  [CardKind.SupplyShortage]: {
    label: "Binh Lương Thốn Đoạn",
    description:
      "Bài công cụ thời gian, chỉ nhắm được người ở khoảng cách 1: đặt vào vùng phán xét của họ. Giai đoạn phán xét của họ, họ phán 1 lá; nếu không phải chất Chuồn, họ bỏ qua giai đoạn rút bài lượt đó.",
  },
  [CardKind.FireAttack]: {
    label: "Hỏa Công",
    description:
      "Chọn 1 người còn bài trên tay: họ lật 1 lá bài của họ; nếu bạn bỏ được 1 lá cùng chất trên tay mình, họ chịu 1 sát thương Hỏa.",
  },
  [CardKind.Lightning]: {
    label: "Thiểm Điện",
    description:
      "Bài công cụ thời gian: đặt vào vùng phán xét của chính bạn. Giai đoạn phán xét của bạn, phán 1 lá; nếu là Bích 2~9, bạn chịu 3 sát thương Lôi; nếu không, lá này chuyển sang người tiếp theo (quay vòng bàn đấu cho tới khi ai đó trúng).",
  },
  [CardKind.Collateral]: {
    label: "Tá Đao Sát Nhân",
    description:
      "Chọn 1 người khác đang có vũ khí (A) và 1 người trong tầm đánh của A (B). A cần dùng [Sát] lên B, nếu không (hoặc không thể), A giao vũ khí đang trang bị cho bạn.",
  },
  [CardKind.BefriendAttacking]: {
    label: "Viễn Giao Cận Công",
    description: "Chọn 1 người có thế lực xác định khác bạn (chỉ dùng được ở Quốc Chiến): mục tiêu bốc 1 lá, sau đó bạn bốc 3 lá.",
  },
  [CardKind.AwaitExhausted]: {
    label: "Dĩ Dật Đãi Lao",
    description: "Bạn và mọi đồng minh cùng phe đều bốc 2 lá rồi bỏ 2 lá.",
  },
  [CardKind.IronChain]: {
    label: "Thiết Tác Liên Hoàn",
    description:
      "Chọn 1 người: đảo trạng thái liên hoàn của họ. Người đang liên hoàn khi chịu sát thương Hỏa/Lôi sẽ thoát liên hoàn, đồng thời mọi người khác đang liên hoàn cũng chịu sát thương y hệt.",
  },
  [CardKind.Nullification]: {
    label: "Vô Giải Khả Kích",
    description:
      "Bài phản ứng, chỉ dùng được khi 1 lá công cụ hoặc 1 lá Vô Giải Khả Kích khác đang chờ hiệu lực: triệt tiêu hiệu quả của lá đó với mục tiêu.",
  },
  [CardKind.HegNullification]: {
    label: "Vô Giải Khả Kích - Quốc",
    description:
      "Giống Vô Giải Khả Kích, nhưng ở Quốc Chiến có thể chọn triệt tiêu hiệu quả với chỉ mục tiêu đó, hoặc với toàn bộ thế lực của mục tiêu cùng lúc.",
  },
  [CardKind.KnownBoth]: {
    label: "Tri Bỉ Tri Kỉ",
    description: "Chọn 1 người khác có tướng chưa mở hoặc còn bài trên tay: bạn được xem trộm toàn bộ bài trên tay hoặc 1 tướng úp của họ.",
  },
};

const WEAPON_DESCRIPTION: Record<string, string> = {
  Crossbow: "Bỏ giới hạn 1 [Sát]/lượt -- có thể đánh [Sát] không giới hạn số lần trong lượt của bạn, miễn còn bài và mục tiêu hợp lệ.",
  DoubleSword: "Sau khi [Sát] gây sát thương lên mục tiêu khác giới tính, chọn: mục tiêu bỏ 1 lá bài ngẫu nhiên, hoặc nếu không thì bạn bốc 1 lá.",
  QinggangSword:
    "(Khả năng bỏ qua giáp trang bị của mục tiêu chưa được cài đặt -- [Sát] của bạn vẫn bị Nhân Vương Thuẫn/Đằng Giáp chặn như bình thường; chỉ có tầm đánh được áp dụng.)",
  IceSword: "Sau khi [Sát] của bạn sắp gây sát thương, có thể huỷ sát thương đó và thay vào đó chọn tối đa 2 lá bài (trên tay hoặc trang bị) của mục tiêu để bỏ.",
  Spear: "Có thể dùng 2 lá bài bất kỳ trên tay như thể là 1 lá [Sát].",
  Axe: "Khi [Sát] của bạn bị né, có thể bỏ 2 lá bài trên tay để buộc đòn đó trúng.",
  KylinBow: "Khi [Sát] của bạn gây sát thương lên mục tiêu đang có ngựa, có thể phá huỷ 1 lá ngựa của mục tiêu.",
  Fan: "Bất kỳ lá bài nào khác [Sát] trên tay đều có thể dùng/bỏ như thể là [Sát].",
  SixSwords: "+1 tầm đánh nếu có đồng minh còn sống khác cũng đang trang bị Lục Hợp Kiếm.",
  Triblade: "Sau khi [Sát] của bạn gây sát thương, có thể chọn 1 người chơi khác trong tầm 1 tính từ mục tiêu ban đầu để cũng chịu 1 sát thương.",
};

const ARMOR_DESCRIPTION: Record<string, string> = {
  EightDiagram:
    "Khi bạn được yêu cầu đánh ra [Thiểm] nhưng không có [Thiểm] (thật hoặc biến hóa) trên tay, bạn có thể tiến hành Phán xét: nếu kết quả có màu Đỏ, xem như bạn đã né. (Giản lược: chỉ được đề nghị khi không còn [Thiểm] nào -- luật gốc cho phép chọn dùng Bát Quái Trận ngay cả khi vẫn còn [Thiểm] để dành lại.)",
  RenwangShield: "Tỏa định kỹ: [Sát] chất Đen (Bích/Chuồn) không có hiệu quả với bạn.",
  Vine:
    "Tỏa định kỹ: [Nam Man Nhập Xâm], [Vạn Tiễn Tề Phát] và [Sát] không thuộc tính Hỏa/Lôi đều không có hiệu quả với bạn. Khi bạn nhận sát thương có thuộc tính Hỏa, sát thương đó +1.",
  SilverLion:
    "Tỏa định kỹ: khi bạn nhận sát thương, nếu sát thương đó > 1, giảm còn 1. Sau khi bạn mất Bạch Ngân Sư Tử khỏi vùng trang bị (vẫn còn sống), nếu đang bị thương thì hồi 1 máu.",
};

const HORSE_DEFENSIVE = "Ngựa phòng thủ: người khác nhìn khoảng cách đến bạn +1 (bạn khó bị [Sát] nhắm tới hơn).";
const HORSE_OFFENSIVE = "Ngựa tấn công: khoảng cách bạn nhìn người khác -1 (bạn dễ đưa người khác vào tầm đánh hơn).";
const HORSE_DESCRIPTION: Record<string, string> = {
  JueYing: HORSE_DEFENSIVE,
  DiLu: HORSE_DEFENSIVE,
  ZhuaHuangFeiDian: HORSE_DEFENSIVE,
  ChiTu: HORSE_OFFENSIVE,
  DaYuan: HORSE_OFFENSIVE,
  ZiXing: HORSE_OFFENSIVE,
};

/** Builds the full card catalog once (23 basic/trick kinds + 10 weapons + 6 horses + 4 armors =
 *  43 entries), grouped/deduped from the real dealt deck so counts and each entry's `range`/
 *  `distanceDelta` can never drift from what Room actually shuffles in. */
function buildCardCatalog(): LibraryCard[] {
  const deck = buildStandardDeck();
  const byKey = new Map<string, Card[]>();
  for (const c of deck) {
    const key = c.weaponName ?? c.horseName ?? c.armorName ?? c.kind;
    const group = byKey.get(key);
    if (group) group.push(c);
    else byKey.set(key, [c]);
  }
  const entries: LibraryCard[] = [];
  for (const cards of byKey.values()) {
    const sample = cards[0];
    if (sample.kind === CardKind.Weapon) {
      entries.push({
        kind: sample.kind,
        name: sample.weaponName!,
        label: sample.weaponName!,
        count: cards.length,
        range: sample.weaponRange,
        description: WEAPON_DESCRIPTION[sample.weaponName!] ?? "",
      });
    } else if (sample.kind === CardKind.Horse) {
      entries.push({
        kind: sample.kind,
        name: sample.horseName!,
        label: sample.horseName!,
        count: cards.length,
        distanceDelta: sample.horseDelta,
        description: HORSE_DESCRIPTION[sample.horseName!] ?? "",
      });
    } else if (sample.kind === CardKind.Armor) {
      entries.push({
        kind: sample.kind,
        name: sample.armorName!,
        label: sample.armorName!,
        count: cards.length,
        description: ARMOR_DESCRIPTION[sample.armorName!] ?? "",
      });
    } else {
      const info = KIND_INFO[sample.kind as BasicOrTrickKind];
      entries.push({ kind: sample.kind, name: null, label: info.label, count: cards.length, description: info.description });
    }
  }
  return entries;
}

/** Every ported general with its skills' real Vietnamese descriptions (same text the
 *  pick-general screen's candidate payload already sends), sorted by display name. */
function buildGeneralCatalog(): LibraryGeneral[] {
  return GENERALS.map((g): LibraryGeneral => ({
    name: g.name,
    displayName: g.displayName,
    kingdom: g.kingdom,
    maxHp: g.maxHp,
    gender: g.gender ?? "male",
    skills: g.skillNames.map((n) => {
      const s = SKILLS[n];
      return { name: s.name, displayName: s.displayName, description: s.description };
    }),
  })).sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
}

/** Computed once at module load -- both catalogs are pure functions of static data (GENERALS/
 *  SKILLS/buildStandardDeck), never change at runtime, so every "listLibrary" request reuses
 *  the same arrays instead of rebuilding them. */
export const CARD_CATALOG: LibraryCard[] = buildCardCatalog();
export const GENERAL_CATALOG: LibraryGeneral[] = buildGeneralCatalog();
