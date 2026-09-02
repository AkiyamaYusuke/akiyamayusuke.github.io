# site-deploy-ui.ps1 — 静态站发布控制台(深色 WinForms,自适应布局)
# 双击 site-deploy-ui.bat 启动。子进程方式执行 site-deploy.ps1,日志实时滚动。
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $scriptDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$deployScriptPath = Join-Path $scriptDir "site-deploy.ps1"
$configPath = Join-Path $scriptDir "site-deploy.local.json"
$configExamplePath = Join-Path $scriptDir "site-deploy.config.example.json"
$lastLogPath = Join-Path $logDir "site-deploy.last.log"

$defaultConfig = [ordered]@{
    ToolTitle = "Site Deploy"
    ServerHost = ""
    ServerUser = ""
    ServerPort = 22
    TargetDir = ""
    PublicBaseUrl = ""
    PublicPrefix = ""
    ReleaseNotes = ""
    ThemeMode = "Dark"
}

$themes = @{
    Dark = @{ FormBack=[Drawing.Color]::FromArgb(30,34,42); HeaderBack=[Drawing.Color]::FromArgb(24,27,34); Surface=[Drawing.Color]::FromArgb(37,41,52); SurfaceAlt=[Drawing.Color]::FromArgb(43,48,60); Control=[Drawing.Color]::FromArgb(43,48,60); Border=[Drawing.Color]::FromArgb(66,72,90); Text=[Drawing.Color]::FromArgb(230,233,240); Muted=[Drawing.Color]::FromArgb(156,163,175); Accent=[Drawing.Color]::FromArgb(86,156,214); AccentHover=[Drawing.Color]::FromArgb(70,142,204); Success=[Drawing.Color]::FromArgb(78,201,176); Error=[Drawing.Color]::FromArgb(244,71,71); Warning=[Drawing.Color]::FromArgb(220,180,70); LogBack=[Drawing.Color]::FromArgb(24,27,34); LogText=[Drawing.Color]::FromArgb(230,233,240) }
    Light = @{ FormBack=[Drawing.Color]::FromArgb(245,246,250); HeaderBack=[Drawing.Color]::FromArgb(255,255,255); Surface=[Drawing.Color]::FromArgb(255,255,255); SurfaceAlt=[Drawing.Color]::FromArgb(250,250,252); Control=[Drawing.Color]::FromArgb(250,250,252); Border=[Drawing.Color]::FromArgb(208,213,221); Text=[Drawing.Color]::FromArgb(42,45,52); Muted=[Drawing.Color]::FromArgb(102,112,133); Accent=[Drawing.Color]::FromArgb(53,116,240); AccentHover=[Drawing.Color]::FromArgb(43,102,220); Success=[Drawing.Color]::FromArgb(42,128,102); Error=[Drawing.Color]::FromArgb(196,43,28); Warning=[Drawing.Color]::FromArgb(176,120,20); LogBack=[Drawing.Color]::FromArgb(252,252,253); LogText=[Drawing.Color]::FromArgb(42,45,52) }
}
$fontUi = New-Object Drawing.Font("Segoe UI", 10)
$fontUiSmall = New-Object Drawing.Font("Segoe UI", 9)
$fontUiBold = New-Object Drawing.Font("Segoe UI Semibold", 10)
$fontTitle = New-Object Drawing.Font("Segoe UI Semibold", 16)
$fontToolbar = New-Object Drawing.Font("Segoe UI Semibold", 9)
$fontLog = New-Object Drawing.Font("Consolas", 9)
$script:theme = $themes.Dark
$script:currentTask = $null
$script:lastLogLength = 0
$script:taskStartTime = $null
$script:leftPanelScrollY = 0
$script:textBoxes = @()
$script:comboBoxes = @()
$script:sectionLabels = @()
$script:inputLabels = @()
$script:toolbarButtons = @()
$script:actionButtons = @()
$script:allButtons = @()

