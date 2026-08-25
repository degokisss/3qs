-- translation for JoyPackage

return {
	["joy"] = "Hoan Lạc",

	["shit"] = "Thỉ",
	[":shit"] = "Bài cơ bản\n\n<b>Thời điểm</b>: Giai đoạn ra bài\n<b>Mục tiêu</b>: Bạn\n<b>Hiệu quả</b>: Không có\n\n<b>Hiệu ứng thêm</b>: Trong lượt của bạn, khi lá này từ tay của bạn tiến vào chồng bài bỏ hoặc bàn chơi, nếu chất của lá này là:\n* BÍCH: Mất 1 máu;\n* TÉP: Bạn nhận 1 sát thương Lôi;\n* RÔ: Bạn nhận 1 sát thương;\n* CƠ: Bạn nhận 1 sát thương Hỏa.",
	["disgusting_card"] = "Lá bốc mùi",
	["$ShitLostHp"] = "%from đã ăn %card, mất 1 máu",
	["$ShitDamage"] = "%from đã ăn %card, nhận 1 sát thương.",

-- disaster
	["Disaster"] = "Thiên Tai",

	["deluge"] = "Hồng Thủy",
	[":deluge"] = "Bài công cụ thời gian\n\nSử dụng: Trong giai đoạn ra bài.\nMục tiêu: Bạn.\nHiệu quả: Giai đoạn phán xét của mục tiêu, tiến hành phán xét, nếu kết quả phán xét có điểm là A hoặc K, mục tiêu ngẫu nhiên mở ra số bài bằng số người còn sống, theo vòng bắt đầu từ người tiếp theo với mục tiêu, mỗi người lần lượt nhận 1 lá từ số bài này, sau đó bỏ lá này\nNếu không, lá [Hồng Thủy] chuyển sang mục tiêu tiếp theo.",

	["typhoon"] = "Đài Phong",
	[":typhoon"] = "Bài công cụ thời gian\n\nSử dụng: Trong giai đoạn ra bài.\nMục tiêu: Bạn.\nHiệu quả: Giai đoạn phán xét của mục tiêu, tiến hành phán xét, nếu kết quả phán xét từ 2~9 RÔ, những người có khoảng cách 1 với mục tiêu bỏ 6 lá trên tay, sau đó bỏ lá này. Nếu không, lá [Đài Phong] chuyển sang mục tiêu tiếp theo.",

	["earthquake"] = "Địa Chấn",
	[":earthquake"] = "Bài công cụ thời gian\n\nSử dụng: Trong giai đoạn ra bài.\nMục tiêu: Bạn.\nHiệu quả: Giai đoạn phán xét của mục tiêu, tiến hành phán xét, nếu kết quả phán xét từ 2~9 TÉP, những người trong khoảng cách 1 với mục tiêu (bỏ qua hiệu ứng từ ngựa +1) bỏ tất cả trang bị, sau đó bỏ lá này. Nếu không, lá [Địa Chấn] chuyển sang mục tiêu tiếp theo.",

	["volcano"] = "Hỏa Sơn",
	[":volcano"] = "Bài công cụ thời gian\n\nSử dụng: Trong giai đoạn ra bài.\nMục tiêu: Bạn.\nHiệu quả: Giai đoạn phán xét của mục tiêu, tiến hành phán xét, nếu kết quả phán xét từ 2~9 CƠ, mục tiêu nhận 2 sát thương Hỏa, những người trong khoảng cách 1 với mục tiêu (bỏ qua hiệu ứng từ ngựa +1) nhận 1 sát thương Hỏa, sau đó bỏ lá này. Nếu không, lá [Hỏa Sơn] chuyển sang mục tiêu tiếp theo.",

	["mudslide"] = "Nễ Thạch Lưu",
	[":mudslide"] = "Bài công cụ thời gian\n\nSử dụng: Trong giai đoạn ra bài.\nMục tiêu: Bạn.\nHiệu quả: Giai đoạn phán xét của mục tiêu, tiến hành phán xét, nếu kết quả phán xét có màu Đen và điểm là A, K, 4, 7, bắt đầu từ mục tiêu, bỏ nhiều bài từ vùng trang bị nhất có thể, người không có trang bị nhận 1 sát thương, hiệu quả dừng lại khi có 4 trang bị được bỏ đi, sau đó bỏ lá này\nNếu không, lá [Nễ Thạch Lưu] chuyển sang mục tiêu tiếp theo.",

-- equips
	["JoyEquip"] = "Hoan Lạc - Trang Bị",

	["monkey"] = "Hầu Tử",
	[":monkey"] = "Bài trang bị - Chiến Mã\n\nKỹ năng:\n" ..
	"Khi người khác sử dụng [Đào], bạn có thể bỏ [Hầu Tử], loại bỏ mục tiêu của lá [Đào] này và thu lấy lá đó.\nTỏa định kỹ, khoảng cách từ bạn đến người khác -1.",
	["grab_peach"] = "Thu Đào",



	["yx_sword"] = "Dương Tu Kiếm",
	[":yx_sword"] = "Bài trang bị - Vũ khí\n\nTầm đánh: 4\nKỹ năng: Khi lá [Sát] của bạn tạo gây thương, bạn có thể lệnh 1 người khác trong tầm đánh của bạn trở thành nguồn sát thương, sau đó bạn giao [Dương Tu Kiếm] cho họ.",
	["@yxsword-select"] = "Bạn có thể chỉ định 1 người trong tầm đánh trở thành nguồn sát thương",

}
