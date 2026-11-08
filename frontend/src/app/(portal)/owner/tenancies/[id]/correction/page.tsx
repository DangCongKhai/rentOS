"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { DateField } from "@/components/ui/date-field";
import {
  ApiError,
  correctOwnerTenancyProposal,
  getOwnerTenancyTimeline,
  type TenancyContractRecord,
  type TenancyTimeline,
} from "@/lib/auth-api";

type PolicySnapshot = {
  property: Record<string, unknown>;
  unit: Record<string, unknown>;
};

function readSnapshot(
  value: TenancyContractRecord["policies_snapshot"],
): PolicySnapshot {
  let parsed: unknown = value;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { property: {}, unit: {} };
  }

  const root = parsed as Record<string, unknown>;
  const property =
    root.property && typeof root.property === "object" && !Array.isArray(root.property)
      ? (root.property as Record<string, unknown>)
      : {};
  const unit =
    root.unit && typeof root.unit === "object" && !Array.isArray(root.unit)
      ? (root.unit as Record<string, unknown>)
      : {};

  return { property, unit };
}

function rulesToText(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((rule): rule is string => typeof rule === "string").join("\n")
    : "";
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return [error.message, ...Object.values(error.errors).flat()]
      .filter(Boolean)
      .join(" ");
  }

  return "Không thể gửi phiên bản mới. Vui lòng thử lại.";
}