function Load-Config {
    $src = if (Test-Path $configPath) { $configPath } elseif (Test-Path $configExamplePath) { $configExamplePath } else { $null }
    if (-not $src) { return [pscustomobject]$defaultConfig }
    try {
        $raw = [System.IO.File]::ReadAllText($src) | ConvertFrom-Json
        return [pscustomobject]@{
            ToolTitle = if ($raw.ToolTitle) { [string]$raw.ToolTitle } else { $defaultConfig.ToolTitle }
            ServerHost = if ($raw.ServerHost) { [string]$raw.ServerHost } else { $defaultConfig.ServerHost }
            ServerUser = if ($raw.ServerUser) { [string]$raw.ServerUser } else { $defaultConfig.ServerUser }
            ServerPort = if ($raw.ServerPort) { [int]$raw.ServerPort } else { $defaultConfig.ServerPort }
            TargetDir = if ($raw.TargetDir) { [string]$raw.TargetDir } else { $defaultConfig.TargetDir }
            PublicBaseUrl = if ($raw.PublicBaseUrl) { [string]$raw.PublicBaseUrl } else { $defaultConfig.PublicBaseUrl }
            PublicPrefix = if ($raw.PublicPrefix) { [string]$raw.PublicPrefix } else { $defaultConfig.PublicPrefix }
            ReleaseNotes = if ($null -ne $raw.ReleaseNotes) { [string]$raw.ReleaseNotes } else { $defaultConfig.ReleaseNotes }
            ThemeMode = if ($themes.ContainsKey([string]$raw.ThemeMode)) { [string]$raw.ThemeMode } else { $defaultConfig.ThemeMode }
        }
    } catch { return [pscustomobject]$defaultConfig }
}

function Save-Config {
    param([hashtable]$Config)
    ($Config | ConvertTo-Json) | Set-Content -Path $configPath -Encoding UTF8
}

# ---------- 控件工厂(OurNest 同款:宽高都显式指定,支持自适应) ----------
function New-Label {
    param([string]$Text, [int]$X, [int]$Y, [int]$Width = 200, [System.Drawing.Font]$Font = $fontUiSmall, [string]$Kind = "muted")
    $l = New-Object System.Windows.Forms.Label
    $l.Text = $Text
    $l.Location = New-Object Drawing.Point($X, $Y)
    $l.Size = New-Object Drawing.Size($Width, 22)
    $l.AutoSize = $true
    $l.Font = $Font
    $l.BackColor = [Drawing.Color]::Transparent
    $l.ForeColor = if ($Kind -eq "section") { $script:theme.Accent } elseif ($Kind -eq "text") { $script:theme.Text } else { $script:theme.Muted }
    if ($Kind -eq "section") { $script:sectionLabels += $l } elseif ($Kind -eq "text") { } else { $script:inputLabels += $l }
    return $l
}

function New-TextBox {
    param([string]$Text, [int]$X, [int]$Y, [int]$Width, [int]$Height = 30, [bool]$MultiLine = $false)
    $t = New-Object System.Windows.Forms.TextBox
    $t.Text = $Text
    $t.Location = New-Object Drawing.Point($X, $Y)
    $t.Size = New-Object Drawing.Size($Width, $Height)
    $t.BorderStyle = "FixedSingle"
    $t.Font = $fontUi
    if ($MultiLine) {
        $t.Multiline = $true; $t.ScrollBars = "Vertical"; $t.AcceptsReturn = $true; $t.WordWrap = $true
    }
    $script:textBoxes += $t
    return $t
}

function New-ComboBox {
    param([string[]]$Items, [int]$X, [int]$Y, [int]$Width)
    $c = New-Object System.Windows.Forms.ComboBox
    $c.Location = New-Object Drawing.Point($X, $Y)
    $c.Size = New-Object Drawing.Size($Width, 30)
    $c.DropDownStyle = "DropDownList"
    $c.Font = $fontUi
    foreach ($item in $Items) { [void]$c.Items.Add($item) }
    $script:comboBoxes += $c
    return $c
}

function New-Button {
    param([string]$Text, [int]$X, [int]$Y, [int]$Width, [int]$Height = 32, [bool]$Primary = $false)
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $Text
    $b.Location = New-Object Drawing.Point($X, $Y)
    $b.Size = New-Object Drawing.Size($Width, $Height)
    $b.FlatStyle = "Flat"
    $b.FlatAppearance.BorderSize = 1
    $b.Font = $(if ($Primary) { $fontToolbar } else { $fontUiBold })
    $b.Tag = [pscustomobject]@{ Role = $(if ($Primary) { "Primary" } else { "Secondary" }); Normal = $script:theme.Control; Hover = $script:theme.Border }
    $b.Add_MouseEnter({ if ($_.Source -and $_.Source.Tag) { $_.Source.BackColor = $_.Source.Tag.Hover } })
    $b.Add_MouseLeave({ if ($_.Source -and $_.Source.Tag) { $_.Source.BackColor = $_.Source.Tag.Normal } })
    $script:allButtons += $b
    return $b
}

