# Runbook: DEV, QA and PROD environments

Indent Easy runs in three environments, each on its own Ubuntu 26.04 LTS virtual machine under
Hyper-V on a Windows host. Work reaches production only through testing:

```text
feature/* ──PR──► dev ──► DEV ──rc tag──► QA (testing, UAT) ──sign-off, release tag, approval──► PROD
```

| Environment | VM name | Address | Hostname |
|---|---|---|---|
| DEV | `DEV` | 192.168.50.11 | `dev.indent-easy.local` |
| QA | `QA` | 192.168.50.12 | `qa.indent-easy.local` |
| PROD | `PROD` | 192.168.50.13 | `prod.indent-easy.local` |

All definitions live in [`infrastructure/vm/environments.json`](../../infrastructure/vm/environments.json).

## Interim host: the development laptop

The laptop has 2 CPU cores and 8 GB RAM. Each VM starts with 768 MB and can grow to 2 GB.

- Run **at most two VMs at once**, and quit Docker Desktop while they run, because its WSL VM also
  holds memory.
- Typical sessions: `DEV` alone while integrating; `DEV` + `QA` while testing a release; `PROD`
  on its own for demos.
- The laptop is not a production server: no redundancy, and PROD is down whenever the laptop is
  off. Go-live waits for the office server (SRS R-18, OQ-022).

## First-time setup

1. **SSH key.** A key for the VMs is created once:
   `ssh-keygen -t ed25519 -N "" -C indent-easy-vms -f ~/.ssh/indent_easy_vms`
2. **Base image.** Download the Ubuntu 26.04 cloud image into `D:\VMs\IndentEasy\base\` and verify
   it against Ubuntu's `SHA256SUMS`.
3. **Disks and seed ISOs** (Docker must be running, no admin needed):
   ```powershell
   powershell -ExecutionPolicy Bypass -File infrastructure\vm\prepare-images.ps1
   ```
4. **Network and VMs** (administrator, approve the UAC prompt):
   ```powershell
   Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File D:\indent-easy\infrastructure\vm\create-vms.ps1 -Start DEV -ForUser $env:USERNAME"
   ```
   This creates:
   - the `IE-Env` internal switch, with 192.168.50.1 as the host's address and NAT to the internet
   - the three VMs, not started except those named in `-Start`
   - hosts-file names for the three environments

   `-ForUser` adds your normal account to *Hyper-V Administrators*, so after you next sign in you
   can start and stop the VMs without admin rights. Pass it from your normal shell as shown,
   because UAC may elevate as a different account. The log is at
   `D:\VMs\IndentEasy\create-vms.log`.
   If switch creation fails with "Internal miniport create failed … already exists", run the
   script again. Hyper-V rolls the half-made switch back cleanly, and on the laptop the second
   attempt succeeded.
5. **First boot** takes 2–4 minutes while cloud-init installs Docker and updates. Watch with
   `vm.ps1 status` until SSH shows `up`.

## Everyday use

```powershell
powershell -File infrastructure\vm\vm.ps1 status          # all environments
powershell -File infrastructure\vm\vm.ps1 start DEV QA    # start
powershell -File infrastructure\vm\vm.ps1 stop QA         # clean shutdown
powershell -File infrastructure\vm\vm.ps1 ssh DEV         # shell as ieadmin
```

On a VM: `cloud-init status --long` shows provisioning, `docker ps` shows running containers,
`/etc/indent-easy/environment` names the environment, and `/opt/indent-easy` holds the deployment.

## Releasing

```text
merge to dev ──CI green──► image sha-abc1234 ──► tag dev ──► DEV deploys it
git tag v1.2.0-rc.1 (on a dev commit) ─────────► tag qa  ──► QA deploys the same image
merge dev → main, git tag v1.2.0 + approval ──► tag prod ──► PROD deploys the image QA tested
```

1. **DEV:** merge feature PRs into `dev`. When every CI job passes, the image built from that commit
   is pushed as `sha-<commit>`, and the `dev` tag moves to it. DEV deploys it within about two minutes.
2. **QA:** tag the commit you want tested, which must already be on `dev`, and push the tag:
   ```sh
   git tag v1.2.0-rc.1 <commit> && git push origin v1.2.0-rc.1
   ```
   The *Release* workflow points `qa` at that commit's image; nothing is rebuilt. Fix problems on
   `dev`, then tag `v1.2.0-rc.2`, and so on.
3. **PROD:** after QA signs off, open a PR `dev` → `main` and merge it, then tag `main`:
   ```sh
   git tag v1.2.0 origin/main && git push origin v1.2.0
   ```
   The workflow waits for your approval (*Actions → the run → Review deployments*). It then
   checks that `main` is identical to the last release candidate, and points `prod` at the image QA
   tested. If `main` differs from what QA tested, it refuses.
4. **Rollback:** open *Actions → Release*, find the run for the previous version (for example
   `v1.1.0`) and choose *Re-run all jobs*. After approval, PROD goes back to that image. The agent
   also rolls back by itself if a new version never becomes ready.

GitHub environments enforce this: `dev` deploys only from the `dev` branch, `qa` only from
`v*-rc.*` tags, and `production` only from `v*` tags and only with approval.

**One-time step after the first image is published:** open
*github.com/Shivamchaubey14 → Packages → indent-easy-api → Package settings* and set the visibility
to **Public**. The VMs then pull without credentials. The image contains no secrets; the code is
already public. To keep it private instead, run `docker login ghcr.io` on each VM with a
read-only (`read:packages`) token.

## How a VM deploys

Each VM runs the stack in `/opt/indent-easy`, installed from the laptop:

```sh
bash infrastructure/deploy/install.sh DEV    # or QA / PROD; safe to re-run
```

The installer:
- copies `compose.yaml`, the deploy agent (`deploy.sh`) and the systemd units
- on first install, **generates the environment's secrets on the VM** (`/opt/indent-easy/.env`, mode
  600). They never leave the machine; re-running the installer keeps them, and keeps the data
- enables `indent-easy-deploy.timer`, which runs the agent every two minutes

Each VM runs this stack:

```text
:80 ─► web (NGINX: the app + proxy) ─► api-a ┐
                                     └► api-b ┴─► postgres, redis
