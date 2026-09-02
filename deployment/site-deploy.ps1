# site-deploy.ps1 - Static site publisher: pack locally -> upload over SSH -> overwrite into target dir.
# Real connection values live only in site-deploy.local.json (gitignored) or explicit params.
# The target dir is overwritten IN PLACE (its directory inode is never swapped), so a read-only bind
# mount of that dir keeps seeing new content without recreating the consuming container.
# No server-side version history is kept; the repo is the source of truth for rollback.
#
# This file is a faithful port of the robust OurNest publisher patterns (service-deploy.ps1 +
# script-common.ps1): Start-Process + per-line live log streaming + hard timeout + kill, exit-code
# readability fallback, SSH failure text detection, a TCP probe then a marker-based SSH preflight with
# retry, and a chunked 8 MB upload where each chunk is streamed with a real stdin pump and retried.
# Only the remote install step differs: a static in-place overwrite instead of compose.
#
# Usage:
#   .\site-deploy.ps1 -DryRun        # pack only, no SSH / no server changes
#   .\site-deploy.ps1                # read local config and publish
#   .\site-deploy.ps1 -ServerHost x -TargetDir /opt/site -LogFile deploy.log
param(
    [string]$ServerHost = "",
    [string]$ServerUser = "",
    [int]$ServerPort = 22,
    [string]$TargetDir = "",
    [string]$PublicBaseUrl = "",
    [string]$PublicPrefix = "",
    [string]$ReleaseNotes = "",
    [string]$ToolTitle = "",
    [string]$ProjectRoot = "",
    [string]$ConfigPath = "",
    [string]$LogFile = "",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = (Split-Path -Parent $scriptDir) }
if (-not $ConfigPath)  { $ConfigPath  = Join-Path $scriptDir "site-deploy.local.json" }
$script:sshExe = "ssh"

function Write-Log {
    # Mirrors OurNest Write-Log: a timestamped line; every remote/command line goes through this so
    # the UI shows steady progress instead of stalling silently.
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) {
        Write-Host ""
        return
    }
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Text
    Write-Host $line
    if ($LogFile) {
        Add-Content -Path $LogFile -Value $line -Encoding UTF8
    }
}

function Ensure-Directory {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { throw "Directory path is required." }
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

function Remove-ItemWithRetry {
    # Retry recursive delete on transient locks; never throws in IgnoreFailure mode. From OurNest.
    param([string]$Path, [switch]$Recurse, [int]$MaxAttempts = 5, [int]$DelayMilliseconds = 1200, [switch]$IgnoreFailure)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path $Path)) { return $true }
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $removeArgs = @{ LiteralPath = $Path; Force = $true; ErrorAction = 'Stop' }
            if ($Recurse) { $removeArgs.Recurse = $true }
            Remove-Item @removeArgs
            return $true
        } catch {
            if ($attempt -ge $MaxAttempts) {
                if ($IgnoreFailure) {
                    Write-Log ("Warning: unable to remove path after {0} attempts, leaving it in place: {1} ({2})" -f $MaxAttempts, $Path, $_.Exception.Message)
                    return $false
                }
                throw
            }
            Write-Log ("Remove retry {0}/{1} for {2}: {3}" -f $attempt, $MaxAttempts, $Path, $_.Exception.Message)
            Start-Sleep -Milliseconds $DelayMilliseconds
        }
    }
    return $false
}

function Remove-EmptyDirectoryWithRetry {
    param([string]$Path, [int]$MaxAttempts = 4, [int]$DelayMilliseconds = 800)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path $Path)) { return $true }
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $remainingEntries = @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction Stop)
            if ($remainingEntries.Count -gt 0) { return $false }
            Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
            return $true
        } catch {
            if ($attempt -ge $MaxAttempts) {
                Write-Log ("Unable to remove empty directory after {0} attempts: {1} ({2})" -f $MaxAttempts, $Path, $_.Exception.Message)
                return $false
            }
            Start-Sleep -Milliseconds $DelayMilliseconds
        }
    }
    return $false
}

function Format-SizeMb {
    param([long]$Bytes)
    return [Math]::Round($Bytes / 1MB, 2)
}

function Format-Duration {
    param([double]$Seconds)
    if ($Seconds -lt 0) { $Seconds = 0 }
    if ($Seconds -lt 60) { return ("{0}s" -f [Math]::Max(0, [Math]::Round($Seconds))) }
    $duration = [TimeSpan]::FromSeconds([Math]::Max(0, $Seconds))
    if ($duration.TotalHours -ge 1) { return $duration.ToString("hh\:mm\:ss") }
    return $duration.ToString("mm\:ss")
}

function Escape-SingleQuoted {
    # escape a value for embedding inside a remote single-quoted shell string (OurNest helper)
    param([string]$Value)
    if ($null -eq $Value) { return "" }
    return $Value.Replace("'", "'\''")
}

function Format-Argument {
    # quote a single command-line token for the Windows CRT argument parser (OurNest helper)
    param([string]$Value)
    if ($null -eq $Value) { return '""' }
    if ($Value -match '[\s"]') {
        return '"' + ($Value -replace '"', '\"') + '"'
    }
    return $Value
}

function Normalize-ArgumentList {
    # flatten any nested arrays into a flat string list (OurNest helper)
    param([object[]]$Arguments)
    $normalized = New-Object System.Collections.Generic.List[string]
    function Add-NormalizedArgument {
        param([object]$Value)
        if ($null -eq $Value) { $normalized.Add($null); return }
        if ($Value -is [string]) { $normalized.Add($Value); return }
        if ($Value -is [System.Collections.IEnumerable]) {
            foreach ($nestedValue in $Value) { Add-NormalizedArgument -Value $nestedValue }
            return
        }
        $normalized.Add([string]$Value)
    }
    if ($Arguments) {
        foreach ($argument in $Arguments) { Add-NormalizedArgument -Value $argument }
    }
    return @($normalized.ToArray())
}