function Set-ButtonTheme {
    param([System.Windows.Forms.Button]$b)
    $isPrimary = ($b.Tag.Role -eq "Primary")
    $b.BackColor = if ($isPrimary) { $script:theme.Accent } else { $script:theme.Control }
    $b.ForeColor = if ($isPrimary) { [Drawing.Color]::White } else { $script:theme.Text }
    $b.FlatAppearance.BorderColor = $script:theme.Border
    $b.Tag = [pscustomobject]@{ Role = $b.Tag.Role; Normal = $b.BackColor; Hover = $(if ($isPrimary) { $script:theme.AccentHover } else { $script:theme.Border }) }
}

function Apply-Theme {
    $script:theme = $themes[$themeModeBox.SelectedItem]
    $form.BackColor = $script:theme.FormBack; $form.ForeColor = $script:theme.Text
    $headerPanel.BackColor = $script:theme.HeaderBack
    foreach ($p in @($leftPanel, $rightPanel)) { $p.BackColor = $script:theme.Surface }
    foreach ($l in $script:sectionLabels) { $l.ForeColor = $script:theme.Accent; $l.BackColor = [Drawing.Color]::Transparent }
    foreach ($l in $script:inputLabels) { $l.ForeColor = $script:theme.Muted; $l.BackColor = [Drawing.Color]::Transparent }
    foreach ($t in $script:textBoxes) { $t.BackColor = $script:theme.Control; $t.ForeColor = $script:theme.Text }
    foreach ($c in $script:comboBoxes) { $c.BackColor = $script:theme.Control; $c.ForeColor = $script:theme.Text }
    $titleLabel.ForeColor = $script:theme.Text
    $subtitleLabel.ForeColor = $script:theme.Muted
    $statusLabel.ForeColor = $script:theme.Muted
    $statusValue.ForeColor = switch -Regex ($statusValue.Text) { "^Idle|^Saved|^Completed|^Open" { $script:theme.Success; break } "^Running" { $script:theme.Warning; break } "^Failed|^TASK" { $script:theme.Error; break } default { $script:theme.Text } }
    $logBox.BackColor = $script:theme.LogBack; $logBox.ForeColor = $script:theme.LogText
    foreach ($b in $script:allButtons) { Set-ButtonTheme -b $b }
    $titleLabel.Text = $titleBox.Text.Trim()
    $form.Text = $titleBox.Text.Trim()
}

function Append-Log {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return }
    $logBox.AppendText($Text + [Environment]::NewLine)
    $logBox.SelectionStart = $logBox.TextLength
    $logBox.ScrollToCaret()
}

function Set-Status {
    param([string]$Text)
    $statusValue.Text = $Text
    $statusValue.ForeColor = switch -Regex ($Text) { "^Idle|^Saved|^Completed|^Open" { $script:theme.Success; break } "^Running" { $script:theme.Warning; break } "^Failed|^TASK" { $script:theme.Error; break } default { $script:theme.Text } }
}

function Esc {
    param([string]$v)
    return ($v -replace "'", "''")
}

