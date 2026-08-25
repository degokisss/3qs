--[[********************************************************************
	Copyright (c) 2013-2015 Mogara

  This file is part of QSanguosha-Hegemony.

  This game is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License as
  published by the Free Software Foundation; either version 3.0
  of the License, or (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
  General Public License for more details.

  See the LICENSE file for more details.

  Mogara
*********************************************************************]]

-- translation for StandardPackage

local t = {
	["standard_cards"] = "Tiêu chuẩn",


	["slash"] = "Sát",
	[":slash"] = "Bài cơ bản\n\n<b>Giới hạn</b>: Một lần trong giai đoạn ra bài đối với tất cả loại [Sát]\n<b>Lựa chọn</b>: 1 người trong tầm đánh.\n<b>Mục tiêu</b>: Người đã chọn\n<b>Hiệu quả</b>: Gây 1 sát thương cho mục tiêu.",
	["slash-jink"] = "%src đã sử dụng [Sát], hãy sử dụng 1 [Thiểm]",
	["@multi-jink-start"] = "%src đã sử dụng lá [sát], hãy sử dụng %arg lá [Thiểm]",
	["@multi-jink"] = "%src đã sử dụng [Sát], hãy sử dụng thêm %arg lá [Thiểm]",
	["@slash_extra_targets"] = "Hãy chọn thêm mục tiêu khác cho lá [Sát]",

	["fire_slash"] = "Sát Hỏa",
	[":fire_slash"] = "Bài cơ bản\n\n<b>Giới hạn</b>: Một lần trong giai đoạn ra bài đối với tất cả loại [Sát]\n<b>Lựa chọn</b>: 1 người trong tầm đánh.\n<b>Mục tiêu</b>: Người đã chọn\n<b>Hiệu quả</b>: Gây 1 sát thương Hỏa cho mục tiêu.",

	["thunder_slash"] = "Sát Lôi",
	[":thunder_slash"] = "Bài cơ bản\n\n<b>Giới hạn</b>: Một lần trong giai đoạn ra bài đối với tất cả loại [Sát]\n<b>Lựa chọn</b>: 1 người trong tầm đánh.\n<b>Mục tiêu</b>: Người đã chọn\n<b>Hiệu quả</b>: Gây 1 sát thương Lôi cho mục tiêu.",

	["jink"] = "Thiểm",
	[":jink"] = "Bài cơ bản\n\n<b>Thời điểm</b>: Khi lá [Sát] có hiệu quả với bạn\n<b>Hiệu quả</b>: Triệt tiêu hiệu quả của lá[Sát] này với bạn.",
	["#NoJink"] = "%from Không thể sử dụng[<font color=\"yellow\"><b>Thiểm</b></font>]để vô hiệu hóa[<font color=\"yellow\"><b>Sát</b></font>]",

	["peach"] = "Đào",
	[":peach"] = "Bài cơ bản\n\nCách thức I: \n<b>Mục tiêu</b>: Bạn nếu đang bị thương.\n<b>Hiệu quả</b>: Mục tiêu hồi 1 máu.\n\nCách thức II:\n<b>Thời điểm</b>: Khi 1 người trong trạng thái hấp hối.\n<b>Mục tiêu</b>: Người đang trong trạng thái hấp hối.\n<b>Hiệu quả</b>: Mục tiêu hồi 1 máu.",

	["analeptic"] = "Tửu",
	[":analeptic"] = "Bài cơ bản\n\nCách thức I: \n<b>Giới hạn</b>: Một lần trong lượt của mỗi người.\n<b>Mục tiêu</b>: Bạn.\n<b>Hiệu quả</b>: Lá [Sát] tiếp theo mục tiêu sử dụng trong lượt này +1 sát thương.\n\nCách thức II: \n<b>Thời điểm</b>: Khi bạn trong trạng thái hấp hối.\n<b>Mục tiêu</b>: Bạn.\n<b>Hiệu quả</b>: Mục tiêu hồi 1 máu",
	["#UnsetDrankEndOfTurn"] = "%from kết thúc lượt, lá [<font color=\"yellow\"><b>Tửu</b></font>] mất tác dụng",


	["Crossbow"] = "Gia Cát Liên Nỏ",
	[":Crossbow"] = "Bài trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 1\n<b>Kỹ năng</b>: Tỏa định kỹ: bạn không giới hạn số lần sử dụng lá [Sát].",

	["DoubleSword"] = "Thư Hùng Song Cổ Kiếm",
	[":DoubleSword"] = "Bài trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 2\n<b>Kỹ năng</b>: Sau khi xác định từng mục tiêu của [Sát], nếu mục tiêu khác giới tính với bạn, bạn có thể lệnh mục tiêu chọn bỏ 1 lá bài trên tay hoặc lệnh bạn rút 1 lá bài.",
	["double-sword-card"] = "%src phát động hiệu quả [Thư Hùng Song Cổ Kiếm], bạn cần phải bỏ 1 lá bài trên tay hoặc để %src rút 1 lá bài.",

	["SixSwords"] = "Ngô Lục Kiếm",
	[":SixSwords"] = "Bài trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 2\n<b>Kỹ năng</b>: Tỏa định kỹ: người khác có thế lực giống bạn +1 tầm đánh.",

	["Triblade"] = "Tam Tiêm Lưỡng Nhận Đao",
	[":Triblade"] = "Bài trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 3<br/><b>Kỹ năng</b>: Sau khi bạn gây sát thương cho mục tiêu của lá [Sát], bạn có thể bỏ 1 lá bài trên tay và chọn 1 người khác ở khoảng cách 1 của mục tiêu, bạn gây 1 sát thương cho họ.",
	["tribladeskill"] = "Tam Tiêm Lưỡng Nhận Đao",
	["@Triblade"] = "Phát động hiệu quả [Tam Tiêm Lưỡng Nhận Đao]",
	["~Triblade"] = "Chọn 1 lá bài trên tay, chọn mục tiêu kế tiếp rồi bấm \"Xác nhận\"",

	["QinggangSword"] = "Thanh Công Kiếm",
	[":QinggangSword"] = "Bài trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 2\n<b>Kỹ năng</b>: Tỏa định kỹ: Sau khi bạn xác định mục tiêu của lá [Sát], ứng với mỗi mục tiêu, bạn lệnh [Sát] này Bỏ qua phòng cụ của họ.\n<b>Bỏ qua phòng cụ</b>: Vô hiệu hoá phòng cụ người bị bỏ qua phòng cụ đến khi xác định số sát thương cuối cùng mà họ phải nhận.",

	["Spear"] = "Trượng Bát Xà Mâu",
	[":Spear"] = "Bài trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 3\n<b>Kỹ năng</b>: Bạn có thể chuyển hóa sử dụng/đánh ra 2 lá trên tay thành [Sát].",

	["Axe"] = "Quán Thạch Phủ",
	[":Axe"] = "Bài trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 3\n<b>Kỹ năng</b>: Sau khi [Sát] bạn sử dụng bị triệt tiêu bởi [Thiểm] của mục tiêu, bạn có thể bỏ 2 lá, lệnh cho [Sát] này vẫn có hiệu quả đối với mục tiêu này.",
	["@Axe"] = "Bạn có thể bỏ ra 2 lá bài để [Sát] vẫn có hiệu quả.",
	["~Axe"] = "Chọn 2 lá bài để bỏ rồi bấm \"Xác nhận\"",

	["KylinBow"] = "Kỳ Lân Cung",
	[":KylinBow"] = "Bài trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 5\n<b>Kỹ năng</b>: Khi bạn gây sát thương cho mục tiêu của [Sát], bạn có thể bỏ 1 Ngựa trong vùng trang bị của mục tiêu.",
	["KylinBow:dhorse"] = "Ngựa +1",
	["KylinBow:ohorse"] = "Ngựa -1",
	["KylinBow:shorse"] = "Lục Long Tham Giá",

	["EightDiagram"] = "Bát Quái Trận",
	[":EightDiagram"] = "Bài trang bị - Phòng cụ\n\n<b>Kỹ năng</b>: Khi bạn được yêu cầu sử dụng/đánh ra [Thiểm], bạn có thể tiến hành Phán xét, nếu kết quả phán xét có màu Đỏ, xem như bạn đã sử dụng/đánh ra [Thiểm].",

	["RenwangShield"] = "Nhân Vương Thuẫn",
	[":RenwangShield"] = "Bài trang bị - Phòng cụ\n\n<b>Kỹ năng</b>: Tỏa định kỹ: [Sát] Đen không có hiệu quả với bạn.",

	["IceSword"] = "Hàn Băng Kiếm",
	[":IceSword"] = "Bài trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 2\n<b>Kỹ năng</b>: Khi bạn gây sát thương cho mục tiêu của [Sát], nếu mục tiêu có bài, bạn có thể chặn sát thương này và lần lượt bỏ 2 lá của mục tiêu.",

	["Fan"] = "Chu Tước Vũ Phiến",
	[":Fan"] = "Bài trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 4\n<b>Kỹ năng</b>: Khi bạn sử dụng [Sát] phổ thông, bạn có thể chuyển hóa [Sát] này thành [Sát Hỏa].",
	["fan"] = "Chu Tước Vũ Phiến",

	["SilverLion"] = "Bạch Ngân Sư Tử",
	[":SilverLion"] = "Bài trang bị - Phòng cụ\n\n<b>Kỹ năng</b>: Tỏa định kỹ:\n• Khi bạn nhận sát thương, nếu sát thương này > 1, sát thương này trở thành 1.\n• Sau khi bạn mất [Bạch Ngân Sư Tử] từ vùng trang bị của bạn, bạn hồi 1 máu." ,
	["#SilverLion"] = "[<font color=\"yellow\"><b>Bạch Ngân Sư Tử</b></font>] của %from giảm %arg sát thương còn <font color=\"yellow\"><b>1</b></font> điểm.",

	["Vine"] = "Đằng Giáp",
	[":Vine"] ="Bài trang bị - Phòng cụ\n\n<b>Kỹ năng</b>: Tỏa định kỹ:\n• [Nam Man Nhập Xâm], [Vạn Tiễn Tề Phát] và [Sát] phổ thông không có hiệu quả với bạn.\n• Khi bạn tính toán sát thương phải nhận, nếu sát thương này có thuộc tính Hỏa, sát thương này +1." ,
	["#VineDamage"] = "Phát động hiệu quả [<font color=\"yellow\"><b>Đằng Giáp</b></font>] của %from, sát thương Hỏa tăng từ %arg lên %arg2 điểm.",

	["Horse"] = "Ngựa",
	[":+1 horse"] = "Bài trang bị - Ngựa +1\n\n<b>Kỹ năng</b>: Tỏa định kỹ: khoảng cách từ người khác đến bạn +1.",
	["JueYing"] = "Tuyệt Ảnh",
	["DiLu"] = "Đích Lô",
	["ZhuaHuangFeiDian"] = "Trảo Hoàng Phi Điện",
	[":-1 horse"] = "Bài trang bị - Ngựa -1\n\n<b>Kỹ năng</b>: Tỏa định kỹ: khoảng cách từ bạn đến người khác -1.",
	["ChiTu"] = "Xích Thố",
	["DaYuan"] = "Đại Uyển",
	["ZiXing"] = "Tử Tuynh",
	["JingFan"] = "Kinh Phàm",

	["amazing_grace"] = "Ngũ Cốc Phong Đăng",
	[":amazing_grace"] = "Bài công cụ\n\n<b>Mục tiêu</b>: Tất cả\n<b>Hiệu quả</b>: Lật ra từ chồng bài số lá bài bằng với số mục tiêu; mục tiêu thu lấy 1 lá từ số bài đã lật ra.",

	["god_salvation"] = "Đào Viên Kết Nghĩa",
	[":god_salvation"] = "Bài Công cụ\n\n<b>Mục tiêu</b>: Tất cả\n<b>Hiệu quả</b>: Mục tiêu hồi 1 máu; Không có hiệu quả với mục tiêu không bị thương.",

	["savage_assault"] = "Nam Man Nhập Xâm",
	[":savage_assault"] = "Bài công cụ\n\n<b>Mục tiêu</b>: Tất cả người khác\n<b>Hiệu quả</b>: Mục tiêu cần đánh ra 1 lá [Sát]; nếu không, họ nhận 1 sát thương.",
	["savage-assault-slash"] = "%src đã sử dụng [Nam Man Nhập Xâm], hãy đánh ra [Sát]",

	["archery_attack"] = "Vạn Tiễn Tề Phát",
	[":archery_attack"] = "Bài công cụ\n\n<b>Mục tiêu</b>: Tất cả người khác.\n<b>Hiệu quả</b>: Mục tiêu cần đánh ra 1 lá [Thiểm]; nếu không, họ nhận 1 sát thương.",
	["archery-attack-jink"] = "%src đã sử dụng [Vạn Tiễn Tề Phát], hãy đánh ra [Thiểm]",

	["collateral"] = "Tá Đao Sát Nhân",
	[":collateral"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1 người khác có vũ khí trong vùng trang bị (gọi là A) và 1 người trong tầm đánh của A (gọi là B)\n<b>Mục tiêu</b>: A\n<b>Hiệu quả</b>: A cần sử dụng [Sát] với B, nếu không, họ giao vũ khí trong vùng trang bị cho bạn.",
	["collateral-slash"] = "%dest đã sử dụng [Tá Đao Sát Nhân], yêu cầu dùng [Sát] lên %src",
	["#CollateralSlash"] = "%from đã chọn sử dụng [<font color=\"yellow\"><b>Sát</b></font>] lên %to",

	["duel"] = "Quyết Đấu",
	[":duel"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1 người khác\n<b>Mục tiêu</b>: Người đã chọn.\n<b>Hiệu quả</b>: Bắt đầu từ mục tiêu và bạn lần lượt đánh ra lá [Sát] đến khi có người  không đánh ra lá[Sát], người đó nhận 1 sát thương từ người còn lại.",
	["duel-slash"] = "%src sử dụng [Quyết Đấu] với bạn, hãy đánh ra 1 [Sát]",

	["ex_nihilo"] = "Vô Trung Sinh Hữu",
	[":ex_nihilo"] = "Bài công cụ\n\n<b>Mục tiêu</b>: Bạn\n<b>Hiệu quả</b>: Mục tiêu rút 2 lá.",

	["snatch"] = "Thuận Thủ Khiên Dương",
	[":snatch"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1 người khác ở khoảng cách 1 của bạn và có bài trong vùng chơi\n<b>Mục tiêu</b>: Người đã chọn\n<b>Hiệu quả</b>: Bạn thu lấy 1 lá trong vùng chơi của mục tiêu.",

	["dismantlement"] = "Quá Hạ Sách Kiều",
	[":dismantlement"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1 người khác có bài trong vùng chơi\n<b>Mục tiêu</b>: Người đã chọn.\n<b>Hiệu quả</b>: Bạn bỏ 1 lá trong vùng chơi của mục tiêu.",

	["nullification"] = "Vô Giải Khả Kích",
	[":nullification"] = "Bài công cụ\n\n<b>Thời điểm</b>: Khi 1 lá công cụ có hiệu quả với 1 người hoặc khi [Vô Giải Khả Kích] có hiệu quả.\n<b>Hiệu quả</b>: Triệt tiêu hiệu quả của lá công cụ với người đó; hoặc triệt tiêu hiệu quả của [Vô Giải Khả Kích];\n▷ Nếu công cụ bị triệt tiêu là [Thiểm Điện], chuyển lá đó sang người tiếp theo.",

	["heg_nullification"] = "Vô Giải Khả Kích - Quốc",
	[":heg_nullification"] = "Bài công cụ\n\n<b>Thời điểm</b>: Khi 1 lá công cụ có hiệu quả với 1 người hoặc khi [Vô Giải Khả Kích] có hiệu quả.\n<b>Hiệu quả</b>: Triệt tiêu hiệu quả của lá công cụ với người đó hoặc tất cả người cùng thế lực với người đó; hoặc triệt tiêu hiệu quả của [Vô Giải Khả Kích];\n▷ Nếu công cụ bị triệt tiêu là [Thiểm Điện], chuyển lá đó sang người tiếp theo.",
	["@heg_nullification-choose"] = "[Vô Giải Khả Kích - Quốc]: Chọn hiệu ứng",
	["heg_nullification:single"] = "Chỉ mục tiêu",
	["heg_nullification:all"] = "Toàn bộ thế lực" ,

	["indulgence"] = "Lạc Bất Tư Thục",
	[":indulgence"] = "Bài công cụ thời gian\n\n<b>Lựa chọn</b>: 1 người khác\n<b>Mục tiêu</b>: Người đã chọn\n<b>Hiệu quả</b>: Giai đoạn phán xét của mục tiêu, họ tiến hành phán xét, nếu kết quả phán xét không phải chất CƠ, bỏ qua giai đoạn ra bài lượt này; sau đó đưa lá này vào chồng bài bỏ.",

	["lightning"] = "Thiểm Điện",
	[":lightning"] = "Bài công cụ thời gian\n\n<b>Mục tiêu</b>: Bạn\n<b>Hiệu quả</b>: Giai đoạn phán xét của mục tiêu, tiến hành phán xét, nếu kết quả phán xét từ 2~9 BÍCH, mục tiêu nhận 3 điểm sát thương Lôi, sau đó đưa lá này vào chồng bài bỏ; nếu không, lá [Thiểm Điện] chuyển sang người tiếp theo.",

	["iron_chain"] = "Thiết Tác Liên Hoàn",
	[":iron_chain"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1-2 người\n<b>Mục tiêu</b>: Người đã chọn\n<b>Hiệu quả</b>: Mục tiêu thay đổi trạng thái xích.\n<b>Trùng Chú</b>: Có thể đưa lá này vào chồng bài bỏ để rút 1 lá.",

	["fire_attack"] = "Hỏa Công",
	[":fire_attack"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1 người có bài trên tay\n<b>Mục tiêu</b>: Người đã chọn.\n<b>Hiệu quả</b>: Mục tiêu mở 1 lá trên tay, bạn có thể bỏ 1 lá trên tay có cùng chất với lá họ đã mở để gây 1 sát thương Hỏa cho mục tiêu.",
	["fire-attack-card"] = "Bạn có thể bỏ 1 lá trên tay cùng chất với lá %arg của %dest để %dest nhận 1 sát thương Hỏa.",
	["@fire-attack"] = "%src đưa ra lá có chất %arg，hãy bỏ 1 lá cùng chất trên tay.",

	["supply_shortage"] = "Binh Lương Thốn Đoạn",
	[":supply_shortage"] = "Bài công cụ thời gian\n\n<b>Lựa chọn</b>: 1 người khác ở khoảng cách 1\n<b>Mục tiêu</b>: Người đã chọn\n<b>Hiệu quả</b>: Giai đoạn phán xét của mục tiêu, họ tiến hành phán xét, nếu kết quả phán xét không phải chất TÉP, bỏ qua giai đoạn rút bài lượt này; sau đó đưa lá này vào chồng bài bỏ.",

	["await_exhausted"] = "Dĩ Dật Đãi Lao",
	[":await_exhausted"] = "Bài công cụ\n\n<b>Mục tiêu</b>: Tất cả người có cùng thế lực với bạn.\n<b>Hiệu quả</b>: Mục tiêu rút 2 lá và bỏ 2 lá.",

	["known_both"] = "Tri Bỉ Tri Kỉ",
	[":known_both"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1 người khác có tướng chưa mở hoặc có bài trên tay\n<b>Mục tiêu</b>: Người đã chọn\n<b>Hiệu quả</b>: Bạn chọn xem tất cả bài trên tay hoặc 1 tướng úp của mục tiêu.\n<b>Trùng Chú</b>: Có thể đưa lá này vào chồng bài bỏ để rút 1 lá.",
	["#KnownBothView"] = "%from đã xem được %arg của %to" ,
	["$KnownBothViewGeneral"] = "%from đã xem được %arg của %to, chính là %arg2" ,
	["@known_both-choose"] = "Tri Bỉ Tri Kỉ: Vui lòng chọn hành động lên %dest",
	["known_both:head_general"] = "Xem Chủ tướng",
	["known_both:deputy_general"] = "Xem Phó tướng",
	["known_both:handcards"] = "Xem bài trên tay",

	["befriend_attacking"] = "Viễn Giao Cận Công",
	[":befriend_attacking"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1 người có thế lực xác định khác bạn\n<b>Mục tiêu</b>: Người đã chọn\n<b>Hiệu quả</b>: Mục tiêu rút 1 lá, sau đó bạn rút 3 lá.",

}

local ohorses = { "ChiTu", "DaYuan", "ZiXing", "JingFan"}
local dhorses = { "ZhuaHuangFeiDian", "DiLu", "JueYing"}

for _, horse in ipairs(ohorses) do
	t[":" .. horse] = t[":-1 horse"]
end

for _, horse in ipairs(dhorses) do
	t[":" .. horse] = t[":+1 horse"]
end

return t