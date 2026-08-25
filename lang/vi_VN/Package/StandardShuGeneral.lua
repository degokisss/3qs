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
	-- 蜀势力
	["#liubei"] = "Loạn Thế Đích Kiêu Hùng",
	["liubei"] = "Lưu Bị",
	["rende"] = "Nhân Đức",
	[":rende"] = "Giai đoạn ra bài, bạn có thể đem tùy ý lượng bài trên tay giao cho 1 người khác chưa nhận bài từ kỹ năng này trong giai đoạn này;\n▷ Nếu đây là lần đầu tổng số lá bạn giao bằng kỹ năng này trong giai đoạn này ≥ 2, bạn có thể xem như sử dụng 1 lá cơ bản.",
    ["@rende-basic"] = "Nhân Đức: Chọn lá cơ bản để sử dụng",
    ["rende_basic"] = "Nhân Đức",
	
	["#guanyu"] = "Mĩ Nhiêm Công",
	["guanyu"] = "Quan Vũ",
	["wusheng"] = "Võ Thánh",
	[":wusheng"] = "• Bạn có thể chuyển hóa sử dụng/đánh ra 1 lá Đỏ thành [Sát].\n• Lá [Sát] RÔ do bạn sử dụng không giới hạn khoảng cách.",

	["#zhangfei"] = "Vạn Phu Bất Đương",
	["zhangfei"] = "Trương Phi",
	["paoxiao"] = "Bào Hao",
	[":paoxiao"] = "Tỏa định kỹ:\n• Bạn sử dụng lá [Sát] không giới hạn số lượng.\n• Khi bạn sử dụng [Sát] thứ 2 trong 1 lượt, bạn rút 1 lá.",
	["#PaoxiaoDraw"] = "%from đã phát động »%arg«, rút 1 lá",
    ["#PaoxiaoTarget"] = "%from đã phát động »%arg«, bỏ qua phòng cụ của %to",

	["#zhugeliang"] = "Trì Mộ Đích Thừa Tướng",
	["zhugeliang"] = "Gia Cát Lượng",
	["guanxing"] = "Quan Tinh",
	[":guanxing"] = "Khi bắt đầu giai đoạn chuẩn bị, bạn có thể xem X lá bài trên đầu chồng bài rút (X là số người còn sống, tối đa 5), sau đó sắp xếp tùy ý những lá này lên đầu hoặc đáy chồng bài rút.",
	["kongcheng"] = "Không Thành",
	[":kongcheng"] = "Tỏa định kỹ:\n• Khi bạn trở thành mục tiêu của [Sát]/[Quyết Đấu], nếu bạn không có bài trên tay, hủy bỏ mục tiêu đối với bạn.\n• Ngoài lượt của bạn, khi bạn nhận được bài do người khác giao cho, nếu bạn không có bài trên tay, đặt những lá bài này lên trên Tướng này, gọi là [Cầm];\n• Khi bắt đầu giai đoạn rút bài, bạn thu lấy tất cả lá [Cầm].",
	["#GuanxingResult"] = "%from đã phát động »<font color=\"yellow\"><b>Quan Tinh</b></font>«: %arg lên trên, %arg2 xuống dưới",
	["$GuanxingTop"] = "Đặt lên đầu chồng bài: %card",
	["$GuanxingBottom"] = "Đặt dưới đáy chồng bài: %card",
	["zither"] = "Cầm",

	["#zhaoyun"] = "Hổ Uy Tướng Quân",
	["zhaoyun"] = "Triệu Vân",
	["longdan"] = "Long Đảm",
	[":longdan"] = "• Bạn có thể chuyển hóa sử dụng/đánh ra [Thiểm] thành [Sát];\n▶ Sau khi [Sát] này bị triệt tiêu bởi [Thiểm] của mục tiêu, bạn có thể gây 1 sát thương cho 1 người ngoại trừ mục tiêu.\n• Bạn có thể chuyển hóa sử dụng/đánh ra [Sát] thành [Thiểm];\n▶ Sau khi [Thiểm] này triệt tiêu [Sát] của 1 người, bạn có thể hồi 1 máu cho 1 người khác ngoại trừ người sử dụng [Sát].",

	["#longdan-draw"] = "Long đảm [Rút bài]",
	["#LongdanDraw"] = "%from đã phát động »%arg<font color=\"yellow\"><b>(Ngũ Hổ Tướng Đại Kỳ)</b></font>«, rút 1 lá.",
	["longdan-damage"] = "Phát động »Long Đảm«, gây 1 sát thương cho người",
	["longdan-recover"] = "Phát động »Long Đảm«, hồi 1 máu cho người khác",
	["#longdan-slash"] = "Long Đảm [Sát]",
	["#longdan-jink"] = "Long Đảm [Thiểm]",
	["#LongdanDamage"] = "%from đã phát động »%arg«，gây 1 sát thương cho %to",
	["#LongdanRecover"] = "%from đã phát động »%arg«，hồi 1 máu cho %to",
	
	["#machao"] = "Nhất Kỵ Đươmg Thiên",
	["machao"] = "Mã Siêu",
	["mashu_machao"] = "Mã Thuật",
	[":mashu"] = "Tỏa định kỹ: Khoảng cách từ bạn đến người khác -1.",
	["tieqi"] = "Thiết Kỵ",
	[":tieqi"] = "Sau khi bạn xác định mục tiêu của [Sát], ứng với mỗi mục tiêu, bạn có thể tiến hành phán xét, thực hiện lần lượt:\n- Vô hiệu hóa kỹ năng không phải Tỏa định kỹ của 1 tướng đã mở của mục tiêu trong lượt này;\n- Mục tiêu chọn bỏ 1 lá cùng chất với kết quả phán xét hoặc không thể sử dụng [Thiểm] để hưởng ứng [Sát] này.",
	
	["@tieji-discard"] = "Thiết Kỵ: Bỏ 1 lá bài có chất %arg, nếu không bạn không thể sử dụng [Thiểm]",
	["#TieqiHeadSkills"] = "%from đã phát động »%arg«, khóa kỹ năng không phải tỏa định kỹ của chủ tướng của %to",
	["#TieqiDeputySkills"] = "%from đã phát động »%arg«, khóa kỹ năng không phải tỏa định kỹ của phó tướng của %to",
	["#TieqiAllSkills"] = "%from đã phát động »arg«, khóa kỹ năng không phải tỏa định kỹ của %to ",
	
	
	["#huangyueying"] = "Quy Ẩn Kiệt Nữ",
	["huangyueying"] = "Hoàng Nguyệt Anh",
	["jizhi"] = "Tập Trí",
	[":jizhi"] = "Khi bạn sử dụng công cụ phổ thông không phải chuyển hóa, bạn có thể rút 1 lá.",
	["qicai"] = "Kỳ Tài",
	[":qicai"] = "Tỏa định kỹ: Công cụ bạn sử dụng không giới hạn khoảng cách.",

	["#huangzhong"] = "Lão Đương Ích Tráng",
	["huangzhong"] = "Hoàng Trung",
	["liegong"] = "Liệt Cung",
    [":liegong"] = "• Lá [Sát] bạn sử dụng không giới hạn khoảng cách với mục tiêu có số bài trên tay ≤ bạn.\n• Sau khi bạn xác định từng mục tiêu của [Sát], nếu số máu của họ ≥ bạn, bạn có thể chọn 1 mục:\n1. Lệnh mục tiêu không thể sử dụng [Thiểm] để hưởng ứng [Sát] này;\n2. Lệnh cho sát thương từ hiệu quả của lá [Sát] này +1 đối với mục tiêu này.",
    ["@liegong-choice"] = "Liệt Cung: Lựa chọn hiệu quả cho %dest",
    ["liegong:nojink"] = "Không thể sử dụng [Thiểm]",
    ["liegong:adddamage"] = "Sát thương +1",

	["#weiyan"] = "Thị Huyết Độc Lang",
	["weiyan"] = "Ngụy Diên",
	["kuanggu"] = "Cuồng Cốt",
	[":kuanggu"] = "Sau khi bạn gây sát thương cho 1 người, nếu khoảng cách từ bạn tới họ ≤1 trước khi máu giảm, ứng với mỗi sát thương, bạn có thể chọn 1 mục:\n1. Hồi 1 máu;\n2. Rút 1 lá.",
	["kuanggu:draw"] = "Rút 1 lá",
	["kuanggu:recover"] = "Hồi 1 máu",
	
	["#pangtong"] = "Phượng Sồ",
	["pangtong"] = "Bàng Thống",
	["lianhuan"] = "Liên Hoàn",
	[":lianhuan"] = "Giai đoạn ra bài, bạn có thể chuyển hóa sử dụng lá TÉP trên tay thành [Thiết Tác Liên Hoàn] hoặc Trùng Chú lá TÉP trên tay.",
	["niepan"] = "Niết Bàn",
	[":niepan"] = "Hạn định kỹ: Khi bạn trong trạng thái hấp hối, bạn có thể phát động kỹ năng này, thực hiện lần lượt:\n- Bạn bỏ toàn bộ bài trong vùng chơi;\n- Bạn hồi máu đến 3 và rút 3 lá;\n- Bạn loại bỏ trạng thái xích và chồng tướng.",
	["@nirvana"] = "Niết Bàn",

	["#wolong"] = "Ngoạ Long",
	["wolong"] = "Khổng Minh",
	["&wolong"] = "Gia Cát Lượng",
	["bazhen"] = "Bát Trận",
	[":bazhen"] = "Tỏa định kỹ: Nếu vùng trang bị của bạn không có phòng cụ, bạn xem như có [Bát Quái Trận].",
	["huoji"] = "Hỏa Kế",
	[":huoji"] = "Bạn có thể chuyển hóa sử dụng lá Đỏ trên tay thành [Hỏa Công].",
	["kanpo"] = "Khán Phá",
	[":kanpo"] = "Bạn có thể chuyển hóa sử dụng lá Đen trên tay thành [Vô Giải Khả Kích].",

	["#liushan"] = "Vô Vi Chân Mệnh Chủ",
	["liushan"] = "Lưu Thiện",
	["xiangle"] = "Hưởng Lạc",
	[":xiangle"] = "Tỏa định kỹ: Sau khi bạn trở thành mục tiêu của [Sát], người sử dụng [Sát] chọn 1 mục:\n1. Họ bỏ 1 lá cơ bản;\n2. Lệnh [Sát] đó không có hiệu quả với bạn.",
	["@xiangle-discard"] = "%src đã phát động [Hưởng Lạc], hãy bỏ thêm 1 lá cơ bản nếu không lá [Sát] sẽ vô hiệu.",
	["fangquan"] = "Ủy Quyền",
	[":fangquan"] = "Khi tiến vào giai đoạn ra bài, bạn có thể bỏ qua giai đoạn này;\n▶ Khi kết thúc lượt này, bạn có thể bỏ 1 lá bài trên tay, lệnh 1 người có 1 lượt sau lượt này.",
	["@fangquan-discard"] = "Bạn có thể bỏ ra 1 lá bài và chọn 1 người để họ có lượt sau bạn.",
	["#fangquan-after"] = "Ủy Quyền",
	["~fangquan"] = "Chọn 1 lá bài, chọn 1 người và kích \"Xác nhận\"",
	["#Fangquan"] = "%to đã nhận lượt thay thế",

	["#menghuo"] = "Nam Man Vương",
	["menghuo"] = "Mạnh Hoạch",
	["huoshou"] = "Họa Thủ",
	[":huoshou"] = "Tỏa định kỹ:\n• [Nam Man Nhập Xâm] không có hiệu quả với bạn.\n• Sau khi 1 người khác xác định mục tiêu của [Nam Man Nhập Xâm], bạn trở thành nguồn sát thương của [Nam Man Nhập Xâm] này.",
	["#sa_avoid_huoshou"] = "Họa Thủ (vô hiệu Nam Man Nhập Xâm)" ,
	["zaiqi"] = "Tái Khởi",
    [":zaiqi"] = "Khi kết thúc giai đoạn bỏ bài, bạn có thể chọn tối đa X người cùng thế lực (X là số lá Đỏ đã đi vào chồng bài bỏ trong lượt này), họ lựa chọn 1 mục:\n1. Họ rút 1 lá;\n2. Lệnh bạn hồi 1 máu.",
	["#HuoshouTransfer"] = "%from đã phát động »%arg2«, [<font color=\"yellow\"><b>Nam Man Nhập Xâm</b></font>] chuyển nguồn sát thương thành %from",
	["@zaiqi-target"] = "Có thể phát động »Tái Khởi«, chọn tối đa %arg người cùng thế lực với bạn",
    ["@zaiqi-choice"] = "Tái khởi: Rút 1 lá hoặc Lệnh cho %src hồi 1 máu",
    ["zaiqi:drawcard"] = "Rút 1 lá",
    ["zaiqi:recover"] = "Hồi 1 máu",

	["#zhurong"] = "Dã Tính Nữ Vương",
	["zhurong"] = "Chúc Dung",
	["juxiang"] = "Cự Tượng",
	[":juxiang"] = "Tỏa định kỹ:\n• [Nam Man Nhập Xâm] không có hiệu quả với bạn.\n• Sau khi [Nam Man Nhập Xâm] do người khác sử dụng kết toán xong, bạn thu lấy lá này.",
	["#sa_avoid_juxiang"] = "Cự Tượng vô hiệu hoá [Nam Man Nhập Xâm]" ,
	["lieren"] = "Liệt Nhận",
	[":lieren"] = "Sau khi bạn gây sát thương cho mục tiêu của [Sát], bạn có thể tiến hành đấu điểm với họ, nếu bạn thắng, bạn thu lấy 1 lá của mục tiêu.",

	["#ganfuren"] = "Chiêu Liệt Hoàng Hậu",
	["ganfuren"] = "Cam Phu Nhân",
	["shushen"] = "Thục Thận",
	[":shushen"] = "Sau khi bạn hồi máu, ứng với mỗi máu bạn đã hồi, bạn có thể lệnh 1 người khác rút 1 lá.",
	["shushen-invoke"] = "Phát động »Thục Thận«. <br/>Chọn một người rồi bấm \"Xác nhận\"<br/>",
	["shenzhi"] = "Thần Trí",
	[":shenzhi"] = "Khi bắt đầu giai đoạn chuẩn bị, bạn có thể bỏ tất cả bài trên tay, nếu số lá đã bỏ ≥ số máu hiện tại của bạn, bạn hồi 1 máu.",

	

}
