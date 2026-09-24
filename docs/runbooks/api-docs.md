# Runbook: the API documentation site

The docs site (`apps/docs`) is built from the contracts and the API build on every CI run. It is
published to **Cloudflare Pages** and protected by **Cloudflare Access**, so only approved people
can open it. They sign in with a one-time PIN sent to their e-mail address.

| What | Where |
|---|---|
| Live site | `https://indent-easy-docs.pages.dev` (or the `DOCS_URL` repository variable) |
| Build locally | `pnpm docs:build` → `apps/docs/dist` |
| Preview locally | `pnpm docs:dev` → http://localhost:4700 |
| Every CI run | The built site is attached as the `api-docs` artifact |
| Publishing | The `docs-deploy` job in `.github/workflows/ci.yml`, on pushes to `dev` |

## Safety rules built into the pipeline

- **The deploy refuses to run** unless an anonymous request to the site is already redirected to
  the Cloudflare Access login (`scripts/ci/assert-access-gate.sh`). Without the gate, nothing is
  published.
- **After deploying** it checks again: the site, the OpenAPI file, and the deployment's own
  preview URL must all require sign-in. Otherwise the job fails.
- The site sends `noindex` headers and has no third-party scripts. The REST viewer's AI and MCP
  features are off.

## One-time setup

Do these **in this order**. The Access gate must exist before the first deploy.

### 1. Cloudflare account and API token

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. Copy your **Account ID**: *Workers & Pages → Overview*, right-hand side.
3. Create an API token: *My Profile → API Tokens → Create Token → Create Custom Token*
   - Name: `indent-easy-docs-deploy`
   - Permissions: **Account → Cloudflare Pages → Edit** (nothing else)
   - Account resources: your account
   - Copy the token; it is shown only once.

### 2. Create the Pages project (empty)

*Workers & Pages → Create → Pages → Upload assets*. Name it **`indent-easy-docs`**, then close
the page without uploading anything. The CI job can also create it, but Access needs it to exist.
If Cloudflare shows a different `*.pages.dev` address (the name was taken), note it for step 5.

### 3. Cloudflare Access (the login gate)

1. Open <https://one.dash.cloudflare.com>, choose a team name, and pick the **Free** plan (up to
   50 users). Cloudflare may ask for a payment method; the free plan is not charged.
2. *Access → Applications → Add an application → Self-hosted*.
   - Application name: `Indent Easy API docs`
   - Session duration: 24 hours
   - Public hostnames: add **`indent-easy-docs.pages.dev`** and **`*.indent-easy-docs.pages.dev`**.
     The second one covers each deployment's preview URL.
3. Add a policy:
   - Action: **Allow**
   - Include: **Emails** → the addresses allowed to read the docs
4. Login methods: keep **One-time PIN**.
5. Save. Opening the site in a private window should now show the Cloudflare Access login.

### 4. GitHub secrets

Run these from the repository folder. `gh` prompts for each value, so it never appears in your
shell history or in chat:

```sh
gh secret set CLOUDFLARE_ACCOUNT_ID --repo Shivamchaubey14/indent-easy-platform
gh secret set CLOUDFLARE_API_TOKEN  --repo Shivamchaubey14/indent-easy-platform
```

### 5. Only if the address differs

```sh
gh variable set DOCS_URL --body "https://<your-project>.pages.dev" --repo Shivamchaubey14/indent-easy-platform
```

The next push to `dev` publishes the docs. To publish immediately, re-run the latest CI run on
`dev` from the *Actions* tab.

## Managing who can read the docs

Edit the policy in *Zero Trust → Access → Applications → Indent Easy API docs → Policies*. Removing
an e-mail address blocks that person at their next sign-in; to cut access immediately, revoke
their session under *Zero Trust → My Team → Users*.
