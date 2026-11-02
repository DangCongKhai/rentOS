"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ProfileRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const verified = searchParams.get("verified");
    if (verified) {
      router.replace(`/tenant/profile?verified=${verified}`);
    } else {
      router.replace("/tenant/profile");
    }
  }, [router, searchParams]);

  return <p className="text-center py-12 text-slate-500">Đang chuyển hướng…</p>;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-center py-12 text-slate-500">Đang chuyển hướng…</p>}>
      <ProfileRedirect />
    </Suspense>
  );
}
