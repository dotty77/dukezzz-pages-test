<#
DUKE：在你自己的电脑上读取绝区零缓存中的调频历史链接。
请先在游戏中打开「调频 > 调频详情 > 调频记录」，等待记录显示。
本脚本只读游戏日志/指定缓存；不联网、不读 Cookie/密码、不修改游戏文件，
不申请管理员、不修改执行策略、不创建缓存副本。找到的链接仅显示并复制到本机剪贴板。
链接可能过期；本脚本不联网验证。不要把链接发给其他人或粘贴到公开聊天中。

用法：powershell -NoProfile -File .\get-tuning-link.ps1 -GamePath "游戏安装目录"
可选 -NoClipboard 仅显示；路径可以是启动器目录、游戏目录或 ZenlessZoneZero_Data。
实现参考目录结构：rng.moe 的公开获取教程；这是独立的有限只读实现。
#>
[CmdletBinding()]
param(
    [string]$GamePath = '',
    [switch]$NoClipboard
)

function Test-BagelLocalPath {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    # Reject UNC/device paths so a pasted path cannot trigger access to a network share.
    if ($Path -match '^[\\/]{2}' -or $Path -notmatch '^[a-zA-Z]:[\\/]') { return $false }
    try { if ((New-Object IO.DriveInfo([IO.Path]::GetPathRoot($Path))).DriveType -eq [IO.DriveType]::Network) { return $false } } catch { return $false }
    return $true
}

function Get-BagelContainedPath {
    param([string]$Root, [string]$Relative)
    $base = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $target = [IO.Path]::GetFullPath((Join-Path $base $Relative))
    if (-not $target.StartsWith($base + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { return $null }
    # Never follow junctions/symbolic links out of the chosen tree.
    $cursor = $target
    while ($cursor.Length -ge $base.Length) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
            if ($null -eq $item -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $null }
        }
        if ($cursor.Equals($base, [StringComparison]::OrdinalIgnoreCase)) { break }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
        if ([string]::IsNullOrEmpty($cursor)) { return $null }
    }
    return $target
}

