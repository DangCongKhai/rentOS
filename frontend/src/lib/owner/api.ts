import { ApiError, request } from "@/lib/http/client";
import type { OwnerRentalRequestSummary, OwnerRentalRequestDetail, OwnerProperty, AmenityCatalogEntry, OwnerPropertyDetail, OwnerPropertyMedia, OwnerListing, OwnerUnit } from "./types";

export async function getOwnerRentalRequests(): Promise<
  OwnerRentalRequestSummary[]
> {
  return request<OwnerRentalRequestSummary[]>("/api/v1/owner/rental-requests");
}

export async function getOwnerRentalRequest(
  rentalRequestId: string,
): Promise<OwnerRentalRequestDetail> {
  return request<OwnerRentalRequestDetail>(
    `/api/v1/owner/rental-requests/${encodeURIComponent(rentalRequestId)}/proposal-context`,
  );
}

export async function getOwnerProperties(
  includeArchived = false,
): Promise<OwnerProperty[]> {
  const query = includeArchived ? "?include_archived=1" : "";
  const result = await request<OwnerProperty[] | { data: OwnerProperty[] }>(
    `/api/v1/owner/properties${query}`,
  );
  return Array.isArray(result) ? result : result.data;
}

export async function getAmenityCatalog(): Promise<AmenityCatalogEntry[]> {
  return request<AmenityCatalogEntry[]>("/api/v1/owner/amenities");
}

export async function getOwnerProperty(
  propertyId: string,
): Promise<OwnerPropertyDetail> {
  const property = await request<OwnerPropertyDetail>(
    `/api/v1/owner/properties/${propertyId}`,
  );
  return {
    ...property,
    units: Array.isArray(property.units) ? property.units : [],
  };
}

export async function getOwnerPropertyMedia(
  propertyId: string,
): Promise<OwnerPropertyMedia[]> {
  return request<OwnerPropertyMedia[]>(
    `/api/v1/owner/properties/${propertyId}/media`,
  );
}

export async function getOwnerListingById(
  listingId: string,
): Promise<OwnerListing> {
  return request<OwnerListing>(`/api/v1/owner/listings/${listingId}`);
}