```

The agent follows this environment's tag (`dev`, `qa` or `prod`) for **both** images, the API and
the web tier. When either points at a new digest it rolls the release out one piece at a time:

1. runs the migrator, if the API image changed
2. replaces `api-a` and waits until it is healthy, then does the same for `api-b`. One replica
   always serves; NGINX retries a request on the other replica if it hits one mid-restart
3. replaces `web`, if the web image changed
4. checks `/health/ready` through the web tier
5. if any step fails, **rolls the previous pair of digests back out** the same way. The failed pair
   is remembered, so it isn't retried every two minutes; the next tag move clears it.

| File on the VM | Meaning |
|---|---|
| `state/current-api`, `state/current-web` / `state/previous` | Digests running now / before the last deploy |
| `state/last-deploy.json` | Last result: `deployed`, `rolled-back`, `failed` or `rollback-failed` |
| `state/failed` + `state/failed-deploy.log` | Digest that failed, with container status, health checks and logs |

```sh
ssh -i ~/.ssh/indent_easy_vms ieadmin@192.168.50.11 journalctl -fu indent-easy-deploy   # follow DEV
```

Measured on DEV, with requests through the web tier every 0.1–0.2 s:

| Release | Result |
|---|---|
| New API image | **0 failed requests** (67/67), about 16 s |
| Broken API image | **0 failed requests** (492/492); `api-a` rolled back, `api-b` never touched |
| New web image | about **0.6 s** unavailable: one NGINX container owns port 80 |
| First deploy / after a VM reboot | 34 s / about 100 s |
| One-time switch from the old single-API layout | about 8 s unavailable |

API releases, the common case, cause no downtime. Web-only releases cause a sub-second gap; release
those outside the busiest hours.

## Moving to the office server

Copy `infrastructure/vm/` to the server, and put the base image and SSH key in place. Run the same
two scripts, adjusting `vmRoot` and the memory sizes in `environments.json` to the server. Names and
addresses stay the same, so nothing else changes. Move PROD data with a `pg_dump` restore, and
copy the MinIO buckets with `mc mirror`.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Not enough memory in the system to start the virtual machine` | Stop another VM or quit Docker Desktop, then start again |
| Agent logs `cannot pull ... denied` | The image isn't published yet, or the GHCR package is still private (see the one-time step above) |
| `last-deploy.json` says `rolled-back` | Read `state/failed-deploy.log` on the VM; fix, merge and let CI move the tag again |
| VM running but SSH `down` for more than 5 minutes | Open the VM console in Hyper-V Manager and run `cloud-init status --long` |
| VM has no internet | On the host: `Get-NetNat IE-Env-NAT`, and check that `vEthernet (IE-Env)` has 192.168.50.1 |
| Secure Boot failure at first boot | The VM needs the `MicrosoftUEFICertificateAuthority` template (`create-vms.ps1` sets it) |