function Start-Task {
    param([string]$TaskName, [string[]]$WrapperBody, [string[]]$IntroLines)
    if ($script:currentTask -and -not $script:currentTask.Process.HasExited) {
        [System.Windows.Forms.MessageBox]::Show("A task is already running.", "Task Busy") | Out-Null
        return
    }
    $uiTempDir = Join-Path $scriptDir "temp_build"
    New-Item -ItemType Directory -Force -Path $uiTempDir | Out-Null
    $wrapperPath = Join-Path $uiTempDir ("site-deploy-task-{0}-{1}.ps1" -f $TaskName.Replace(" ", "-"), (Get-Date -Format "yyyyMMdd-HHmmss"))
    $wrapperText = @(
        "`$ErrorActionPreference = 'Stop'",
        "try {",
        ($WrapperBody -join [Environment]::NewLine + "  "),
        "  exit `$LASTEXITCODE",
        "} catch {",
        "  'TASK ERROR: ' + `$_.Exception.Message | Add-Content -Path '$lastLogPath' -Encoding UTF8",
        "  exit 1",
        "}"
    ) -join "`r`n"
    Set-Content -Path $wrapperPath -Value $wrapperText -Encoding UTF8
    if (Test-Path $lastLogPath) { Remove-Item -LiteralPath $lastLogPath -Force -ErrorAction SilentlyContinue }
    $logBox.Clear(); $script:lastLogLength = 0
    Append-Log ("[{0}] Starting {1}..." -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $TaskName)
    foreach ($line in $IntroLines) { Append-Log $line }
    Set-Status ("Running {0}..." -f $TaskName)
    foreach ($b in $script:allButtons) { $b.Enabled = $false }
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = "powershell.exe"
    $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$wrapperPath`""
    $psi.WorkingDirectory = $scriptDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $proc = New-Object Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    $script:currentTask = @{ Process = $proc; WrapperPath = $wrapperPath; TaskName = $TaskName }
    $script:taskStartTime = Get-Date
    $pollTimer.Start()
}

function Get-FormConfig {
    $hp = 0
    $hostV = $hostBox.Text.Trim()
    if ([string]::IsNullOrWhiteSpace($hostV)) { throw "Server Host is required." }
    if (-not [int]::TryParse($portBox.Text.Trim(), [ref]$hp) -or $hp -le 0) { throw "Server Port must be a positive integer." }
    $userV = $userBox.Text.Trim()
    if ([string]::IsNullOrWhiteSpace($userV)) { throw "Server User is required." }
    $tDir = $targetDirBox.Text.Trim()
    if ([string]::IsNullOrWhiteSpace($tDir)) { throw "Target Dir is required." }
    return @{
        ToolTitle = $titleBox.Text.Trim()
        ServerHost = $hostV
        ServerUser = $userV
        ServerPort = $hp
        TargetDir = $tDir
        PublicBaseUrl = $publicBaseUrlBox.Text.Trim()
        PublicPrefix = $prefixBox.Text.Trim()
        ReleaseNotes = $notesBox.Text
        ThemeMode = [string]$themeModeBox.SelectedItem
    }
}

function Get-DeployWrapper {
    $c = Get-FormConfig
    # 先一次性转义再拼进双引号行(避免在双引号串里内嵌 \" 引发的解析问题)
    $escapedServerHost   = Esc $c.ServerHost
    $escapedServerUser   = Esc $c.ServerUser
    $escapedTargetDir    = Esc $c.TargetDir
    $escapedPublicBase   = Esc $c.PublicBaseUrl
    $escapedPublicPrefix = Esc $c.PublicPrefix
    $escapedNotes        = Esc $c.ReleaseNotes
    $escapedConfigPath   = Esc $configPath
    $escapedLogPath      = Esc $lastLogPath
    $escapedToolTitle    = Esc $c.ToolTitle
    $escapedDeployScript = Esc $deployScriptPath
    $body = @(
        "  `$params = @{",
        "      ServerHost = '$escapedServerHost'",
        "      ServerUser = '$escapedServerUser'",
        "      ServerPort = $($c.ServerPort)",
        "      TargetDir = '$escapedTargetDir'",
        "      PublicBaseUrl = '$escapedPublicBase'",
        "      PublicPrefix = '$escapedPublicPrefix'",
        "      ReleaseNotes = '$escapedNotes'",
        "      ConfigPath = '$escapedConfigPath'",
        "      LogFile = '$escapedLogPath'",
        "      ToolTitle = '$escapedToolTitle'",
        "  }",
        "  & '$escapedDeployScript' @params"
    ) -join "`r`n"
    return $body
}

