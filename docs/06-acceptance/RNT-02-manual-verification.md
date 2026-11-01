# RNT-02 manual verification

Run these checks against the local Supabase stack and a signed-in owner account after applying Laravel migrations. Record the date, environment, and screenshots or request IDs beside each completed item.

## Property and unit management

- [ ] Create a whole-space property. Confirm its initial unit is created and the property remains a draft when address or terms are incomplete.
- [ ] Create a separate-unit property with at least three rooms. Edit one row's label, rent, deposit, minimum term, occupancy, unit amenities, amenity details, and additional rules before saving.
- [ ] Submit a duplicate label or invalid row in a bulk batch. Confirm no rows from that batch are saved.
- [ ] Edit a property's address, shared amenities, amenity details, policies, and shared rules. Save an unrelated field afterward and confirm the details remain.
- [ ] Mark a marketed room `MAINTENANCE` while another complete `READY` marketed room remains. Confirm the status saves and any tenancy/agreement rows remain unchanged.
- [ ] Archive a property and a unit. Confirm they disappear from active lists and their historical records remain.

## Photos and Supabase Storage

- [ ] Upload a valid JPG, PNG, and WebP to the configured private `property-media` bucket. Confirm each object is uploaded, the API returns a signed preview URL, and each completed upload has one media row.
- [ ] Upload an invalid MIME type and an image larger than 10 MB. Confirm validation fails and no media row is created.
- [ ] Temporarily point only the local test environment to a nonexistent bucket (or use a controlled Storage outage), attempt an upload, and restore the correct bucket setting. Confirm the UI shows a safe error and no media row is created.
- [ ] Upload multiple photos to a property and to a unit. Confirm selecting another file does not replace earlier photos.
- [ ] Reorder and deselect unit photos, save, reload, and confirm the order and selection persisted. Confirm the same-property unit restriction is enforced.
- [ ] Attempt to deselect the current cover or the final required unit photo. Confirm the API rejects the invalid change and leaves the gallery unchanged.

## Listing lifecycle and public display

- [ ] Create and edit a listing draft independently from property creation. Submit it and confirm the review state is separate from publication state.
- [ ] Try to submit with one READY advertised unit missing a selected photo. Confirm submission fails with that unit identified; select a photo and retry.
- [ ] Approve the first submission as an admin, publish as the owner, hide, republish, then archive. Verify each state in the owner screen and public API.
- [ ] With no move-in date, confirm public search excludes units with a tenancy conflict at any point from today through that unit's minimum rental term. Confirm a free sibling unit can still make the listing appear.
- [ ] Open a public unit detail. Confirm effective pet and smoking policies and the combined shared and unit-specific rules are shown.
- [ ] Change advertised property and unit rules after a contract exists. Confirm the contract's stored `policies_snapshot` remains byte-for-byte unchanged.
- [ ] Edit valid content after initial approval. Confirm the approved listing remains directly editable and changes are audited without another moderation submission.

## Concurrency and full journey

- [ ] Race admin approval against a property/photo edit on PostgreSQL. Confirm an outdated submitted revision cannot be approved.
- [ ] Race changing a unit to maintenance against a new rental proposal. Confirm the property/unit row locks and status/revision checks produce one consistent result.
- [ ] Race unit archival against allocation. Confirm allocation cannot attach to an archived unit and archival cannot silently remove an existing tenancy.
- [ ] Complete the owner and admin journey through the first approved listing and RNT-04 request/contract confirmation flow.

## Location picker

- [ ] Load provinces and wards through the Laravel `/api/v1/locations/*` endpoints. Confirm the browser makes no direct request to `tinhthanhpho.com`, and retry messaging appears when the upstream service is unavailable.
