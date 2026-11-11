# Performance and resource loading

Course Task6b/6d require lazy/code-split noncritical resources, responsive/compressed WebP/AVIF-capable image delivery where supported, reasonable JS/CSS bundles, bounded pagination, eager loading/indexes and N+1 prevention. Contract document UI downloads on demand. Benchmark a seeded listing query and record query count/latency before/after; exact latency budget and load dataset are to be agreed and measured, not fabricated. Do not introduce an AI thumbnail service. Prevent flash of stale account favourites and cancel/discard out-of-order search responses.

Validation is part of feature/engineering issues and PR evidence. Tool versions/configuration must match the local installed framework; no invented pass result.
