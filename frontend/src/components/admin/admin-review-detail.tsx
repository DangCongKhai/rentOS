"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReviewPackage } from "@/lib/admin-review-package";
import { useAdminReviewPreview } from "@/lib/admin-review-store";
import { AdminIcon } from "./admin-icons";
import { AdminPreviewReset } from "./admin-preview-reset";
import { AdminReviewDialog } from "./admin-review-dialog";
import type { AdminMedia, AdminPackageDto } from "@/lib/admin-review-api";
import { AdminPrivateImage } from "./admin-private-image";

const money = new Intl.NumberFormat("vi-VN");
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function MediaPreview({ label, photo, onClose }: { label: string; photo?: AdminMedia; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);
  return (
    <dialog ref={dialog} className="admin-reviewDialog admin-mediaDialog" aria-labelledby="media-preview-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="admin-reviewDialogHeading"><h2 id="media-preview-title">{label}</h2><button type="button" aria-label="Đóng ảnh" onClick={onClose}><AdminIcon name="close" /></button></div>
      <div className="admin-mediaLarge">{photo ? <AdminPrivateImage media={photo} /> : label}</div>
      {!photo && <p className="admin-reviewLocalNote">Khung ảnh minh họa theo thiết kế.</p>}
    </dialog>
  );
}

