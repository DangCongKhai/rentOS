export type RoomDraft = {
  label: string;
  labelEdited: boolean;
  customized: boolean;
  unit_kind: string;
  area_m2: string;
  rent: string;
  deposit: string;
  minimum_rental_months: string;
  max_occupants: string;
  bedrooms: string;
  bathrooms: string;
  description: string;
};

export function emptyRoom(label: string): RoomDraft {
  return {
    label,
    labelEdited: false,
    customized: false,
    unit_kind: "ROOM",
    area_m2: "",
    rent: "",
    deposit: "",
    minimum_rental_months: "3",
    max_occupants: "1",
    bedrooms: "0",
    bathrooms: "1",
    description: "",
  };
}
