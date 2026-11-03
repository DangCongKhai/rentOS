"use client";

import { dashboardPreview } from "@/lib/admin-dashboard-preview";
import { useAdminReviewPreview } from "@/lib/admin-review-store";
import { getReviewQueue } from "@/lib/admin-review-queue";
import { adminPreviewMode, waitingLabel } from "@/lib/admin-review-api";
import { useAdminApi } from "@/components/admin/admin-api-provider";

export default function AdminPage() {
  const { items, decisions, ready } = useAdminReviewPreview();
  const { dashboard } = useAdminApi();
  const queue = getReviewQueue(items);
  const stats = !adminPreviewMode && dashboard ? [
    { title: "Bài đăng chờ duyệt lần đầu", value: dashboard.pending_count, description: dashboard.oldest_submitted_at ? `Chờ lâu nhất ${waitingLabel(dashboard.oldest_submitted_at)}` : "Không có tin chờ duyệt" },
    { title: "Báo cáo đang mở", value: dashboard.open_reports_count, description: "Báo cáo chưa xử lý xong" },
    { title: "Bài đăng đang bị đình chỉ", value: dashboard.suspended_count, description: "Tin đăng bị admin đình chỉ" },
  ] : dashboardPreview.stats.map((stat, index) => index === 0 ? {
    ...stat,
    value: ready ? queue.length : "…",
    description: queue[0] ? `Chờ lâu nhất ${queue[0].waiting}` : "Không có tin chờ duyệt",
  } : stat);
  const pendingRows = queue.slice(0, 2).map((item) => ({
    id: item.id, status: "Chờ duyệt", title: item.title,
    description: `Chủ nhà ${item.owner} · ${item.units} căn · ${item.photos} ảnh`, elapsed: item.waiting,
  }));
  const waiting = !adminPreviewMode && dashboard ? dashboard.waiting.map((item) => ({ id: item.id, status: "Chờ duyệt", title: item.title, description: `Chủ nhà ${item.owner.name} · ${item.units_count} căn · ${item.photos_count} ảnh`, elapsed: waitingLabel(item.submitted_at) })) : [pendingRows[0], dashboardPreview.waiting[1], pendingRows[1]].filter((item) => item !== undefined);
  const localActivities = Object.values(decisions)
    .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt))
    .map((decision) => ({
      id: `local-${decision.listingId}`, actor: decision.reviewer,
      action: decision.status === "APPROVED" ? "đã phê duyệt" : "đã từ chối",
      target: items.find((item) => item.id === decision.listingId)?.title ?? decision.listingId,
      at: decision.decidedAt,
      label: new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(decision.decidedAt)),
    }));
  const activities = !adminPreviewMode && dashboard ? dashboard.activities.map((item) => ({ id: item.id, actor: item.actor_name ?? "Hệ thống", action: item.action === "listing.approved" ? "đã phê duyệt" : item.action === "listing.rejected" ? "đã từ chối" : item.action, target: item.title ?? "Tin đăng", at: item.created_at, label: new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at)) })) : [...localActivities, ...dashboardPreview.activities].slice(0, 5);
  return (
    <section aria-labelledby="dashboard-title">
      <div className="admin-pageHeading">
        <h1 id="dashboard-title">Bảng điều khiển</h1>
        {adminPreviewMode && <span className="admin-previewLabel">Bản xem trước · Dữ liệu mẫu</span>}
      </div>
      <div className="admin-stats">
        {stats.map((stat) => (
          <article key={stat.title} className="admin-statCard">
            <h2>{stat.title}</h2>
            <p className="admin-statValue">{stat.value}</p>
            <p className="admin-statDescription">{stat.description}</p>
          </article>
        ))}
      </div>
      <div className="admin-panels">
        <section className="admin-panel" aria-labelledby="waiting-title">
          <h2 id="waiting-title" className="admin-panelHeading">Chờ lâu nhất</h2>
          <ul className="admin-waitingList">
            {waiting.length === 0 && <li className="admin-waitingRow">Không có bài đăng nào đang chờ.</li>}
            {waiting.map((item) => (
              <li key={item.id} className="admin-waitingRow">
                <span className="admin-statusBadge">{item.status}</span>
                <div className="admin-waitingDetails"><h3>{item.title}</h3><p>{item.description}</p></div>
                <span className="admin-elapsed">{item.elapsed}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="admin-panel" aria-labelledby="activity-title">
          <h2 id="activity-title" className="admin-panelHeading">Hoạt động gần đây</h2>
          <ol className="admin-activityList">
            {activities.length === 0 && <li className="admin-activityRow">Chưa có hoạt động kiểm duyệt.</li>}
            {activities.map((activity) => (
              <li key={activity.id} className="admin-activityRow">
                <p><strong>{activity.actor}</strong> {activity.action} <span className="admin-activityTarget">{activity.target}</span></p>
                <time dateTime={activity.at}>{activity.label}</time>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
