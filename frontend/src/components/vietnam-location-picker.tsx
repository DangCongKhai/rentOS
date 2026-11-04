"use client";

import { useEffect, useState } from "react";

const API_BASE = `${(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")}/api/v1/locations`;

type AdministrativeUnit = {
  code: string;
  name: string;
};

type ApiResponse = {
  success: boolean;
  data: AdministrativeUnit[] | { data?: AdministrativeUnit[] };
};

async function loadUnits(url: string): Promise<AdministrativeUnit[]> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error("Could not load locations");
  }

  const result = (await response.json()) as ApiResponse;
  if (!result.success) {
    throw new Error("Could not load locations");
  }

  const data = Array.isArray(result.data) ? result.data : result.data.data;
  return (data ?? []).map((unit) => ({ code: unit.code, name: unit.name }));
}

export type SelectedLocation = {
  city: string;
  ward: string;
  cities: string[];
  wards: string[];
};

export function VietnamLocationPicker({
  cityName = "city",
  wardName = "ward",
  initialCity = "",
  initialWard = "",
  required = true,
  onLocationChange,
}: {
  cityName?: string;
  wardName?: string;
  initialCity?: string;
  initialWard?: string;
  required?: boolean;
  onLocationChange?: (location: SelectedLocation) => void;
}) {
  const [cities, setCities] = useState<AdministrativeUnit[]>([]);
  const [wards, setWards] = useState<AdministrativeUnit[]>([]);
  const [cityCode, setCityCode] = useState("");
  const [city, setCity] = useState(initialCity);
  const [ward, setWard] = useState(initialWard);
  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingWards, setLoadingWards] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    loadUnits(`${API_BASE}/provinces`)
      .then((units) => {
        if (active) {
          setCities(units);
          const selected = units.find((unit) => unit.name === initialCity);
          if (selected) {
            setLoadingWards(true);
            setCityCode(selected.code);
          }
        }
      })
      .catch(() => {
        if (active) setError("Không tải được danh sách tỉnh/thành. Vui lòng thử lại.");
      })
      .finally(() => {
        if (active) setLoadingCities(false);
      });

    return () => {
      active = false;
    };
  }, [initialCity, retry]);

  useEffect(() => {
    if (!cityCode) {
      return;
    }

    let active = true;

    loadUnits(`${API_BASE}/provinces/${encodeURIComponent(cityCode)}/wards`)
      .then((units) => {
        if (active) setWards(units);
      })
      .catch(() => {
        if (active) setError("Không tải được danh sách phường/xã. Vui lòng thử lại.");
      })
      .finally(() => {
        if (active) setLoadingWards(false);
      });

    return () => {
      active = false;
    };
  }, [cityCode, retry]);

  useEffect(() => {
    onLocationChange?.({
      city,
      ward,
      cities: cities.map((unit) => unit.name),
      wards: wards.map((unit) => unit.name),
    });
  }, [city, ward, cities, wards, onLocationChange]);

  function selectCity(code: string) {
    setCityCode(code);
    setCity(cities.find((unit) => unit.code === code)?.name ?? "");
    setWard("");
    setWards([]);
    setLoadingWards(Boolean(code));
    setError("");
  }

  const selectClassName = "min-h-11 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-11 text-sm text-slate-900 focus:border-[#3368a0] focus:outline-none focus:ring-2 focus:ring-[#3368a0]/20 disabled:bg-slate-100";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium text-slate-700">
        Tỉnh / thành phố
        <div className="relative mt-1">
          <select
            className={selectClassName}
            value={cityCode}
            onChange={(event) => selectCity(event.target.value)}
            disabled={loadingCities}
            required={required}
          >
            <option value="">{loadingCities ? "Đang tải…" : "Chọn tỉnh / thành phố"}</option>
            {cities.map((unit) => <option key={unit.code} value={unit.code}>{unit.name}</option>)}
          </select>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-slate-700"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <input type="hidden" name={cityName} value={city} />
        <input type="hidden" name={`${cityName}_code`} value={cityCode} />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Phường / xã (cấp huyện cũ)
        <div className="relative mt-1">
          <select
            className={selectClassName}
            name={wardName}
            value={ward}
            onChange={(event) => setWard(event.target.value)}
            disabled={!cityCode || loadingWards}
            required={required}
          >
            <option value="">{loadingWards ? "Đang tải…" : "Chọn phường / xã"}</option>
            {wards.map((unit) => <option key={unit.code} value={unit.name}>{unit.name}</option>)}
          </select>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-slate-700"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </label>

      {error && <div className="flex items-center gap-3 text-sm text-rose-700 sm:col-span-2" role="alert"><span>{error}</span><button type="button" onClick={() => { setError(""); setRetry((value) => value + 1); }} className="font-semibold underline">Thử lại</button></div>}
    </div>
  );
}
