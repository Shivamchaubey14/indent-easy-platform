# Authentication: operating it

How sign-in works is in SRS §30. This page covers what operators do.

## The first administrator

Nobody can sign in until an account exists. Create the first one from the command line; the
password is read from standard input (or `IE_NEW_PASSWORD`), never from the arguments.

```sh
# local
printf '%s\n' 'a long passphrase of your own' | pnpm user:create --email you@shwetdhara.in --name "Your Name"

# on a VM (DEV/QA/PROD), in /opt/indent-easy
printf '%s\n' 'a long passphrase' | docker compose run --rm -T api dist/cli/create-user.js \
  --email admin@shwetdhara.in --name "Administrator" --temporary
```

`--temporary` makes the user choose a new password at first sign-in. Passwords need 12 to 128
characters, must not contain the user's e-mail name or employee code, and must not appear in known
breaches (checked through Have I Been Pwned's k-anonymity API; only a 5-character hash prefix
leaves the server). There are no composition rules.

Roles and scopes for that user come with the authorization step of Phase 1.

## Signing keys

Access tokens are ES256 JWTs. `JWT_SIGNING_KEYS` holds one or more private keys as
`kid:<base64 PKCS#8 DER>`, comma-separated. The first key signs; every listed key verifies and
appears in `/.well-known/jwks.json`.

- `install.sh` generates a key on each VM, and replaces the placeholder that VMs installed before
  authentication existed still have. **After pulling this change, re-run
  `infrastructure/deploy/install.sh <ENV>` for each existing VM before its next deploy**, or the
  new API refuses to start there and the agent rolls back.
- Rotation (every 90 days): generate a key with
  `openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 | openssl pkcs8 -topk8 -nocrypt -outform DER | base64 -w0`,
  put it **first** in the list (`knew:<key>,kold:<key>`), deploy, and remove the old key after
  the access-token lifetime (10 minutes) has passed.
- Locally the variable is empty: each API start makes a temporary key, so access tokens end on
  restart (the web app refreshes them).

## Lockouts and sessions

- Five wrong passwords within 15 minutes lock an account for 15 minutes. The lock clears itself.
  Every attempt is recorded in `audit.security_event` and `audit.login_event`.
- Password reset, password change and "sign out everywhere" revoke sessions immediately: the
  session goes on a Redis deny-list, so its access token stops working at once.
- A refresh token that is used twice ends its whole session (someone copied it). The event is
  `REFRESH_REUSE_DETECTED`.

```sql
-- recent security events for one user
SELECT occurred_at, type, outcome, ip, details
FROM audit.security_event WHERE user_id = '<uuid>' ORDER BY occurred_at DESC LIMIT 20;
```

## Password reset e-mails

The reset link points at `PUBLIC_BASE_URL/reset-password#token=…`, works once, and expires after
30 minutes. The token is in the URL fragment, so it never reaches server logs. Locally every
e-mail lands in Mailpit (http://localhost:8025).

## Cookies over plain HTTP

The refresh cookie is `Secure` only when `PUBLIC_BASE_URL` is `https://`. The VMs are still plain
HTTP on the internal network; TLS for them is an open item before any real user signs in there.
