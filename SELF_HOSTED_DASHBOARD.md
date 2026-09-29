# Self-hosted dashboard boundary

The editor now has an explicit `backendCapabilities.dashboard` capability. It
is resolved at the backend boundary with the same precedence as persistence:

- Revyme Cloud keeps the Cloud dashboard contract.
- self-hosted persistence selects the Orange & Gray dashboard shell.
- standalone/local mode keeps the existing single-project editor behavior.

The self-hosted shell owns `/dashboard` and opens projects at
`/builder/<project-id>`. Project names, revisions, timestamps, creation, and
loading come from the control plane (`GET /api/projects`, `POST /api/projects`,
and `GET /api/projects/:id`). Browser localStorage is not an authority for the
project list. The root path remains accepted as a compatibility entry point
for existing development bookmarks; new navigation uses `/dashboard`.

The current deployment deliberately exposes one development workspace from the
authenticated control-plane session. It does not pretend to offer workspace
switching, membership management, invitations, or role administration. Those
surfaces should be added only with server-enforced identity and authorization:

1. establish an authenticated browser session and resolve the current user;
2. load workspaces through memberships, with server-side tenant scoping;
3. enforce project access (`owner`, `editor`, `viewer`) on every read/write;
4. add invitations, membership changes, and role transitions as audited API
   operations;
5. apply the same identity checks to save, publish, promotion, rollback, and
   asset operations rather than trusting editor-supplied workspace IDs.

Until that work is complete, any future Settings/Members affordance should be a
non-functional placeholder, not a client-side permission model.
