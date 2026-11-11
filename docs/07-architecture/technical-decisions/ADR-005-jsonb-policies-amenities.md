# Controlled standard/custom JSONB amenities

Status: agreed project design; implementation unverified.

## Decision and reason

Use the relational core plus bounded property/unit policy and amenity JSONB. Code-managed allowlisted canonical keys and explicit aliases drive filters; custom descriptions stay local/display-only. Normalize custom labels with NFC/trim/whitespace and case-fold local dedup; preserve accents. Automatic global slugification does not identify synonyms. Snapshot actually agreed policies in immutable contracts.

## Consequences and validation

Apply the owning module requirements and acceptance scenarios; update the related API/data/workflow/issue documents together if the decision changes. Record actual implementation tests and evidence rather than treating this ADR as proof of working code.