function Get-DisplayCommand {
    param([string]$FilePath, [object[]]$Arguments)
    $flattenedArguments = Normalize-ArgumentList -Arguments $Arguments
    $formattedArgs = if ($flattenedArguments.Count -gt 0) { $flattenedArguments | ForEach-Object { Format-Argument $_ } } else { @() }
    return ((@($FilePath) + @($formattedArgs)) -join " ").Trim()
}

function Test-SshFailureText {
    # detect a known SSH/SCP failure marker in stderr even when the process exits 0 (OurNest helper)
    param([string]$FilePath, [string]$Stdout, [string]$Stderr)
    if ([string]::IsNullOrWhiteSpace($FilePath)) { return $null }
    $commandName = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    if ($commandName -notin @('ssh', 'scp')) { return $null }
    if ([string]::IsNullOrWhiteSpace($Stderr)) { return $null }
    $patterns = @(
        '^ssh: connect to host .* port \d+: Connection timed out\b',
        '^ssh: connect to host .* port \d+: Connection refused\b',
        '^ssh: connect to host .* port \d+: No route to host\b',
        '^ssh: connect to host .* port \d+: Network is unreachable\b',
        '^ssh: Could not resolve hostname\b',
        '^.*@.*: Permission denied \(',
        '^Host key verification failed\b',
        '^kex_exchange_identification:',
        '^Connection closed by .* port \d+',
        '^client_loop: send disconnect: Broken pipe\b',
        '^scp: .*'
    )
    $lines = $Stderr -split "`r?`n"
    foreach ($pattern in $patterns) {
        foreach ($line in $lines) {
            $match = [regex]::Match($line.Trim(), $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
            if ($match.Success) { return $match.Value }
        }
    }
    return $null
}

function Read-NewFileContent {
    # read only lines appended to a log file since the last read (for live command streaming)
    param([string]$Path, [ref]$Offset)
    if (-not (Test-Path $Path)) { return @() }
    $fileStream = $null
    $streamReader = $null
    try {
        $fileStream = New-Object System.IO.FileStream($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        if ($Offset.Value -gt $fileStream.Length) { $Offset.Value = 0L }
        $fileStream.Seek($Offset.Value, [System.IO.SeekOrigin]::Begin) | Out-Null
        $streamReader = New-Object System.IO.StreamReader($fileStream)
        $content = $streamReader.ReadToEnd()
        $Offset.Value = $fileStream.Position
        if ([string]::IsNullOrEmpty($content)) { return @() }
        return ($content -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    } finally {
        if ($streamReader) { $streamReader.Dispose() }
        elseif ($fileStream) { $fileStream.Dispose() }
    }
}

function Get-CommandLogRoot {
    # per-command stdout/stderr go under this session's command_logs dir (cleaned with the session)
    if ($script:commandLogDir -and (Test-Path $script:commandLogDir)) {
        return $script:commandLogDir
    }
    $fallback = Join-Path $scriptDir "temp_build"
    Ensure-Directory -Path $fallback
    return $fallback
}

function Test-TcpPortReachable {
    # 5s-bounded TCP probe - fails fast on an unreachable host/port instead of letting ssh hang
    param([string]$ComputerName, [int]$Port, [int]$TimeoutMilliseconds = 5000)
    $client = $null
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect($ComputerName, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMilliseconds, $false)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch { return $false }
    finally { if ($client) { $client.Close() } }
}

function Invoke-ExternalCommand {
    # Run an executable directly and wait, streaming stdout/stderr lines live as they appear.
    # Mirrors the OurNest executor: Start-Process with redirected files, polled every 500ms, hard
    # timeout with kill, exit-code readability fallback, and SSH failure text detection. A small
    # $StdinContent is written to a file and redirected as the child's stdin (for `bash -s` scripts).
    param([string]$FilePath, [object[]]$Arguments, [string]$StdinContent = "", [int]$TimeoutSeconds = 0)

    $normalizedArguments = Normalize-ArgumentList -Arguments $Arguments
    $commandId = [guid]::NewGuid().ToString("N")
    $logRoot = Get-CommandLogRoot
    $stdoutPath = Join-Path $logRoot ("command-stdout-{0}.log" -f $commandId)
    $stderrPath = Join-Path $logRoot ("command-stderr-{0}.log" -f $commandId)
    $stdinPath = $null
    if ($StdinContent) {
        $stdinPath = Join-Path $logRoot ("command-stdin-{0}.log" -f $commandId)
        [System.IO.File]::WriteAllText($stdinPath, $StdinContent)
    }
    $redirectedProcess = $null
    try {
        Write-Log ("Command line: {0}" -f (Get-DisplayCommand -FilePath $FilePath -Arguments $normalizedArguments))
        if ($TimeoutSeconds -gt 0) { Write-Log ("Command timeout: {0}s" -f $TimeoutSeconds) }
        $startInfo = @{
            FilePath = $FilePath
            ArgumentList = $normalizedArguments
            NoNewWindow = $true
            PassThru = $true
            RedirectStandardOutput = $stdoutPath
            RedirectStandardError = $stderrPath
        }
        if ($stdinPath) { $startInfo.RedirectStandardInput = $stdinPath }
        $redirectedProcess = Start-Process @startInfo

        $timedOut = $false
        $timeoutStopwatch = if ($TimeoutSeconds -gt 0) { [System.Diagnostics.Stopwatch]::StartNew() } else { $null }
        $stdoutOffset = 0L
        $stderrOffset = 0L
        while (-not $redirectedProcess.WaitForExit(500)) {
            foreach ($line in (Read-NewFileContent -Path $stdoutPath -Offset ([ref]$stdoutOffset))) { Write-Log $line }
            foreach ($line in (Read-NewFileContent -Path $stderrPath -Offset ([ref]$stderrOffset))) { Write-Log $line }
            if ($TimeoutSeconds -gt 0 -and $timeoutStopwatch.Elapsed.TotalSeconds -ge $TimeoutSeconds) { $timedOut = $true; break }
        }
        foreach ($line in (Read-NewFileContent -Path $stdoutPath -Offset ([ref]$stdoutOffset))) { Write-Log $line }
        foreach ($line in (Read-NewFileContent -Path $stderrPath -Offset ([ref]$stderrOffset))) { Write-Log $line }

        if ($timedOut) {
            try { $redirectedProcess.Kill() } catch { Write-Log ("Warning: failed to terminate timed out process {0}: {1}" -f $FilePath, $_.Exception.Message) }
            throw "Command timed out after ${TimeoutSeconds}s: $FilePath $($normalizedArguments -join ' ')"
        }

        $redirectedProcess.WaitForExit()
        $redirectedProcess.Refresh()
        $exitCode = 0
        try {
            $exitCode = [int]$redirectedProcess.ExitCode
        } catch {
            # Some environments report an empty ExitCode even after a clean exit; the process has
            # already exited, so fall back to success rather than misreading it as a failure.
            Write-Log ("Warning: process exit code unreadable for {0}; assuming success (process already exited)." -f $FilePath)
            $exitCode = 0
        }
        $stdoutContent = if ($stdoutPath -and (Test-Path $stdoutPath)) { [System.IO.File]::ReadAllText($stdoutPath) } else { "" }
        $stderrContent = if ($stderrPath -and (Test-Path $stderrPath)) { [System.IO.File]::ReadAllText($stderrPath) } else { "" }
        $sshFailureText = Test-SshFailureText -FilePath $FilePath -Stdout $stdoutContent -Stderr $stderrContent
        if (-not [string]::IsNullOrWhiteSpace($sshFailureText)) {
            throw "Detected SSH command failure: $sshFailureText"
        }
        if ($exitCode -ne 0) {
            throw "Command failed with exit code ${exitCode}: $FilePath $($normalizedArguments -join ' ')"
        }
    } finally {
        if ($redirectedProcess) { $redirectedProcess.Dispose() }
        foreach ($path in @($stdoutPath, $stderrPath, $stdinPath)) {
            if ($path -and (Test-Path $path)) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
        }
    }
}

function Invoke-ExternalCommandWithRetry {
    # retry wrapper around Invoke-ExternalCommand (OurNest helper)
    param([string]$FilePath, [object[]]$Arguments, [int]$MaxAttempts = 3, [int]$DelaySeconds = 5, [int]$TimeoutSeconds = 0, [string]$StdinContent = "")
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            Write-Log ("Starting command attempt {0}/{1}: {2}" -f $attempt, $MaxAttempts, $FilePath)
            Invoke-ExternalCommand -FilePath $FilePath -Arguments $Arguments -TimeoutSeconds $TimeoutSeconds -StdinContent $StdinContent
            return
        } catch {
            if ($attempt -ge $MaxAttempts) { throw }
            Write-Log "Command failed, retrying in ${DelaySeconds}s: $($_.Exception.Message)"
            Start-Sleep -Seconds $DelaySeconds
        }
    }
}

function Invoke-ExternalCommandCapture {
    # run a short command and return its text (used by the SSH preflight marker check)
    param([string]$FilePath, [object[]]$Arguments, [int]$TimeoutSeconds = 0, [switch]$IncludeStandardError)
    $normalizedArguments = Normalize-ArgumentList -Arguments $Arguments
    $commandId = [guid]::NewGuid().ToString("N")
    $logRoot = Get-CommandLogRoot
    $stdoutPath = Join-Path $logRoot ("capture-stdout-{0}.log" -f $commandId)
    $stderrPath = Join-Path $logRoot ("capture-stderr-{0}.log" -f $commandId)
    $process = $null
    try {
        Write-Log ("Command line: {0}" -f (Get-DisplayCommand -FilePath $FilePath -Arguments $normalizedArguments))
        if ($TimeoutSeconds -gt 0) { Write-Log ("Command timeout: {0}s" -f $TimeoutSeconds) }
        $startInfo = @{
            FilePath = $FilePath
            ArgumentList = $normalizedArguments
            NoNewWindow = $true
            PassThru = $true
            RedirectStandardOutput = $stdoutPath
            RedirectStandardError = $stderrPath
        }
        $process = Start-Process @startInfo
        $timedOut = $false
        $timeoutStopwatch = if ($TimeoutSeconds -gt 0) { [System.Diagnostics.Stopwatch]::StartNew() } else { $null }
        while (-not $process.WaitForExit(500)) {
            if ($TimeoutSeconds -gt 0 -and $timeoutStopwatch.Elapsed.TotalSeconds -ge $TimeoutSeconds) { $timedOut = $true; break }
        }
        if ($timedOut) {
            try { $process.Kill() } catch { Write-Log ("Warning: failed to terminate timed out process {0}: {1}" -f $FilePath, $_.Exception.Message) }
            throw "Command timed out after ${TimeoutSeconds}s: $FilePath $($normalizedArguments -join ' ')"
        }
        $process.WaitForExit()
        $process.Refresh()
        $exitCode = 0
        try { $exitCode = [int]$process.ExitCode } catch { $exitCode = 0 }
        $stdout = if ($stdoutPath -and (Test-Path $stdoutPath)) { [System.IO.File]::ReadAllText($stdoutPath) } else { "" }
        $stderr = if ($stderrPath -and (Test-Path $stderrPath)) { [System.IO.File]::ReadAllText($stderrPath) } else { "" }
        $sshFailureText = Test-SshFailureText -FilePath $FilePath -Stdout $stdout -Stderr $stderr
        if (-not [string]::IsNullOrWhiteSpace($sshFailureText)) { throw "Detected SSH command failure: $sshFailureText" }
        if ($exitCode -ne 0) { throw "Command failed with exit code ${exitCode}: $FilePath $($normalizedArguments -join ' ')" }
        if ($IncludeStandardError) {
            return (($stdout, $stderr | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join [Environment]::NewLine).Trim()
        }
        return $stdout.Trim()
    } finally {
        if ($process) { $process.Dispose() }
        foreach ($path in @($stdoutPath, $stderrPath)) {
            if ($path -and (Test-Path $path)) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
        }
    }
}

function Invoke-SshPreflightWithRetry {
    # TCP probe already passed; each attempt runs `echo SSH connection OK` under a hard timeout and
    # succeeds only when that marker comes back - so a key/host/port problem is reported clearly and
    # a hung ssh can never stall the UI. `-n` points ssh stdin at /dev/null so it never waits on input.
    param([object[]]$Arguments, [int]$MaxAttempts = 3, [int]$DelaySeconds = 8, [int]$TimeoutSeconds = 40)
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            Write-Log ("Starting SSH preflight attempt {0}/{1} (timeout {2}s)" -f $attempt, $MaxAttempts, $TimeoutSeconds)
            $preflightOutput = Invoke-ExternalCommandCapture -FilePath $script:sshExe -Arguments $Arguments -TimeoutSeconds $TimeoutSeconds
            foreach ($line in ($preflightOutput -split "`r?`n")) {
                if (-not [string]::IsNullOrWhiteSpace($line)) { Write-Log $line }
            }
            if ($preflightOutput -notmatch '(^|\r?\n)SSH connection OK(\r?\n|$)') {
                throw "SSH preflight did not return the expected success marker."
            }
            return
        } catch {
            if ($attempt -ge $MaxAttempts) { throw }
            Write-Log "SSH preflight failed, retrying in ${DelaySeconds}s: $($_.Exception.Message)"
            Start-Sleep -Seconds $DelaySeconds
        }
    }
}

