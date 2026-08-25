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
	["transformation"] = "Biến",
	["transformation_equip"] = "Biến",

	--魏
	["#xunyou"] = "Tào Ngụy Văn Mưu Chủ",
	["xunyou"] = "Tuân Du",
	["qice"] = "Kỳ sách",
	[":qice"] = "Một lần trong giai đoạn ra bài, bạn có thể chuyển hóa sử dụng tất cả bài trên tay thành 1 lá công cụ phổ thông (Số mục tiêu không vượt quá số lá đem sử dụng);\n▷ Bạn có thể đổi Phó tướng.",
	["zhiyu"] = "Trí Ngu",
	[":zhiyu"] = "Sau khi bạn nhận sát thương, bạn có thể rút 1 lá và mở tất cả bài trên tay, nếu tất cà đều cùng màu, nguồn sát thương bỏ 1 lá trên tay.",

	["bianhuanghou"] = "Biện Phu Nhân",
	["#bianhuanghou"] = "Đính Thế Chi Ung Dung",
	["wanwei"] = "Văn Ngụy",
	[":wanwei"] = "Khi bài của bạn bị người khác chỉ định để thu lấy hoặc bỏ, bạn có thể đổi thành tự chọn lá của bạn.",
	["@wanwei-dismantle"] = "Văn Ngụy: Hãy chọn %arg lá bài để %src bỏ đi",
	["@wanwei-extraction"] = "Văn Ngụy: Hãy chọn %arg lá bài để %src thu lấy",
	["yuejian"] = "Ước Kiệm",
	[":yuejian"] = "Tỏa định kỹ: Khi bắt đầu giai đoạn bỏ bài của người cùng thế lực, nếu lượt này họ không sử dụng bài chọn người thế lực khác làm mục tiêu, bạn lệnh giới hạn trữ bài của họ bằng với giới hạn máu.",

	-- 群
	["lijueguosi"] = "Lý Giác & Quách Tỷ",
	["#lijueguosi"] = "Phạm Tộ Khuynh Họa",
	["&lijueguosi"] = "Lý Giác Quách Tỷ",
	["xiongsuan"] = "Hung Toán",
	[":xiongsuan"] = "Hạn định kỹ: Giai đoạn ra bài, bạn có thể bỏ 1 lá bài trên tay và chọn 1 người cùng thế lực, thực hiện lần lượt:\n- Bạn gây 1 sát thương cho họ;\n- Bạn rút 3 lá;\n- Bạn chọn 1 Hạn định kỹ đã phát động của họ;\n▶ Khi kết thúc lượt này, thêm 1 giới hạn phát động Hạn định kỹ đó.",
	["@xiongsuan-reset"] = "Hung Toán: Đặt lại 1 Hạn định kỹ của %dest",
	["#XiongsuanReset"] = "%from đặt lại Kỹ năng »%arg«",
	

	["#new_zuoci"] = "Quỷ Ảnh Thần Đạo",
	["new_zuoci"] = "Tả Từ",
	["yigui"] = "Dịch Quỷ",
	[":yigui"] = "• Sau khi bạn mở tướng này lần đầu tiên, bạn nhận 2 lá từ chồng bài tướng đặt lên tướng này, gọi là [Hồn].\n"..
	"• Khi bạn cần sử dụng lá cơ bản hoặc công cụ phổ thông có mục tiêu, nếu bạn chưa sử dụng lá đó bằng kỹ năng này trong lượt này, bạn có thể bỏ 1 [Hồn], xem như bạn sử dụng lá đó;\n▷ Bạn không thể chỉ định người thế lực gốc khác với [Hồn] làm mục tiêu của lá này.",

	["jihun"] = "Cấp Hồn",
	[":jihun"] = "Sau khi bạn nhận sát thương hoặc sau khi 1 người thế lực xác định khác với bạn thoát khỏi trạng thái hấp hối, bạn có thể nhận 1 lá từ chồng bài tướng đặt lên tướng này, gọi là [Hồn].",
	
	["#dropHuashenDetail"] = "%from đã bỏ [Hồn] %arg",
	["#GetHuashenDetail"] = "%from đã nhận [Hồn] %arg",
	["#VeiwHuashenDetail"] = "%from đang xem %arg từ chồng tướng",
	["#dropHuashen"] = "%from đã bỏ [Hồn] %arg",
	["#GetHuashen"] = "%from đã nhận [Hồn] %arg ",
	["#VeiwHuashen"] = "%from đang xem %arg từ chồng tướng",
	
    ["soul"] = "Hồn",

	-- 蜀
	["shamoke"] = "Sa Ma Kha",
	["#shamoke"] = "Ngũ Kê Man Vương",
	["jili"] = "Tật Lê",
	[":jili"] = "Khi bạn sử dụng/đánh ra bài, nếu lá này là lá thứ X mà bạn sử dụng/đánh ra trong lượt này, bạn có thể rút X lá (X là tầm đánh của bạn).",

	["masu"] = "Mã Tắc",
	["#masu"] = "Duy Ác Kình Mưu",
	["sanyao"] = "Tán Dao",
	[":sanyao"] = "Một lần trong giai đoạn ra bài, bạn có thể bỏ 1 lá và chọn 1 người nhiều máu nhất, bạn gây 1 sát thương cho họ.",
	["zhiman"] = "Chế Man",
	[":zhiman"] = "Khi bạn gây sát thương cho người khác, bạn có thể chặn sát thương này lại, thực hiện lần lượt:\n- Bạn thu lấy 1 lá trong vùng trang bị hoặc phán xét của họ;\n- Nếu họ cùng thế lực với bạn, bạn có thể lệnh họ đổi Phó tướng.",
	["#Zhiman"] = "%from đã phát động »%arg«, chặn sát thương tới %to",
	["@zhiman-ask"] = "Có thể lệnh mục tiêu đổi Phó tướng?",
	["zhiman-second"] = "Chế Man",

	-- 吴
	["#lingtong"] = "Hào Tình Liệt Đảm",
	["lingtong"] = "Lăng Thống",
	["xuanlue"] = "Toàn Lược",
	[":xuanlue"] = "Sau khi bạn mất bài trong vùng trang bị, bạn có thể bỏ 1 lá của người khác.",
	["xuanlue-invoke"] = "Có thể phát động »Toàn Lược« để bỏ 1 lá của người khác.",
	["yongjin"] = "Dũng Tiến",
	[":yongjin"] = "Hạn định kỹ: Giai đoạn ra bài, bạn có thể phát động kỹ năng này: Tối đa 3 lần, bạn có thể di chuyển 1 trang bị trên bàn chơi.",
	["@brave"] = "Dũng Tiến",
	["@yongjin-next"] = "Dũng Tiến: Di chuyển 1 trang bị trên bàn.",
	["~yongjin_next"] = "Chọn 1 người có trang bị, sau đó chọn 1 chơi để nhận trang bị rồi bấm \"Xác nhận\"",

	["lvfan"] = "Lữ Phạm",
	["#lvfan"] = "Trung Đốc Lượng Trực",
	["diaodu"] = "Điều Độ",
	["#diaodu-draw"] = "Điều Độ",
	[":diaodu"] = "• Khi 1 người cùng thế lực với bạn sử dụng trang bị, họ có thể rút 1 lá.\n• Đầu giai đoạn ra bài, bạn có thể thu lấy 1 lá trong vùng trang bị của 1 người cùng thế lực, sau đó, nếu người bị thu lấy là:\n * Bạn: Bạn giao lá đó cho 1 người khác;\n * Không phải bạn: Bạn có thể giao lá đó cho 1 người khác ngoại trừ họ.",
	["@diaodu"] = "Có thể phát động »Điều Độ« để thu lấy 1 trang bị của người cùng thế lực.",
	["@diaodu-give"] = "Điều Độ: Giao [%arg] cho 1 người khác.",
	["@diaodu-draw"] = "Có thể phát động »Điều Độ« của %src, rút 1 lá.",
	["diancai"] = "Điển Tài",
	[":diancai"] = "Khi kết thúc giai đoạn ra bài của người khác, nếu bạn đã mất ít nhất X lá trong giai đoạn này (X là số máu của bạn, tối thiểu 1), bạn có thể bổ sung bài trên tay tới giới hạn máu;\n▷ Bạn có thể đổi Phó tướng.",

	["#lord_sunquan"] = "Hổ Cư Giang Đông",
	["lord_sunquan"] = "Tôn Quyền - Quân",
	["&lord_sunquan"] = "Tôn Quyền",
	["jiahe"] = "Gia Hỏa",
	[":jiahe"] = "Quân chủ kỹ, Tỏa định kỹ: Bạn có »Duyên Giang Phong Hỏa Đồ«.\n\n»<b>Duyên Giang Phong Hỏa Đồ</b>«:\n• Một lần trong giai đoạn ra bài của mỗi người thế lực Ngô, họ có thể đặt 1 trang bị lên »Duyên Giang Phong Hỏa Đồ«, gọi là [Phong Hỏa].\n• Khi bắt đầu giai đoạn chuẩn bị của người thế lực Ngô, họ có thể nhận 1 kỹ năng tùy theo số [Phong Hỏa]:\n* 1+: »Anh Tư«;\n* 2+: »Hảo Thi«;\n* 3+: »Thiệp Liệp«;\n* 4+: »Độ Thế«;\n▷ Nếu có 5 [Phong Hỏa] trở lên, họ có thể nhận thêm 1 kỹ năng khác.\n• Tỏa định kỹ: Sau khi bạn nhận sát thương từ lá bài, đưa 1 [Phong Hỏa] vào chồng bài bỏ.",
	["lianzi"] = "Liễm Tư",
	[":lianzi"] = "Một lần trong giai đoạn ra bài, bạn có thể bỏ 1 lá trên tay, sau đó lật ra X lá trên đầu chồng bài rút (X là số [Phong Hỏa] cộng với số lá trong vùng trang bị của những người thế lực Ngô), bạn thu lấy những lá cùng loại với lá bạn bỏ;\n▷ Nếu trong 1 lần bạn thu lấy > 3 lá, bạn mất kỹ năng này và nhận kỹ năng »Chế Hành«.",
	["jubao"] = "Tư Bảo",
	[":jubao"] = "Tỏa định kỹ:\n• Người khác không thể thu lấy bảo vật trong khu trang bị của bạn.\n• Khi bắt đầu giai đoạn kết thúc, nếu trên bàn chơi hoặc chồng bài bỏ có [Định Lan Dạ Minh Châu], bạn rút 1 lá, sau đó thu lấy 1 lá của người đang trang bị [Định Lan Dạ Minh Châu].",
	["@lianzi"] = "Chọn và lấy những lá cùng loại với lá bạn bỏ",
	["lianzi#up"] = "Bài bỏ",
	["lianzi#down"] = "Thu lấy",
	["flamemap"] = "Duyên Giang Phong Hỏa Đồ",
	["flame_map"] = "Phong Hỏa",
	[":flamemap"] = "• Một lần trong giai đoạn ra bài của mỗi người thế lực Ngô, họ có thể đặt 1 trang bị lên »Duyên Giang Phong Hỏa Đồ«, gọi là [Phong Hỏa].\n• Khi bắt đầu giai đoạn chuẩn bị của người thế lực Ngô, họ có thể nhận 1 kỹ năng tùy theo số [Phong Hỏa]:\n* 1+: »Anh Tư«;\n* 2+: »Hảo Thi«;\n* 3+: »Thiệp Liệp«;\n* 4+: »Độ Thế«;\n▷ Nếu có 5 [Phong Hỏa] trở lên, họ có thể nhận thêm 1 kỹ năng khác.\n• Tỏa định kỹ: Sau khi bạn nhận sát thương từ lá bài, đưa 1 [Phong Hỏa] vào chồng bài bỏ.",
	
	["&flamemap"] = "Có thể đặt 1 trang bị lên »Duyên Giang Phong Hỏa Đồ«, trở thành [Phong Hỏa]",
	["@flamemap"] = "Duyên Giang Phong Hỏa Đồ: Chọn [Phong Hỏa] để bỏ đi.",
	["@flamemap-choose"] = "Duyên Giang Phong Hỏa Đồ: Chọn kỹ năng muốn nhận.",
	["yingzi_flamemap"] = "Anh Tư",
	["haoshi_flamemap"] = "Hảo Thi",
	["duoshi_flamemap"] = "Độ Thế",
	
	["#haoshi_flamemap-give"] = "Hảo Thi: Giao bài",
	
	["shelie"] = "Thiệp Liệp",
	[":shelie"] = "Khi bắt đầu giai đoạn rút bài, bạn có thể không rút bài, đổi thành lật ra 5 lá trên đầu chồng bài rút, thu lấy trong đó mỗi chất 1 lá.",
	["@shelie"] = "Chọn mỗi chất 1 lá và bỏ những lá còn lại",
	["shelie#up"] = "Bỏ đi",
	["shelie#down"] = "Thu lấy",

	["LuminousPearl"] = "Định Lan Dạ Minh Châu",
	[":LuminousPearl"] = "Bài Trang bị - Bảo vật\n\nKỹ năng: Tỏa định kỹ:\n* Nếu bạn đã có »Chế Hành«, không giới hạn số lá bỏ đi trong 1 lần phát động »Chế Hành«;\n* Nếu bạn không có kỹ năng »Chế Hành«, xem như bạn có »Chế Hành«.",
	["zhihenglp"] = "Chế Hành",

	["transform"] = "Đổi Phó tướng",
	["@transform-ask"] = "%arg: Có thể đổi Phó tướng",
	["GameRule:ShowGeneral"] = "Chọn 1 tướng để thay đổi.",

}
