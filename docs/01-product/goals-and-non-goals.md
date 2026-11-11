# Goals and non-goals

## Goals

- Independently manage properties, units and public listings; make location/date search and private favourites usable.
- Keep requests pending during discussion and accept them only when a tenancy proposal transaction succeeds.
- Prevent double allocation through PostgreSQL constraints and temporary reservations.
- Preserve immutable contract versions and require both parties to acknowledge the same version; renew through new consecutive segments.
- Satisfy the actual course tooling and evidence: Sanctum, Scramble, Telescope, queues/workers, tests, caching and measured resource/query improvements.

## Outside the initial MVP

Phone OTP/KYC, property/photo moderation, image-replacement review, in-app chat/viewing calendar, payments, verified legal e-signatures, confirmed mid-term agreement amendments, Kafka/RabbitMQ/Elasticsearch and AI thumbnails. Maps/geocoding, Google OAuth, property reviews and a dedicated changes-requested moderation state remain P2 deferred. Automated browser/E2E suites and TypeScript generator integration are not required.
