export type OwnerProperty = {
  id: string;
  owner_id: string;
  client_operation_id: string;
  name: string;
  property_type: string;
  rental_arrangement: string;
  city: string | null;
  policies?: unknown;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OwnerPropertyDetail = OwnerProperty & {
  address_line: string | null;
  ward: string | null;
  description: string | null;
  content_revision: number;
  property_type: string;
  rental_arrangement: string;
  shared_amenities: AmenityDocument;
  policies: PropertyPolicies;
  units: OwnerUnit[];
};

export type OwnerPropertyMedia = {
  id: string;
  property_id: string;
  unit_id: string | null;
  caption: string | null;
  sort_order: number;
  is_selected_for_listing: boolean;
  revision: number;
  mime_type: string;
  size_bytes: number;
  preview_url: string | null;
  assigned_unit_ids?: string[];
};

export type OwnerListing = {
  id: string;
  property_id: string;
  client_operation_id: string;
  title: string;
  description: string;
  cover_media_id: string | null;
  moderation_status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  publication_status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  submitted_revision: number | null;
  submitted_content_revision: number | null;
  approved_content_revision: number | null;
  review_reason: string | null;
  admin_suspended_at: string | null;
  archived_at: string | null;
  property_content_revision: number;
};

export type AmenityDocument = {
  schema_version: number;
  standard: Record<string, { enabled: boolean; details?: string | null }>;
  custom: string[];
};

export type PropertyPolicies = {
  schema_version: number;
  pets: string;
  smoking: string;
  shared_rules: string[];
};

export type OwnerUnit = {
  id: string;
  property_id: string;
  label: string;
  unit_kind: string;
  description: string | null;
  floor: string | null;
  area_m2: string | number | null;
  bedrooms: number;
  bathrooms: string | number;
  bathroom_arrangement: string;
  amenities: AmenityDocument;
  advertised_monthly_rent: string | number | null;
  deposit: string | number | null;
  minimum_rental_months: number;
  max_occupants: number | null;
  operational_status: "READY" | "MAINTENANCE" | "RETIRED";
  is_marketed: boolean;
  policy_overrides: {
    pets?: string;
    smoking?: string;
    additional_rules?: string[];
  };
  archived_at: string | null;
};

export type AmenityCatalogEntry = {
  key: string;
  label: string;
  label_vi?: string;
  scopes: string[];
};

export type OwnerRentalRequestSummary = {
  id: string;
  status: string;
  desired_move_in_date: string;
  desired_end_date: string;
  message: string;
  contact_name: string;
  contact_phone: string;
  created_at: string;
  closed_at: string | null;
  outcome_reason: string | null;
  listing_title: string;
  property_name: string;
  city: string | null;
  preferred_unit_label: string | null;
  tenancy_id: string | null;
};

export type OwnerProposalUnit = {
  id: string;
  label: string;
  operational_status: "READY" | "MAINTENANCE" | "RETIRED";
  monthly_rent: number | string | null;
  deposit_amount: number | string | null;
  minimum_rental_months: number;
  policy_overrides: OwnerUnit["policy_overrides"];
  has_date_conflict: boolean;
};

export type OwnerRentalRequestDetail = {
  request: OwnerRentalRequestSummary & {
    preferred_unit_id: string | null;
    listing_id: string;
    property_id: string;
    policies: PropertyPolicies | string;
  };
  property_policies: PropertyPolicies;
  units: OwnerProposalUnit[];
};
