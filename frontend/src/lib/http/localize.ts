export type FieldErrors = Record<string, string[]>;

const translatedApiMessages: Record<string, string> = {
  "Move-in cannot be recorded before the confirmed start date.":
    "Chỉ có thể xác nhận nhận nhà từ ngày bắt đầu kỳ thuê đã xác nhận.",
  "Only a confirmed tenancy awaiting move-in can be activated.":
    "Chỉ có thể xác nhận nhận nhà cho kỳ thuê đã được xác nhận và chưa ghi nhận ngày nhận nhà.",
  "The latest contract version is not mutually confirmed.":
    "Phiên bản hợp đồng mới nhất chưa được cả hai bên xác nhận.",
  "This contract is no longer the current, unexpired proposal.":
    "Đề xuất này không còn là phiên bản hiện hành hoặc đã hết hạn.",
  "This contract already has a tenant decision.":
    "Bạn đã phản hồi phiên bản hợp đồng này rồi.",
  "The selected unit is no longer available for those dates.":
    "Căn này không còn trống trong khoảng thời gian đã chọn.",
  "The given data was invalid.":
    "Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại các mục đã nhập.",
};

const translatedFieldLabels: Record<string, string> = {
  email: "email",
  password: "mật khẩu",
  password_confirmation: "xác nhận mật khẩu",
  name: "họ tên",
  reason: "lý do",
  start_date: "ngày bắt đầu",
  end_date: "ngày kết thúc",
  requested_end_date: "ngày kết thúc đề xuất",
  monthly_rent: "giá thuê tháng",
  proposed_monthly_rent: "giá thuê tháng đề xuất",
  contact_name: "tên liên hệ",
  contact_phone: "số điện thoại liên hệ",
};

export function localizeApiMessage(message: string, status: number): string {
  const trimmed = message.trim();
  const knownTranslation = translatedApiMessages[trimmed];

  if (knownTranslation) return knownTranslation;
  if (/[À-ỹĐđ]/u.test(trimmed)) return trimmed;

  const requiredField = trimmed.match(/^The (.+) field is required\.$/i);
  if (requiredField) {
    const field = requiredField[1].replaceAll(".", " ");
    return `Vui lòng nhập ${translatedFieldLabels[field] ?? field.replaceAll("_", " ")}.`;
  }

  const invalidField = trimmed.match(/^The (.+) field is invalid\.$/i);
  if (invalidField) {
    const field = invalidField[1].replaceAll(".", " ");
    return `${translatedFieldLabels[field] ?? field.replaceAll("_", " ")} không hợp lệ.`;
  }

  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (status === 404) return "Không tìm thấy dữ liệu yêu cầu.";
  if (status === 409) return "Dữ liệu đã thay đổi hoặc không còn phù hợp. Vui lòng tải lại trang.";
  if (status === 419) return "Phiên bảo mật đã hết hạn. Vui lòng tải lại trang.";
  if (status === 422) return "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các mục đã nhập.";
  if (status === 429) return "Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.";

  return "Có lỗi xảy ra. Vui lòng thử lại sau.";
}

export function localizeFieldErrors(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [
      field,
      messages.map((message) => localizeApiMessage(message, 422)),
    ]),
  );
}