function CorrectionForm({
  tenancyId,
  source,
}: {
  tenancyId: string;
  source: TenancyContractRecord;
}) {
  const router = useRouter();
  const snapshot = readSnapshot(source.policies_snapshot);

  const [startDate, setStartDate] = useState(source.start_date.slice(0, 10));
  const [endDate, setEndDate] = useState(source.end_date.slice(0, 10));
  const [rent, setRent] = useState(String(source.monthly_rent));
  const [deposit, setDeposit] = useState(String(source.deposit_amount));
  const [pets, setPets] = useState(
    String(snapshot.unit.pets ?? snapshot.property.pets ?? "ASK_OWNER"),
  );
  const [smoking, setSmoking] = useState(
    String(snapshot.unit.smoking ?? snapshot.property.smoking ?? "ASK_OWNER"),
  );
  const [rules, setRules] = useState(
    rulesToText(snapshot.unit.additional_rules),
  );
  const [document, setDocument] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!document) {
      setError("Chọn tài liệu hợp đồng PDF mới.");
      return;
    }

    if (
      document.type !== "application/pdf" &&
      !document.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Tài liệu hợp đồng phải là tệp PDF.");
      return;
    }

    if (document.size > 10 * 1024 * 1024) {
      setError("Tài liệu PDF không được vượt quá 10 MB.");
      return;
    }

    if (!acknowledged) {
      setError("Xác nhận đã kiểm tra chính xác phiên bản hợp đồng mới.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await correctOwnerTenancyProposal(tenancyId, {
        client_operation_id: crypto.randomUUID(),
        supersedes_contract_id: source.id,
        start_date: startDate,
        end_date: endDate,
        monthly_rent: Number(rent),
        deposit_amount: Number(deposit),
        policies_snapshot: {
          property: snapshot.property,
          unit: {
            ...snapshot.unit,
            pets,
            smoking,
            additional_rules: rules
              .split(/\r?\n/)
              .map((rule) => rule.trim())
              .filter(Boolean),
          },
        },
        agreement_document: document,
      });

      router.push(`/owner/tenancies/${result.tenancy_id}`);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-5 px-1 py-4 sm:px-2 sm:py-6">
      <Link
        href={`/owner/tenancies/${tenancyId}`}
        className="text-sm font-semibold text-[#3368a0] hover:underline"
      >
        ← Quay lại kỳ thuê
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Gửi phiên bản hợp đồng mới
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Phiên bản mới sẽ thay thế phiên bản {source.version_number}. Người
          thuê cần xác nhận lại hợp đồng này.
        </p>
      </header>

      <form
        onSubmit={(event) => void submit(event)}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField
            name="start_date"
            label="Ngày bắt đầu"
            defaultValue={startDate}
            onValueChange={setStartDate}
            picker
          />
          <DateField
            name="end_date"
            label="Ngày kết thúc"
            defaultValue={endDate}
            onValueChange={setEndDate}
            picker
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
            Giá thuê tháng (₫)
            <input
              type="number"
              min="1"
              step="1"
              required
              value={rent}
              onChange={(event) => setRent(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-300 px-3.5 text-base font-normal"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
            Tiền đặt cọc (₫)
            <input
              type="number"
              min="0"
              step="1"
              required
              value={deposit}
              onChange={(event) => setDeposit(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-300 px-3.5 text-base font-normal"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
            Chính sách thú cưng
            <select
              value={pets}
              onChange={(event) => setPets(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base font-normal"
            >
              <option value="NOT_ALLOWED">Không cho phép</option>
              <option value="WITH_APPROVAL">Cần phê duyệt</option>
              <option value="ALLOWED">Được phép</option>
              <option value="ASK_OWNER">Trao đổi với chủ nhà</option>
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
            Chính sách hút thuốc
            <select
              value={smoking}
              onChange={(event) => setSmoking(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base font-normal"
            >
              <option value="NOT_ALLOWED">Không cho phép</option>
              <option value="OUTDOOR_ONLY">Chỉ ngoài trời</option>
              <option value="ALLOWED">Được phép</option>
              <option value="ASK_OWNER">Trao đổi với chủ nhà</option>
            </select>
          </label>
        </div>

        <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
          Nội quy bổ sung, mỗi dòng một mục
          <textarea
            rows={4}
            value={rules}
            onChange={(event) => setRules(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-base font-normal"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
          Tài liệu hợp đồng PDF mới (tối đa 10 MB)
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setDocument(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm font-normal"
          />
        </label>

        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-1 size-4 accent-[#3368a0]"
          />
          <span>
            Tôi xác nhận đã kiểm tra các điều khoản và tài liệu của phiên bản
            mới trước khi gửi cho người thuê.
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={submitting || !acknowledged}
            className="min-h-11 rounded-xl bg-[#3368a0] px-5 text-sm font-semibold text-white hover:bg-[#285584] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Đang gửi…" : "Gửi phiên bản mới"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function OwnerTenancyCorrectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [timeline, setTimeline] = useState<TenancyTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    void getOwnerTenancyTimeline(id)
      .then((result) => {
        if (active) setTimeline(result);
      })
      .catch((caught: unknown) => {
        if (!active) return;

        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }

        setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, retry, router]);

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-4xl px-1 py-6">
        <p
          aria-busy="true"
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
        >
          Đang tải thông tin kỳ thuê…
        </p>
      </section>
    );
  }

  if (error || !timeline) {
    return (
      <section className="mx-auto w-full max-w-4xl px-1 py-6">
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error || "Không tìm thấy kỳ thuê."}
        </p>
        {error && (
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              setRetry((value) => value + 1);
            }}
            className="mt-3 font-semibold text-[#3368a0] underline"
          >
            Thử lại
          </button>
        )}
      </section>
    );
  }

  const source = timeline.contracts[timeline.contracts.length - 1];
  const canCorrect =
    timeline.tenancy.status === "AWAITING_REVISION" &&
    source?.type === "ORIGINAL" &&
    source.tenant_rejected_at !== null &&
    source.tenant_confirmed_at === null;

  if (!canCorrect || !source) {
    return (
      <section className="mx-auto w-full max-w-4xl space-y-4 px-1 py-6">
        <Link
          href={`/owner/tenancies/${id}`}
          className="text-sm font-semibold text-[#3368a0] hover:underline"
        >
          ← Quay lại kỳ thuê
        </Link>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Chỉ có thể gửi phiên bản mới khi đề xuất gần nhất đã bị người thuê từ
          chối.
        </p>
      </section>
    );
  }

  return <CorrectionForm tenancyId={id} source={source} />;
}
