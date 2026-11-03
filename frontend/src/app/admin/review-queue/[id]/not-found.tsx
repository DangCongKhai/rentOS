import Link from "next/link";

export default function ReviewNotFound() {
  return (
    <section className="admin-queueEmpty">
      <h1>Không tìm thấy gói tin đăng</h1>
      <p>Tin mẫu này không tồn tại. Vui lòng chọn một tin trong hàng đợi.</p>
      <Link href="/admin/review-queue" className="admin-queueClear">Về hàng đợi kiểm duyệt</Link>
    </section>
  );
}
