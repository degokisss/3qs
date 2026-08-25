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
	-- 吴势力
	["#sunquan"] = "Niên Khinh Hiền Quân",
	["sunquan"] = "Tôn Quyền",
	["zhiheng"] = "Chế Hành",
	[":zhiheng"] = "Một lần trong giai đoạn ra bài, bạn có thể bỏ tối đa X lá (X là giới hạn máu của bạn), bạn rút số lá tương ứng.",

	["#ganning"] = "Cẩm Phàm Du Hiệp",
	["ganning"] = "Cam Ninh",
	["qixi"] = "Kỳ Tập",
	[":qixi"] = "Giai đoạn ra bài, bạn có thể chuyển hóa sử dụng lá Đen thành [Quá Hạ Sách Kiều].",

	["#lvmeng"] = "Bạch Y Độ Giang",
	["lvmeng"] = "Lữ Mông",
	["keji"] = "Khắc Kỷ",
	[":keji"] = "Tỏa định kỹ: Khi bắt đầu giai đoạn bỏ bài, nếu bạn trong giai đoạn ra bài không sử dụng các lá bài khác màu với nhau, giới hạn trữ bài của bạn trong lượt này +4.",
	["mouduan"] = "Mưu Đoạn",
	[":mouduan"] = "Khi bắt đầu giai đoạn kết thúc, nếu trong giai đoạn ra bài của lượt này bạn đã sử dụng bài từ 4 chất khác nhau hoặc 3 loại bài khác nhau, bạn có thể di chuyển 1 lá trên bàn chơi.",
	["@mouduan-move"] = "Mưu Đoạn: có thể di chuyển 1 lá trên bàn.",

	["#huanggai"] = "Khinh Thân Vi Quốc",
	["huanggai"] = "Hoàng Cái",
	["kurou"] = "Khổ Nhục",
	[":kurou"] = "Một lần trong giai đoạn ra bài, bạn có thể bỏ 1 lá, thực hiện lần lượt:\n- Bạn mất 1 máu;\n- Bạn rút 3 lá;\n- Giới hạn sử dụng [Sát] của bạn trong giai đoạn này +1.",

	["#zhouyu"] = "Đại Đô Đốc",
	["zhouyu"] = "Chu Du",
	["yingzi_zhouyu"] = "Anh Tư",
	[":yingzi"] = "Tỏa định kỹ:\n• Giai đoạn rút bài, bạn rút thêm 1 lá.\n• Giới hạn trữ bài của bạn bằng với giới hạn máu.",
	["fanjian"] = "Phản Gián",
	[":fanjian"] = "Một lần trong giai đoạn ra bài, bạn có thể mở ra 1 lá bài trên tay và giao cho 1 người khác, bạn lệnh cho họ lựa chọn 1 mục:\n1. Nếu họ có bài trên tay hoặc có lá cùng chất với lá bạn đã mở trong vùng trang bị, họ mở ra tất cả bài trên tay và bỏ đi tất cả lá của họ có cùng chất với lá bạn đã mở ra;\n2. Họ mất 1 máu.",
	["fanjian_show:prompt"] = "Phản Gián: Bấm \"Xác nhận\" để mở bài trên tay và bỏ toàn bộ lá %arg; Bấm »Hủy bỏ« để mất 1 máu.",
	
	["#daqiao"] = "Căng Trì Chi Hoa",
	["daqiao"] = "Đại Kiều",
	["guose"] = "Quốc Sắc",
	[":guose"] = "Giai đoạn ra bài, bạn có thể chuyển hóa sử dụng lá RÔ thành [Lạc Bất Tư Thục]",
	["liuli"] = "Lưu Ly",
	[":liuli"] = "Khi bạn trở thành mục tiêu của [Sát], bạn có thể bỏ đi 1 lá, thay đổi mục tiêu của [Sát] này thành người khác trong tầm đánh của bạn (Không thể là người sử dụng [Sát] và người đã là mục tiêu của [Sát] này).",
	["~liuli"] = "Chọn 1 lá, chọn người khác rồi bấm \"Xác nhận\"",
	["@liuli"] = "%src đã sử dụng [Sát] lên bạn, có thể bỏ 1 lá để phát động »Lưu Ly«",

	["#luxun"] = "Kình Thiên Chi Trụ",
	["luxun"] = "Lục Tốn",
	["qianxun"] = "Khiêm Tốn",
	["qianxun-cancel"] = "Khiêm Tốn",
	[":qianxun"] = "Tỏa định kỹ:\n• Khi bạn trở thành mục tiêu của [Thuận Thủ Khiên Dương], hủy bỏ mục tiêu đối với bạn.\n• Khi [Lạc Bất Tư Thục] tiến vào vùng phán xét của bạn, đưa lá đó vào chồng bài bỏ.",
	["duoshi"] = "Độ Thế",
	[":duoshi"] = "Bốn lần trong giai đoạn ra bài, bạn có thể chuyển hóa sử dụng bài Đỏ trên tay thành [Dĩ Dật Đãi Lao].",

	["#sunshangxiang"] = "Cung Yêu Cơ",
	["sunshangxiang"] = "Tôn Thượng Hương",
	["jieyin"] = "Kết Nhân",
	[":jieyin"] = "Một lần trong giai đoạn ra bài, bạn có thể bỏ 2 lá trên tay và chọn 1 người có giới tính nam đang bị thương, bạn và họ hồi 1 máu.",
	["xiaoji"] = "Kiêu Cơ",
	["xiaojidraw"] = "Kiêu Cơ: Rút bài.",
	[":xiaoji"] = "Sau khi bạn mất bài trong vùng trang bị, bạn có thể:\n* Nếu đang là lượt của bạn, bạn rút 1 lá;\n* Nếu không phải lượt của bạn, bạn rút 3 lá.",

	["#sunjian"] = "Vũ Liệt Đế",
	["sunjian"] = "Tôn Kiên",
	["yinghun_sunjian"] = "Anh Hồn",
	[":yinghun"] = "Khi bắt đầu giai đoạn chuẩn bị, bạn có thể chọn 1 người khác và chọn 1 mục:\n1. Lệnh họ rút X lá sau đó bỏ 1 lá;\n2. Lệnh họ rút 1 lá sau đó bỏ X lá (X là số máu bạn đã mất).",
	["#yinghun_sunjian"] = "Phát động »Anh Hồn« lên %to",
	["yinghun-invoke"] = "Có thể phát động »Anh Hồn«<br/>Chọn 1 người rồi bấm \"Xác nhận\"<br/>",
	["yinghun_sunjian:d1tx"] = "Rút 1 lá rồi bỏ X lá",
	["yinghun_sunjian:dxt1"] = "Rút X lá rồi bỏ 1 lá",

	["#xiaoqiao"] = "Kiều Tình Chi Hoa",
	["xiaoqiao"] = "Tiểu Kiều",
	["hongyan"] = "Hồng Nhan",
	[":hongyan"] = "Toả định kỹ:\n• Lá BÍCH của bạn và kết quả phán xét BÍCH của bạn xem như CƠ;\n• Nếu bạn có lá CƠ trong vùng trang bị, giới hạn trữ bài của bạn +1",
	["tianxiang"] = "Thiên Hương",
	[":tianxiang"] = "Hai lần trong lượt của mỗi người, khi bạn nhận sát thương, bạn có thể bỏ 1 lá CƠ trên tay và lựa chọn 1 người khác, bạn chặn sát thương này, sau đó bạn chọn 1 mục mà chưa chọn trong lượt này:\n1. Nếu sát thương này có nguồn, bạn lệnh nguồn sát thương gây 1 sát thương cho họ, sau đó họ rút X lá (X là số máu họ đã mất, tối đa 5);\n2. Lệnh họ mất 1 máu, sau đó họ thu lấy lá bạn vừa bỏ.",
	
	["@tianxiang-card"] = "Có thể bỏ 1 lá CƠ để phát động »Thiên Hương »",
	["@tianxiang-choose"] = "Thiên Hương: Chọn cho %dest nhận 1 sát thương và rút bài hoặc cho %dest mất 1 máu và thu lấy [%arg]",
	["tianxiang:damage"] = "Nhận sát thương",
	["tianxiang:losehp"] = "Mất máu",

	["#taishici"] = "Đốc Liệt Chi Sĩ",
	["taishici"] = "Thái Sử Từ",
	["tianyi"] = "Thiên Nghĩa",
	[":tianyi"] = "Một lần trong giai đoạn ra bài, bạn có thể đấu điểm với 1 người:\n* Nếu bạn thắng: Trong lượt này, bạn sử dụng [Sát] không giới hạn khoảng cách; giới hạn sử dụng [Sát] và số mục tiêu của [Sát] +1;\n* Nếu bạn không thắng: Bạn không thể sử dụng [Sát] trong lượt này.",

	["#zhoutai"] = "Lịch Chiến Chi Khu",
	["zhoutai"] = "Chu Thái",
	["buqu"] = "Bất Khuất",
	[":buqu"] = "Tỏa định kỹ: Khi bạn trong trạng thái hấp hối, bạn mở 1 lá trên đầu chồng bài rút và đặt lên tướng này, gọi là [Sang], nếu [Sang] mới đặt so với những [Sang] khác:\n* Khác điểm: Bạn hồi máu đến 1;\n* Cùng điểm: Bạn đưa [Sang] này vào chồng bài bỏ.",
	["scars"] = "Sang",
	["#BuquDuplicate"] = "%from thất bại khi dùng »<font color=\"yellow\"><b>Bất Khuất</b></font>«. Có lá [Sang] trùng trong %arg",
	["#BuquDuplicateGroup"] = "Số trùng của %arg là %arg2",
	["$BuquDuplicateItem"] = "Lá [Sang] bị trùng: %card",
	["$BuquRemove"] = "%from loại bỏ lá [Sang]: %card",
	["fenji"] = "Phấn Kích",
	[":fenji"] = "Khi bắt đầu giai đoạn kết thúc của 1 người, nếu họ không có bài trên tay, bạn có thể lệnh cho họ rút 2 lá, sau đó bạn mất 1 máu.",

	["#lusu"] = "Độc Đoạn Đích Ngoại Giao Gia",
	["lusu"] = "Lỗ Túc",
	["haoshi"] = "Hảo Thi",
	[":haoshi"] = "Giai đoạn rút bài, bạn có thể rút thêm 2 lá;\n▶ Sau khi bạn rút bài, nếu số bài trên tay bạn > 5, bạn giao một nửa bài trên tay (làm tròn xuống) cho 1 người khác có số bài trên tay ít nhất.",
	["#haoshi-give"] = "Hảo Thi: Giao bài",
	["@haoshi-give"] = "Hảo Thi: Chọn %arg lá trên tay và giao cho 1 người có ít bài nhất.",
	["dimeng"] = "Kết Minh",
	[":dimeng"] = "Một lần trong giai đoạn ra bài, bạn có thể chọn 2 người khác và bỏ đi X lá (X là số bài chênh lệch trên tay giữa 2 người), lệnh họ hoán đổi bài trên tay.",
	["#Dimeng"] = "%from (tay %arg lá) và %to (tay %arg2 lá) đã đổi bài cho nhau",

	["#erzhang"] = "Kinh Thiên Vĩ Địa",
	["erzhang"] = "Trương Chiêu & Trương Hoành",
	["&erzhang"] = "Trương Chiêu Trương Hoành",
	["zhijian"] = "Trực Gián",
	[":zhijian"] = "Giai đoạn ra bài, bạn có thể đặt 1 trang bị trên tay vào vùng trang bị trống tương ứng của người khác, sau đó bạn rút 1 lá.",
	["guzheng"] = "Cổ Chính",
	[":guzheng"] = "Khi kết thúc giai đoạn bỏ bài của người khác, bạn có thể giao cho họ 1 lá trong những lá đã bỏ đi trong giai đoạn này;\n▷ Bạn có thể thu lấy những lá còn lại.",
	["$ZhijianEquip"] = "%from được trang bị %card",
	["@guzheng"] = "Có thể phát động »Cổ Chính« để khiến %src lấy lại 1 lá trong chỗ bài bỏ." ,
	["@guzheng-obtain"] = "Cổ chính: Có thể lấy những lá bỏ còn lại.",
	["#guzheng"] = "Cổ Chính",
	["#guzhengOther"] = "Cổ Chính",

	["#dingfeng"] = "Thanh Trắc Trọng Thần",
	["dingfeng"] = "Đinh Phụng",
	["duanbing"] = "Đoản Binh",
	[":duanbing"] = "Sau khi bạn chỉ định mục tiêu cho [Sát], bạn có thể chỉ định thêm 1 mục tiêu ở khoảng cách 1.",
	["duanbing-invoke"] = "«Đoản Binh«: Có thể chọn 1 người trong tầm 1 để trở thành mục tiêu của [Sát]",
	["fenxun"] = "Phấn Tấn",
	[":fenxun"] = "Một lần trong giai đoạn ra bài, bạn có thể bỏ 1 lá và lựa chọn 1 người khác, khoảng cách từ bạn đến họ là 1 trong lượt này.",


}

