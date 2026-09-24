<#
.SYNOPSIS
  Builds the per-environment disks and cloud-init seed ISOs for the DEV, QA and PROD VMs.

.DESCRIPTION
  Does not need administrator rights. Uses Docker (qemu-img, xorriso in an Alpine container)
  so nothing extra is installed on Windows. Existing VM disks are never overwritten: a VM's
  disk is its data. Run create-vms.ps1 (elevated) afterwards.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File infrastructure\vm\prepare-images.ps1
#>
[CmdletBinding()]
param(
  [string[]] $Only
)
$ErrorActionPreference = 'Stop'

$config = Get-Content (Join-Path $PSScriptRoot 'environments.json') -Raw | ConvertFrom-Json
$root = $config.vmRoot
$baseImage = Join-Path $root $config.baseImage
if (-not (Test-Path $baseImage)) { throw "Base image not found: $baseImage" }

$keyPath = $config.sshPublicKey -replace '^~', $HOME
if (-not (Test-Path $keyPath)) {
  throw "SSH public key not found: $keyPath (create it with: ssh-keygen -t ed25519 -f $($keyPath -replace '\.pub$',''))"
}
$sshKey = (Get-Content $keyPath -Raw).Trim()

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker is not running. Start Docker Desktop and try again.' }

function Render([string] $template, [hashtable] $values) {
  $text = Get-Content (Join-Path $PSScriptRoot "cloud-init\$template") -Raw
  foreach ($key in $values.Keys) { $text = $text.Replace("{{$key}}", [string]$values[$key]) }
  if ($text -match '\{\{[A-Z_]+\}\}') { throw "Unfilled placeholder in $template : $($Matches[0])" }
  return $text -replace "`r`n", "`n"
}

$utf8 = New-Object System.Text.UTF8Encoding($false)

foreach ($envConfig in $config.environments) {
  if ($Only -and ($Only -notcontains $envConfig.name)) { continue }
  $name = $envConfig.name
  $dir = Join-Path $root $name
  $seedDir = Join-Path $dir 'seed'
  New-Item -ItemType Directory -Force -Path $seedDir | Out-Null

  $values = @{
    ENV_NAME       = $name
    HOSTNAME       = $envConfig.hostname
    DOMAIN         = $config.network.domain
    ADMIN_USER     = $config.adminUser
    SSH_PUBLIC_KEY = $sshKey
    IP             = $envConfig.ip
    PREFIX_LENGTH  = $config.network.prefixLength
    GATEWAY        = $config.network.gateway
    DNS            = ($config.network.dns -join ', ')
  }
  [IO.File]::WriteAllText((Join-Path $seedDir 'user-data'), (Render 'user-data.tpl' $values), $utf8)
  [IO.File]::WriteAllText((Join-Path $seedDir 'network-config'), (Render 'network-config.tpl' $values), $utf8)
  [IO.File]::WriteAllText((Join-Path $seedDir 'meta-data'), (Render 'meta-data.tpl' $values), $utf8)

  $disk = Join-Path $dir "$name.vhdx"
  $makeDisk = -not (Test-Path $disk)
  $baseRelative = $config.baseImage -replace '\\', '/'
  $script = @(
    'set -e',
    'apk add --no-cache qemu-img xorriso >/dev/null',
    "xorriso -as mkisofs -quiet -output /vms/$name/seed.iso -volid cidata -joliet -rock /vms/$name/seed/user-data /vms/$name/seed/meta-data /vms/$name/seed/network-config"
  )
  if ($makeDisk) {
    # Hyper-V wants dynamic VHDX; the disk is grown to its final size by create-vms.ps1.
    $script += "qemu-img convert -p -f qcow2 -O vhdx -o subformat=dynamic /vms/$baseRelative /vms/$name/$name.vhdx"
  }
  Write-Host "[$name] building seed ISO$(if ($makeDisk) { ' and disk' } else { ' (disk exists, kept)' })"
  docker run --rm -v "${root}:/vms" alpine:3 sh -c ($script -join ' && ')
  if ($LASTEXITCODE -ne 0) { throw "[$name] image build failed" }
}

Write-Host 'Done. Next: run create-vms.ps1 as administrator.'
