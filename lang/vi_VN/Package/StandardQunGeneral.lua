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

-- translation for Standard General Package

return {
	-- 群雄
	["#huatuo"] = "Thần Y",
	["huatuo"] = "Hoa Đà",
	["chuli"] = "Trừ Lệ",
	
	[":chuli"] = "Một lần trong giai đoạn ra bài, nếu bạn có bài, bạn có thể chọn tối đa 3 người có thế lực khác nhau và có bài, thực hiện lần lượt:\n- Bạn bỏ đi 1 lá của bạn và họ;\n- Lệnh người đã mất đi lá BÍCH bởi kỹ năng này rút 1 lá.",
	["jijiu"] = "Cấp Cứu",
	[":jijiu"] = "Ngoài lượt của bạn, bạn có thể chuyển hóa sử dụng bài Đỏ thành [Đào].",

	["#lvbu"] = "Kích Chỉ Trung Nguyên",
	["lvbu"] = "Lữ Bố",
	["wushuang"] = "Vô Song",
	[":wushuang"] = "Tỏa định kỹ:\n• Sau khi bạn xác định mục tiêu của [Sát], ứng với mỗi mục tiêu, bạn lệnh họ cần sử dụng 2 [Thiểm] để triệt tiêu [Sát] này.\n• Sau khi bạn xác định mục tiêu của [Quyết Đấu] ứng với mỗi mục tiêu hoặc sau khi bạn trở thành mục tiêu của [Quyết Đấu], bạn lệnh người cùng bạn [Quyết Đấu] cần đánh ra 2 [Sát] mỗi lần để hưởng ứng.\n• Sau khi bạn lựa chọn mục tiêu cho [Quyết Đấu] phi chuyển hóa, bạn có thể lựa chọn thêm tối đa 2 người để trở thành mục tiêu.",
	["@wushuang-slash-1"] = "%src [Quyết Đấu] với bạn, bạn phải đánh ra 2 [Sát] liên tiếp.",
	["@wushuang-slash-2"] = "%src [Quyết Đấu] với bạn, bạn phải đánh ra thêm 1 [Sát] khác.",
	["@wushuang-add"] = "Vô Song: Có thể chọn thêm 2 mục tiêu cho [Quyết Đấu]",

	["#diaochan"] = "Tuyệt Thế Đích Vũ Cơ",
	["diaochan"] = "Điêu Thuyền",
	["lijian"] = "Ly Gián",
	[":lijian"] = "Một lần trong giai đoạn ra bài, bạn có thể bỏ 1 lá và lựa chọn 2 người khác có giới tính nam, lệnh người chọn sau xem như sử dụng [Quyết Đấu] với người chọn trước.",
	["biyue"] = "Bế Nguyệt",
	[":biyue"] = "Khi bắt đầu giai đoạn kết thúc, bạn có thể rút 1 lá.",

	["#yuanshao"] = "Cao Quý Đính Danh Môn",
	["yuanshao"] = "Viên Thiệu",
	["luanji"] = "Loạn Kích",
	[":luanji"] = "Giai đoạn ra bài, bạn có thể chuyển hóa sử dụng 2 lá trên tay thành [Vạn Tiễn Tề Phát];\n▷ Bạn không thể sử dụng [Vạn Tiễn Tề Phát] bằng cách này với lá thành phần cùng chất với những lá bạn đã sử dụng theo cách này trong lượt này;\n▶ Sau khi người cùng thế lực với bạn đánh ra [Thiểm] để hưởng ứng, họ có thể rút 1 lá.",
	["#luanji-draw"] = "Loạn Kích (Rút bài)",
	["@luanji-draw"] = "Loạn Kích: Rút 1 lá?",
	["#LuanjiDraw"] = "%from hưởng ứng »%arg« và có thể rút 1 lá.",

	["#yanliangwenchou"] = "Hổ Lang Huynh Đệ",
	["yanliangwenchou"] = "Nhan Lương & Văn Xú",
	["&yanliangwenchou"] = "Nhan Lương Văn Xú",
	["shuangxiong"] = "Song Hùng",
	[":shuangxiong"] = "Giai đoạn rút bài, bạn có thể chọn không rút bài, bạn tiến hành phán xét;\n▶ Sau khi phán xét trên có hiệu lực, bạn thu lấy kết quả phán xét;\n▶ Trong lượt này, bạn có thể chuyển hóa sử dụng bài trên tay khác màu với kết quả phán xét trên thành [Quyết Đấu].",
	["#shuangxiong"] = "Song Hùng (Thu lấy lá phán xét)",

	["#jiaxu"] = "Lãnh Khốc Đích Độc Sĩ",
	["jiaxu"] = "Giả Hủ",
	["wansha"] = "Hoàn Sát",
	[":wansha"] = "Tỏa định kỹ: Trong lượt của bạn, khi có người vào trạng thái hấp hối, bạn lệnh người khác không trong trạng thái hấp hối không thể sử dụng [Đào].",
	["weimu"] = "Duy Mạc",
	[":weimu"] = "Tỏa định kỹ:\n• Khi bạn trở thành mục tiêu của công cụ phổ thông Đen, hủy bỏ mục tiêu đối với bạn.\n• Khi có lá Đen tiến vào vùng phán xét của bạn, đưa lá đó vào chồng bài bỏ.",
	["luanwu"] = "Loạn Vũ",
	[":luanwu"] = "Hạn định kỹ: Giai đoạn ra bài, bạn có thể phát động kỹ năng này, lệnh tất cả người khác chọn 1 mục:\n1. Họ sử dụng [Sát] với người có khoảng cách nhỏ nhất;\n2. Họ mất 1 máu.",
	["@chaos"] = "Loạn Vũ",
	["@luanwu-slash"] = "Hãy sử dụng [Sát] để hưởng ứng »Loạn Vũ«",
	["#WanshaOne"] = "%from đã phát động »%arg«, chỉ %from có thể cứu %from",
	["#WanshaTwo"] = "%from đã phát động »%arg«, chỉ %from và %to có thể cứu %from",

	["#pangde"] = "Nhân Mã Nhất Thể",
	["pangde"] = "Bàng Đức",
	["mashu_pangde"] = "Mã Thuật",
	["jianchu"] = "Kiện Xuất",
	[":jianchu"] = "Sau khi bạn xác định mục tiêu của [Sát], ứng với mỗi mục tiêu, bạn có thể bỏ 1 lá của họ, nếu lá bị bỏ đi là:\n* Trang bị: Họ không thể sử dụng [Thiểm] để hưởng ứng;\n* Phi trang bị: Họ thu lấy [Sát] mà bạn sử dụng.",

	["#zhangjiao"] = "Thiên Công Tướng Quân",
	["zhangjiao"] = "Trương Giác",
	["leiji"] = "Lôi Kích",
	[":leiji"] = "Khi bạn sử dụng/đánh ra [Thiểm], bạn có thể lệnh 1 người khác tiến hành phán xét, nếu kết quả phán xét có chất BÍCH, bạn gây 2 sát thương Lôi cho họ.",
	["leiji-invoke"] = "Có thể phát động »Lôi Kích«: Chọn 1 người khác",
	["guidao"] = "Quỷ Đạo",
	[":guidao"] = "Khi phán xét của 1 người có hiệu lực, bạn có thể đánh ra 1 lá Đen để hoán đổi kết quả phán xét đó.",
	["@guidao-card"] = CommonTranslationTable["@askforretrial"],
	["~guidao"] = "Chọn 1 lá màu Đen và nhấn \"Xác nhận\"",

	["#caiwenji"] = "Dị Hương Đích Cô Nữ",
	["caiwenji"] = "Thái Văn Cơ",
	["beige"] = "Bi ca",
	[":beige"] = "Sau khi 1 người nhận sát thương từ lá [Sát], bạn có thể bỏ 1 lá, lệnh họ tiến hành phán xét, nếu kết quả phán xét có chất:\n* CƠ: Họ hồi 1 máu;\n* RÔ: Họ rút 2 lá;\n* TÉP: Nguồn sát thương bỏ 2 lá;\n* BÍCH: Nguồn sát thương thay đổi trạng thái chồng tướng.",
	["@beige"] = "Có thể bỏ 1 lá để kích »Bi Ca«",
	["duanchang"] = "Đoạn Trường",
	[":duanchang"] = "Tỏa định kỹ: Khi bạn trận vong do người khác gây sát thương, bạn chọn 1 tướng của họ, lệnh họ mất đi kỹ năng của tướng đó.",
	["@duanchang"] = "Đoạn Trường",
	["#DuanchangLoseHeadSkills"] = "%from đã phát động »%arg«， %to đã mất kỹ năng của Chủ tướng",
	["#DuanchangLoseDeputySkills"] = "%from đã phát động »%arg«， %to đã mất kỹ năng của Phó tướng",

	["#mateng"] = "Trì Sính Tây Thùy",
	["mateng"] = "Mã Đằng",
	["mashu_mateng"] = "Mã Thuật",
	["xiongyi"] = "Hùng Dị",
	[":xiongyi"] = "Hạn định kỹ: Giai đoạn ra bài, bạn có thể phát động kỹ năng này, thực hiện lần lượt:\n- Lệnh tất cả người cùng thế lực với bạn rút 3 lá;\n- Nếu thế lực của bạn là một trong những thế lực ít người nhất, bạn hồi 1 máu.",
	["@arise"] = "Hùng Dị",

	["#kongrong"] = "Lẫm Nhiên Trọng Nghĩa",
	["kongrong"] = "Khổng Dung",
	["mingshi"] = "Danh Sĩ",
	[":mingshi"] = "Tỏa định kỹ: Khi bạn tính toán sát thương phải nhận, nếu nguồn sát thương có tướng chưa mở, lệnh sát thương này -1.",
	["lirang"] = "Lễ Nhượng",
	[":lirang"] = "Khi bài của bạn tiến vào chồng bài bỏ do bỏ bài, bạn có thể giao tùy ý cho những người khác.",
	["@lirang-give"] = "Lễ Nhượng: Bạn có thể giao bài bỏ cho người khác.",
	["#lirang"] = "Lễ nhượng",
	["#Mingshi"] = "%from đã phát động »<font color=\"yellow\"><b>Danh Sĩ</b></font>«, sát thương từ %arg đến %arg2 -1.",

	["#jiling"] = "Trọng Gia Đích Chủ Tướng",
	["jiling"] = "Kỷ Linh",
	["shuangren"] = "Song Nhận",
	[":shuangren"] = "Khi bắt đầu giai đoạn ra bài, bạn có thể đấu điểm với 1 người:\n* Nếu bạn thắng: Bạn xem như sử dụng [Sát] với 1 người cùng thế lực với họ;\n* Nếu bạn không thắng: Bạn không thể chỉ định người khác làm mục tiêu sử dụng bài.",
	["@shuangren"] = "Bạn có thể kích »Song Nhận«",

	["#tianfeng"] = "Hà Bắc Côi Kiệt",
	["tianfeng"] = "Điền Phong",
	["sijian"] = "Tử Gián",
	[":sijian"] = "Sau khi bạn mất đi lá cuối cùng trên tay, bạn có thể bỏ 1 lá của 1 người khác.",
	["sijian-invoke"] = "Bạn có thể kích »Tử Gián«<br/>Chọn 1 người khác có bài, nhấn \"Xác nhận\".<br/>",
	["suishi"] = "Tùy Thế",
	[":suishi"] = "Tỏa định kỹ:\n• Khi người khác tiến trạng thái hấp hồi, nếu nguồn sát thương có cùng thế lực với bạn, bạn rút 1 lá.\n• Khi người khác có cùng thế lực với bạn trận vong, bạn mất 1 máu.",

	["#panfeng"] = "Liên Quân Thượng Tướng",
	["panfeng"] = "Phan Phụng",
	["kuangfu"] = "Cuồng Phủ",
    [":kuangfu"] = "Một lần trong giai đoạn ra bài, sau khi bạn xác định mục tiêu của [Sát], bạn có thể thu lấy 1 trang bị của 1 trong các mục tiêu;\n▶ Sau khi kết toán xong [Sát] này, nếu [Sát] này không gây sát thương, bạn bỏ 2 lá trên tay.",
    ["kuangfu-invoke"] = "Có thể phát động »Cuồng Phủ«, chọn 1 mục tiêu của [Sát]",
    ["@kuangfu-discard"] = "Cuồng Phủ: Bỏ 2 lá trên tay",

	["#zoushi"] = "Hoặc Tâm Chi Mị",
	["zoushi"] = "Trâu Thị",
	["huoshui"] = "Họa Thủy",
	[":huoshui"] = "Tỏa định kỹ: Trong lượt của bạn:\n• Người khác không thể mở tướng.\n• Khi bạn sử dụng [Sát] hoặc [Vạn Tiễn Tề Phát], mục tiêu của lá này không thể sử dụng hoặc đánh ra [Thiểm] để hưởng ứng.",
	["qingcheng"] = "Khuynh Thành",
	[":qingcheng"] = "Giai đoạn ra bài, bạn có thể bỏ 1 lá Đen và chọn 1 người khác đã mở tất cả tướng, bạn úp 1 tướng của họ;\n▷ Nếu lá bạn bỏ là trang bị, bạn có thể chọn 1 người khác đã mở tất cả tướng, bạn úp 1 tướng của họ.",
	["qingcheng-second"] = "Khuynh thành: Bạn có thể úp tướng của 1 người khác.",
	["#QingchengSecond"] = "%from đã phát động »%arg« lên %to",
	

}

