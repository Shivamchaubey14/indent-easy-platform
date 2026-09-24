<#
.SYNOPSIS
  Creates the IE-Env network and the DEV, QA and PROD Hyper-V VMs. Must run elevated.

.DESCRIPTION
  Idempotent: existing switch, NAT, VMs and hosts entries are left as they are. VMs are
  created but not started unless -Start is given, because this laptop cannot run all three
  alongside Docker Desktop. With -ForUser, also adds that account to "Hyper-V Administrators" so
  day-to-day start/stop (vm.ps1) works without elevation after the next sign-in. Pass the name
  from the normal (non-elevated) shell: UAC may elevate as a different account.

.EXAMPLE
  Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File D:\indent-easy\infrastructure\vm\create-vms.ps1 -Start DEV -ForUser $env:USERNAME"
#>
#Requires -RunAsAdministrator
[CmdletBinding()]
param(
  [string[]] $Start = @(),
  [string] $ForUser
)
$ErrorActionPreference = 'Stop'

$config = Get-Content (Join-Path $PSScriptRoot 'environments.json') -Raw | ConvertFrom-Json
$root = $config.vmRoot
$net = $config.network
Start-Transcript -Path (Join-Path $root 'create-vms.log') -Force | Out-Null
try {
  # --- Network: internal switch + host gateway address + NAT --------------------------------
  if (-not (Get-VMSwitch -Name $net.switchName -ErrorAction SilentlyContinue)) {
    Write-Host "Creating switch $($net.switchName)"
    New-VMSwitch -Name $net.switchName -SwitchType Internal | Out-Null
  }
  $alias = "vEthernet ($($net.switchName))"
  if (-not (Get-NetIPAddress -InterfaceAlias $alias -IPAddress $net.gateway -ErrorAction SilentlyContinue)) {
    Write-Host "Assigning $($net.gateway) to $alias"
    New-NetIPAddress -InterfaceAlias $alias -IPAddress $net.gateway -PrefixLength $net.prefixLength | Out-Null
  }
  if (-not (Get-NetNat -Name $net.natName -ErrorAction SilentlyContinue)) {
    Write-Host "Creating NAT $($net.natName) for $($net.prefix)"
    New-NetNat -Name $net.natName -InternalIPInterfaceAddressPrefix $net.prefix | Out-Null
  }

  # --- VMs ----------------------------------------------------------------------------------
  foreach ($e in $config.environments) {
    $name = $e.name
    $dir = Join-Path $root $name
    $disk = Join-Path $dir "$name.vhdx"
    $seed = Join-Path $dir 'seed.iso'
    if (Get-VM -Name $name -ErrorAction SilentlyContinue) {
      Write-Host "[$name] exists, skipping"
      continue
    }
    if (-not (Test-Path $disk) -or -not (Test-Path $seed)) {
      throw "[$name] disk or seed ISO missing; run prepare-images.ps1 first"
    }

    $size = [int64]$e.diskGB * 1GB
    if ((Get-VHD -Path $disk).Size -lt $size) { Resize-VHD -Path $disk -SizeBytes $size }

    Write-Host "[$name] creating VM"
    New-VM -Name $name -Generation 2 -MemoryStartupBytes ([int64]$e.memoryStartupMB * 1MB) `
      -VHDPath $disk -Path $root -SwitchName $net.switchName | Out-Null
    Set-VM -Name $name -ProcessorCount $e.cpus -DynamicMemory `
      -MemoryMinimumBytes ([int64]$e.memoryMinimumMB * 1MB) `
      -MemoryMaximumBytes ([int64]$e.memoryMaximumMB * 1MB) `
      -AutomaticCheckpointsEnabled $false -CheckpointType Production `
      -AutomaticStartAction Nothing -AutomaticStopAction ShutDown `
      -SmartPagingFilePath $dir -SnapshotFileLocation $dir `
      -Notes "Indent Easy $name environment ($($e.ip))"
    # Ubuntu boots with Secure Boot using the Microsoft UEFI CA template.
    Set-VMFirmware -VMName $name -EnableSecureBoot On -SecureBootTemplate 'MicrosoftUEFICertificateAuthority'
    Add-VMDvdDrive -VMName $name -Path $seed
    $bootDisk = Get-VMHardDiskDrive -VMName $name | Select-Object -First 1
    Set-VMFirmware -VMName $name -FirstBootDevice $bootDisk
    Enable-VMIntegrationService -VMName $name -Name 'Guest Service Interface'
  }

  # --- Friendly names in the Windows hosts file ---------------------------------------------
  $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
  $begin = '# >>> indent-easy environments'
  $end = '# <<< indent-easy environments'
  $block = @($begin) + ($config.environments | ForEach-Object {
      "{0}`t{1}.{2} {3}" -f $_.ip, $_.name.ToLower(), $net.domain, $_.hostname
    }) + @($end)
  # Replace our previous block (if any) and append the current one; other entries are untouched.
  $text = [IO.File]::ReadAllText($hostsPath)
  $pattern = '(?s)(\r?\n)*' + [regex]::Escape($begin) + '.*?' + [regex]::Escape($end) + '\r?\n?'
  $text = [regex]::Replace($text, $pattern, '')
  $text = $text.TrimEnd() + "`r`n`r`n" + ($block -join "`r`n") + "`r`n"
  [IO.File]::WriteAllText($hostsPath, $text, [Text.Encoding]::ASCII)

  # --- Let the regular account manage the VMs without elevation ----------------------------
  $group = 'Hyper-V Administrators'
  $member = "$env:COMPUTERNAME\$ForUser"
  if (-not $ForUser) {
    Write-Host "No -ForUser given; '$group' membership unchanged"
  } elseif (-not (Get-LocalGroupMember -Group $group -ErrorAction SilentlyContinue | Where-Object Name -eq $member)) {
    Add-LocalGroupMember -Group $group -Member $ForUser
    Write-Host "Added $ForUser to '$group' (takes effect at next sign-in)"
  }

  foreach ($name in $Start) {
    Write-Host "[$name] starting"
    Start-VM -Name $name
  }

  Get-VM | Where-Object { $config.environments.name -contains $_.Name } |
    Format-Table Name, State, MemoryStartup, ProcessorCount -AutoSize | Out-String | Write-Host
  Write-Host 'SUCCESS'
} catch {
  Write-Host "FAILED: $($_.Exception.Message)"
  throw
} finally {
  Stop-Transcript | Out-Null
}
