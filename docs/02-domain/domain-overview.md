# Domain overview
Property is the physical container. Unit is the independently rentable space. WHOLE_SPACE has one auto-created unit even when its UI hides unit creation. Listing is one current property-level advertisement reusing linked property/unit content. Media links to a property and optionally one of its units.

A rental request is a tenant application/contact record, kept pending throughout discussion. Tenancy is the continuing tenant-unit relationship. tenancy_contracts contains immutable submitted ORIGINAL/RENEWAL segment versions and embedded write-once confirmations. tenancy_renewal_requests records proposals to continue occupancy. Listing reports and audit logs preserve decisions and changes.

favourite_properties is a private user-property relationship independent of date availability and listing turnover. A saved row never authorizes access to hidden content.
