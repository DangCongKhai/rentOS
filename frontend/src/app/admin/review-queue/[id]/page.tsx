import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AdminReviewDetail } from "@/components/admin/admin-review-detail";
import { AdminReviewLoader } from "@/components/admin/admin-review-loader";
import { getReviewPackage } from "@/lib/admin-review-package";

export const metadata: Metadata = { title: "Đánh giá gói tin đăng — rentOS" };

async function ReviewPackageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (process.env.NEXT_PUBLIC_ADMIN_DATA_MODE !== "preview") return <AdminReviewLoader id={id} />;
  const reviewPackage = getReviewPackage(id);
  if (!reviewPackage) notFound();
  return <AdminReviewDetail reviewPackage={reviewPackage} />;
}

export default function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="admin-reviewLoading" role="status">Đang tải gói tin đăng…</p>}><ReviewPackageContent params={params} /></Suspense>;
}
