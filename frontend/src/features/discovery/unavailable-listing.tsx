import Link from "next/link";

export function UnavailableListing() {
  return (
    <section className="mx-auto flex min-h-[50vh] w-full max-w-lg items-center px-4 py-16">
      <div className="grid w-full justify-items-center gap-3 rounded-2xl border border-border-default bg-white px-8 py-12 text-center">
        <h1 className="text-2xl font-semibold text-heading">Bài đăng này hiện không khả dụng</h1>
        <p className="text-sm text-secondary">
          Bài đăng có thể đã được gỡ hoặc không còn hiển thị công khai. Hãy tiếp tục tìm những chỗ ở khác phù hợp với bạn.
        </p>
        <Link href="/listings" className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-action-primary px-5 font-semibold text-white">
          Quay lại trang tìm kiếm
        </Link>
      </div>
    </section>
  );
}
