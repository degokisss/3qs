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

	-- 魏势力
	["#caocao"] = "Ngụy Vũ Đế",
	["caocao"] = "Tào Tháo",
	["jianxiong"] = "Gian Hùng",
	[":jianxiong"] = "Sau khi bạn nhận sát thương, bạn có thể thu lấy lá gây sát thương cho bạn.",

	["#simayi"] = "Lang Cố Chi Quỷ",
	["simayi"] = "Tư Mã Ý",
	["fankui"] = "Phản Quỹ",
	[":fankui"] = "Sau khi bạn nhận sát thương, bạn có thể thu lấy 1 lá của nguồn sát thương.",
	["guicai"] = "Quỷ Tài",
	[":guicai"] = "Khi phán xét của 1 người có hiệu lực, bạn có thể đánh ra 1 lá để thay thế kết quả phán xét đó.",
	["@guicai-card"] = CommonTranslationTable["@askforretrial"],
	["~guicai"] = "Chọn 1 lá bài xong bấm \"Xác nhận\"",

	["#xiahoudun"] = "Hộ Quốc Tông Chủ",
	["xiahoudun"] = "Hạ Hầu Đôn",
	["ganglie"] = "Cương Liệt",
	[":ganglie"] = "Sau khi bạn nhận sát thương, bạn có thể tiến hành phán xét, nếu màu của kết quả phán xét có màu:\n* Đỏ: Bạn gây 1 sát thương cho nguồn sát thương;\n* Đen: bạn bỏ 1 lá của nguồn sát thương",

	["#zhangliao"] = "Tiền Tướng Quân",
	["zhangliao"] = "Trương Liêu",
	["tuxi"] = "Tập Kích",
	[":tuxi"] = "Giai đoạn rút bài, bạn có thể chọn rút bớt X lá và chọn X người khác có bài trên tay, thu lấy 1 lá trên tay của mỗi người.",
	["@tuxi-card"] = "Bạn có thể phát động »Tập Kích«",
	["~tuxi"] = "Chọn những người khác và bấm \"Xác nhận\"",

	["#xuchu"] = "Hổ Si",
	["xuchu"] = "Hứa Chử",
	["luoyi"] = "Lỏa Y",
	[":luoyi"] = "Khi kết thúc giai đoạn rút bài, bạn có thể bỏ 1 lá;\n▶ Trong lượt này, khi bạn gây sát thương cho mục tiêu của [Sát] hoặc [Quyết Đấu], sát thương này +1.",
	["#LuoyiBuff"] = "%from đã phát động »<font color=\"yellow\"><b>Loả Y</b></font>«, sát thương từ %arg tăng thành %arg2",
	["@luoyi"] = "Lỏa Y: Bạn có thể bỏ 1 lá.",

	["#guojia"] = "Tảo Chung Tiên Tri",
	["guojia"] = "Quách Gia",
	["tiandu"] = "Thiên Khiển",
	[":tiandu"] = "Sau khi phán xét của bạn có hiệu lực, bạn có thể thu lấy kết quả phán xét.",
	["yiji"] = "Di Kế",
	[":yiji"] = "Sau khi bạn nhận sát thương, bạn có thể xem 2 lá bài trên đầu chồng bài rút và giao cho tùy ý người.",
	["#yiji"] = "Di Kế",
	["@yiji-give"] = "Di Kế: Giao những lá này cho người khác hoặc bấm Hủy bỏ để giữ lại.",

	["#zhenji"] = "Bạc Hạnh Đích Mỹ Nhân",
	["zhenji"] = "Chân Cơ",
	["luoshen"] = "Lạc Thần",
	[":luoshen"] = "Khi bắt đầu giai đoạn chuẩn bị, bạn có thể phát động kỹ năng này, thực hiện lần lượt:\n- Bạn tiến hành phán Xét, nếu kết quả phán xét có màu Đen, bạn có thể lặp lại quá trình này;\n- Bạn thu lấy tất cả kết quả phán xét có màu Đen.",
	["#luoshen-move"] = "Lạc Thần (Chuyển lá này vào vùng Kết quả phán xét)",
	["qingguo"] = "Khuynh Quốc",
	[":qingguo"] = "Bạn có thể chuyển hóa sử dụng/đánh ra lá Đen trên tay thành [Thiểm].",

	["#xiahouyuan"] = "Tật Hành Đích Liệp Báo",
	["xiahouyuan"] = "Hạ Hầu Uyên",
	["shensu"] = "Thần Tốc",
	[":shensu"] = "Nếu bạn thỏa mãn điều kiện sử dụng [Sát] (bỏ qua giới hạn khoảng cách), khi bạn tiến vào giai đoạn:\n* Phán xét: Bạn có thể bỏ qua giai đoạn này và giai đoạn rút bài;\n* Ra bài: Bạn có thể bỏ qua giai đoạn này và bỏ 1 lá trang bị;\n* Bỏ bài: Bạn có thể bỏ qua giai đoạn này và mất 1 máu;\n▷ Bạn xem như sử dụng [Sát] không giới hạn khoảng cách.",
	["@shensu1"] = "Bạn có thể bỏ qua giai đoạn phán xét và rút bài để phát động »Thần Tốc«",
	["@shensu2"] = "Bạn có thể bỏ qua giai đoạn ra bài và bỏ 1 trang bị để phát động »Thần Tốc«",
	["@shensu3"] = "Bạn có thể bỏ qua giai đoạn bỏ bài và mất 1 máu để phát động »Thần Tốc«",

	["#zhanghe"] = "Liệu Địch Cơ Tiên",
	["zhanghe"] = "Trương Cáp",
	["qiaobian"] = "Xảo Biến",
	[":qiaobian"] = "Khi tiến vào 1 giai đoạn trong lượt của bạn (Ngoại trừ giai đoạn chuẩn bị và kết thúc), bạn có thể bỏ 1 lá bài trên tay để bỏ qua giai đoạn này; sau đó nếu giai đoạn đã bỏ qua là:\n* Rút bài: Bạn có thể chọn tối đa 2 người có bài trên tay, bạn thu lấy 1 lá trên tay mỗi người;\n* Ra bài: Bạn có thể di chuyển 1 lá trên bàn chơi.",
	["@qiaobian-2"] = "Bạn có thể lấy 1 lá bài từ 1 đến 2 người khác nhau.",
	["@qiaobian-3"] = "Bạn có thể chuyển 1 lá bài trên bàn đến khu tương ứng của một người chơi khác",
	["#qiaobian"] = "Bạn có thể bỏ 1 lá bài trên tay để bỏ qua <font color='yellow'><b> %arg </b></font>",
	["~qiaobian2"] = "Chọn 1 đến 2 người chơi rồi bấm \"Xác nhận\"",
	["~qiaobian3"] = "Chọn một người chơi rồi bấm \"Xác nhận\"",
	["@qiaobian-to"] = "Hãy chọn người chơi để chuyển [%arg] đến.",
    ["qiaobian_draw"] = "Xảo Biến",
    ["qiaobian_play"] = "Xảo Biến",

	["#xuhuang"] = "Châu Á Phu Chi Phong",
	["xuhuang"] = "Từ Hoảng",
	["duanliang"] = "Đoạn Lương",
	[":duanliang"] = "Bạn có thể chuyển hóa sử dụng lá Đen không phải Công cụ thành [Binh Lương Thốn Đoạn] không giới hạn khoảng cách;\n▷ Nếu khoảng cách giữa bạn và mục tiêu > 2, bạn không thể phát động kỹ năng này trong giai đoạn này.",

	["#caoren"] = "Đại Tướng Quân",
	["caoren"] = "Tào Nhân",
	["jushou"] = "Chiếm Thủ",
	[":jushou"] = "Khi bắt đầu giai đoạn kết thúc, bạn có thể rút X lá (X là số thế lực còn sống), thực hiện lần lượt:\n- Bạn sử dụng 1 trang bị trên tay hoặc bỏ 1 lá phi trang bị;\n- Nếu bạn rút > 2 lá, bạn thay đổi trạng thái chồng tướng.",

	["@jushou"] = "Chiếm Thủ: Sử dụng 1 trang bị hoặc bỏ 1 lá không phải trang bị",
	
	["#dianwei"] = "Cổ Chi Ác Lai",
	["dianwei"] = "Điển Vi",
	["qiangxi"] = "Cường Kích",
	[":qiangxi"] = "Một lần trong giai đoạn ra bài, bạn có thể chọn 1 người khác, bạn chọn bỏ 1 Vũ khí hoặc mất 1 máu, bạn gây 1 sát thương cho họ.",

	["#xunyu"] = "Vương Tá Chi Tài",
	["xunyu"] = "Tuân Úc",
	["quhu"] = "Vờn Hổ",
	[":quhu"] = "Một lần trong giai đoạn ra bài, bạn có thể tiến hành đấu điểm với 1 người có số máu > bạn:\n* Nếu bạn thắng: Họ gây 1 sát thương cho 1 người trong tầm đánh của họ do bạn chỉ định;\n* Nếu bạn không thắng: Họ gây 1 sát thương cho bạn.",
	["@quhu-damage"] = "Hãy chọn 1 người trong tầm đánh của %src",
	["jieming"] = "Tiết Mệnh",
	[":jieming"] = "Sau khi bạn nhận sát thương, bạn có thể chọn 1 người, lệnh họ bổ sung bài trên tay đến giới hạn máu (Tối đa 5).",
	["jieming-invoke"] = "Bạn có thể phát động »Tiết Mệnh«. <br/>Chọn một người và bấm \"Xác nhận\"<br/>",
	["#QuhuNoWolf"] = "%from đã phát động »<font color=\"yellow\"><b>Vờn Hổ</b></font>« đấu điểm thắng, gây sát thương cho 1 người khác trong tầm đánh của %to",

	["#caopi"] = "Kế Thừa Bá Nghiệp",
	["caopi"] = "Tào Phi",
	["xingshang"] = "Hành Thương",
	[":xingshang"] = "Khi 1 người khác trận vong, bạn có thể thu lấy tất cả bài của họ.",
	["fangzhu"] = "Lưu Đày",
	[":fangzhu"] = "Sau khi bạn nhận sát thương, bạn có thể lệnh 1 người khác lựa chọn 1 mục:\n1. Họ rút X lá, sau đó thay đổi trạng thái chồng tướng;\n2. Họ bỏ X lá, sau đó mất 1 máu;\n(X là số máu đã mất của bạn).",
	["fangzhu-invoke"] = "Có thể phát động »Lưu Đày«. <br/>Chọn một người rồi bấm \"Xác nhận\"",
	["@fangzhu-discard"] = "Lưu Đày: Chọn %arg lá để bỏ và mất 1 máu, hoặc bấm »Hủy bỏ« để rút %arg lá và đặt chồng tướng.",

	["#yuejin"] = "Kiên Cường Đột Phá",
	["yuejin"] = "Nhạc Tiến",
	["xiaoguo"] = "Dũng Mãnh",
	[":xiaoguo"] = "Khi bắt đầu giai đoạn kết thúc của 1 người khác, bạn có thể bỏ 1 lá cơ bản, lệnh họ chọn 1 mục:\n1. Họ bỏ 1 trang bị và lệnh bạn rút 1 lá;\n2. Bạn gây 1 sát thương cho họ.",
	["@xiaoguo"] = "Có thể bỏ 1 lá cơ bản để phát động »Dũng Mãnh«",
	["@xiaoguo-discard"] = "Dũng Mãnh: Bỏ 1 trang bị, hoặc nhận 1 sát thương.",	
	

}

