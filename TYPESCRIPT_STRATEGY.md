# TypeScript strategy

rentOS keeps API types explicit for now. Scramble is installed so the Laravel API can publish an OpenAPI document, but this repository does not generate TypeScript from that document yet.

## What is installed

- Package: `dedoc/scramble`
- Local docs: `http://localhost:8000/docs/api`
- OpenAPI JSON: `http://localhost:8000/docs/api.json`

Run the backend and open those URLs after migrations. Feature owners document their endpoints by adding normal Laravel Form Requests and API Resources. Scramble reads those.

## Later generation

When the API is stable enough to share generated types:

1. Export the OpenAPI document from Scramble.
2. Generate TypeScript with a tool such as `openapi-typescript`.
3. Put the generated file in the frontend and import it from the API client.

Do not add a CI check that fails when generated files drift until the team actually commits those files. Do not install or run the generator as part of the current setup.

## What to do until then

Write the response types used by a feature next to that feature. When a response changes, update the type and the test that reads the response. A generated client is a later replacement, not a requirement for finishing a feature.
