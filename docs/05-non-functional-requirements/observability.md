# Error/performance monitoring and alerts

Khai installs/configures Telescope in RNT-01: provider/assets/migrations/private-schema storage, request/exception/query/job watchers, filtering, access restrictions and scheduled telescope:prune retention. Demonstrate controlled local records without secrets. Do not expose a deployed APP_ENV=local dashboard.

Tri’s RNT-12 adds request/job correlation, safe user-facing error references, critical-error reports, deduplicated individual slow-query alerts and CPU/memory/disk/network monitoring for the actual app/worker host. A query shown in Telescope is not an alert delivered to an operator. State provider visibility limits rather than inventing managed-database metrics. Failed alert delivery must not recurse or corrupt business outcomes; preserve redacted fallback logs.

Test watcher/config/access/redaction/pruning at setup; test threshold/dedup/delivery failures and actual controlled alert receipt in RNT-12. No application measurements or alerts are claimed executed in this pack.


Official Telescope configuration/pruning/access reference: https://laravel.com/docs/12.x/telescope. Choose the matching installed framework version; these docs do not prove a package has been installed.


Official Telescope configuration/pruning/access reference: https://laravel.com/docs/12.x/telescope. Choose the matching installed framework version; these docs do not prove a package has been installed.