export function AdminReviewDetail({ reviewPackage, onDecided, onReload }: { reviewPackage: ReviewPackage; onDecided?: (data: AdminPackageDto) => void; onReload?: () => void }) {
  const { decisions, ready, storageError } = useAdminReviewPreview();
  const [action, setAction] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [media, setMedia] = useState<{ label: string; photo?: AdminMedia } | null>(null);
  const api = reviewPackage.apiData;
  const cover = api?.media.find((photo) => photo.id === api.cover_media_id);
  const decision = api ? api.reviewed_at && ["APPROVED", "REJECTED"].includes(api.moderation_status) ? { status: api.moderation_status, reviewer: api.reviewer?.name ?? "Quản trị viên", decidedAt: api.reviewed_at, reason: api.review_reason } : undefined : decisions[reviewPackage.id];
  const disabled = api ? api.moderation_status !== "PENDING" || Boolean(decision) : !ready || Boolean(decision) || Boolean(storageError);
  const status = !api && !ready ? "Đang tải…" : decision?.status === "APPROVED" ? "Đã phê duyệt" : decision?.status === "REJECTED" ? "Đã từ chối" : api?.moderation_status === "DRAFT" ? "Bản nháp" : "Đang duyệt";
  const checklist = [
    { text: "Địa chỉ đầy đủ", valid: api ? api.completeness.address : Boolean(reviewPackage.address) },
    { text: "Có ảnh dùng chung và ảnh bìa", valid: api ? api.completeness.shared_cover : Boolean(reviewPackage.cover && reviewPackage.gallery.length) },
    { text: "Mỗi căn có ảnh và điều khoản hợp lệ", valid: api ? api.completeness.unit_photos_terms : reviewPackage.units.every((unit) => reviewPackage.gallery.includes(unit.code) && unit.rent > 0 && unit.minimumMonths > 0) },
    { text: "Đã thiết lập chính sách", valid: api ? api.completeness.policies : reviewPackage.policies.length > 0 },
  ];
  const complete = checklist.every((item) => item.valid);

  return (
    <section aria-labelledby="review-title">
      <nav className="admin-reviewBreadcrumb" aria-label="Đường dẫn trang"><Link href="/admin/review-queue">Hàng đợi kiểm duyệt</Link><span aria-hidden="true">/</span><span>Gói tin đăng lần đầu</span></nav>
      <div className="admin-reviewHeading">
        <h1 id="review-title">{reviewPackage.title}</h1>
        <span className={`admin-reviewStatus ${decision?.status === "APPROVED" ? "admin-reviewStatusApproved" : decision?.status === "REJECTED" ? "admin-reviewStatusRejected" : ""}`}><AdminIcon name={decision?.status === "REJECTED" ? "close" : decision ? "check" : "clock"} />{status}</span>
      </div>
      <p className="admin-reviewMetadata">Chủ nhà: {reviewPackage.owner} · Gửi duyệt lúc {dateTime.format(new Date(reviewPackage.submittedAt))} · Đã chờ {reviewPackage.waiting} · Nội dung: tin đăng v{reviewPackage.listingVersion}, bất động sản v{reviewPackage.propertyVersion}, {reviewPackage.units.length} căn</p>
      {!api && <p className="admin-reviewLocalNote">Bản xem trước · Dữ liệu và ảnh minh họa. Quyết định chỉ lưu trong trình duyệt.</p>}

      <div className="admin-reviewLayout">
        <div className="admin-reviewBody">
          <section className="admin-reviewCard" aria-labelledby="listing-section">
            <h2 id="listing-section">Bài đăng</h2>
            <dl className="admin-reviewFields">
              <dt>Tiêu đề</dt><dd>{reviewPackage.title}</dd>
              <dt>Mô tả</dt><dd>{reviewPackage.description}</dd>
              <dt>Ảnh bìa</dt><dd><button type="button" className="admin-reviewCover" disabled={Boolean(api && !cover)} onClick={() => setMedia({ label: reviewPackage.cover, photo: cover })} aria-label={`Xem ảnh bìa: ${reviewPackage.cover}`}>{cover ? <AdminPrivateImage media={cover} /> : api ? "Chưa có ảnh bìa" : reviewPackage.cover}</button></dd>
            </dl>
          </section>

          <section className="admin-reviewCard" aria-labelledby="property-section">
            <h2 id="property-section">Bất động sản</h2>
            <dl className="admin-reviewFields">
              <dt>Địa chỉ</dt><dd>{reviewPackage.address}</dd>
              <dt>Tiện ích tòa nhà</dt><dd>{reviewPackage.amenities.join(" · ")}</dd>
              <dt>Chính sách</dt><dd>{reviewPackage.policies.join(" · ")}</dd>
              {api?.property.description && <><dt>Mô tả</dt><dd>{api.property.description}</dd></>}
            </dl>
          </section>

          <section className="admin-reviewCard" aria-labelledby="units-section">
            <h2 id="units-section">Danh sách căn ({reviewPackage.units.length})</h2>
            <ul className="admin-reviewUnits">
              {reviewPackage.units.map((unit) => (
                <li key={unit.code}>
                  <div className="admin-reviewUnitHeading"><h3>{unit.code}</h3><span>Được quảng cáo</span></div>
                  <p>{unit.area} m² · {unit.bathroom ?? "Phòng tắm riêng"} · tối đa {unit.occupants} người</p>
                  <p><strong>{money.format(unit.rent)} đ / tháng</strong> · cọc {money.format(unit.deposit)} đ</p>
                  <p className="admin-reviewUnitNote">Tối thiểu {unit.minimumMonths} tháng · {unit.note}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-reviewCard" aria-labelledby="gallery-section">
            <h2 id="gallery-section">Bộ sưu tập ảnh (chỉ ảnh đã chọn)</h2>
            <ul className="admin-reviewGallery">{api ? api.media.map((photo) => <li key={photo.id}><button type="button" onClick={() => setMedia({ label: photo.caption ?? "Ảnh được chọn", photo })} aria-label={`Xem ảnh: ${photo.caption ?? "Ảnh được chọn"}`}><AdminPrivateImage media={photo} /></button></li>) : reviewPackage.gallery.map((label) => <li key={label}><button type="button" onClick={() => setMedia({ label })} aria-label={`Xem ảnh: ${label}`}>{label}</button></li>)}</ul>
          </section>

          <div className="admin-reviewCard admin-reviewOwnerAudit">
            <section aria-labelledby="owner-section"><h2 id="owner-section">Chủ nhà</h2><dl className="admin-reviewFields"><dt>Họ tên</dt><dd>{reviewPackage.owner}</dd><dt>Email</dt><dd>{reviewPackage.email}</dd><dt>Tin đăng khác</dt><dd>{reviewPackage.otherListings}</dd></dl></section>
            <section aria-labelledby="audit-section"><h2 id="audit-section">Nhật ký kiểm toán</h2>
              <details className="admin-reviewAudit"><summary>Xem {api ? api.audit.length + 1 : decision ? 2 : 1} sự kiện{!api && " mẫu"}</summary><ol>
                {api ? api.audit.map((event) => <li key={event.id}><strong>{event.actor_name ?? "Hệ thống"}</strong> {event.action === "listing.approved" ? "đã phê duyệt" : event.action === "listing.rejected" ? "đã từ chối" : event.action} gói tin.<time dateTime={event.created_at}>{dateTime.format(new Date(event.created_at))}</time>{event.reason && <p>Lý do: {event.reason}</p>}</li>) : decision && <li><strong>{decision.reviewer}</strong> {decision.status === "APPROVED" ? "đã phê duyệt" : "đã từ chối"} gói tin.<time dateTime={decision.decidedAt}>{dateTime.format(new Date(decision.decidedAt))}</time>{decision.reason && <p>Lý do: {decision.reason}</p>}</li>}
                <li><strong>{reviewPackage.owner}</strong> đã gửi duyệt lần đầu.<time dateTime={reviewPackage.submittedAt}>{dateTime.format(new Date(reviewPackage.submittedAt))}</time></li>
              </ol></details>
            </section>
          </div>
        </div>

        <aside className="admin-reviewDecision" aria-labelledby="decision-section">
          <div className="admin-reviewCard">
            <h2 id="decision-section">Quyết định</h2>
            <ul className="admin-reviewChecklist">{checklist.map((item) => <li key={item.text}><AdminIcon name={item.valid ? "check" : "close"} /><span>{item.text}{!item.valid && " — chưa đủ"}</span></li>)}</ul>
            {!api && storageError && <p className="admin-reviewError" role="alert">{storageError}</p>}
            {decision && <div className="admin-reviewOutcome" role="status">
              <strong>{decision.status === "APPROVED" ? "Đã phê duyệt gói tin." : "Đã từ chối gói tin."}</strong>
              <p>{decision.reviewer} · {dateTime.format(new Date(decision.decidedAt))}</p>
              {decision.reason && <p className="admin-reviewOutcomeReason">Lý do: {decision.reason}</p>}
              <p>{decision.status === "APPROVED" ? "Tin chưa được đăng công khai. Chủ nhà có thể thực hiện bước đăng bài." : "Chủ nhà cần sửa nội dung và gửi duyệt lại."}</p>
              <Link href="/admin/review-queue">Về hàng đợi kiểm duyệt →</Link>
            </div>}
            <button type="button" className="admin-reviewPrimary" disabled={disabled || !complete} onClick={() => setAction("APPROVED")}>Phê duyệt</button>
            <p className="admin-reviewDecisionHint">Phê duyệt cho phép chủ nhà đăng bài. Thao tác này không tự động đăng bài.</p>
            <button type="button" className="admin-reviewReject" disabled={disabled} onClick={() => setAction("REJECTED")}>Từ chối</button>
            <p className="admin-reviewDecisionNotice">Nếu nội dung thay đổi hoặc quản trị viên khác đã quyết định, bạn cần tải lại gói tin để xem nội dung và kết quả mới nhất.</p>
            {api && <button type="button" className="admin-reviewSecondary" onClick={onReload}>Tải lại gói tin</button>}
          </div>
          {!api && <AdminPreviewReset />}
        </aside>
      </div>
      {action && <AdminReviewDialog reviewPackage={reviewPackage} action={action} onClose={() => setAction(null)} onDecided={onDecided} onReload={onReload} />}
      {media && <MediaPreview label={media.label} photo={media.photo} onClose={() => setMedia(null)} />}
    </section>
  );
}
