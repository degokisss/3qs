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

-- translation for StrategicAdvantage Package

return {
	["strategic_advantage"] = "Thế Bị Thiên",

	["transfer"] = "Hợp",
	["is_transferable"] = "Lá này có thể được »Hợp Tung«",

	["Blade"] = "Thanh Long Yển Nguyệt Đao",
	[":Blade"] = "Bài Trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 3\n<b>Kỹ năng</b>: Tỏa định kỹ: Khi bạn sử dụng [Sát], mục tiêu của lá [Sát] này không thể mở tướng cho đến khi [Sát] này kết toán xong",

	["Halberd"] = "Phương Thiên Hoạ Kích",
	[":Halberd"] = "Bài Trang bị - Vũ khí\n\n<b>Tầm đánh</b>: 4\n<b>Kỹ năng</b>: Sau khi bạn chỉ định mục tiêu cho [Sát], bạn có thể chỉ định ở các thế lực xác định khác với mục tiêu, mỗi thế lực một người, đồng thời có thể chọn những người không có thế lực, lệnh họ trở thành mục tiêu của [Sát] này;\n▶ Sau khi 1 mục tiêu sử dụng [Thiểm] triệt tiêu [Sát] này, lệnh cho [Sát] này không có hiệu quả với những mục tiêu còn lại.",
	["halberd"] = "Phương Thiên Họa Kích",
	["#HalberdNullified"] = "Do hiệu quả của [%arg], %from dùng [%arg2] với %to vô hiệu",
	["@halberd-use"] = "Sử dụng hiệu ứng của [Phương Thiên Họa Kích]?",

	["Breastplate"] = "Hộ Tâm Kính",
	[":Breastplate"] = "Bài Trang bị - Phòng cụ\n\n<b>Kỹ năng</b>: Khi bạn nhận sát thương, nếu số sát thương ≥ số máu hiện tại của bạn, bạn có thể đưa lá này từ vùng trang bị vào chồng bài bỏ để chặn sát thương này.",
	["#Breastplate"] = "%from đã chặn %arg sát thương [%arg2] từ %to",

	["IronArmor"] = "Minh Quang Khải",
	[":IronArmor"] = "Bài Trang bị - Phòng cụ\n\n<b>Kỹ năng</b>: Tỏa định kỹ:\n" ..
	"• Khi bạn trở thành mục tiêu của [Hỏa Thiêu Liên Doanh]/[Hỏa Công]/[Sát Hỏa], hủy bỏ mục tiêu đối với bạn.\n" ..
	"• Nếu bạn thuộc tiểu thế lực, bạn không thể nhận trạng thái xích." ,
	["#IronArmor"] = "%from đã phát động [%arg]",


	["WoodenOx"] = "Mộc Ngưu Lưu Mã",
	[":WoodenOx"] = "Bài Trang bị - Bảo vật\n\n<b>Kỹ năng</b>:\n• Một lần trong giai đoạn ra bài, nếu số lá trong [Mộc Ngưu Lưu Mã] < 5, bạn có thể đặt úp 1 lá trên tay vào [Mộc Ngưu Lưu Mã], sau đó bạn có thể chuyển [Mộc Ngưu Lưu Mã] sang vùng trang bị của người khác.\n• Bạn có thể sử dụng hoặc đánh ra bài trên [Mộc Ngưu Lưu Mã] như bài trên tay.\n• Khi bạn mất [Mộc Ngưu Lưu Mã], nếu lá này không chuyển sang vùng trang bị khác, đưa tất cả lá trong [Mộc Ngưu Lưu Mã] vào chồng bài bỏ.",
	["@wooden_ox-move"] = "Bạn có thể chuyển [Mộc Ngưu Lưu Mã] sang vùng trang bị của một người khác",
	["wooden_ox"] = "Mộc Ngưu Lưu Mã",
	["#WoodenOx"] = "%from đánh ra %arg lá %arg2 bài",


	["JadeSeal"] = "Ngọc Tỉ",
	[":JadeSeal"] = "Bài Trang bị - Bảo vật\n\n<b>Kỹ năng</b>: Tỏa định kỹ: Nếu bạn đã có thế lực:\n" ..
	"• Thế lực của bạn là Đại thế lực duy nhất, tất cả thế lực khác không có [Ngọc Tỉ] là Tiểu Thế Lực.\n" ..
	"• Giai đoạn rút bài, bạn rút thêm 1 lá.\n" ..
	"• Khi bắt đầu giai đoạn ra bài, bạn xem như sử dụng 1 lá [Tri Bỉ Tri Kỉ].\n" ,
	["@JadeSeal"] = "Phát động [Ngọc Tỉ], xem như dùng 1 [Tri Kỷ Tri Bỉ]",
	["~JadeSeal"] = "Chọn mục tiêu [Tri Kỷ Tri Bỉ] rồi bấm \"Xác nhận\"",

	["drowning"] = "Thuỷ Yêm Thất Quân",
	[":drowning"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1 người khác có bài trong vùng trang bị\n<b>Mục tiêu</b>: Người đã chọn\n<b>Hiệu quả</b>: Mục tiêu lựa chọn bỏ tất cả bài trong vùng trang bị hoặc nhận 1 sát thương Lôi.",
	["drowning:throw"] = "Bỏ tất cả bài trong vùng trang bị",
	["drowning:damage"] = "Nhận 1 sát thương Lôi",

	["burning_camps"] = "Hỏa Thiêu Liên Doanh",
	[":burning_camps"] = "Bài công cụ\n\n<b>Mục tiêu</b>: Tất cả người cùng đội hình với người phía sau bạn.\n<b>Hiệu quả</b>: Bạn gây 1 sát thương Hỏa đối với mục tiêu. ",

	["lure_tiger"] = "Điệu Hổ Ly Sơn",
	[":lure_tiger"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1-2 người khác\n<b>Mục tiêu</b>: Người đã chọn\n<b>Hiệu quả</b>: Trong lượt này, mục tiêu không tính khoảng cách, vị trí; không thể sử dụng bài; không thể bị chỉ định làm mục tiêu của bài; không thể thay đổi số máu.",
	["lure_tiger_effect"] = "Điệu Hổ Ly Sơn",
	["#lure_tiger-prohibit"] = "Điệu Hổ Ly Sơn",

	["fight_together"] = "Lục Lực Đồng Tâm",
	[":fight_together"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1 người thuộc đại thế lực hoặc tiểu thế lực\n<b>Mục tiêu</b>: Tất cả người thuộc cùng cấp độ thế lực với người đã chọn.\n<b>Hiệu quả</b>: Nếu mục tiêu đang có trạng thái xích, họ rút 1 lá; nếu không, họ nhận trạng thái xích.\n<b>Trùng Chú</b>: Có thể đưa lá này vào chồng bài bỏ để rút 1 lá.",
	["@fight_together-choice"] = "Lục Lực Đồng Tâm: Chọn thế lực hoặc đổi bài",
	["fight_together:big"] = "Đại Thế Lực",
	["fight_together:small"] = "Tiểu Thế Lực",

	["alliance_feast"] = "Liên Quân Thịnh Yến",
	[":alliance_feast"] = "Bài công cụ\n\n<b>Lựa chọn</b>: 1 người có thế lực xác định khác bạn\n<b>Mục tiêu</b>: Bạn và tất cả người cùng thế lực với người đã chọn.\n<b>Hiệu quả</b>: Nếu mục tiêu là:\n*Bạn: Chọn rút số bài và hồi số máu tùy ý với tổng bằng số người của thế lực đã chọn.\n* Không phải bạn: Họ rút 1 lá và thoát trạng thái xích.",
	["@alliancefeast-choose"] = "Liên Quân Thịnh Yến: Chọn số máu hồi phục, số lượng còn lại dùng để rút bài.",

	["threaten_emperor"] = "Hiệp Thiên Tử Dĩ Lệnh Chư Hầu",
	[":threaten_emperor"] = "Bài công cụ\n\n<b>Mục tiêu</b>: Bạn\n<b>Điều kiện</b>: Bạn thuộc đại thế lực và đang trong giai đoạn ra bài của bạn\n<b>Hiệu quả</b>: Bạn kết thúc giai đoạn ra bài;\n▶ Khi kết thúc giai đoạn bỏ bài, bạn có thể bỏ 1 lá trên tay để nhận thêm một lượt sau lượt này.",
	["@threaten_emperor"] = "Nhận hiệu quả của [Hiệp Thiên Tử Dĩ Lệnh Chư Hầu], có thể bỏ 1 lá trên tay để nhận thêm 1 lượt",

	["imperial_order"] = "Sắc lệnh",
	[":imperial_order"] = "Bài công cụ\n\n<b>Mục tiêu</b>: Tất cả người không có thế lực.\n<b>Hiệu quả</b>: Mục tiêu chọn 1 mục:\n1. Mở 1 tướng và rút 1 lá;\n2.Bỏ 1 trang bị;\n3. Mất 1 máu.\n<b>Hiệu ứng thêm</b>: Khi lá này tiến vào chồng bài bỏ không phải do sử dụng, lá này bị loại bỏ khỏi trận đấu, sau đó đưa [Chiếu Thư] vào đáy chồng bài rút;\n▶ Khi kết thúc lượt này, tất cả người không có thế lực có thế lực giải quyết hiệu quả của lá này.",

	["#RemoveImperialOrder"] = "[%arg] bị bỏ ra nhưng chưa sử dụng, sẽ bị loại khỏi trận đấu.",
	["#ImperialOrderEffect"] = "%from kết thúc lượt, phát động hiệu quả của [%arg] đã bị loại bỏ",
	
    ["@imperial_order-choose"] = "[Sắc Lệnh]: Lựa chọn 1 mục:\n1. Mở 1 tướng và rút bài;\n2. Bỏ 1 trang bị;\n3. Mất 1 máu.",
	["imperial_order:show_head"] = "Mở chủ tướng",
	["imperial_order:show_deputy"] = "Mở phó tướng",
    ["imperial_order:dis_equip"] = "Bỏ trang bị",
    ["imperial_order:cancel"] = "Mất 1 máu",
    ["@imperial_order-equip"] = "[Sắc Lệnh]: chọn 1 trang bị để bỏ.",
	
}