function Split-FileIntoParts {
    # split a file into fixed-size parts for the chunked upload (OurNest helper)
    param([string]$SourcePath, [string]$OutputDirectory, [int]$ChunkSizeBytes = 2097152)
    if (Test-Path $OutputDirectory) {
        [void](Remove-ItemWithRetry -Path $OutputDirectory -Recurse -MaxAttempts 6 -DelayMilliseconds 1500)
    }
    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
    $buffer = New-Object byte[] $ChunkSizeBytes
    $parts = @()
    $inputStream = [System.IO.File]::OpenRead($SourcePath)
    try {
        $index = 0
        while (($bytesRead = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $partPath = Join-Path $OutputDirectory ("part-{0:D4}" -f $index)
            $outputStream = [System.IO.File]::Open($partPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
            try { $outputStream.Write($buffer, 0, $bytesRead) } finally { $outputStream.Dispose() }
            $parts += $partPath
            $index += 1
        }
    } finally {
        $inputStream.Dispose()
    }
    return @($parts)
}

function Send-FileChunkOverSsh {
    # stream ONE local file over SSH to a remote path by writing it to the ssh process stdin with a
    # real 1 MB pump (System.Diagnostics.Process, not Start-Process), retrying each chunk. From OurNest.
    param([string]$LocalPath, [string]$RemotePath, [object[]]$SshBaseArgs, [string]$Remote, [int]$TimeoutSeconds = 300, [int]$MaxAttempts = 3, [int]$DelaySeconds = 6)
    $escapedRemotePath = Escape-SingleQuoted $RemotePath
    $normalizedSshBaseArgs = Normalize-ArgumentList -Arguments $SshBaseArgs
    $sshArguments = ((Normalize-ArgumentList -Arguments ($normalizedSshBaseArgs + @($Remote, "cat > '$escapedRemotePath'"))) | ForEach-Object { Format-Argument $_ }) -join " "
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        $process = $null
        $stdin = $null
        $fileStream = $null
        $stdout = ""
        $stderr = ""
        try {
            Write-Log ("Streaming file over SSH to {0}" -f $RemotePath)
            Write-Log ("SSH upload command: {0}" -f ("ssh " + $sshArguments))
            if ($attempt -gt 1) {
                Write-Log ("Retrying chunk upload attempt {0}/{1}: {2}" -f $attempt, $MaxAttempts, $RemotePath)
            }
            $process = New-Object System.Diagnostics.Process
            $process.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
            $process.StartInfo.FileName = $script:sshExe
            $process.StartInfo.Arguments = $sshArguments
            $process.StartInfo.UseShellExecute = $false
            $process.StartInfo.CreateNoWindow = $true
            $process.StartInfo.RedirectStandardInput = $true
            $process.StartInfo.RedirectStandardOutput = $true
            $process.StartInfo.RedirectStandardError = $true
            [void]$process.Start()

            $stdin = $process.StandardInput.BaseStream
            $fileStream = [System.IO.File]::OpenRead($LocalPath)
            $buffer = New-Object byte[] (1024 * 1024)
            while (($bytesRead = $fileStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                if ($process.HasExited) { throw "SSH process exited before chunk upload completed." }
                $stdin.Write($buffer, 0, $bytesRead)
            }
            $stdin.Flush()
            $stdin.Close()
            $stdin = $null
            $fileStream.Dispose()
            $fileStream = $null

            if ($TimeoutSeconds -gt 0) {
                if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
                    try { $process.Kill() } catch { Write-Log ("Warning: failed to terminate timed out SSH upload: {0}" -f $_.Exception.Message) }
                    throw "SSH upload timed out after ${TimeoutSeconds}s: $LocalPath -> $RemotePath"
                }
            } else {
                $process.WaitForExit()
            }

            $stdout = $process.StandardOutput.ReadToEnd()
            $stderr = $process.StandardError.ReadToEnd()
            foreach ($line in (($stdout + [Environment]::NewLine + $stderr) -split "`r?`n")) {
                if (-not [string]::IsNullOrWhiteSpace($line)) { Write-Log $line }
            }
            if ($process.ExitCode -ne 0) {
                $errorSummary = (($stderr -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) | Select-Object -First 1)
                if ([string]::IsNullOrWhiteSpace($errorSummary)) { $errorSummary = "ssh exited with code $($process.ExitCode)" }
                throw "SSH upload failed with exit code $($process.ExitCode): $errorSummary"
            }
            return
        } catch {
            try { if ($stdin) { $stdin.Dispose(); $stdin = $null } } catch {}
            try { if ($fileStream) { $fileStream.Dispose(); $fileStream = $null } } catch {}
            try { if ($process -and -not $process.HasExited) { $process.WaitForExit(2000) | Out-Null } } catch {}
            try { if ($process) { $stdout = $process.StandardOutput.ReadToEnd() } } catch {}
            try { if ($process) { $stderr = $process.StandardError.ReadToEnd() } } catch {}
            $summary = $_.Exception.Message
            $firstErrorLine = (($stderr -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) | Select-Object -First 1)
            if (-not [string]::IsNullOrWhiteSpace($firstErrorLine)) { $summary = $firstErrorLine }
            if ($attempt -ge $MaxAttempts) {
                throw "SSH chunk upload failed after ${MaxAttempts} attempts: $LocalPath -> $RemotePath ($summary)"
            }
            Write-Log ("Chunk upload attempt {0}/{1} failed for {2}: {3}" -f $attempt, $MaxAttempts, $RemotePath, $summary)
            Start-Sleep -Seconds $DelaySeconds
        } finally {
            if ($stdin) { $stdin.Dispose() }
            if ($fileStream) { $fileStream.Dispose() }
            if ($process) { $process.Dispose() }
        }
    }
}

function Send-DeployArchive {
    # chunked upload of the whole archive with per-chunk progress / speed / ETA (from OurNest):
    # parts land under a remote dir, then one ssh command reassembles `cat part-* > pkg` and cleans up.
    param([string]$PackagePath, [string]$RemotePackagePath, [object[]]$SshBaseArgs, [string]$Remote, [string]$SessionTempRoot, [string]$Stamp)
    $packageSize = (Get-Item -LiteralPath $PackagePath).Length
    $chunkRoot = Join-Path $SessionTempRoot "upload-parts"
    $remotePartDir = "/tmp/site-deploy-upload-parts-$Stamp"
    $escapedRemotePartDir = Escape-SingleQuoted $remotePartDir
    $escapedRemotePackagePath = Escape-SingleQuoted $RemotePackagePath

    $parts = @(Split-FileIntoParts -SourcePath $PackagePath -OutputDirectory $chunkRoot -ChunkSizeBytes 8388608)
    Write-Log ("Uploading archive to {0}:{1} ({2} MB total)" -f $Remote, $RemotePackagePath, (Format-SizeMb $packageSize))
    Write-Log ("Upload mode: chunked SSH stream upload ({0} part(s), 8 MB each, non-interactive SSH auth)" -f $parts.Count)
    Invoke-ExternalCommandWithRetry -FilePath $script:sshExe -Arguments ($SshBaseArgs + @("-n", $Remote, "mkdir -p '$escapedRemotePartDir' && rm -f '$escapedRemotePackagePath'")) -MaxAttempts 5 -DelaySeconds 8 -TimeoutSeconds 60
    try {
        $uploadedBytes = 0L
        $uploadStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        for ($index = 0; $index -lt $parts.Count; $index++) {
            $part = $parts[$index]
            $partName = Split-Path -Leaf $part
            $partLength = (Get-Item -LiteralPath $part).Length
            $chunkNumber = $index + 1
            Write-Log ("Uploading chunk {0}/{1}: {2} ({3} MB)" -f $chunkNumber, $parts.Count, $partName, (Format-SizeMb $partLength))
            $chunkStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            Send-FileChunkOverSsh -LocalPath $part -RemotePath "${remotePartDir}/$partName" -SshBaseArgs $SshBaseArgs -Remote $Remote -TimeoutSeconds 300
            $uploadedBytes += $partLength
            $chunkElapsedSeconds = [Math]::Max(0.1, $chunkStopwatch.Elapsed.TotalSeconds)
            Write-Log ("Chunk uploaded {0}/{1} in {2} at {3} MB/s" -f $chunkNumber, $parts.Count, (Format-Duration $chunkElapsedSeconds), [Math]::Round(($partLength / $chunkElapsedSeconds) / 1MB, 2))
            $elapsedSeconds = [Math]::Max(0.1, $uploadStopwatch.Elapsed.TotalSeconds)
            $progressPercent = if ($packageSize -gt 0) { [Math]::Min(($uploadedBytes * 100.0) / $packageSize, 100.0) } else { 100.0 }
            $speedBytesPerSecond = $uploadedBytes / $elapsedSeconds
            $remainingBytes = [Math]::Max(0, $packageSize - $uploadedBytes)
            $remainingSeconds = if ($speedBytesPerSecond -gt 0) { $remainingBytes / $speedBytesPerSecond } else { 0 }
            Write-Log ("Upload progress: {0}/{1} MB ({2}%), speed {3} MB/s, ETA {4}" -f (Format-SizeMb $uploadedBytes), (Format-SizeMb $packageSize), [Math]::Round($progressPercent, 1), [Math]::Round($speedBytesPerSecond / 1MB, 2), (Format-Duration $remainingSeconds))
        }
        Write-Log "Upload complete, reassembling archive on server"
        Invoke-ExternalCommandWithRetry -FilePath $script:sshExe -Arguments ($SshBaseArgs + @("-n", $Remote, "cat '$escapedRemotePartDir'/part-* > '$escapedRemotePackagePath' && rm -rf '$escapedRemotePartDir'")) -MaxAttempts 5 -DelaySeconds 8 -TimeoutSeconds 120
        Write-Log "Remote archive reassembly finished"
    } finally {
        if (Test-Path $chunkRoot) {
            [void](Remove-ItemWithRetry -Path $chunkRoot -Recurse -MaxAttempts 6 -DelayMilliseconds 1500 -IgnoreFailure)
        }
    }
}

function Escape-BashDQ {
    # escape a value for embedding inside a remote bash double-quoted string
    param([string]$Value)
    return ($Value -replace '\\', '\\' -replace '"', '\"' -replace '\$', '\$' -replace '`', '\`')
}

function Assert-NotBlank {
    param([string]$Value, [string]$Message)
    if ([string]::IsNullOrWhiteSpace($Value)) { throw $Message }
    return $Value
}

# ---------- 1. Load config (CLI params win over local config) ----------
$cfg = $null
if (Test-Path $ConfigPath) {
    try { $cfg = [System.IO.File]::ReadAllText($ConfigPath) | ConvertFrom-Json } catch { Write-Log ("Config read warning: " + $_.Exception.Message) }
}
if (-not $ServerHost)    { $ServerHost    = if ($cfg) { [string]$cfg.ServerHost } else { "" } }
if (-not $ServerUser)    { $ServerUser    = if ($cfg) { [string]$cfg.ServerUser } else { "" } }
if (-not $TargetDir)     { $TargetDir     = if ($cfg) { [string]$cfg.TargetDir } else { "" } }
if (-not $PublicBaseUrl) { $PublicBaseUrl = if ($cfg) { [string]$cfg.PublicBaseUrl } else { "" } }
if (-not $PublicPrefix)  { $PublicPrefix  = if ($cfg) { [string]$cfg.PublicPrefix } else { "" } }
if (-not $ReleaseNotes)  { $ReleaseNotes  = if ($cfg) { [string]$cfg.ReleaseNotes } else { "" } }
if (-not $ToolTitle)     { $ToolTitle     = if ($cfg) { [string]$cfg.ToolTitle } else { "Site Deploy" } }

# Server values always come from gitignored local config / explicit params - never hardcoded here.
if (-not $DryRun) {
    Assert-NotBlank $ServerHost "ServerHost is required. Fill deployment/site-deploy.local.json (gitignored) or pass -ServerHost." | Out-Null
    Assert-NotBlank $ServerUser "ServerUser is required (from local config)." | Out-Null
    Assert-NotBlank $TargetDir  "TargetDir is required (from local config)."  | Out-Null
}

# Resolve the OpenSSH client once up front (the Store-bash stub issue never applies to ssh.exe).
try {
    $resolvedSsh = (Get-Command ssh.exe -ErrorAction Stop).Source
    if ($resolvedSsh) { $script:sshExe = $resolvedSsh }
} catch { }

$hasSmokeTarget = (-not [string]::IsNullOrWhiteSpace($PublicBaseUrl)) -and (-not [string]::IsNullOrWhiteSpace($PublicPrefix))
$publicUrl = if ($hasSmokeTarget) { ($PublicBaseUrl.TrimEnd('/') + "/" + $PublicPrefix.Trim('/')) } else { "" }

Write-Log ("==== {0} ====" -f $ToolTitle)
Write-Log ("Server:  {0}@{1}:{2}" -f $ServerUser, $ServerHost, $ServerPort)
Write-Log ("Target:  {0}  (Public: {1})" -f $TargetDir, $(if ($publicUrl) { $publicUrl } else { "(not set - smoke check skipped)" }))
if ($DryRun) { Write-Log "DRY-RUN: pack only - no SSH, no server change." }

# ---------- 2. Validate project, prepare session temp ----------
$indexPath = Join-Path $ProjectRoot "index.html"
if (-not (Test-Path $indexPath)) { throw ("index.html not found under " + $ProjectRoot) }
$includePath = Join-Path $scriptDir "site-publish.include"
if (-not (Test-Path $includePath)) { throw ("site-publish.include not found: " + $includePath) }
$include = Get-Content $includePath | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith("#") }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$shortSha = ""
try { $shortSha = (& git -C $ProjectRoot rev-parse --short HEAD 2>$null | Select-Object -First 1).Trim() } catch { }
if (-not $shortSha) { $shortSha = "nosha" }
$deployVersion = "deploy-$shortSha-$stamp"

