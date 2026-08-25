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
	
	["lord_ex"] = "Bất Thần",
	["lord_ex_card"] = "Bất Thần",
	
	
	["#mengda"] = "Đãi Quân Phản Phúc",
	["mengda"] = "Mạnh Đạt",
	["qiuan"] = "Cầu An",
	[":qiuan"] = "Khi bạn nhận sát thương, nếu bạn không có [Hàm], bạn có thể đem lá gây sát thương cho bạn đặt lên tướng này, gọi là [Hàm], sau đó chặn sát thương này.",
	["liangfan"] = "Lượng Phản",
	[":liangfan"] = "Tỏa định kỹ: Khi bắt đầu giai đoạn chuẩn bị, nếu bạn có [Hàm], bạn mất 1 máu, sau đó thu lấy tất cả [Hàm];\n▶ Trong lượt này, sau khi bạn gây sát thương cho 1 người do sử dụng [Hàm], bạn có thể thu lấy 1 lá của họ.",
	["letter"] = "Hàm",

	["#LiangfanEffect"] = "%from đã sử dụng [%arg] để gây sát thương và thu lấy 1 lá của %to",
	
	["@liangfan"] = "Lượng Phản: Lấy 1 lá của %dest",
	
	
	["#tangzi"] = "Đắc Thì Thức Phong",
	["tangzi"] = "Đường Tư",
	["xingzhao"] = "Hưng Thạo",
	[":xingzhao"] = "Tỏa định kỹ: Dựa theo số thế lực trên bàn chơi có người bị thương:\n* 1+: Bạn có kỹ năng »Tuân Tuân«.\n* 2+: Sau khi bạn nhận sát thương, nếu số bài trên tay bạn và nguồn sát thương khác nhau, người ít bài trên tay hơn rút 1 lá.\n* 3+: Khi bắt đầu giai đoạn bỏ bài, giới hạn trữ bài của bạn +4.\n* 4+: Khi bạn mất bài trong vùng trang bị, bạn rút 1 lá.",
	["xunxun_tangzi"] = "Tuân Tuân",
	
	["#zhanglu"] = "Chính Khoan Giáo Huệ",
	["zhanglu"] = "Trương Lỗ",
	["bushi"] = "Bố Thí",
	[":bushi"] = "• Khi kết thúc lượt, bạn nhận X [Nghĩa Xá] (X là số máu của bạn).\n• Khi bắt đầu giai đoạn chuẩn bị của người khác, nếu bạn có [Nghĩa Xá], bạn có thể giao 1 lá cho họ, sau đó bạn bỏ 1 [Nghĩa Xá] và rút 2 lá.\n• Khi bắt đầu giai đoạn chuẩn bị, bạn bỏ X lá (X là số người còn sống trừ số máu của bạn và trừ 2), sau đó bỏ tất cả [Nghĩa Xá].",
	["midao"] = "Mễ Đạo",
	[":midao"] = "• Khi bắt đầu giai đoạn kết thúc, nếu không có [Mễ], bạn có thể rút 2 lá, sau đó bạn đặt 2 lá lên tướng này, gọi là [Mễ].\n• Khi phán xét của 1 người có hiệu lực, bạn có thể đánh ra 1 [Mễ] để thay đổi kết quả phán xét, sau đó thu lấy lá phán xét ban đầu.",
    ["bushi:discard"] = "Có thể phát động »Bố Thí« để bỏ %arg lá",
    ["bushi:mark"] = "Có thể phát động »Bố Thí« để nhận [Nghĩa Xá]",
    ["yishe"] = "Nghĩa Xá",
    ["@bushi-give"] = "Có thể phát động »Nghĩa Xá« để giao 1 lá cho %src",
    ["rice"] = "Mễ",
    ["@midao-push"] = "Mễ Đạo: Chọn 2 lá để đặt [Mễ]",
    ["@midao-card"] = CommonTranslationTable["@askforretrial"],
	
	["#mifangfushiren"] = "Trục Giá Nghênh Trần",
	["mifangfushiren"] = "Mi Phương & Phó Sĩ Nhân",
	["&mifangfushiren"] = "Mi Phương Phó Sĩ Nhân",
	["fengshix"] = "Phong Thế",

	[":fengshix"] = "• Sau khi bài bạn sử dụng xác định 1 mục tiêu duy nhất, nếu số bài trên tay họ < bạn, bạn có thể bỏ 1 lá của bạn và họ, lệnh sát thương từ lá này +1.\n• Sau khi bạn trở thành mục tiêu duy nhất của bài do người khác sử dụng, nếu số lá trên tay bạn < họ, họ có thể lệnh bạn bỏ 1 lá của bạn và họ, lệnh sát thương từ lá này +1.",
	
	["@fengshix"] = "Có thể phát động »Phong Thế« của %src",
	
	
	["#liuqi"] = "Cư Ngoại Nhi An",
	["liuqi"] = "Lưu Kỳ",
	["wenji"] = "Vấn Kế",
	[":wenji"] = "Khi bắt đầu giai đoạn ra bài, bạn có thể lệnh 1 người khác giao cho bạn 1 lá ngửa mặt:\n* Nếu họ cùng thế lực với bạn hoặc không có thế lực, lượt này bạn sử dụng lá này không giới hạn khoảng cách và số lần và không thể hưởng ứng;\n* Nếu họ thế lực xác định khác bạn, bạn giao cho họ 1 lá bài khác ngửa mặt.",
	
	["tunjiang"] = "Truân Giang",
	[":tunjiang"] = "Khi bắt đầu giai đoạn kết thúc, nếu bạn trong giai đoạn ra bài đã sử dụng ít nhất 1 lá và không chỉ định người khác làm mục tiêu, bạn có thể rút X lá (X là số thế lực trên bàn chơi).",
	["@wenji"] = "Có thể kích »Vấn Kế«, chọn 1 người khác",
	["@wenji-give"] = "Vấn Kế, chọn 1 lá và giao cho %src",
	["#WenjiEffect"] = "%from đã phát động %arg, [%arg2] không thể bị hưởng ứng.",
	["#wenji-effect"] = "Vấn Kế",
	
	["#shixie"] = "Bách Việt Linh Y",
	["shixie"] = "Sĩ Nhiếp",
	["biluan"] = "Tị Loạn",
	[":biluan"] = "Tỏa định kỹ: Khoảng cách từ người khác tới bạn +X (X là số lá trong vùng trang bị của bạn).",
	["lixia"] = "Lễ Hạ",
	[":lixia"] = "Tỏa định kỹ: Khi bắt đầu giai đoạn chuẩn bị của người thế lực khác bạn, nếu bạn không ở trong tầm đánh của họ, bạn lệnh họ chọn 1 mục:\n1. Lệnh bạn rút 1 lá;\n2. Bỏ 1 lá trong vùng trang bị của bạn, sau đó họ mất 1 máu.",

    ["@lixia-choose"] = "Lễ Hạ: Chọn lệnh %src rút 1 lá hoặc bỏ 1 lá trong vùng trang bị của %src và mất 1 máu",
    ["lixia:draw"] = "Rút bài",
    ["lixia:discard"] = "Bỏ trang bị",

    ["#zhonghui"] = "Kiệt Ngạo Đích Dã Tâm Gia",
    ["zhonghui"] = "Chung Hội",
    ["quanji"] = "Quyền Kế",
    [":quanji"] = "• Một lần trong lượt của mỗi người ứng với mỗi thời điểm, sau khi bạn gây hoặc nhận sát thương, bạn có thể rút 1 lá, sau đó đặt ngửa 1 lá lên tướng này, gọi là [Quyền].\n• Giới hạn trữ bài của bạn +X (X là số [Quyền]).",
    ["paiyi"] = "Bài Dị",
    [":paiyi"] = "Một lần trong giai đoạn ra bài, bạn có thể đưa 1 [Quyền] vào chồng bài bỏ và chọn 1 người, họ rút X lá (X là số [Quyền] bạn có, tối đa 7);\n▷ Nếu số bài trên tay họ > bạn, bạn gây 1 sát thương cho họ.",

    ["@quanji-push"] = "Quyền Kế: Đặt 1 lá lên tướng làm [Quyền]",
    ["power_pile"] = "Quyền",


    ["#dongzhao"] = "Di Tôn Dị Đỉnh",
    ["dongzhao"] = "Đổng Chiêu",
    ["quanjin"] = "Khuyến Tiến",
    [":quanjin"] = "Một lần trong giai đoạn ra bài, bạn có thể giao 1 lá trên tay cho người từng nhận sát thương trong giai đoạn này và lệnh họ chấp hành 1 [Quân Lệnh]:\n* Nếu họ chấp hành, bạn rút 1 lá;\n* Nếu họ không chấp hành và bạn không phải người có nhiều bài trên tay nhất, bạn bổ sung bài trên tay đến khi bằng người có nhiều bài trên tay nhất, tối đa 5 lá.",
    ["zaoyun"] = "Tạc Vận",
    [":zaoyun"] = "Một lần trong giai đoạn ra bài, bạn có thể chọn 1 người thế lực xác định với bạn và khoảng cách từ bạn đến họ lớn hơn 1 và bỏ X lá bài trên tay (X là khoảng cách từ bạn đến họ -1), lệnh khoảng cách từ bạn đến họ là 1 trong lượt này, sau đó bạn gây 1 sát thương cho họ.",

    ["#xushu"] = "Nan Vi Hoàn Thần",
    ["xushu"] = "Từ Thứ",
    ["qiance"] = "Khiêm Sách",
	[":qiance"] = "Sau khi người cùng thế lực với bạn xác định mục tiêu của lá công cụ, họ có thể lệnh những mục tiêu thuộc Đại thế lực không thể hướng ứng với lá này.",
	["jujian"] = "Cử Tiến",
	[":jujian"] = "Phó tướng kỹ, Giảm 0.5 máu gốc: Khi 1 người cùng thế lực với bạn tiến vào trạng thái hấp hối, bạn có thể lệnh họ hồi đến 1 máu, sau đó bạn đổi Phó tướng.",
	["@qiance"] = "Có thể phát động »Khiêm Sách« của %src",
    
    ["#wujing"] = "Hàn Mã Lưu Kim",
    ["wujing"] = "Ngô Cảnh",
    ["diaogui"] = "Điều Quy",
    [":diaogui"] = "Một lần trong giai đoạn ra bài, có thể sử dụng 1 lá trang bị như [Điệu Hổ Ly Sơn];\n▷ Nếu thế lực của bạn có sự thay đổi về đội hình do phát động kỹ năng này, bạn rút X lá (X là số người của đội hình đông nhất trong những quan hệ đội hình ở thế lực của bạn có sự thay đổi).",
    ["fengyang"] = "Phong Dương",
    [":fengyang"] = "Trận pháp kỹ: Quan hệ đội hình: Người thế lực xác định khác bạn không thể thu lấy hoặc bỏ trang bị của người cùng đội hình với bạn.",

    ["#yanbaihu"] = "Sài Nha Lạc Giản",
    ["yanbaihu"] = "Nghiêm Bạch Hổ",
    ["zhidao"] = "Trĩ Đạo",
    [":zhidao"] = "Tỏa định kỹ: Khi bắt đầu giai đoạn ra bài, bạn chọn 1 người khác, trong lượt này:\n* Khoảng cách từ bạn đến họ là 1;\n* Bạn không thể chỉ định người khác ngoại trừ họ làm mục tiêu sử dụng bài;\n▶ Sau khi bạn gây sát thương cho họ lần đầu tiên trong giai đoạn này, bạn thu lấy 1 lá trong vùng chơi của họ.",
    ["jilix"] = "Ký Li",
    [":jilix"] = "Tỏa định kỹ:\n• Sau khi kết toán xong lá cơ bản Đỏ hoặc công cụ phổ thông Đỏ, nếu bạn là mục tiêu duy nhất của lá này, bạn lệnh cho người sử dụng xem như sử dụng lá cùng tên với lá đó với bạn (không giới hạn khoảng cách, số lần sử dụng);\n• Khi bạn nhận sát thương lần thứ 2 trong cùng 1 giai đoạn, bạn chặn sát thương và loại bỏ tướng này.",
    
    ["#zhidao-damage"] = "Trĩ Đạo",
    ["@zhidao-target"] = "Trĩ Đạo: Chọn 1 người khác",
    ["#ZhidaoEffect"] = "%from đã phát động »%arg«, nhận 1 lá trong vùng chơi của %to",
    
    ["jilix:target"] = "Có thể phát động »Ký Li«, lệnh %src 1 lần nữa xem như sử dụng [%arg] với bạn.",
    ["jilix:damage"] = "Có thể phát động »Ký Li«, chặn sát thương và loại bỏ tướng này.",

    ["ImperialEdict"] = "Chiếu Thư",
    [":ImperialEdict"] = "Bài Trang bị - Bảo vật\n\n<b>Kỹ năng</b>:\n• Sau khi sử dụng lá này, bạn đặt lá này vào vùng tướng của bạn.\n\n• Một lần trong giai đoạn ra bài của người có cùng thế lực với bạn, nếu họ thuộc tiểu thế lực, có thể đặt tối đa 2 lá trên tay lên tướng của bạn; nếu không thuộc tiểu thế lực, họ có thể đặt 1 lá trên tay lên tướng của bạn, gọi là [Chiếu].\n• Một lần trong giai đoạn ra bài, nếu có 4 [Chiếu] không cùng chất, bạn có thể đưa tất cả [Chiếu] vào chồng bài bỏ, rút ngẫu nhiêu 1 lá công cụ thế lực.\n" ,

    ["imperialedictattach"] = "Đặt bài trên tay",
    [":imperialedictattach"] = "Một lần trong giai đoạn ra bài của người có cùng thế lực với bạn, nếu họ thuộc tiểu thế lực, có thể đặt tối đa 2 lá trên tay lên tướng của bạn; nếu không thuộc tiểu thế lực, họ có thể đặt 1 lá trên tay lên tướng của bạn, gọi là [Chiếu].",
    ["imperialedicttrick"] = "Nhận bài công cụ",
    [":imperialedicttrick"] = "Một lần trong giai đoạn ra bài, nếu có 4 lá [Chiếu] không cùng chất, bạn có thể đưa tất cả [Chiếu] vào chồng bài bỏ, rút ngẫu nhiêu 1 lá công cụ thế lực.",

    ["rule_the_world"] = "Hiệu Lệnh Thiên Hạ",
    [":rule_the_world"] = "Bài công cụ - Ngụy\n\nMục tiêu: Một người không phải ít máu nhất\nHiệu quả: Ngoại trừ mục tiêu, mỗi người có thể lựa chọn 1 mục:\n1. Bỏ 1 lá trên tay và xem như sử dụng [Sát] không giới hạn khoảng cách với mục tiêu (Người thế lực Ngụy không cần bỏ bài);\n2. Bỏ 1 lá của mục tiêu (Người thế lực Ngụy thu lấy lá đó thay vì bỏ).",
    ["rule_the_world:slash"] = "%log xem như sử dụng [Sát] với %to",
    ["rule_the_world:discard"] = "Một lá bài của %to bị %log",
    ["rule_the_world_slash"] = "Bỏ 1 lá bài và",
    ["rule_the_world_discard"] = "bỏ đi",
    ["rule_the_world_getcard"] = "thu lấy",
    ["@rule_the_world-slash"] = "Hiệu Lệnh Thiên Hạ: Bỏ 1 lá trên tay, xem như sử dụng [Sát] với %dest.",

    ["conquering"] = "Khắc Phục Trung Nguyên",
    [":conquering"] = "Bài công cụ - Thục\n\nMục tiêu: Tùy ý\nHiệu quả: Mục tiêu lựa chọn 1 mục:\n1. Xem như sử dụng [Sát] (Sát thương từ [Sát] này +1 nếu do người thế lực Thục sử dụng);\nRút 1 lá (Người thế lực Thục đổi thành rút 2 lá).",
    ["@conquering-slash"] = "Khắc Phục Trung Nguyên: Chọn mục tiêu, xem như sử dụng [Sát], hoặc bấm »Hủy bỏ« để rút bài. ",

    ["consolidate_country"] = "Cố Quốc An Bang",
    [":consolidate_country"] = "Bài công cụ - Ngô\n\nMục tiêu: Bạn\nHiệu quả: Mục tiêu rút 8 lá sau đó bỏ ít nhất 6 lá trên tay, nếu bạn thuộc thế lực Ngô, có thể giao tùy ý tối đa 6 lá trong số những lá bỏ cho những người khác thuộc thế lực Ngô, mỗi người tối đa 2 lá.",

    ["@consolidate_country-discard"] = "Cố Quốc An Bang: Chọn tối thiểu 6 lá trên tay để bỏ",
    ["@consolidate_country-give"] = "Cố Quốc An Bang: Có thể giao 6 lá cho người thế lực Ngô khác, tối đa 2 lá mỗi người.",

    ["chaos"] = "Văn Hòa Loạn Võ",
    [":chaos"] = "Bài công cụ - Quần\n\nMục tiêu: Tất cả\nHiệu quả: Mục tiêu mở bài trên tay, sau đó bạn chọn 1 mục:\n1. Lệnh họ bỏ 2 lá khác loại trên tay;\n2. Bỏ 1 lá trên tay họ;\nNgười thế lực Quần sau khi chấp hành lựa chọn của bạn, nếu họ không có bài trên tay, họ bổ sung bài trên tay tới máu hiện tại.",
    
    ["chaos:letdiscard"] = "Lệnh %to bỏ 2 lá không cùng loại trên tay",
    ["chaos:discard"] = "Bỏ 1 lá trên tay %to",

    ["@chaos-select"] = "Văn Hòa Loạn Võ: Chọn 2 lá không cùng loại trên tay để bỏ.",

    ["@trick-show"] = "Có thể mở 1 tướng để [%arg] có thêm hiệu ứng.",
    ["trick_show:show_head"] = "Mở chủ tướng",
    ["trick_show:show_deputy"] = "Mở phó tướng",

    ["#simazhao"] = "Trào Phong Khai Thiên",
    ["simazhao"] = "Tư Mã Chiêu",
    ["suzhi"] = "Túc Trí",
    [":suzhi"] = "Tỏa định kỹ:\n• Giới hạn ba lần trong lượt của bạn đối với các mục sau:\n* Khi bạn gây sát thương cho mục tiêu của [Sát] hoặc [Quyết Đấu], bạn lệnh số sát thương +1;\n* Khi bạn sử dụng công cụ phi chuyển hóa, bạn rút 1 lá;\n* Sau khi bài của người khác tiến vào chồng bài bỏ do bỏ đi, bạn thu lấy 1 lá của họ.\n• Nếu chưa phát động »Túc Trí« 3 lần trong lượt:\n* Bạn có thể sử dụng công cụ phi chuyển hóa không giới hạn khoảng cách;\n* Khi bạn kết thúc lượt, bạn nhận kỹ năng »Phản Quỹ« đến khi bắt đầu lượt tiếp theo của bạn.",
    ["zhaoxin"] = "Chiêu Tâm",
    [":zhaoxin"] = "Sau khi bạn nhận sát thương, bạn có thể mở tất cả bài trên tay, sau đó hoán đổi bài trên tay với 1 người khác có số lá trên tay ≤ bạn.",
    ["@zhaoxin-exchange"] = "Chiêu Tâm: Chọn 1 người có bài trên tay không nhiều hơn bạn để đổi bài.",
    ["fankui_simazhao"] = "Phản Quỹ",
    
    ["#xuyou"] = "Tất Phương Kiểu Dực",
    ["xuyou"] = "Hứa Du",

    ["chenglve"] = "Thành Lược",
    [":chenglve"] = "Sau khi kết toán bài do 1 người cùng thế lực với bạn sử dụng, nếu số mục tiêu > 1, bạn có thể lệnh họ rút 1 lá;\n▷ Nếu bạn đã nhận sát thương từ lá này, bạn có thể lệnh 1 người cùng thế lực với bạn không có tướng úp và không có tiêu ký nào nhận được 1 tiêu ký [Âm Dương Ngư].",
    ["shicai"] = "Thị Tài",
    [":shicai"] = "Tỏa định kỹ: Sau khi bạn nhận sát thương, nếu số sát thương là:\n* 1: Bạn rút 1 lá;\n* 2+: Bạn bỏ 2 lá.",

    ["@chenglve-mark"] = "Thành Lược: Chọn 1 người nhận tiêu ký [Âm Dương Ngư].",

    ["#xiahouba"] = "Cức Đồ Tráng Chí",
    ["xiahouba"] = "Hạ Hầu Bá",
    ["baolie"] = "Báo Liệt",
    [":baolie"] = "Tỏa định kỹ:\n• Khi bắt đầu giai đoạn ra bài, lệnh những người thế lực xác định khác bạn có tầm đánh đến bạn sử dụng [Sát] với bạn, nếu không, bạn bỏ 1 lá của họ.\n• Bạn sử dụng [Sát] với người có máu ≥ bạn không giới hạn khoảng cách và số lần.",
    ["@baolie-slash"] = "Báo Liệt: Sử dụng [Sát] với %src, hoăc họ bỏ 1 lá của bạn.",

    ["#zhugeke"] = "Hưng Gia Xích Tộc",
    ["zhugeke"] = "Gia Cát Khác",
    ["aocai"] = "Ngạo Tài",
    [":aocai"] = "Ngoài lượt của bạn, khi bạn cần sử dụng/đánh ra bài cơ bản, bạn có thể xem hai lá trên đầu chồng bài, bạn có thể sử dụng/đánh ra lá cơ bản có tên tương ứng trong đó.",
    ["duwu"] = "Độc Võ",
    [":duwu"] = "Hạn định kỹ: Giai đoạn ra bài, bạn có thể phát động kỹ năng này, thực hiện lần lượt:\n- Bạn chọn 1 [Quân Lệnh], yêu cầu tất cả người thế lực khác bạn chấp hành [Quân Lệnh] này; nếu họ không chấp hành, bạn gây 1 sát thương cho họ và rút một lá;\n- Nếu trong những người còn sống có người đã tiến vào trạng thái hấp hối trong quá trình trên, bạn mất 1 máu.",
    
    ["#aocai"] = "Ngạo Tài",
    ["@aocai-view"] = "Ngạo Tài: Chọn 1 lá phù hợp để sử dụng/đánh ra",

    ["#sunchen"] = "Thực Tủy Đích Triêu Đường Khách",
    ["sunchen"] = "Tôn Lâm",
    ["shilu"] = "Thị Lực",
    [":shilu"] = "• Sau khi có người trận vong, nếu họ có tướng, bạn có thể đặt tất cả tướng của họ lên tướng này, gọi là [Lục];\n▷ Nếu họ bị bạn giết, bạn nhận 2 lá từ chồng bài tướng đặt lên tướng này, gọi là [Lục].\n• Khi bắt đầu giai đoạn chuẩn bị, nếu bạn có [Lục], bạn có thể bỏ tối đa X lá (X là số [Lục]), sau đó rút số lá tương ứng.",
    ["xiongnve"] = "Hung Ngược",
    [":xiongnve"] = "• Khi bắt đầu giai đoạn ra bài, bạn có thể bỏ 1 [Lục], chọn 1 mục có hiệu quả trong lượt này:\n1. Khi bạn gây sát thương cho người cùng thế lực với [Lục] đã bỏ, sát thương này +1;\n2. Khi bạn gây sát thương cho người cùng thế lực với [Lục] đã bỏ, thu lấy 1 lá của họ;\n3. Bạn sử dụng bài với mục tiêu cùng thế lực với [Lục] đã bỏ không giới hạn số lần.\n• Khi kết thúc giai đoạn ra bài, bạn có thể bỏ 2 [Lục], đến khi bắt đầu lượt tiếp theo của bạn, khi bạn tính toán sát thương phải nhận từ người khác, sát thương này -1. ",

    ["#xiongnve-effect"] = "Hung Ngược",

    ["massacre"] = "Lục",
    ["@shilu"] = "Thị Lục: có thể bỏ tối đa%arg lá rồi rút số lá tương ứng.",
    ["@xiongnve-continue"] = "Hung Ngược: Có thể tiếp tục bỏ [Lục]",
    
    ["#GetMassacreDetail"] = "%from đã nhận [Lục] %arg",
    ["#dropMassacreDetail"] = "%from đã bỏ [Lục] %arg",
    ["#GetMassacre"] = "%from đã nhận %arg [Lục]",
    
    ["@xiongnve-choice"] = "Hung Ngược: Lựa chọn 1 tác dụng.",
    ["xiongnve:adddamage"] = "+1 sát thương",
    ["xiongnve:extraction"] = "Lấy bài sau khi gây sát thương",
    ["xiongnve:nolimit"] = "Sử dụng bài không giới hạn số lần",
    
    ["#xiongnveAdddamage"] = "Lượt này, sát thương %from gây cho người thế lực %arg +1",
    ["#xiongnveExtraction"] = "Lượt này, %from lấy 1 lá của người thế lực %arg sau khi gây sát thương cho họ",
    ["#xiongnveNolimit"] = "Lượt này, %from sử dụng bài lên người thế lực %arg không giới hạn số lần.",
    ["xiongnve_avoid"] = "Hung Ngược: Giảm sát thương.",

	["xiongnve:attack"] = "Có thể phát động »Hung Ngược«, bỏ 1 [Lục] để có hiệu quả tương ứng với thế lực đó",	
	["xiongnve:defence"] = "Có thể phát động »Hung Ngược«, bỏ 2 [Lục] để lệnh sát thương nhận được -1",

    ["#panjun"] = "Quan Nhân Vu Vy",
    ["panjun"] = "Phan Tuấn",
    ["congcha"] = "Quan Vy",
    [":congcha"] = "• Khi bắt đầu giai đoạn chuẩn bị, bạn có thể chọn 1 người không có thế lực;\n▶ Cho đến khi bắt đầu lượt tiếp theo của bạn, khi họ mở tướng và trở thành có thế lực, nếu của họ và bạn:\n* Cùng thế lực: Bạn và họ rút 2 lá;\n* Khác thế lực: Họ mất 1 máu.\n• Giai đoạn rút bài, nếu không có người không có thế lực, bạn có thể lệnh số lá rút +2.",
    ["gongqing"] = "Công Thanh",
    [":gongqing"] = "Tỏa định kỹ:\n• Khi bạn tính toán sát thương phải nhận, nếu tầm đánh của nguồn sát thương lớn hơn 3, sát thương này +1;\n• Khi bạn nhận sát thương, nếu tầm đánh của nguồn sát thương nhỏ hơn 3 và sát thương lớn hơn 1, sát thương này trở thành 1.",
    ["@congcha-target"] = "Có thể phát động »Quan Vy«, chọn 1 người không có thế lực.",
    
    ["#congcha-effect"] = "Quan Vy",

    
    ["#wenqin"] = "Dương Châu Thích Sử",
    ["wenqin"] = "Văn Khâm",
    ["jinfa"] = "Căng Phạt",
    [":jinfa"] = "Một lần trong giai đoạn ra bài, có thể bỏ 1 lá và chọn 1 người khác có bài, họ chọn 1 mục:\n1. Lệnh bạn lấy 1 lá của họ;\n2. Họ giao 1 lá trang bị cho bạn, nếu bạn nhận được lá ♠ và lá đó còn trên tay bạn, xem như họ sử dụng 1 [Sát] với bạn.",
    ["@jinfa-give"] = "Căng Phạt: Chọn 1 trang bị giao cho %src hoặc bấm hủy và lệnh %src lấy 1 lá của bạn.",


    ["#huangzu"] = "Giang Hạ Phúc Tâm",
    ["huangzu"] = "Hoàng Tổ",
    ["xishe"] = "Vãn Cung",
    [":xishe"] = "• Khi bắt đầu giai đoạn chuẩn bị của người khác, bạn có thể bỏ 1 lá trong vùng trang bị và xem như sử dụng 1 [Sát] với họ, nếu số máu của họ nhỏ hơn của bạn, bạn lệnh cho [Sát] này không thể hưởng ứng; bạn có thể lặp lại quá trình này.\n• Khi kết thúc lượt này, nếu trong lượt người trận vong và nguồn là [Sát] từ kỹ năng này của bạn, bạn có thể đổi phó tướng, tướng sau khi đổi được úp xuống.",
    ["@xishe-slash"] = "Có thể phát động »Văn Cung«, bỏ 1 lá trong vùng trang bị, xem như sử dụng [Sát] với %src",
    
    ["#xishe-transform"] = "Vãn Cung",
    
    
    
    ["#gongsunyuan"] = "Giáo Đồ Huyền Hải",
    ["gongsunyuan"] = "Công Tôn Uyên",
    ["huaiyi"] = "Hoài Dị",
    [":huaiyi"] = "• Một lần trong giai đoạn ra bài, bạn có thể mở toàn bộ bài trên tay, nếu có đủ 2 màu, bạn thực hiện lần lượt:\n- Bạn chọn 1 màu và bỏ những lá trên tay có màu này;\n- Bạn chọn tối đa X người có bài, thu lấy 1 lá của họ (X là số lá bạn vừa bỏ), nếu lá được thu lấy là trang bị thì đặt lá đó lên tướng này thay vì thu lấy, gọi là [Dị].\n• Bạn có thể sử dụng hoặc đánh ra [Dị] như bài trên tay.",
    ["zisui"] = "Tứ Tuy",
    [":zisui"] = "Tỏa định kỹ:\n• Giai đoạn rút bài, nếu có [Dị], bạn rút thêm X lá (X là số [Dị]).\n• Khi bắt đầu giai đoạn kết thúc, nếu số [Dị] > giới hạn máu của bạn, bạn trận vong.",
    
    ["@huaiyi-choose"] = "Hoài Dị: Chọn 1 màu để bỏ bài",
    ["@huaiyi-snatch"] = "Hoài Dị: Chọn tối đa %arg người, lần lượt thu lấy 1 lá của họ.",
    ["huaiyi:red"] = "Đỏ",
    ["huaiyi:black"] = "Đen",
    
    ["&disloyalty"] = "Di",

	["#test"] = "%arg",
	
	["#pengyang"] = "Giang Dương Thái Thú",
	["pengyang"] = "Bành Dạng",
	
	

    ["tongling"] = "Thông Linh",
    [":tongling"] = "Một lần trong giai đoạn ra bài, sau khi bạn gây sát thương cho 1 người thế lực xác định khác bạn (A), bạn có thể chọn 1 người cùng thế lực với bạn (B), B có thể sử dụng 1 lá có bao gồm A là mục tiêu;\n* Nếu lá này gấy sát thương, bạn và B rút 2 lá;\n* Nếu lá này không gây sát thương, bạn lệnh A thu lấy lá bạn đã sử dụng để gây sát thương cho A.",
    ["jinxian"] = "Cận Hãm",
    [":jinxian"] = "Sau khi bạn mở tướng này, bạn lệnh tất cả người ở khoảng cách ≤1 thực hiện: Nếu họ đã:\n* Mở tất cả tướng: Họ úp 1 tướng\n* Có tướng úp: Họ bỏ 2 lá.",
    
    
    ["@tongling-invoke"] = "Có thể phát động »Thông Linh«, chọn 1 người sử dụng bài lên %dest",
    ["@tongling-usecard"] = "Thông Linh: Chọn 1 lá bài để sử dụng lên %dest",
    ["@jinxian-hide"] = "Cận Hãm: chọn ẩn 1 tướng của bạn",
    ["jinxian_hide:head"] = "Chủ tướng",
    ["jinxian_hide:deputy"] = "Phó tướng",

	
	["#sufei"] = "Hùng Mãnh Dật Tài",
	["sufei"] = "Tô Phi",
	["lianpian"] = "Liên Phiên",
	[":lianpian"] = "Khi bắt đầu giai đoạn kết thúc của 1 người, nếu trong lượt này tổng số lá tiến vào chồng bài bỏ do bạn chỉ định bỏ đi > số máu của bạn, nếu lượt này là lượt của:\n* Bạn: Bạn có thể lệnh 1 người cùng thế lực với bạn bổ sung bài trên tay đến giới hạn máu của họ;\n* Người khác: Họ có thể chọn bỏ 1 lá của bạn hoặc lệnh bạn hồi 1 máu.",
	
	["@lianpian-target"] = "Có thể phát động »Liên Phiên«, chọn 1 người bổ sung bài trên tay đến giới hạn máu",
	["@lianpian"] = "Có thể phát động »Liên Phiên« của %src",
	["#lianpian-other"] = "Liên Phiên",
	["lianpian:discard"] = "Bỏ 1 lá của họ.",
	["lianpian:recover"] = "Lệnh họ hồi 1 máu.",
	
	["#liuba"] = "Sắc Hành Chỉnh Thân",
	["liuba"] = "Lưu Ba",
	["tongdu"] = "Trù Độ",
	[":tongdu"] = "Khi bắt đầu giai đoạn kết thúc của người cùng thế lực với bạn, họ có thể rút X lá (X là số bài họ đã bỏ trong giai đoạn bỏ bài ở lượt này, tối đa 3).",
	["qingyin"] = "Quy Ẩn",
	[":qingyin"] = "Hạn định kỹ: Giai đoạn ra bài, bạn có thể phát động kỹ năng này, thực hiện lần lượt:\n- Lệnh tất cả người cùng thế lực với bạn hồi đầy máu;\n- Bạn loại bỏ tướng này.",
	["@tongdu"] = "Có thể phát động »Trù Độ« của %src",
	["#tongdu-other"] = "Trù Độ",
	
	["#zhuling"] = "Kiên Thành Túc Tướng",
	["zhuling"] = "Chu Linh",
	["juejue"] = "Trấn Vệ",
	[":juejue"] = "• Khi bắt đầu giai đoạn bỏ bài, bạn có thể mất 1 máu; Nếu làm vậy, khi kết thúc giai đoạn này, nếu trong giai đoạn này bạn có bỏ bài, bạn lệnh tất cả người khác chọn 1 mục:\n1. Họ đưa X lá trên tay vào chồng bài bỏ (X là số lá bạn đã bỏ trong giai đoạn này);\n2. Bạn gây 1 sát thương cho họ.\n• Khi bạn giết người cùng thế lực với bạn, bạn bỏ qua chấp hành thưởng phạt.",
	["fangyuan"] = "Ngư Lân",
	[":fangyuan"] = "Trận pháp kỹ: Quan hệ vây công:\n• Nếu bạn là người vây công, giới hạn trữ bài của người vây công +1, giới hạn trữ bài của người bị vây công -1.\n• Khi bắt đầu giai đoạn kết thúc, nếu bạn là người bị vây công trong quan hệ vây công, bạn xem như sử dụng [Sát] với 1 người vây công",
	["@fangyuan-slash"] = "Ngư Lân: Chọn 1 người đang vây công bạn, xem như sử dụng [Sát] với họ",
	
	["@juejue-discard"] = "Trấn Vệ: Đưa %arg lá trên tay vào chồng bài bỏ, hoặc %src gây 1 sát thương với bạn.",
	
	["#fangyuan-maxcards"] = "Ngư Lân",


}
