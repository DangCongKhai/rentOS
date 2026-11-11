# Tenancy lifecycle
1. From an existing PENDING rental request, the owner submits a tenancy proposal with one ORIGINAL contract and explicit owner acknowledgement. Request becomes ACCEPTED, tenancy PENDING_CONFIRMATION, blocked dates/deadline set atomically.
2. Tenant confirms the same contract UUID/document hash before deadline: tenancy CONFIRMED, confirmed projection set, pending pointer/deadline cleared. Calendar arrival alone does not confirm or activate.
3. Owner records actual move-in on/after agreed start: ACTIVE. Owner records end/cancellation explicitly with reason and actual timestamps; do not fabricate move-out from date expiry.
4. Tenant declines initial proposal: AWAITING_REVISION, proposed hold released. Corrected row may reacquire dates under same tenancy. Expired original is EXPIRED and terminal; cancelled original is CANCELLED and terminal. A new rental request is required to restart those terminal cases.
5. A renewal request is PENDING until its proposed RENEWAL row gets mutual confirmation. During confirmation block the extra dates, retain existing agreed span/rent. On decline/expiry release only extra span; request stays PENDING unless explicitly withdrawn/rejected.

An ACCEPTED rental request remains historical proposal acceptance even if the proposal later expires or is declined. Display request and tenancy state together.
