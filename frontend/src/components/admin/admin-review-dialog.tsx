"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { dashboardPreview } from "@/lib/admin-dashboard-preview";
import type { ReviewPackage } from "@/lib/admin-review-package";
import { ReviewDecisionError } from "@/lib/admin-review-decision";
import { savePreviewDecision, useAdminReviewPreview } from "@/lib/admin-review-store";
import { AdminIcon } from "./admin-icons";
import { decideAdminPackage, type AdminPackageDto } from "@/lib/admin-review-api";
import { ApiError, initializeCsrf } from "@/lib/auth-api";
import { useAdminApi } from "./admin-api-provider";

export function AdminReviewDialog({ reviewPackage, action, onClose, onDecided, onReload }: {
  reviewPackage: ReviewPackage;
  action: "APPROVED" | "REJECTED";
  onClose: () => void;
  onDecided?: (data: AdminPackageDto) => void;
  onReload?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const { user } = useAuth();
  const { refresh } = useAdminApi();
  const { decisions, storageError } = useAdminReviewPreview();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [csrfExpired, setCsrfExpired] = useState(false);
  const isRejection = action === "REJECTED";
  const api = reviewPackage.apiData;
  const decided = api ? api.moderation_status !== "PENDING" : Boolean(decisions[reviewPackage.id]);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    if (isRejection) reasonField.current?.focus();
    return () => { element?.close(); };
  }, [isRejection]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    if (isRejection && !reason.trim()) {
      setReasonError("Vui lòng nhập lý do từ chối.");
      reasonField.current?.focus();
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      if (api) {
        const signature = JSON.stringify([reviewPackage.id, action, api.snapshot_token, reason.trim()]);
        if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
        const updated = await decideAdminPackage(reviewPackage.id, action, api.snapshot_token, operation.current.id, reason);
        onDecided?.(updated);
      } else await savePreviewDecision({
        listingId: reviewPackage.id,
        status: action,
        reason,
        reviewer: user?.name ?? dashboardPreview.administrator,
        decidedAt: new Date().toISOString(),
        expectedVersion: reviewPackage.submittedVersion,
        currentVersion: reviewPackage.submittedVersion,
      });
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError) {
        if (failure.status === 409) setConflict(true);
        if (failure.status === 419) setCsrfExpired(true);
        if ([401, 403].includes(failure.status)) refresh();
        if (failure.errors.reason?.[0]) setReasonError(failure.errors.reason[0]);
        setError(failure.status === 419 ? "Phiên bảo mật hết hạn. Khôi phục phiên rồi xác nhận lại quyết định." : failure.message);
      } else if (failure instanceof ReviewDecisionError) {
        if (failure.code === "reason") setReasonError(failure.message);
        else setError(failure.message);
      } else {
        setError(api ? "Chưa xác nhận được kết quả lưu. Kiểm tra kết nối rồi bấm xác nhận lại để nhận kết quả của cùng thao tác." : "Không lưu được quyết định mẫu. Hãy kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.");
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className="admin-reviewDialog" aria-labelledby="review-dialog-title" onCancel={(event) => {
      event.preventDefault();
      if (!inFlight.current) onClose();
    }}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="admin-reviewDialogHeading">
          <h2 id="review-dialog-title">{isRejection ? "Từ chối gói tin đăng" : "Phê duyệt gói tin đăng?"}</h2>
          <button type="button" aria-label="Đóng hộp thoại" onClick={onClose} disabled={saving}><AdminIcon name="close" /></button>
        </div>
        <p className="admin-reviewDialogListing">{reviewPackage.title}</p>
        <p>{isRejection
          ? "Lý do sẽ được lưu cùng quyết định. Chủ nhà cần sửa nội dung và gửi duyệt lại."
          : "Bạn xác nhận đã xem toàn bộ nội dung. Phê duyệt cho phép chủ nhà đăng bài, không tự động công khai bài đăng."}</p>
        {isRejection && (
          <div className="admin-reviewReason">
            <label htmlFor="rejection-reason">Lý do từ chối <span>(bắt buộc)</span></label>
            <textarea id="rejection-reason" ref={reasonField} value={reason} maxLength={1000} required rows={5}
              aria-invalid={Boolean(reasonError)} aria-describedby="rejection-hint rejection-error"
              onChange={(event) => { setReason(event.target.value); setReasonError(""); }}
              onBlur={() => { if (dialog.current?.open && !reason.trim()) setReasonError("Vui lòng nhập lý do từ chối."); }}
              placeholder="Nêu rõ nội dung cần chủ nhà sửa trước khi gửi duyệt lại" />
            <p id="rejection-hint">Tối đa 1.000 ký tự · {reason.length}/1.000</p>
            <p id="rejection-error" className="admin-reviewFieldError" role="alert">{reasonError}</p>
          </div>
        )}
        {(error || (!api && storageError) || decided) && <p className="admin-reviewError" role="alert">{error || (!api && storageError) || "Tin đã có quyết định từ cửa sổ khác. Hãy đóng hộp thoại để xem kết quả."}</p>}
        {conflict && <button type="button" className="admin-reviewSecondary" onClick={() => { onClose(); onReload?.(); }}>Tải lại để xem xét lại</button>}
        {csrfExpired && <button type="button" className="admin-reviewSecondary" disabled={saving} onClick={async () => {
          setSaving(true);
          try { await initializeCsrf(); setCsrfExpired(false); setError("Đã khôi phục phiên bảo mật. Bạn có thể xác nhận lại."); }
          catch { setError("Không khôi phục được phiên. Hãy tải lại trang và đăng nhập lại."); }
          finally { setSaving(false); }
        }}>Khôi phục phiên bảo mật</button>}
        {!api && <p className="admin-reviewLocalNote">Chỉ lưu trong trình duyệt này; chưa gửi tới hệ thống của nhóm.</p>}
        <div className="admin-reviewDialogActions">
          <button type="button" className="admin-reviewSecondary" onClick={onClose} disabled={saving}>Hủy</button>
          <button type="submit" className={isRejection ? "admin-reviewDanger" : "admin-reviewPrimary"} disabled={saving || decided || conflict || csrfExpired || (!api && Boolean(storageError))}>
            {saving ? "Đang lưu…" : isRejection ? "Xác nhận từ chối" : "Xác nhận phê duyệt"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
