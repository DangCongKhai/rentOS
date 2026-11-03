"use client";

import { useState } from "react";
import { resetReviewPreview } from "@/lib/admin-review-store";

export function AdminPreviewReset() {
  const [notice, setNotice] = useState("");
  return (
    <div className="admin-previewReset">
      <p className="admin-previewResetTitle">Thử lại dữ liệu mẫu</p>
      <p>Xóa quyết định thử nghiệm đã lưu trong trình duyệt này và đưa 4 tin mẫu về hàng đợi.</p>
      <button type="button" onClick={() => {
        try {
          resetReviewPreview();
          setNotice("Đã khôi phục 4 tin mẫu. Bạn có thể thử duyệt lại.");
        } catch {
          setNotice("Không thể khôi phục dữ liệu. Vui lòng kiểm tra quyền lưu trữ của trình duyệt.");
        }
      }}>Khôi phục dữ liệu mẫu</button>
      <p role="status">{notice}</p>
    </div>
  );
}
