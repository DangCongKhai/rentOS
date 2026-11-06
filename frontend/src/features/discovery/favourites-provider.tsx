"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuth, type AuthStatus } from "@/lib/auth-context";
import { FavouritesStore } from "@/lib/favourites-store";

const Context = createContext<{
  accountId: string | null;
  authStatus: AuthStatus;
  state: ReturnType<FavouritesStore["snapshot"]>;
  retry: () => void;
  toggle: (id: string) => void;
  prompt: () => void;
} | null>(null);

export function useFavourites() {
  return useContext(Context);
}

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const accountId = status === "authenticated" ? user?.id ?? null : null;
  const store = useMemo(() => new FavouritesStore(accountId), [accountId]);
  const state = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const [promptOpen, setPromptOpen] = useState(false);

  useLayoutEffect(() => {
    if (accountId !== null) return store.activate();
  }, [accountId, store]);

  useEffect(() => {
    if (!state.notice) return;
    const timer = window.setTimeout(store.dismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [state, store]);

  return (
    <Context.Provider value={{ accountId, authStatus: status, state, toggle: store.toggle, retry: store.retry, prompt: () => setPromptOpen(true) }}>
      {children}
      {promptOpen && status === "guest" && <GuestPrompt onClose={() => setPromptOpen(false)} />}
      {state.notice && (
        <div className="fixed right-4 bottom-4 z-[100] flex max-w-[calc(100%-2rem)] items-center gap-4 rounded-full bg-surface-nav-dark px-5 py-3 text-sm font-semibold text-white shadow-lg">
          <p role={state.notice === "error" ? "alert" : "status"}>
            {state.notice === "saved" ? "Đã lưu vào Yêu thích" : state.notice === "removed" ? "Đã bỏ khỏi Yêu thích" : "Không cập nhật được Yêu thích. Vui lòng thử lại."}
          </p>
          <button type="button" className="min-h-8 text-rentos-sky" onClick={store.dismiss}>Đóng</button>
        </div>
      )}
    </Context.Provider>
  );
}

export function FavouriteButton({ propertyId, className = "" }: { propertyId?: string; className?: string }) {
  const favourites = useFavourites();
  if (!favourites || !propertyId) return null;
  const { state, authStatus, prompt, toggle, retry } = favourites;
  const saved = state.ids.has(propertyId);

  return (
    <button type="button" aria-pressed={saved}
      aria-label={saved ? "Bỏ khỏi Yêu thích" : "Lưu vào Yêu thích"}
      disabled={authStatus === "loading" || state.status === "loading"}
      className={"grid size-11 place-items-center rounded-full bg-white shadow-md hover:bg-red-50 " + className}
      onClick={() => {
        if (authStatus === "guest") prompt();
        else if (state.status === "error") retry();
        else toggle(propertyId);
      }}>
      <Image src={saved ? "/images/favourites/heart-filled.svg" : "/images/favourites/heart-outline.svg"} alt=""
        width={saved ? 20 : 17.2375} height={saved ? 20 : 15.9893} />
    </button>
  );
}

function GuestPrompt({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-[440px] rounded-2xl bg-surface-card p-6 text-heading shadow-xl backdrop:bg-surface-nav-dark/50 sm:p-7"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <h2 id={titleId} className="text-[22px] font-bold">Đăng nhập để lưu tin</h2>
      <p className="mt-3 text-secondary">Tạo tài khoản hoặc đăng nhập để lưu các tin đăng bạn thích và xem lại bất cứ lúc nào.</p>
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button type="button" className="min-h-11 rounded-2xl border border-border-strong px-5 font-semibold text-link" onClick={onClose}>Để sau</button>
        <Link href="/login" onClick={onClose} className="inline-flex min-h-11 items-center rounded-2xl bg-action-primary px-5 font-semibold text-white">Đăng nhập</Link>
      </div>
    </dialog>
  );
}
