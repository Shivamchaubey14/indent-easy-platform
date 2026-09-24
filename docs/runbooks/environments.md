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

## Releasing (once the deployment pipeline exists)

1. Merge feature PRs into `dev`. CI builds the images once and DEV updates itself.
2. When DEV is ready for testing, tag the tested commit `vX.Y.Z-rc.1`. QA receives the **same
   image**. Test there, and fix issues on `dev` (`rc.2`, `rc.3`, …).
3. After QA sign-off, open a PR `dev` → `main` and merge it, then tag `vX.Y.Z` on `main`. The
   `production` environment asks for approval, and PROD receives the image that passed QA.
4. Rollback: re-point PROD to the previous release tag. The deploy agent also reverts on its own
   if the new version fails its health check.

## Moving to the office server

Copy `infrastructure/vm/` to the server, and put the base image and SSH key in place. Run the same
two scripts, adjusting `vmRoot` and the memory sizes in `environments.json` to the server. Names and
addresses stay the same, so nothing else changes. Move PROD data with a `pg_dump` restore, and
copy the MinIO buckets with `mc mirror`.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Not enough memory in the system to start the virtual machine` | Stop another VM or quit Docker Desktop, then start again |
| VM running but SSH `down` for more than 5 minutes | Open the VM console in Hyper-V Manager and run `cloud-init status --long` |
| VM has no internet | On the host: `Get-NetNat IE-Env-NAT`, and check that `vEthernet (IE-Env)` has 192.168.50.1 |
| Secure Boot failure at first boot | The VM needs the `MicrosoftUEFICertificateAuthority` template (`create-vms.ps1` sets it) |
