# Security

Use Fortify accounts and Sanctum SPA sessions with CSRF on all browser mutations. Configure exact credentialed origins, stateful hosts/ports, HTTPS and protected session cookies. Scope independent personal API tokens to explicitly supported endpoints and current-user resources; require current Policies for both modes. No browser login creates a PAT.

Store password/reset-token/API-token hashes; show a PAT secret once and never persist it in public responses, logs, Telescope or replay caches. Token management requires a verified active browser session; mutations require CSRF and recent password confirmation. Browser logout and PAT revocation are separate. Password reset/change and account suspension invalidate all sessions/PATs.

Laravel owns users/profile/session/reset/token tables in the private application schema. Eloquent direct SQL does not automatically enforce Supabase auth.uid() RLS: use restricted database roles and Laravel Policies. Keep service credentials server-only and private contract storage private. Supabase Auth is outside the target architecture.

Telescope is local by default. Enabled nonlocal access requires a tested session/admin gate and redaction. Test real session/CSRF and bearer behavior; explicitly defeat the Laravel CSRF testing bypass. See [authentication setup](../07-architecture/authentication-setup.md).
