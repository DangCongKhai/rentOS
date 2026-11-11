# Immutable contract versions and same-version acknowledgement

Status: agreed project design; implementation unverified.

## Decision and reason

Use tenancy_contracts under one tenancy. Store immutable negotiated terms/document/hash and embedded write-once owner/tenant acknowledgements. Never create contract_versions or contract_confirmations tables. Correct unconfirmed proposals by a new version; renew by a new consecutive segment. Both parties must acknowledge the same current UUID/hash before deadline.

## Consequences and validation

Apply the owning module requirements and acceptance scenarios; update the related API/data/workflow/issue documents together if the decision changes. Record actual implementation tests and evidence rather than treating this ADR as proof of working code.