export async function getOwnerListing(
  propertyId: string,
): Promise<OwnerListing | null> {
  try {
    return await request<OwnerListing>(
      `/api/v1/owner/properties/${propertyId}/listing`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function createOwnerListing(
  propertyId: string,
  input: {
    client_operation_id: string;
    title: string;
    description: string;
    cover_media_id: string | null;
  },
): Promise<OwnerListing> {
  return request<OwnerListing>(
    `/api/v1/owner/properties/${propertyId}/listing`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateOwnerListing(
  propertyId: string,
  input: {
    expected_content_revision: number;
    title: string;
    description: string;
    cover_media_id: string | null;
  },
): Promise<OwnerListing> {
  return request<OwnerListing>(
    `/api/v1/owner/properties/${propertyId}/listing`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

async function listingAction(
  propertyId: string,
  action: "submit" | "publish" | "hide" | "archive",
  expectedContentRevision: number,
): Promise<OwnerListing> {
  return request<OwnerListing>(
    `/api/v1/owner/properties/${propertyId}/listing/${action}`,
    {
      method: "POST",
      body: JSON.stringify({
        expected_content_revision: expectedContentRevision,
      }),
    },
  );
}

export async function submitOwnerListing(
  propertyId: string,
  expectedContentRevision: number,
): Promise<OwnerListing> {
  return listingAction(propertyId, "submit", expectedContentRevision);
}

export async function publishOwnerListing(
  propertyId: string,
  expectedContentRevision: number,
): Promise<OwnerListing> {
  return listingAction(propertyId, "publish", expectedContentRevision);
}

export async function hideOwnerListing(
  propertyId: string,
  expectedContentRevision: number,
): Promise<OwnerListing> {
  return listingAction(propertyId, "hide", expectedContentRevision);
}

export async function archiveOwnerListing(
  propertyId: string,
  expectedContentRevision: number,
): Promise<OwnerListing> {
  return listingAction(propertyId, "archive", expectedContentRevision);
}

export async function createOwnerProperty(
  input: Record<string, unknown>,
): Promise<OwnerPropertyDetail> {
  return request<OwnerPropertyDetail>("/api/v1/owner/properties", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateOwnerProperty(
  propertyId: string,
  input: Record<string, unknown>,
): Promise<OwnerPropertyDetail> {
  return request<OwnerPropertyDetail>(
    `/api/v1/owner/properties/${propertyId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function archiveOwnerProperty(
  propertyId: string,
  expectedContentRevision: number,
): Promise<OwnerPropertyDetail> {
  return request<OwnerPropertyDetail>(
    `/api/v1/owner/properties/${propertyId}/archive`,
    {
      method: "PATCH",
      body: JSON.stringify({
        expected_content_revision: expectedContentRevision,
      }),
    },
  );
}

export async function createOwnerUnit(
  propertyId: string,
  input: Record<string, unknown>,
): Promise<OwnerUnit> {
  return request<OwnerUnit>(`/api/v1/owner/properties/${propertyId}/units`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateOwnerUnit(
  propertyId: string,
  unitId: string,
  input: Record<string, unknown>,
): Promise<OwnerUnit> {
  return request<OwnerUnit>(
    `/api/v1/owner/properties/${propertyId}/units/${unitId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function archiveOwnerUnit(
  propertyId: string,
  unitId: string,
  expectedContentRevision: number,
): Promise<OwnerUnit> {
  return request<OwnerUnit>(
    `/api/v1/owner/properties/${propertyId}/units/${unitId}/archive`,
    {
      method: "PATCH",
      body: JSON.stringify({
        expected_content_revision: expectedContentRevision,
      }),
    },
  );
}

export async function createOwnerUnitBatch(
  propertyId: string,
  input: Record<string, unknown>,
): Promise<OwnerUnit[]> {
  return request<OwnerUnit[]>(
    `/api/v1/owner/properties/${propertyId}/units/bulk`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function uploadOwnerMedia(
  propertyId: string,
  input: {
    file: File;
    client_operation_id: string;
    expected_content_revision: number;
    unit_id?: string;
    caption?: string;
  },
): Promise<{ media: OwnerPropertyMedia; content_revision: number }> {
  const body = new FormData();
  body.set("photo", input.file);
  body.set("client_operation_id", input.client_operation_id);
  body.set(
    "expected_content_revision",
    String(input.expected_content_revision),
  );
  if (input.unit_id) body.set("unit_id", input.unit_id);
  if (input.caption) body.set("caption", input.caption);
  return request<{ media: OwnerPropertyMedia; content_revision: number }>(
    `/api/v1/owner/properties/${propertyId}/media`,
    { method: "POST", body },
  );
}

export async function updateOwnerGallery(
  propertyId: string,
  input: {
    expected_content_revision: number;
    items: Array<{
      media_id: string;
      revision: number;
      sort_order: number;
      is_selected_for_listing: boolean;
    }>;
  },
): Promise<OwnerPropertyMedia[]> {
  return request<OwnerPropertyMedia[]>(
    `/api/v1/owner/properties/${propertyId}/gallery`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function saveOwnerUnitSharedMedia(
  propertyId: string,
  unitId: string,
  input: {
    expected_content_revision: number;
    media_ids: string[];
  },
): Promise<{ content_revision: number }> {
  return request<{ content_revision: number }>(
    `/api/v1/owner/properties/${propertyId}/units/${unitId}/shared-media`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function updateOwnerUnitGallery(
  propertyId: string,
  unitId: string,
  input: {
    expected_content_revision: number;
    items: Array<{
      media_id: string;
      revision: number;
      sort_order: number;
      is_selected_for_listing: boolean;
    }>;
  },
): Promise<OwnerPropertyMedia[]> {
  return request<OwnerPropertyMedia[]>(
    `/api/v1/owner/properties/${propertyId}/units/${unitId}/gallery`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function removeOwnerMedia(
  propertyId: string,
  mediaId: string,
  expectedContentRevision: number,
  revision: number,
): Promise<OwnerPropertyMedia> {
  return request<OwnerPropertyMedia>(
    `/api/v1/owner/properties/${propertyId}/media/${mediaId}`,
    {
      method: "DELETE",
      body: JSON.stringify({
        expected_content_revision: expectedContentRevision,
        revision,
      }),
    },
  );
}
