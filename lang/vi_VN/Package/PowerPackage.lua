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
	["power"] = "Quyền",
	["power_equip"] = "Quyền",

	["cuiyanmaojie"] = "Thôi Diễm & Mao Giới",
	["&cuiyanmaojie"] = "Thôi Diễm Mao Giới",
	["#cuiyanmaojie"] = "Nhật Xuất Nguyệt Thịnh",
	["zhengbi"] = "Chinh Tịch",
	[":zhengbi"] = "Khi bắt đầu giai đoạn ra bài, bạn có thể chọn 1 mục:\n1. Chọn 1 người khác không có thế lực, bạn sử dụng bài với họ không giới hạn khoảng cách và số lần đến sau khi kết thúc lượt này hoặc sau khi họ lật tướng;\n2. Chọn 1 người khác đã có thế lực, bạn giao cho họ 1 lá cơ bản, lệnh họ giao cho bạn 2 lá cơ bản hoặc 1 lá phi cơ bản.",
	["@zhengbi"] = "Phát động »Chinh Tịch«",
	["@zhengbi-give"] = "Chinh Tịch: Hãy chọn 2 lá cơ bản hoặc 1 lá phi cơ bản để giao cho %src",
	["fengying"] = "Phụng Nghênh",
	[":fengying"] = "Hạn định kỹ: Bạn có thể chuyển hóa sử dụng tất cả bài trên tay thành [Hiệp Thiên Tử Dĩ Lệnh Chư Hầu] (Bỏ qua yêu cầu Đại thế lực);\n▶ Khi bạn sử dụng [Hiệp Thiên Tử Dĩ Lệnh Chư Hầu] này, bạn lệnh tất cả người cùng thế lực với bổ sung bài trên tay đến giới hạn máu.",
	["#fengying-after"] = "Phụng Nghênh (Rút bài)",
	
	["yujin"] = "Vu Cấm",
	["#yujin"] = "Thảo Bạo Kiên Lũy",
	["jieyue"] = "Tiết Viện",
	[":jieyue"] = "Khi bắt đầu giai đoạn chuẩn bị, bạn có thể giao 1 lá trên tay cho 1 người không phải thế lực Ngụy, sau đó yêu cầu họ chấp hành 1 [Quân Lệnh]:\n* Nếu họ chấp hành, bạn rút 1 lá;\n* Nếu không, giai đoạn rút bài lượt này, bạn rút thêm 3 lá.",
	["@jieyue"] = "Phát động »Tiết Việt«: Giao 1 lá cho 1 người không phải Ngụy",

	["wangping"] = "Vương Bình",
	["#wangping"] = "Kiện Bế Kiếm Môn",
	["jianglve"] = "Tướng Lược",
	[":jianglve"] = "Hạn định kỹ: Giai đoạn ra bài, bạn có thể phát động kỹ năng này, thực hiện lần lượt:\n- Bạn chọn 1 [Quân Lệnh], yêu cầu tất cả người khác có cùng thế lực với bạn chấp hành [Quân Lệnh] này;\n- Bạn và những người đã chọn chấp hành [Quân Lệnh] tăng 1 giới hạn máu, hồi 1 máu;\n- Bạn rút X lá (X là số người đã hồi máu từ kỹ năng này).",

	["fazheng"] = "Pháp Chính",
	["#fazheng"] = "Thục Hán Đích Phụ Dực",
	["enyuan"] = "Ân Oán",
	[":enyuan"] = "Tỏa định kỹ:\n• Sau khi bạn trở thành mục tiêu của [Đào] do người chơi khác sử dụng, họ rút 1 lá.\n• Sau khi bạn nhận sát thương, nguồn gây sát thương chọn giao 1 lá trên tay cho bạn hoặc mất 1 máu.",
	["@enyuan-give"] = "Ân Oán: Chọn 1 lá trên tay và giao cho %src hoặc bấm Hủy bỏ để mất 1 máu.",
	["xuanhuo"] = "Huyễn Hoặc",
	[":xuanhuo"] = "Một lần trong giai đoạn ra bài của người khác có cùng thế lực với bạn, họ có thể giao cho bạn 1 lá trên tay, sau đó họ có thể bỏ 1 lá và lựa chọn nhận 1 trong các kỹ năng sau mà chưa có trên bàn cho đến hết lượt hoặc tướng có kỹ năng tương ứng được mở: »Võ Thánh«, »Bào Hao«, »Long Đảm«, »Thiết Kỵ«, »Liệt Cung«, »Cuồng Cốt«.",
	["@xuanhuo-choose"] = "Huyễn Hoặc: Chọn 1 kỹ năng để sở hữu.",
	["@xuanhuo-discard"] = "Huyễn Hoặc: Chọn 1 lá bài để bỏ.",
	["xuanhuoattach"] = "Huyễn Hoặc",
	["&xuanhuoattach"] = "Bạn có thể giao cho Pháp Chính 1 lá trên tay, sau đó có thể bỏ 1 lá và nhận 1 trong các kỹ năng sau mà bạn chưa có cho đến hết lượt: »Võ Thánh«, »Bào Hao«, »Long Đảm«, »Thiết Kỵ«, »Liệt Cung«, »Cuồng Cốt«.",

	["wusheng_xh"] = "Võ Thánh",
	["paoxiao_xh"] = "Bào Hao",
	["longdan_xh"] = "Long Đảm",
	["tieqi_xh"] = "Thiết Kỵ",
	["liegong_xh"] = "Liệt Cung",
	["kuanggu_xh"] = "Cuồng Cốt",
	["@liegong_xh-choice"] = "Liệt Cung: Lựa chọn hiệu quả cho %dest",
    ["liegong_xh:nojink"] = "Không thể sử dụng [Thiểm]",
    ["liegong_xh:adddamage"] = "Sát thương +1",
	["kuanggu_xh:draw"] = "Rút 1 lá",
	["kuanggu_xh:recover"] = "Hồi 1 máu",

	["wuguotai"] = "Ngô Quốc Thái",
	["#wuguotai"] = "Vũ Liệt Hoàng Hậu",
	["ganlu"] = "Cam Lộ",
	[":ganlu"] = "Một lần trong giai đoạn ra bài, bạn có thể chọn 2 người có số bài trong vùng trang bị không cùng bằng 0 và số chênh lệch ≤ số máu bạn đã mất, hoán đổi bài trong vùng trang bị của 2 người này.",
	["#GanluSwap"] = "%from và %to trao đổi bài trong vùng trang bị.",
	["buyi"] = "Bổ Ích",
	[":buyi"] = "Một lần trong lượt của mỗi người, sau khi người cùng thế lực với bạn thoát khỏi trạng thái hấp hối, bạn có thể yêu cầu nguồn sát thương chấp hành 1 [Quân Lệnh], nếu họ không chấp hành, người vừa thoát khỏi trạng thái hấp hối hồi 1 máu.",

	["lukang"] = "Lục Kháng",
	["#lukang"] = "Cô Trú Phù Hạ",
	["keshou"] = "Khắc Thủ",
	[":keshou"] = "Khi bạn tính toán sát thương phải nhận, bạn có thể bỏ 2 lá có cùng màu, lệnh sát thương này -1;\n▷ Nếu không có người khác có cùng thế lực với bạn, bạn tiến hành phán xét, nếu kết quả phán xét có màu Đỏ, bạn rút 1 lá.",
	["zhuwei"] = "Trác Vi",
	[":zhuwei"] = "Sau khi phán xét của bạn có hiệu lực, nếu kết quả là 1 lá có khả năng gây sát thương cho mục tiêu, bạn có thể thu lấy lá đó;\n▷ Bạn có thể lệnh cho người đang có lượt +1 giới hạn sử dụng [Sát] và +1 giới hạn trữ bài.",
	["@keshou"] = "Có thể phát động »Khắc Thủ«, chọn 2 lá cùng màu.",
	["@zhuwei-choose"] = "Trác Vi: Có thể lệnh cho %src giới hạn sử dụng [Sát] và giới hạn trữ bài +1.",
	["#ZhuweiBuff"] = "%from đã lệnh %to giới hạn sử dụng [Sát] và giới hạn trữ bài +1.",

	["yuanshu"] = "Viên Thuật",
	["#yuanshu"] = "Trọng Gia Đế",
	["weidi"] = "Ngụy Đế",
	[":weidi"] = "Một lần trong giai đoạn ra bài, bạn có thể chọn 1 người khác đã nhận bài từ chồng bài rút trong lượt này, yêu cầu họ chấp hành 1 [Quân Lệnh], nếu họ không chấp hành, bạn thu lấy toàn bộ bài trên tay họ, sau đó giao cho họ lượng bài tương đương.",
	["@weidi-return"] = "Ngụy Đê: Chọn %arg lá bài để giao cho %src",
	["yongsi"] = "Dong Tứ",
	[":yongsi"] = "Tỏa định kỹ:\n• Nếu không có [Ngọc Tỷ] trong vùng trang bị của tất cả mọi người, bạn xem như có [Ngọc Tỷ].\n• Sau khi bạn trở thành mục tiêu của lá [Tri Bỉ Tri Kỷ], bạn mở ra tất cả bài trên tay.",

	["zhangxiu"] = "Trương Tú",
	["#zhangxiu"] = "Bắc Địa Thương Vương",
	["fudi"] = "Phụ Địch",
	[":fudi"] = "Sau khi bạn nhận sát thương, bạn có thể giao cho nguồn sát thương 1 lá bài trên tay;\n▷ Bạn gây 1 sát thương cho 1 người cùng thế lực với nguồn sát thương mà có số máu nhiều nhất trong thế lực đó và ≥ bạn.",
	["congjian"] = "Tòng Gián",
	[":congjian"] = "Tỏa định kỹ: Khi bạn gây sát thương ngoài lượt hoặc khi bạn tính toán sát thương phải nhận trong lượt, sát thương này +1.",
	["@fudi-give"] = "Phát động »Phụ Địch«, đưa 1 lá cho nguồn sát thương (%src)",
	["@fudi-damage"] = "Phụ Địch: Chọn người nhận sát thương.",

	["#lord_caocao"] = "Phụng Vũ Cửu Tiêu",
	["lord_caocao"] = "Tào Tháo - Quân",
	["&lord_caocao"] = "Tào Tháo" ,
	["jianan"] = "Kiến Anh",
	[":jianan"] = "Quân chủ kỹ, Tỏa định kỹ: Bạn có »Ngũ Tử Lương Tướng Đạo«.\n\n»<b>Ngũ Tử Lương Tướng Đạo</b>«: Khi bắt đầu giai đoạn chuẩn bị của người thế lực Ngụy, họ có thể bỏ 1 lá, thực hiện lần lượt:\n- Nếu họ đã mở 2 tướng, chọn úp 1 tướng;\n- Họ chọn 1 tướng chưa mở của họ, họ không thể mở tướng đã chọn đến khi bắt đầu lượt tiếp theo của họ;\n- Họ lựa chọn 1 trong các kỹ năng sau mà chưa có trên bàn: »Đột Kích«, »Kiêu Quả«, »Xảo Biến«, »Tiết Việt«, »Đoạn Lương«, họ nhận kỹ năng đó đến khi bắt đầu lượt tiếp theo của họ.",
	["elitegeneralflag"] = "Ngũ Tử Lương Tướng Đạo",
	[":elitegeneralflag"] = "Khi bắt đầu giai đoạn chuẩn bị của người thế lực Ngụy, họ có thể bỏ 1 lá và chọn 1 tướng chưa mở của họ (nếu họ đã mở 2 tướng thì chọn úp 1 tướng);\n▷ Họ lựa chọn 1 trong các kỹ năng sau mà chưa có trên bàn: »Đột Kích«, »Kiêu Quả«, »Xảo Biến«, »Tiết Việt«, »Đoạn Lương«, họ nhận kỹ năng đó và không thể mở tướng đã chọn đến khi bắt đầu lượt tiếp theo của họ.",
	["@elitegeneralflag"] = "Có thể phát động »Ngũ Tử Lương Tướng Đạo«, bỏ 1 lá.",
	["@jianan-hide"] = "Ngũ Tử Lương Tướng Đạo: Chọn 1 tướng để úp xuống.",
	["jianan_hide:head"] = "Úp Chủ Tướng",
	["jianan_hide:deputy"] = "Úp Phó Tướng",
	["@jianan-skill"] = "Ngũ Tử Lương Tướng Đạo: Chọn kỹ năng để nhận.",
	["huibian"] = "Huy Tiên",
	[":huibian"] = "Một lần trong giai đoạn ra bài, bạn có thể chọn 1 người thế lực Ngụy và 1 người thế lực Ngụy khác đang bị thương, thực hiện lần lượt:\n- Bạn gây 1 sát thương cho người đầu tiên và họ rút 2 lá;\n- Lệnh người còn lại hồi 1 máu.",
	["zongyu"] = "Tổng Ngự",
	[":zongyu"] = "• Khi [Lục Long Tham Giá] tiến vào vùng trang bị của người khác, nếu có Ngựa trong vùng trang bị của bạn, bạn có thể hoán đổi tất cả Ngựa trong vùng trang bị của bạn với [Lục Long Tham Giá].\n• Khi bạn sử dụng 1 lá Ngựa, nếu trên bàn hoặc chồng bài bỏ có [Lục Long Tham Giá], bạn có thể đem [Lục Long Tham Giá] đặt vào vùng trang bị của bạn.",
	["#ZongyuSwap"] = "%from và %to đã hoán đổi Ngựa trong vùng trang bị.",

	["SixDragons"] = "Lục Long Tham Giá",
	[":SixDragons"] = "Bài Trang Bị - Ngựa đặc biệt\n\nKỹ năng: Tỏa định kỹ:\n• Khoảng cách từ bạn đến người khác -1.\n• Khoảng cách từ người khác đến bạn +1.\n• Sau khi [Lục Long Tham Giá] tiến vào vùng trang bị của bạn, bạn bỏ đi tất cả Ngựa khác.\n• Lá Ngựa khác không thể tiến vào vùng trang bị của bạn.\n",
	["horse"] = "Ngựa đặc biệt",

	["tuxi_egf"] = "Đột Tập",
	["qiaobian_egf"] = "Xảo Biến",
	["xiaoguo_egf"] = "Kiêu Quả",
	["jieyue_egf"] = "Tiết Việt",
	["duanliang_egf"] = "Đoạn Lương",

	["command"] = "Quân lệnh",

	["@startcommand"] = "%arg: Hãy lựa chọn quân lệnh: <br>%arg2;<br>%arg3",
	["@startcommandto"] = "%arg: Lựa chọn quân lệnh cho %dest<br>%arg2;<br>%arg3",
	
	["#command1"] = "Gây 1 sát thương cho 1 người do bạn chọn",
	["#command2"] = "Rút 1 lá, giao cho bạn 2 lá",
	["#command3"] = "Mất 1 máu",
	["#command4"] = "Lượt này, không thể sử dụng/đánh ra bài, vô hiệu kỹ năng trừ Tỏa định kỹ",
	["#command5"] = "Chồng tướng, không thể hồi máu lượt này",
	["#command6"] = "Chọn 1 lá trên tay, 1 trang bị, bỏ những lá còn lại",

	["command1"] = "Gây sát thương",
	["command2"] = "Rút 1, đưa 2",
	["command3"] = "Mất máu",
	["command4"] = "Khóa bài, kỹ năng",
	["command5"] = "Chồng tướng, cấm hồi máu",
	["command6"] = "Giữ 1 trên tay, 1 trang bị",

	["#CommandChoice"] = "%from đã lựa chọn %arg",
	
	["#commandselect_yes"] = "Thực hiện Quân lệnh",
	["#commandselect_no"] = "Không thực hiện quân lệnh",
	
	["#CommandDamage"] = "%from đa lựa chọn gây sát thương cho %to",

	["@command-damage"] = "Quân lệnh: Lựa chọn người nhận sát thương",
	["@command-give"] = "Quân lệnh: Lựa chọn 2 lá và giao cho %src",
	["@command-select"] = "Quân lệnh: Lựa chọn 1 lá trên tay và 1 lá trong vùng trang bị để giữ lại.",
	
	["@docommand"] = "%arg: Lựa chọn chấp hành quân lệnh từ %src<br>%arg2",
	["@docommand1"] = "%arg: Lựa chọn chấp hành quân lệnh từ %src<br>Gây 1 sát thương cho người do %src lựa chọn",
	["@docommand2"] = "%arg: Lựa chọn chấp hành quân lệnh từ %src<br>Rút 1 lá, sau đó giao cho %src 2 lá",
	["yes"] = "Có",
	["no"] = "Không",


}
