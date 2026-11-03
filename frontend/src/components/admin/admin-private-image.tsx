"use client";

import { useEffect, useState } from "react";
import { adminMediaUrl, type AdminMedia } from "@/lib/admin-review-api";

export function AdminPrivateImage({ media }: { media: AdminMedia }) {
  const [state, setState] = useState<{ id: string; src?: string; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    fetch(adminMediaUrl(media.url), { credentials: "include", cache: "no-store", signal: controller.signal, headers: { Accept: "image/*" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không tải được ảnh");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ id: media.id, src: objectUrl });
      }).catch(() => {
        if (!controller.signal.aborted) setState({ id: media.id, error: "Không tải được ảnh" });
      });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [media.id, media.url]);
  if (state?.id !== media.id || !state.src) return <span>{state?.id === media.id && state.error ? state.error : "Đang tải ảnh…"}</span>;
  // A private image needs the browser session; Next's image proxy cannot forward it.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="admin-privateImage" src={state.src} alt={media.caption ?? "Ảnh được chọn cho tin đăng"} />;
}
