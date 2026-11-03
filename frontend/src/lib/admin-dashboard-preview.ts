// A01 design fixtures. Replace with authorized admin API data when available.
export const dashboardPreview = {
  administrator: "Trần Minh",
  stats: [
    { title: "Bài đăng chờ duyệt lần đầu", value: 4, description: "Chờ lâu nhất 1 ngày 6 giờ" },
    { title: "Báo cáo đang mở", value: 2, description: "1 đang mở · 1 đang xem xét" },
    { title: "Bài đăng đang bị đình chỉ", value: 1, description: "Căn hộ A, ban công hướng sông Hàn" },
  ],
  waiting: [
    { id: "listing-1", status: "Chờ duyệt", title: "Studio full nội thất gần biển Mỹ Khê", description: "Chủ nhà Linh · 5 căn · 12 ảnh", elapsed: "1 ngày 6 giờ" },
    { id: "report-118", status: "Báo cáo", title: "#BC-118 · Sai lệch thông tin", description: "Studio full nội thất gần biển Mỹ Khê", elapsed: "2 giờ" },
    { id: "listing-2", status: "Chờ duyệt", title: "Phòng trọ gần ĐH Bách khoa", description: "Chủ nhà Hòa · 4 căn · 9 ảnh", elapsed: "18 giờ" },
  ],
  activities: [
    { id: "activity-1", actor: "Trần Minh", action: "đã đình chỉ", target: "Căn hộ A, ban công hướng sông Hàn", at: "2026-10-19T10:20:00+07:00", label: "10:20 19/10/2026" },
    { id: "activity-2", actor: "Trần Minh", action: "giải quyết báo cáo", target: "#BC-110", at: "2026-10-19T10:18:00+07:00", label: "10:18 19/10/2026" },
    { id: "activity-3", actor: "Lê An", action: "đã phê duyệt", target: "Studio ban công view biển", at: "2026-10-18T16:02:00+07:00", label: "16:02 18/10/2026" },
    { id: "activity-4", actor: "Lê An", action: "đã từ chối", target: "Phòng khép kín Hòa Khánh", at: "2026-10-16T15:40:00+07:00", label: "15:40 16/10/2026" },
    { id: "activity-5", actor: "Trần Minh", action: "khôi phục", target: "Nhà nguyên căn An Khê", at: "2026-10-15T09:12:00+07:00", label: "09:12 15/10/2026" },
  ],
};