function Read-BagelSharedSlice {
    param([string]$Path, [int]$MaxBytes, [switch]$FromStart)
    $stream = $null
    try {
        $sharing = [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete
        $stream = New-Object IO.FileStream($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, $sharing)
        $length = [int][Math]::Min([long]$MaxBytes, $stream.Length)
        $offset = if ($FromStart) { 0L } else { [Math]::Max(0L, $stream.Length - $length) }
        [void]$stream.Seek($offset, [IO.SeekOrigin]::Begin)
        $buffer = New-Object byte[] $length
        $read = 0
        while ($read -lt $length) {
            $n = $stream.Read($buffer, $read, $length - $read)
            if ($n -eq 0) { break }
            $read += $n
        }
        return [pscustomobject]@{ Text = [Text.Encoding]::UTF8.GetString($buffer, 0, $read); Bytes = $read; Offset = $offset }
    } finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Get-BagelDataPathFromLog {
    param([string]$LogPath)
    try {
        if (-not (Test-BagelLocalPath $LogPath) -or -not (Test-Path -LiteralPath $LogPath -PathType Leaf)) { return $null }
        if ((Get-Item -LiteralPath $LogPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { return $null }
        # Only the bounded header is needed for Unity's installation path line.
        $header = (Read-BagelSharedSlice -Path $LogPath -MaxBytes 65536 -FromStart).Text
        foreach ($line in ($header -split '\r?\n' | Select-Object -First 32)) {
            if ($line -match '^\[Subsystems\] Discovering subsystems at path (.+?)[\\/]UnitySubsystems[\\/]?\s*$') {
                $candidate = $Matches[1].Trim().Trim('"', "'")
                if (Test-BagelLocalPath $candidate) { return $candidate }
            }
        }
    } catch { return $null }
    return $null
}

function Resolve-BagelGameDataPath {
    param([string]$SelectedPath)
    $selected = $SelectedPath.Trim().Trim('"', "'")
    if (-not (Test-BagelLocalPath $selected)) { throw '请填写本机磁盘上的绝区零安装目录；不支持网络共享路径。' }
    $full = [IO.Path]::GetFullPath($selected)
    if (Test-Path -LiteralPath $full -PathType Leaf) { $full = [IO.Path]::GetDirectoryName($full) }
    if (-not (Test-Path -LiteralPath $full -PathType Container)) { throw '所选游戏目录不存在。请在启动器中查看安装位置。' }
    $relativePaths = @('webCaches', 'ZenlessZoneZero_Data\webCaches', 'games\ZenlessZoneZero Game\ZenlessZoneZero_Data\webCaches', 'ZenlessZoneZero Game\ZenlessZoneZero_Data\webCaches')
    foreach ($relative in $relativePaths) {
        $candidate = Get-BagelContainedPath -Root $full -Relative $relative
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Container)) { return [IO.Path]::GetDirectoryName($candidate) }
    }
    throw '所选目录下没有找到绝区零 webCaches。请先启动游戏并打开调频记录，或指定 ZenlessZoneZero_Data 目录。'
}

function Get-BagelDefaultGamePath {
    $appData = [Environment]::GetFolderPath('ApplicationData')
    if ($appData) {
        $localLow = [IO.Path]::GetFullPath((Join-Path $appData '..\LocalLow\miHoYo'))
        foreach ($game in @('ZenlessZoneZero', '绝区零')) {
            foreach ($log in @('Player.log', 'Player-prev.log')) {
                $logPath = Get-BagelContainedPath -Root $localLow -Relative ($game + '\' + $log)
                if ($logPath) {
                    $candidate = Get-BagelDataPathFromLog -LogPath $logPath
                    if ($candidate) { try { return Resolve-BagelGameDataPath $candidate } catch { } }
                }
            }
        }
    }
    foreach ($programRoot in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if (-not $programRoot) { continue }
        foreach ($relative in @('HoYoPlay\games\ZenlessZoneZero Game', 'ZenlessZoneZero Game')) {
            $candidate = Get-BagelContainedPath -Root $programRoot -Relative $relative
            if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Container)) {
                try { return Resolve-BagelGameDataPath $candidate } catch { }
            }
        }
    }
    return $null
}

function ConvertTo-BagelSignalUrl {
    param([string]$Candidate)
    if ([string]::IsNullOrWhiteSpace($Candidate) -or $Candidate.Length -gt 32768) { return $null }
    $uri = $null
    if (-not [Uri]::TryCreate($Candidate, [UriKind]::Absolute, [ref]$uri)) { return $null }
    if ($uri.Scheme -cne 'https' -or $uri.Port -ne 443 -or $uri.UserInfo -or $uri.Fragment) { return $null }
    $hostRegions = @{ 'public-operation-nap.mihoyo.com' = 'nap_cn'; 'public-operation-nap-sg.hoyoverse.com' = 'nap_global' }
    if (-not $hostRegions.ContainsKey($uri.Host) -or $uri.AbsolutePath -cne '/common/gacha_record/api/getGachaLog') { return $null }
    # Require the original authority/path too: encoded paths, backslashes and lookalike hosts are not accepted.
    if ($Candidate -cnotmatch '^https://(?:public-operation-nap\.mihoyo\.com|public-operation-nap-sg\.hoyoverse\.com)(?::443)?/common/gacha_record/api/getGachaLog\?') { return $null }
    $values = @{}
    foreach ($part in $uri.Query.TrimStart('?').Split('&')) {
        if (-not $part) { continue }
        $pair = $part -split '=', 2
        try {
            $key = [Uri]::UnescapeDataString($pair[0].Replace('+', ' '))
            # authkey is an opaque base64-like token: a literal + is token data, not a space.
            $encodedValue = if ($pair.Length -gt 1) { $pair[1] } else { '' }
            if ($key -ine 'authkey') { $encodedValue = $encodedValue.Replace('+', ' ') }
            $value = [Uri]::UnescapeDataString($encodedValue)
        } catch { return $null }
        if ($key -match '[\x00-\x20]' -or $value -match '[\x00-\x1f\x7f]' -or $values.ContainsKey($key)) { return $null }
        $values[$key] = $value
    }
    if (-not $values.ContainsKey('authkey') -or [string]::IsNullOrWhiteSpace($values['authkey']) -or $values['authkey'].Length -gt 16384) { return $null }
    if ($values.ContainsKey('game_biz') -and $values['game_biz'] -cne $hostRegions[$uri.Host]) { return $null }
    foreach ($name in @('authkey_ver', 'sign_type')) { if ($values.ContainsKey($name) -and $values[$name] -notmatch '^\d{1,3}$') { return $null } }
    if ($values.ContainsKey('lang') -and $values['lang'] -notmatch '^[a-zA-Z]{2}(?:-[a-zA-Z]{2,4})?$') { return $null }
    $query = New-Object 'System.Collections.Generic.List[string]'
    foreach ($key in @('authkey', 'authkey_ver', 'sign_type', 'game_biz', 'lang')) {
        if ($values.ContainsKey($key)) { $query.Add($key + '=' + [Uri]::EscapeDataString($values[$key])) }
    }
    return 'https://' + $uri.Host + $uri.AbsolutePath + '?' + ($query -join '&')
}

function Find-BagelSignalUrlInText {
    param([string]$Text, [switch]$RequireTerminator)
    # Chromium entries can be separated by 1/0/ without a NUL between adjacent URLs.
    # Match the following scheme too, so an authkey containing literal 1/0/ is preserved.
    $Text = [Text.RegularExpressions.Regex]::Replace($Text, '1/0/(?=https://)', [string][char]0)
    # ASCII URL fields are NUL/whitespace-delimited in Chromium's disk cache.
    $pattern = 'https://[^\x00-\x20"''<>\\]{1,32768}'
    $regex = New-Object Text.RegularExpressions.Regex($pattern, [Text.RegularExpressions.RegexOptions]::CultureInvariant, [TimeSpan]::FromSeconds(2))
    $match = $regex.Match($Text)
    $latest = $null
    $count = 0
    while ($match.Success -and $count -lt 10000) {
        if ($RequireTerminator -and $match.Index + $match.Length -eq $Text.Length) { break }
        $url = ConvertTo-BagelSignalUrl -Candidate $match.Value
        if ($url) { $latest = $url }
        $count++
        $match = $match.NextMatch()
    }
    return $latest
}

function Read-BagelCacheSignalLink {
    param([string]$Path, [int]$MaxBytes)
    $stream = $null
    try {
        $sharing = [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete
        $stream = New-Object IO.FileStream($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, $sharing)
        $limit = [int][Math]::Min([long]$MaxBytes, $stream.Length)
        $truncated = $stream.Length -gt $limit
        $buffer = New-Object byte[] (1024 * 1024)
        $read = 0
        $carry = ''
        $latest = $null
        while ($read -lt $limit) {
            $n = $stream.Read($buffer, 0, [Math]::Min($buffer.Length, $limit - $read))
            if ($n -eq 0) { break }
            $read += $n
            $text = $carry + [Text.Encoding]::UTF8.GetString($buffer, 0, $n)
            $candidate = Find-BagelSignalUrlInText -Text $text -RequireTerminator:($read -lt $limit -or $truncated)
            if ($candidate) { $latest = $candidate }
            $carry = $text.Substring([Math]::Max(0, $text.Length - 32768))
        }
        return [pscustomobject]@{Url=$latest;Bytes=$read;Truncated=$truncated}
    } finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Find-BagelSignalLink {
    param([string]$SelectedPath)
    $data = Resolve-BagelGameDataPath $SelectedPath
    $cacheRoot = Get-BagelContainedPath -Root $data -Relative 'webCaches'
    $versions = @(Get-ChildItem -LiteralPath $cacheRoot -Directory -ErrorAction Stop |
        Where-Object { $_.Name -match '^\d{1,4}\.\d{1,4}\.\d{1,4}\.\d{1,4}$' -and -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } |
        Sort-Object { [Version]$_.Name } -Descending | Select-Object -First 4)
    $relativeDirs = @($versions | ForEach-Object { $_.Name + '\Cache\Cache_Data' }) + @('Cache\Cache_Data')
    $budget = 64 * 1024 * 1024
    $filesRead = 0
    $failedReads = 0
    foreach ($relative in $relativeDirs) {
        $directory = Get-BagelContainedPath -Root $cacheRoot -Relative $relative
        if (-not $directory -or -not (Test-Path -LiteralPath $directory -PathType Container)) { continue }
        $files = @(foreach ($name in @('data_2','data_1','data_0','data_3')) {
            $candidate = Get-BagelContainedPath -Root $directory -Relative $name
            if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { Get-Item -LiteralPath $candidate }
        })
        foreach ($file in $files) {
            if ($budget -le 0) { break }
            $requested = [int]$budget
            # Reserve the whole slice before reading; even partial failed reads stay bounded.
            $budget -= $requested
            try {
                $slice = Read-BagelCacheSignalLink -Path $file.FullName -MaxBytes $requested
                $budget += $requested - $slice.Bytes
                $filesRead++
                $url = $slice.Url
                if ($url) { return [pscustomobject]@{ Url=$url; FilesRead=$filesRead; BytesRead=64*1024*1024-$budget; Source='游戏缓存'; VerifiedOnline=$false; Truncated=$slice.Truncated } }
            } catch { $failedReads++ }
        }
    }
    if ($failedReads) { throw '部分缓存正被游戏独占或无读取权限。请关闭游戏后重试；无需管理员权限。' }
    throw '未找到调频历史链接。请重新在游戏里打开调频记录并等待列表出现，再运行本脚本。缓存从头分块读取，合计最多 64 MB。'
}

# Dot-sourcing defines functions only; synthetic tests use this without auto-discovery.
if ($MyInvocation.InvocationName -ne '.') {
    try {
        Write-Host 'DUKE：只读提取本机绝区零调频链接，不会发送网络请求。'
        if ([string]::IsNullOrWhiteSpace($GamePath)) {
            $GamePath = Get-BagelDefaultGamePath
            if (-not $GamePath) { $GamePath = Read-Host '请输入绝区零安装目录（可从启动器查看），按 Enter 确认' }
        }
        $result = Find-BagelSignalLink -SelectedPath $GamePath
        Write-Host '已找到缓存中的链接（尚未联网验证是否过期）：'
        if ($result.Truncated) { Write-Host '缓存较大，已达到 64 MB 扫描上限；本次链接来自已扫描部分，可能不是最新。' }
        Write-Output $result.Url
        if (-not $NoClipboard) {
            try { Set-Clipboard -Value $result.Url -ErrorAction Stop; Write-Host '已复制到本机剪贴板，请粘贴到DUKE的调频链接输入框。' }
            catch { Write-Host '剪贴板不可用，请手动复制上方链接。' }
        }
        Write-Host '请勿将链接分享给他人。若导入提示过期，重新打开游戏调频记录后再获取。'
    } catch {
        Write-Host ('未完成：' + $_.Exception.Message)
    }
}
