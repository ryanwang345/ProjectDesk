# Sign in with Keycloak

Keycloak sign-in is enabled by default. The deployed app uses the existing
`https://keycloak.ryanwang.dev/realms/homelab` issuer configured in
`ProjectDesk-GitOps/platform-infra/keycloak.yaml` and
`platform-infra/oauth2-proxy.yaml`. The React app uses the official
`keycloak-js` adapter with the authorization code flow and PKCE S256. Access and
refresh tokens stay in memory. The Go API verifies RS256 signatures against
cached Keycloak signing keys and checks issuer, API audience, expiry, subject,
token type, and not-before time. App routes mount only after sign-in, and API
requests refresh the access token before sending it. Logout ends the Keycloak
session and returns to the sign-in screen.

## Local app setup

```bash
docker compose up --build -d
```

Compose starts Postgres, the API, and the web app. It connects to the existing
homelab Keycloak at `https://keycloak.ryanwang.dev`; Keycloak runs outside this
repository. Before signing in at [LinguaDesk](http://localhost:47291), import
`apps/keycloak/homelab-projectdesk-web-client.json` into the **homelab** realm.
The client import includes local redirect and web origins on ports 47291 and
47311 for both `localhost` and `127.0.0.1`. Use the homelab account you
already have.

For frontend development, start Postgres, run the Go API with
`DATABASE_URL=postgres://projectdesk:projectdesk@127.0.0.1:54329/projectdesk?sslmode=disable`,
then run `npm run dev:web`. No frontend environment variables or client secret
are needed: the app reads public configuration from `GET /api/auth/config`.

## Existing Keycloak server

Configure these environment variables on the Go API. The defaults target the
existing homelab realm.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PROJECT_DESK_KEYCLOAK_URL` | `https://keycloak.ryanwang.dev` | Browser-accessible Keycloak base URL; tokens must use this issuer plus `/realms/{realm}`. |
| `PROJECT_DESK_KEYCLOAK_REALM` | `homelab` | Existing homelab realm. |
| `PROJECT_DESK_KEYCLOAK_CLIENT_ID` | `projectdesk-web` | Public SPA client. |
| `PROJECT_DESK_KEYCLOAK_AUDIENCE` | `projectdesk-api` | Required access-token audience. |
| `PROJECT_DESK_KEYCLOAK_JWKS_URL` | Issuer plus `/protocol/openid-connect/certs` | Optional signing-key endpoint; does not change issuer validation. Compose uses the public homelab endpoint. |
| `PROJECT_DESK_AUTH_DISABLED` | `0` | Set exactly `1` for isolated local tests that intentionally bypass authentication. |

Create a public OpenID Connect client with **Standard flow** enabled, **Client
authentication**, **Implicit flow**, and **Direct access grants** disabled, and
PKCE set to **S256**. Retain the default **basic** client scope, which supplies
the access token's `sub` claim. Configure exact web origins and restrict valid redirect
and post-logout redirect URIs to your app. Add an audience protocol mapper with
the configured API audience in **access tokens**; leave it out of ID tokens.
See [Keycloak's JavaScript adapter documentation](https://www.keycloak.org/securing-apps/javascript-adapter).

Compose already sets the public homelab issuer and signing-key endpoint.
Production must use HTTPS for both the app and Keycloak.

The existing `headlamp` client in the homelab realm belongs to oauth2-proxy and
uses a client secret; a browser SPA needs its own public `projectdesk-web`
client. The ready-to-import client configuration is
`apps/keycloak/homelab-projectdesk-web-client.json`. Import it into the
**homelab** realm's Clients section in Keycloak Admin Console, then check its
redirect URIs against the hostnames you actually use. If the client already
exists, add any missing URIs to it in the console; importing a second client
with the same ID is unnecessary. The list includes
`https://staging.ryanwang.dev/*` for the staging URL observed in the browser.
It includes the
`projectdesk-api` audience mapper. The live realm currently reports **Client
not found** for `projectdesk-web`; the API will reject access tokens until this
client and mapper exist there.

## API access and permissions

All API routes require `Authorization: Bearer <access-token>`, except the public
sign-in configuration and GET health/readiness probes. Authentication failures
return `401` with a bearer challenge. The API does not fall back to anonymous
access when Keycloak is unavailable. Signing keys are cached and refreshed by
the OIDC verifier when Keycloak rotates them.

The app remains a **shared workspace**: sign-in does not create separate project,
vocabulary, or learning databases per account. Existing browser preferences and
saved local progress also remain browser-scoped. This change does not introduce
user roles or record ownership.

If `PROJECT_DESK_ADMIN_TOKEN` is set, AI settings mutations additionally require
`X-ProjectDesk-Admin-Token`. The settings UI sends this extra credential while
retaining the Keycloak access token in `Authorization`. For local tests with
sign-in explicitly disabled, the previous admin bearer credential still works.

Existing Cypress functional specs assume an unauthenticated local stack. Run
them only against an isolated API started with `PROJECT_DESK_AUTH_DISABLED=1`.
Never set this bypass on a shared or production environment.

## Verification

```bash
cd apps/api
go test -mod=vendor ./...
cd ../web
npm run build
npm run lint
```

Auth tests use signed RSA tokens and a local JWKS endpoint to check valid tokens,
cached keys, modified signatures, wrong issuers/audiences, expired or premature
tokens, rejected ID/refresh tokens, public probes, fail-closed configuration,
and the explicit local bypass. Manually verify sign-in, deep-link return,
refresh, and logout with your configured identity provider.