function Read-LastLogTail {
    if (-not (Test-Path $lastLogPath)) { return }
    try {
        $fs = New-Object IO.FileStream($lastLogPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
        $sr = New-Object IO.StreamReader($fs)
        $content = $sr.ReadToEnd(); $sr.Dispose(); $fs.Dispose()
        if ($content.Length -gt $script:lastLogLength) {
            foreach ($line in ($content.Substring($script:lastLogLength) -split "`r?`n")) {
                if (-not [string]::IsNullOrWhiteSpace($line)) { Append-Log $line }
            }
            $script:lastLogLength = $content.Length
        }
    } catch { }
}

# ================= 配置 / 布局 =================
$config = Load-Config
$script:theme = $themes[$config.ThemeMode]

$form = New-Object System.Windows.Forms.Form
$form.Text = $config.ToolTitle
$form.Size = New-Object Drawing.Size(1280, 900)
$form.MinimumSize = New-Object Drawing.Size(1080, 760)
$form.StartPosition = "CenterScreen"
$form.Font = $fontUi
$form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None

$headerPanel = New-Object System.Windows.Forms.Panel
$headerPanel.Location = New-Object Drawing.Point(0, 0)
$headerPanel.Size = New-Object Drawing.Size(1280, 88)
$form.Controls.Add($headerPanel)

$titleLabel = New-Label -Text $config.ToolTitle -X 20 -Y 10 -Width 460 -Font $fontTitle -Kind "text"
$titleLabel.AutoSize = $true; $titleLabel.Height = 34
$headerPanel.Controls.Add($titleLabel)
$subtitleLabel = New-Label -Text "Pack locally · Upload via SSH · Sync in place (writes only the target static dir)" -X 22 -Y 46 -Width 660 -Font $fontUiSmall
$headerPanel.Controls.Add($subtitleLabel)

$toolbarPanel = New-Object System.Windows.Forms.FlowLayoutPanel
$toolbarPanel.WrapContents = $false
$toolbarPanel.AutoSize = $true
$toolbarPanel.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
$toolbarPanel.FlowDirection = [System.Windows.Forms.FlowDirection]::LeftToRight
$toolbarPanel.Location = New-Object Drawing.Point(760, 16)
$toolbarPanel.Padding = New-Object System.Windows.Forms.Padding(0)
$headerPanel.Controls.Add($toolbarPanel)

$deployButton = New-Button -Text "Deploy" -X 0 -Y 0 -W 92 -H 34 -Primary $true
$sshButton = New-Button -Text "SSH Check" -X 0 -Y 0 -W 92 -H 34
$openSiteButton = New-Button -Text "Open Site" -X 0 -Y 0 -W 92 -H 34
$openLogButton = New-Button -Text "Log File" -X 0 -Y 0 -W 92 -H 34
foreach ($b in @($deployButton, $sshButton, $openSiteButton, $openLogButton)) { $b.Margin = New-Object Windows.Forms.Padding(0, 0, 10, 0); $b.Height = 34; $toolbarPanel.Controls.Add($b) }

$leftPanel = New-Object System.Windows.Forms.Panel
$leftPanel.Location = New-Object Drawing.Point(20, 106)
$leftPanel.Size = New-Object Drawing.Size(430, 770)
$leftPanel.BorderStyle = "FixedSingle"
$leftPanel.AutoScroll = $true
$form.Controls.Add($leftPanel)

$rightPanel = New-Object System.Windows.Forms.Panel
$rightPanel.Location = New-Object Drawing.Point(468, 106)
$rightPanel.Size = New-Object Drawing.Size(792, 770)
$rightPanel.BorderStyle = "FixedSingle"
$form.Controls.Add($rightPanel)

# ---------- 左侧字段(堆叠排版:标题在输入框上方) ----------
# 连接信息
$connSectionLabel = New-Label -Text "Connection" -X 20 -Y 16 -Kind "section"
$leftPanel.Controls.Add($connSectionLabel)

$hostLabel = New-Label -Text "Server Host" -X 20 -Y 48
$leftPanel.Controls.Add($hostLabel)
$hostBox = New-TextBox -Text $config.ServerHost -X 20 -Y 76 -Width 380
$leftPanel.Controls.Add($hostBox)

$userLabel = New-Label -Text "Server User" -X 20 -Y 112
$leftPanel.Controls.Add($userLabel)
$portLabel = New-Label -Text "Port" -X 300 -Y 112
$leftPanel.Controls.Add($portLabel)
$userBox = New-TextBox -Text $config.ServerUser -X 20 -Y 140 -Width 266
$leftPanel.Controls.Add($userBox)
$portBox = New-TextBox -Text ([string]$config.ServerPort) -X 300 -Y 140 -Width 100
$leftPanel.Controls.Add($portBox)

$targetDirLabel = New-Label -Text "Target Dir (server destination dir)" -X 20 -Y 178
$leftPanel.Controls.Add($targetDirLabel)
$targetDirBox = New-TextBox -Text $config.TargetDir -X 20 -Y 206 -Width 380
$leftPanel.Controls.Add($targetDirBox)

# 对外地址
$publicSectionLabel = New-Label -Text "Public URL" -X 20 -Y 246 -Kind "section"
$leftPanel.Controls.Add($publicSectionLabel)

$publicBaseUrlLabel = New-Label -Text "Public Base URL" -X 20 -Y 278
$leftPanel.Controls.Add($publicBaseUrlLabel)
$publicBaseUrlBox = New-TextBox -Text $config.PublicBaseUrl -X 20 -Y 306 -Width 380
$leftPanel.Controls.Add($publicBaseUrlBox)

$prefixLabel = New-Label -Text "URL Prefix (site sub-path, starts with /)" -X 20 -Y 344
$leftPanel.Controls.Add($prefixLabel)
$prefixBox = New-TextBox -Text $config.PublicPrefix -X 20 -Y 372 -Width 380
$leftPanel.Controls.Add($prefixBox)

# 界面
$uiSectionLabel = New-Label -Text "Interface" -X 20 -Y 412 -Kind "section"
$leftPanel.Controls.Add($uiSectionLabel)

$titleBoxLabel = New-Label -Text "Tool Title" -X 20 -Y 444
$leftPanel.Controls.Add($titleBoxLabel)
$titleBox = New-TextBox -Text $config.ToolTitle -X 20 -Y 472 -Width 380
$leftPanel.Controls.Add($titleBox)

$themeLabel = New-Label -Text "Theme" -X 20 -Y 510
$leftPanel.Controls.Add($themeLabel)
$themeModeBox = New-ComboBox -Items @("Dark", "Light") -X 20 -Y 538 -Width 380
$themeModeBox.SelectedItem = $(if ($themes.ContainsKey($config.ThemeMode)) { $config.ThemeMode } else { "Dark" })
$leftPanel.Controls.Add($themeModeBox)

# 发布说明
$notesSectionLabel = New-Label -Text "Release Notes" -X 20 -Y 578 -Kind "section"
$leftPanel.Controls.Add($notesSectionLabel)
$notesBoxLabel = New-Label -Text "Notes text (written into .deploy-version)" -X 20 -Y 610
$leftPanel.Controls.Add($notesBoxLabel)
$notesBox = New-TextBox -Text $config.ReleaseNotes -X 20 -Y 640 -Width 380 -Height 100 -MultiLine $true
$leftPanel.Controls.Add($notesBox)

# 操作
$actionButtonWidth = 182
$secondColX = 20 + $actionButtonWidth + 16
$saveButton = New-Button -Text "Save Config" -X 20 -Y 756 -W $actionButtonWidth -H 32
$leftPanel.Controls.Add($saveButton)
$openConfigButton = New-Button -Text "Open Config" -X $secondColX -Y 756 -W $actionButtonWidth -H 32
$leftPanel.Controls.Add($openConfigButton)
$clearLogButton = New-Button -Text "Clear Log" -X 20 -Y 796 -W $actionButtonWidth -H 32
$leftPanel.Controls.Add($clearLogButton)
$reloadThemeButton = New-Button -Text "Reload Theme" -X $secondColX -Y 796 -W $actionButtonWidth -H 32
$leftPanel.Controls.Add($reloadThemeButton)

# ---------- 右侧日志 ----------
$runLabel = New-Label -Text "Run Console" -X 20 -Y 14 -Width 200 -Font $fontUiBold -Kind "section"
$rightPanel.Controls.Add($runLabel)
$statusLabel = New-Label -Text "Status" -X 20 -Y 44 -Width 60 -Font $fontUiSmall
$rightPanel.Controls.Add($statusLabel)
$statusValue = New-Label -Text "Idle" -X 86 -Y 44 -Width 420 -Font $fontUiBold -Kind "text"
$rightPanel.Controls.Add($statusValue)
$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Multiline = $true; $logBox.ScrollBars = "Vertical"; $logBox.ReadOnly = $true
$logBox.BorderStyle = "FixedSingle"; $logBox.Font = $fontLog
$rightPanel.Controls.Add($logBox)

# ================= 自适应布局(OurNest 同款:Resize 时按 ClientSize 重排) =================
function Update-ResponsiveLayout {
    $clientWidth = $form.ClientSize.Width
    $clientHeight = $form.ClientSize.Height
    if ($clientWidth -le 0 -or $clientHeight -le 0) { return }

    $pagePadding = 20
    $panelGap = 18
    $contentTop = 106
    $contentHeight = [Math]::Max(540, $clientHeight - $contentTop - $pagePadding)
    $leftWidth = [Math]::Max(408, [Math]::Min(448, [int]([Math]::Round($clientWidth * 0.335))))
    $rightWidth = [Math]::Max(500, $clientWidth - ($pagePadding * 2) - $leftWidth - $panelGap)

    $headerPanel.Width = $clientWidth
    $leftPanel.SetBounds($pagePadding, $contentTop, $leftWidth, $contentHeight)
    $rightPanel.SetBounds($pagePadding + $leftWidth + $panelGap, $contentTop, $rightWidth, $contentHeight)

    $toolbarSize = $toolbarPanel.PreferredSize
    $toolbarPanel.SetBounds([Math]::Max(460, $clientWidth - $toolbarSize.Width - 24), 16, $toolbarSize.Width, 40)

    # 左侧字段:列宽随面板宽度
    $fullFieldWidth = [Math]::Max(300, $leftPanel.ClientSize.Width - 40)
    $fieldLeft = 20
    $portWidth = 100
    $userWidth = $fullFieldWidth - $portWidth - 12

    $hostBox.Width = $fullFieldWidth
    $userBox.Width = $userWidth
    $portBox.Width = $portWidth
    $portLabel.Left = $fieldLeft + $userWidth + 12
    $portBox.Left = $portLabel.Left
    $targetDirBox.Width = $fullFieldWidth
    $publicBaseUrlBox.Width = $fullFieldWidth
    $prefixBox.Width = $fullFieldWidth
    $titleBox.Width = $fullFieldWidth
    $themeModeBox.Width = $fullFieldWidth
    $notesBox.Width = $fullFieldWidth

    $actionButtonWidth = [Math]::Floor(($fullFieldWidth - 16) / 2)
    $saveButton.Width = $actionButtonWidth
    $openConfigButton.SetBounds($fieldLeft + $actionButtonWidth + 16, $openConfigButton.Top, $actionButtonWidth, $openConfigButton.Height)
    $clearLogButton.Width = $actionButtonWidth
    $reloadThemeButton.SetBounds($fieldLeft + $actionButtonWidth + 16, $reloadThemeButton.Top, $actionButtonWidth, $reloadThemeButton.Height)

    # 左侧滚动区高度 = 最下控件底 + 边距
    $leftBottom = ($leftPanel.Controls | Measure-Object -Property Bottom -Maximum).Maximum
    if ($leftBottom -lt 0) { $leftBottom = 900 }
    $minScrollH = [int]$leftBottom + 20
    $leftPanel.AutoScrollMinSize = New-Object Drawing.Size(0, $minScrollH)

    # 右侧日志自适应
    $logWidth = [Math]::Max(220, $rightPanel.ClientSize.Width - 40)
    $logHeight = [Math]::Max(240, $rightPanel.ClientSize.Height - 130)
    $logBox.SetBounds(20, 86, $logWidth, $logHeight)
    $statusValue.Width = [Math]::Max(160, $rightPanel.ClientSize.Width - 160)
}

$pollTimer = New-Object System.Windows.Forms.Timer
$pollTimer.Interval = 600
$pollTimer.Add_Tick({
    Read-LastLogTail
    if ($script:currentTask -and $script:currentTask.Process.HasExited) {
        $pollTimer.Stop()
        foreach ($b in $script:allButtons) { $b.Enabled = $true }
        $elapsed = if ($script:taskStartTime) { [int]((Get-Date) - $script:taskStartTime).TotalSeconds } else { 0 }
        if ($script:currentTask.Process.ExitCode -eq 0) {
            Set-Status ("Completed: {0}" -f $script:currentTask.TaskName)
            Append-Log ("Task finished successfully in {0}s." -f $elapsed)
        } else {
            Set-Status ("Failed: {0}" -f $script:currentTask.TaskName)
            Append-Log ("Task failed in {0}s. Exit code: {1}" -f $elapsed, $script:currentTask.Process.ExitCode)
        }
        if ($script:currentTask.WrapperPath -and (Test-Path $script:currentTask.WrapperPath)) { Remove-Item -LiteralPath $script:currentTask.WrapperPath -Force -ErrorAction SilentlyContinue }
        $script:currentTask = $null
    }
})

# ================= 事件 =================
$form.Add_Resize({
    if ($form.WindowState -ne [System.Windows.Forms.FormWindowState]::Minimized) {
        Update-ResponsiveLayout
    }
})
$form.Add_Shown({
    Update-ResponsiveLayout
})

$themeModeBox.Add_SelectedIndexChanged({ Apply-Theme })
$saveButton.Add_Click({
    try { Save-Config -Config (Get-FormConfig); Set-Status "Saved config"; Append-Log "Config saved." }
    catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Save Failed") | Out-Null }
})
$openConfigButton.Add_Click({
    try {
        Save-Config -Config (Get-FormConfig)
        Start-Process notepad.exe $configPath
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Open Config Failed") | Out-Null }
})
$clearLogButton.Add_Click({ $logBox.Clear() })
$reloadThemeButton.Add_Click({ Apply-Theme; Append-Log ("Theme refreshed: " + [string]$themeModeBox.SelectedItem) })
$openLogButton.Add_Click({
    if (-not (Test-Path $lastLogPath)) { Append-Log "No log file yet."; return }
    Start-Process notepad.exe $lastLogPath
})
$openSiteButton.Add_Click({
    $c = Get-FormConfig
    if (-not $c.PublicBaseUrl) { [System.Windows.Forms.MessageBox]::Show("Public Base URL is empty; cannot open the site.", "Open Site") | Out-Null; return }
    $url = ($c.PublicBaseUrl.TrimEnd('/')) + "/" + ($c.PublicPrefix.Trim('/')) + "/"
    Start-Process $url
    Append-Log ("Opened: " + $url)
    Set-Status "Open site"
})

$deployButton.Add_Click({
    try {
        $c = Get-FormConfig
        $intro = @(
            "Preparing static site deployment...",
            ("Target:  {0}  ->  {1}{2}" -f $c.ServerHost, $c.PublicBaseUrl, $c.PublicPrefix),
            "Note: writes only the target static dir; never touches other services on the same host."
        )
        Start-Task -TaskName "deploy" -WrapperBody (Get-DeployWrapper) -IntroLines $intro
    } catch { Set-Status ("Failed: " + $_.Exception.Message); Append-Log ("TASK ERROR: " + $_.Exception.Message) }
})
$sshButton.Add_Click({
    try {
        $c = Get-FormConfig
        $target = $c.ServerUser + "@" + $c.ServerHost
        $body = "  & ssh -p $($c.ServerPort) -o BatchMode=yes -o ConnectTimeout=20 '$target' 'echo SSH connection OK; uname -a' | ForEach-Object { `$_; }"
        $intro = @("Checking SSH connectivity...", ("ssh " + $target))
        Start-Task -TaskName "ssh-check" -WrapperBody @($body) -IntroLines $intro
    } catch { Set-Status ("Failed: " + $_.Exception.Message); Append-Log ("TASK ERROR: " + $_.Exception.Message) }
})

$form.Add_FormClosing({
    param($sender, $eventArgs)
    if ($script:currentTask -and -not $script:currentTask.Process.HasExited) {
        $r = [System.Windows.Forms.MessageBox]::Show("A task is still running. Close and cancel it?", "Task In Progress", [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Warning)
        if ($r -eq [System.Windows.Forms.DialogResult]::Yes) {
            Stop-Process -Id $script:currentTask.Process.Id -Force -ErrorAction SilentlyContinue
        } else { $eventArgs.Cancel = $true }
    }
})

Apply-Theme
Set-Status "Idle"
Update-ResponsiveLayout
[System.Windows.Forms.Application]::Run($form)
