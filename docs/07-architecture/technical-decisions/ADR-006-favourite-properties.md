# Private property-level favourites

Status: agreed project design; implementation unverified.

## Decision and reason

Unique user/property identity in favourite_properties; PUT intended-state save and idempotent DELETE. Guest sign-in prompt without queued save. Serialize local heart intent and reconcile failure. Hidden/suspended targets remain generic removable placeholders with no hidden details. Saving allocates no unit and reveals no contact.

## Consequences and validation

Apply the owning module requirements and acceptance scenarios; update the related API/data/workflow/issue documents together if the decision changes. Record actual implementation tests and evidence rather than treating this ADR as proof of working code.
