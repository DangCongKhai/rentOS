import { reviewQueuePreview } from "./admin-review-preview";
import type { AdminPackageDto } from "./admin-review-api";

export type ReviewUnit = {
  code: string;
  area: number;
  occupants: number;
  rent: number;
  deposit: number;
  minimumMonths: number;
  note: string;
  bathroom?: string;
};

const packageDetails = {
  "listing-1": {
    description: "Dãy studio 5 căn cách biển Mỹ Khê khoảng 300 m, mỗi căn đều có bếp nhỏ, điều hòa và nội thất cơ bản.",
    address: "Phường Phước Mỹ, Quận Sơn Trà, Đà Nẵng",
    amenities: ["Giặt chung", "Bãi xe có mái che", "Camera an ninh"],
    policies: ["Không thú cưng", "Không hút thuốc trong nhà", "Yên tĩnh sau 22:00"],
    cover: "Mặt tiền tòa nhà",
    email: "linh.example@email.com",
    otherListings: 1,
    listingVersion: 3,
    propertyVersion: 5,
    units: [
      { code: "S201", area: 24, occupants: 2, rent: 3800000, deposit: 3800000, minimumMonths: 3, note: "Hướng đông" },
      { code: "S202", area: 24, occupants: 2, rent: 3800000, deposit: 3800000, minimumMonths: 3, note: "Tầng 2" },
      { code: "S203", area: 28, occupants: 2, rent: 4200000, deposit: 4200000, minimumMonths: 3, note: "Có ban công" },
      { code: "S204", area: 30, occupants: 3, rent: 4500000, deposit: 4500000, minimumMonths: 3, note: "Không nuôi thú cưng" },
      { code: "S205", area: 26, occupants: 2, rent: 4000000, deposit: 4000000, minimumMonths: 3, note: "Tầng 2" },
    ],
    gallery: ["Mặt tiền", "Sảnh", "Khu giặt chung", "S201", "S202", "S203", "S204", "S205"],
  },
  "listing-2": {
    description: "Nhà trọ có 4 phòng khép kín gần Đại học Bách khoa, phù hợp sinh viên và người đi làm. Mỗi phòng có khu bếp và phòng tắm riêng.",
    address: "Phường Hòa Khánh Bắc, Quận Liên Chiểu, Đà Nẵng",
    amenities: ["Bãi để xe", "Wi-Fi", "Camera an ninh"],
    policies: ["Không hút thuốc trong phòng", "Yên tĩnh sau 22:00"],
    cover: "Mặt tiền nhà trọ",
    email: "hoa.example@email.com",
    otherListings: 0,
    listingVersion: 1,
    propertyVersion: 2,
    units: Array.from({ length: 4 }, (_, index) => ({ code: `P10${index + 1}`, area: 20 + index * 2, occupants: 2, rent: 2500000 + index * 100000, deposit: 2500000 + index * 100000, minimumMonths: 6, note: "Có khu bếp riêng" })),
    gallery: ["Mặt tiền", "Khu để xe", "P101", "P102", "P103", "P104"],
  },
  "listing-3": {
    description: "Căn hộ 2 phòng ngủ gần biển Mỹ An, có phòng khách, bếp đầy đủ thiết bị và ban công thoáng. Cho thuê nguyên căn dài hạn.",
    address: "Phường Mỹ An, Quận Ngũ Hành Sơn, Đà Nẵng",
    amenities: ["Thang máy", "Bảo vệ", "Bãi đỗ xe"],
    policies: ["Không hút thuốc trong nhà", "Tối đa 4 người"],
    cover: "Tòa nhà căn hộ Mỹ An",
    email: "quan.example@email.com",
    otherListings: 2,
    listingVersion: 2,
    propertyVersion: 3,
    units: [{ code: "A501", area: 65, occupants: 4, rent: 8500000, deposit: 8500000, minimumMonths: 6, note: "2 phòng ngủ · Có ban công" }],
    gallery: ["Mặt tiền", "Phòng khách", "A501"],
  },
  "listing-4": {
    description: "Hai studio yên tĩnh gần công viên 29/3, có ánh sáng tự nhiên, điều hòa và bếp nhỏ. Phù hợp người đi làm thuê dài hạn.",
    address: "Phường Chính Gián, Quận Thanh Khê, Đà Nẵng",
    amenities: ["Wi-Fi", "Khu giặt chung", "Bãi để xe"],
    policies: ["Không thú cưng", "Yên tĩnh sau 22:00"],
    cover: "Mặt tiền nhà phố Chính Gián",
    email: "thao.example@email.com",
    otherListings: 1,
    listingVersion: 1,
    propertyVersion: 2,
    units: [
      { code: "T201", area: 25, occupants: 2, rent: 3500000, deposit: 3500000, minimumMonths: 3, note: "Hướng công viên" },
      { code: "T202", area: 28, occupants: 2, rent: 3700000, deposit: 3700000, minimumMonths: 3, note: "Có ban công" },
    ],
    gallery: ["Mặt tiền", "Khu giặt chung", "T201", "T202"],
  },
} satisfies Record<string, {
  description: string; address: string; amenities: string[]; policies: string[];
  cover: string; email: string; otherListings: number; listingVersion: number;
  propertyVersion: number; units: ReviewUnit[]; gallery: string[];
}>;

export function getReviewPackage(id: string) {
  const listing = reviewQueuePreview.find((item) => item.id === id);
  const details = packageDetails[id as keyof typeof packageDetails];
  if (!listing || !details) return null;
  return { ...listing, ...details, submittedVersion: 1 };
}

export type ReviewPackage = Omit<NonNullable<ReturnType<typeof getReviewPackage>>, "units"> & { units: ReviewUnit[]; apiData?: AdminPackageDto };