# Local temp lives under the deployment folder (gitignored temp_build), like the OurNest publisher.
$tempBuildRoot = Join-Path $scriptDir "temp_build"
Ensure-Directory -Path $tempBuildRoot
# Sweep stale sessions from crashed/aborted runs (older than 24h) before starting this one.
Get-ChildItem -LiteralPath $tempBuildRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-24) } |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
$tempRoot = Join-Path $tempBuildRoot ("site-deploy-" + $stamp)
$script:commandLogDir = Join-Path $tempRoot "command_logs"
$stage = Join-Path $tempRoot "stage"
$localPkg = Join-Path $tempRoot ("site-deploy-" + $stamp + ".tgz")
$remotePkg = "/tmp/site-deploy-$stamp.tgz"
$remoteHost = ($ServerUser + '@' + $ServerHost)
$cleanupLocalTemp = $false

Ensure-Directory -Path $stage
Ensure-Directory -Path $script:commandLogDir

Write-Log ("Pack root: {0}" -f $ProjectRoot)
Write-Log ("Local temp session dir: {0}" -f $tempRoot)
Write-Log ("Local staging dir: {0}" -f $stage)

try {
    # ---------- 3. Stage the publish entries ----------
    foreach ($entry in $include) {
        $src = Join-Path $ProjectRoot $entry
        if (Test-Path $src) {
            $dst = Join-Path $stage $entry
            if ((Get-Item $src).PSIsContainer) {
                New-Item -ItemType Directory -Force -Path $dst | Out-Null
                Copy-Item -Path (Join-Path $src "*") -Destination $dst -Recurse -Force
            } else {
                New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
                Copy-Item -Path $src -Destination $dst -Force
            }
            Write-Log ("  + {0}" -f $entry)
        } else {
            Write-Log ("  ~ missing (skipped): {0}" -f $entry)
        }
    }

    # ---------- 4. Preflight (TCP probe then marker SSH), unless DryRun ----------
    if (-not $DryRun) {
        Write-Log ("Checking SSH connectivity before packaging: {0} (TCP then non-interactive SSH)" -f $remoteHost)
        Write-Log "SSH preflight uses non-interactive auth and should return within about 30s per attempt"
        $tcpReachable = Test-TcpPortReachable -ComputerName $ServerHost -Port $ServerPort -TimeoutMilliseconds 5000
        Write-Log ("TCP reachability probe {0}:{1} => {2}" -f $ServerHost, $ServerPort, $(if ($tcpReachable) { 'reachable' } else { 'not reachable within 5s' }))
        $preflightSshArgs = @("-n", "-p", [string]$ServerPort, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=30", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=12", "-o", "TCPKeepAlive=yes", $remoteHost, "echo SSH connection OK")
        Invoke-SshPreflightWithRetry -Arguments $preflightSshArgs -MaxAttempts 3 -DelaySeconds 8 -TimeoutSeconds 40
        Write-Log "SSH preflight succeeded"
    }

    # ---------- 5. Pack the archive (bsdtar, so a Git-Bash GNU tar can never misread drive paths) ----------
    $tar = Join-Path $env:SystemRoot "System32\tar.exe"
    if (-not (Test-Path $tar)) {
        $tar = (Get-Command tar.exe -ErrorAction SilentlyContinue).Source
    }
    if (-not $tar) { throw "tar.exe not found (Windows 10+ ships System32\tar.exe)." }
    Write-Log "Packaging site into archive (large sites may take a few seconds)"
    $tarSw = [System.Diagnostics.Stopwatch]::StartNew()
    Invoke-ExternalCommand -FilePath $tar -Arguments @('-czf', $localPkg, '-C', $stage, '.') -TimeoutSeconds 300
    $tarSw.Stop()
    $pkgSizeMb = [Math]::Round((Get-Item $localPkg).Length / 1MB, 2)
    Write-Log ("Packed deploy archive: {0} ({1} MB) in {2}" -f $localPkg, $pkgSizeMb, (Format-Duration $tarSw.Elapsed.TotalSeconds))

    if ($DryRun) {
        Write-Log "DRY-RUN complete: package built, nothing uploaded. Re-run without -DryRun to publish."
        $cleanupLocalTemp = $true
    } else {

    # ---------- 6. Upload (chunked, with per-chunk progress / speed / ETA) ----------
    $sshOpts = @("-p", [string]$ServerPort, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=30", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=12", "-o", "TCPKeepAlive=yes")
    Send-DeployArchive -PackagePath $localPkg -RemotePackagePath $remotePkg -SshBaseArgs $sshOpts -Remote $remoteHost -SessionTempRoot $tempRoot -Stamp $stamp

    # ---------- 7. Remote install (in-place overwrite, target dir inode is never swapped) ----------
    $notesSingle = (($ReleaseNotes -replace '\s+', ' ').Trim())
    $tDir = Escape-BashDQ $TargetDir
    $tPkg = Escape-BashDQ $remotePkg
    $tStage = "/tmp/site-deploy-stage-$stamp"
    $tVersion = Escape-BashDQ $deployVersion
    $tUrl = Escape-BashDQ $publicUrl
    $tNotes = Escape-BashDQ $notesSingle

    $remoteScript = @(
        "set -e",
        "TARGET=`"$tDir`"; PKG=`"$tPkg`"; STAGE=`"$tStage`"; VERSION=`"$tVersion`"; PUBLIC_URL=`"$tUrl`"",
        "# cleanup this run's staging leftovers on exit (success or failure)",
        "trap `"rm -rf $tStage $remotePkg`" EXIT",
        "echo '[remote] === install start ==='",
        "mkdir -p `"`$(dirname `"`$TARGET`")`" `"`$TARGET`" `"`$STAGE`"",
        "echo '[remote] verifying archive integrity'",
        "tar -tzf `"`$PKG`" >/dev/null || { echo '[remote] archive corrupt'; exit 1; }",
        "echo '[remote] unpacking archive'",
        "tar -xzf `"`$PKG`" -C `"`$STAGE`"",
        "for f in index.html css/main.css js/main.js pages/project-detail.html; do",
        "  [ -f `"`$STAGE/`$f`" ] || { echo `"[remote] package is missing required file: `$f`"; exit 1; }",
        "done",
        "echo '[remote] overwriting target content in place (directory inode unchanged)'",
        "find `"`$TARGET`" -mindepth 1 -maxdepth 1 -exec rm -rf {} +",
        "cp -a `"`$STAGE`"/. `"`$TARGET`"/",
        "cat > `"`$TARGET/.deploy-version`" <<'AYEOF'",
        "deploy_name=static-site",
        "deploy_version=$deployVersion",
        "deploy_stamp=$stamp",
        "public_url=$publicUrl",
        "release_notes=$notesSingle",
        "AYEOF",
        "echo '[remote] installed files:'",
        "ls -la `"`$TARGET`"",
        "echo '[remote] === install OK ==='"
    ) -join "`n"

    Write-Log "Remote: applying install (in-place overwrite + version marker)"
    Invoke-ExternalCommandWithRetry -FilePath $script:sshExe -Arguments ($sshOpts + @($remoteHost, "bash -s")) -StdinContent ($remoteScript + "`n") -MaxAttempts 3 -DelaySeconds 10 -TimeoutSeconds 600

    # ---------- 8. Smoke check over HTTP (best-effort) ----------
    if ($publicUrl) {
        # Note: this probes via native curl.exe, NOT Invoke-WebRequest. In Windows PowerShell 5.1 the
        # latter can hard-crash the whole process on certain server responses (a CLR-level fault that
        # skips catch AND finally, leaving the run half-finished and the UI reporting failure even
        # though the files were installed). curl.exe is a separate native process, so it cannot take
        # this PowerShell process down; a bad reply just yields http code 000 / a warning.
        try {
            # The prefix without a trailing slash 308s to the slash form; probe the slash form directly.
            $probeUrl = $publicUrl.TrimEnd('/') + "/"
            $curlExe = Join-Path $env:WINDIR "System32\curl.exe"
            if (-not (Test-Path $curlExe)) { $curlExe = (Get-Command curl.exe -ErrorAction SilentlyContinue).Source }
            if (-not $curlExe) {
                Write-Log "Smoke: curl.exe not available; skipping HTTP smoke (files were already installed)."
            } else {
                $pageCode = (& $curlExe -s -o NUL -w "%{http_code}" --max-time 30 -- $probeUrl) 2>$null
                $pageCode = ([string]$pageCode).Trim()
                $cssCode = (& $curlExe -s -o NUL -w "%{http_code}" --max-time 30 -- ($probeUrl.TrimEnd('/') + "/css/main.css")) 2>$null
                $cssCode = ([string]$cssCode).Trim()
                $pageBody = (& $curlExe -s --max-time 30 -- $probeUrl) 2>$null
                $looksHtml = ([string]$pageBody -match "(?is)<html")
                Write-Log ("Smoke: GET {0} -> HTTP {1} (html page: {2})" -f $probeUrl, $pageCode, $(if ($looksHtml) { "yes" } else { "no" }))
                Write-Log ("Smoke: GET css/main.css -> HTTP {0}" -f $cssCode)
                if ($pageCode -ne "200" -or (-not $looksHtml) -or $cssCode -ne "200") {
                    Write-Log "Smoke: page looks wrong but files were deployed - please check manually (caddy route may need a one-time restart)."
                }
            }
        } catch {
            Write-Log ("Smoke: request failed (site route may need a one-time caddy restart, or public routing not live yet) - " + $_.Exception.Message)
        }
    }

    # ---------- 9. Success summary ----------
    Write-Log ""
    Write-Log "Deploy completed."
    Write-Log "Server:  ${ServerUser}@${ServerHost}"
    Write-Log "Target:  $TargetDir"
    Write-Log "Public:  $publicUrl"
    Write-Log "Version: $deployVersion"
    if (-not [string]::IsNullOrWhiteSpace($notesSingle)) { Write-Log "Notes:   $notesSingle" }
    Write-Log "Revert: re-publish a previous commit (this repo is the source of truth); the server keeps no version history."
    $cleanupLocalTemp = $true
    } # end else (real deploy)
} finally {
    if ($cleanupLocalTemp -and (Test-Path $tempRoot)) {
        Write-Log ("Cleaning local temp session dir: {0}" -f $tempRoot)
        $removedSessionTemp = Remove-ItemWithRetry -Path $tempRoot -Recurse -MaxAttempts 6 -DelayMilliseconds 1500 -IgnoreFailure
        if ($removedSessionTemp) {
            Write-Log "Local temp session dir removed"
            [void](Remove-EmptyDirectoryWithRetry -Path $tempBuildRoot)
        } else {
            Write-Log "Local temp session dir could not be fully removed; keeping it for troubleshooting"
        }
    } elseif (Test-Path $tempRoot) {
        Write-Log ("Preserving local temp session dir for troubleshooting: {0}" -f $tempRoot)
    }
}
# Explicit success exit: an &-invoking wrapper (the UI task runner) propagates this via $LASTEXITCODE,
# so a successful run is reported as exit 0 instead of a stale/mystery code.
exit 0
