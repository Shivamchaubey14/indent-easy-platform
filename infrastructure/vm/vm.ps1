<#
.SYNOPSIS
  Day-to-day control of the DEV, QA and PROD VMs.

.DESCRIPTION
  status  - state, memory in use and whether each VM answers SSH
  start   - start one or more VMs (e.g. start DEV QA)
  stop    - shut one or more VMs down cleanly
  ssh     - open a shell on a VM (e.g. ssh DEV)
  Needs membership of "Hyper-V Administrators" (create-vms.ps1 adds it) or an elevated shell.

.EXAMPLE
  powershell -File infrastructure\vm\vm.ps1 status
  powershell -File infrastructure\vm\vm.ps1 start DEV
#>
param(
  [Parameter(Mandatory, Position = 0)][ValidateSet('status', 'start', 'stop', 'ssh')][string] $Action,
  [Parameter(Position = 1, ValueFromRemainingArguments)][string[]] $Names
)
$ErrorActionPreference = 'Stop'

$config = Get-Content (Join-Path $PSScriptRoot 'environments.json') -Raw | ConvertFrom-Json
$known = @($config.environments.name)
$targets = if ($Names) { $Names | ForEach-Object { $_.ToUpper() } } else { $known }
foreach ($t in $targets) { if ($known -notcontains $t) { throw "Unknown environment '$t' (known: $($known -join ', '))" } }
$key = ($config.sshPublicKey -replace '^~', $HOME) -replace '\.pub$', ''

function Test-Ssh([string] $ip) {
  $client = New-Object Net.Sockets.TcpClient
  try { return $client.ConnectAsync($ip, 22).Wait(1500) -and $client.Connected } catch { return $false } finally { $client.Dispose() }
}

switch ($Action) {
  'status' {
    foreach ($e in $config.environments | Where-Object { $targets -contains $_.name }) {
      $vm = Get-VM -Name $e.name -ErrorAction SilentlyContinue
      [pscustomobject]@{
        Environment = $e.name
        State       = if ($vm) { $vm.State } else { 'not created' }
        MemoryMB    = if ($vm -and $vm.State -eq 'Running') { [int]($vm.MemoryAssigned / 1MB) } else { $null }
        Address     = "$($e.ip) ($($e.name.ToLower()).$($config.network.domain))"
        SSH         = if ($vm -and $vm.State -eq 'Running') { if (Test-Ssh $e.ip) { 'up' } else { 'down' } } else { '-' }
      }
    }
  }
  'start' {
    foreach ($t in $targets) {
      # environments.json is the source of truth for memory; apply it while the VM is off.
      $e = $config.environments | Where-Object name -eq $t
      if ((Get-VM -Name $t).State -eq 'Off') {
        Set-VMMemory -VMName $t -DynamicMemoryEnabled $true `
          -StartupBytes ([int64]$e.memoryStartupMB * 1MB) `
          -MinimumBytes ([int64]$e.memoryMinimumMB * 1MB) `
          -MaximumBytes ([int64]$e.memoryMaximumMB * 1MB)
      }
      Start-VM -Name $t
      Write-Host "$t starting"
    }
  }
  'stop' { foreach ($t in $targets) { Stop-VM -Name $t; Write-Host "$t stopped" } }
  'ssh' {
    if ($targets.Count -ne 1) { throw 'ssh takes exactly one environment' }
    $e = $config.environments | Where-Object name -eq $targets[0]
    ssh -i $key -o StrictHostKeyChecking=accept-new "$($config.adminUser)@$($e.ip)"
  }
}
