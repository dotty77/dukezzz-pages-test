# Copyright 2026 rng.moe
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Modified by DUKE, 2026-09-09. Independent optimized implementation,
# based on rng.moe revision d0f2ad962539e52ed56bdcf6972943e9cae6d182.
# Original scripts remain unchanged in vendor/rng-moe/.
# 只读取绝区零日志头与指定缓存；仅向允许的官方记录接口验证链接。
# 不修改游戏、不申请管理员、不修改执行策略。复制兼容回退会创建并清理临时文件。
# 含临时凭证的链接只在校验成功后显示；不要将链接分享给其他人。
[CmdletBinding()]
param(
    [ValidateSet('cn','os')][string]$Client = 'cn',
    [string]$GamePath = '',
    [switch]$NoClipboard
)

function Stop-BagelTuning {
    param([string]$Code, [string]$Message)
    $errorObject = New-Object InvalidOperationException($Message)
    $errorObject.Data['BagelCode'] = $Code
    throw $errorObject
}

function Test-BagelLocalFilePath {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path) -or $Path -notmatch '^[a-zA-Z]:[\\/]' -or $Path -match '^[\\/]{2}') { return $false }
    try {
        $full = [IO.Path]::GetFullPath($Path)
        if ((New-Object IO.DriveInfo([IO.Path]::GetPathRoot($full))).DriveType -eq [IO.DriveType]::Network) { return $false }
        $cursor = $full
        while ($cursor) {
            if (Test-Path -LiteralPath $cursor) {
                $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
                if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { return $false }
            }
            $cursor = [IO.Path]::GetDirectoryName($cursor)
        }
        return $true
    } catch { return $false }
}

function Resolve-BagelTuningGamePath {
    param([string]$Path)
    $Path = $Path.Trim().Trim('"', "'")
    if (-not (Test-BagelLocalFilePath $Path)) { Stop-BagelTuning 'path' '请指定本机绝区零安装目录；不支持网络路径或链接目录。' }
    $full = [IO.Path]::GetFullPath($Path.Trim().Trim('"', "'"))
    if (Test-Path -LiteralPath $full -PathType Leaf) { $full = [IO.Path]::GetDirectoryName($full) }
    foreach ($relative in @('webCaches', 'ZenlessZoneZero_Data\webCaches', 'games\ZenlessZoneZero Game\ZenlessZoneZero_Data\webCaches', 'ZenlessZoneZero Game\ZenlessZoneZero_Data\webCaches')) {
        $cache = Join-Path $full $relative
        if ((Test-BagelLocalFilePath $cache) -and (Test-Path -LiteralPath $cache -PathType Container)) { return [IO.Path]::GetDirectoryName($cache) }
    }
    Stop-BagelTuning 'path' '该目录下没有找到绝区零 webCaches。请打开游戏调频记录，或指定 ZenlessZoneZero_Data 目录。'
}

function Open-BagelSharedStream {
    param([string]$Path)
    return New-Object IO.FileStream($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
}

function Copy-BagelCacheFile {
    param([string]$Source, [string]$Destination)
    Copy-Item -LiteralPath $Source -Destination $Destination -ErrorAction Stop
}

function Get-BagelDefaultGamePath {
    param([ValidateSet('cn','os')][string]$Client = 'cn', [string[]]$LogPaths)
    if (-not $PSBoundParameters.ContainsKey('LogPaths')) {
        $folder = if ($Client -eq 'cn') { '绝区零' } else { 'ZenlessZoneZero' }
        $appData = [Environment]::GetFolderPath('ApplicationData')
        $root = [IO.Path]::GetFullPath((Join-Path $appData ('..\LocalLow\miHoYo\' + $folder)))
        $LogPaths = @((Join-Path $root 'Player.log'), (Join-Path $root 'Player-prev.log'))
    }
    foreach ($log in $LogPaths) {
        if (-not (Test-BagelLocalFilePath $log) -or -not (Test-Path -LiteralPath $log -PathType Leaf)) { continue }
        $stream = $null
        try {
            $stream = Open-BagelSharedStream -Path $log
            $buffer = New-Object byte[] ([int][Math]::Min(65536, $stream.Length))
            $read = $stream.Read($buffer, 0, $buffer.Length)
            $header = [Text.Encoding]::UTF8.GetString($buffer, 0, $read)
            foreach ($line in ($header -split '\r?\n' | Select-Object -First 32)) {
                if ($line.TrimStart([char]0xFEFF) -match '^\[Subsystems\] Discovering subsystems at path (.+?)[\\/]UnitySubsystems[\\/]?\s*$') {
                    try { return Resolve-BagelTuningGamePath -Path $Matches[1].Trim().Trim('"', "'") } catch { }
                }
            }
        } catch { } finally { if ($null -ne $stream) { $stream.Dispose() } }
    }
    return $null
}

function ConvertTo-BagelTuningUrl {
    param([string]$Candidate, [ValidateSet('cn','os')][string]$Client = 'cn')
    if (-not $Candidate -or $Candidate.Length -gt 32768 -or $Candidate -match '[\x00-\x20\x7f\\]') { return $null }
    $uri = $null
    if (-not [Uri]::TryCreate($Candidate, [UriKind]::Absolute, [ref]$uri)) { return $null }
    if ($uri.Scheme -cne 'https' -or $uri.Port -ne 443 -or $uri.UserInfo -or $uri.Fragment) { return $null }
    $hosts = @{ 'public-operation-nap.mihoyo.com'='cn'; 'public-operation-common.mihoyo.com'='cn'; 'public-operation-nap-sg.hoyoverse.com'='os'; 'public-operation-common-sg.hoyoverse.com'='os' }
    if (-not $hosts.ContainsKey($uri.Host) -or $hosts[$uri.Host] -ne $Client) { return $null }
    $prefix = '^https://' + [regex]::Escape($uri.Host) + '(?::443)?/common/gacha_record/api/getGachaLog\?'
    if ($Candidate -cnotmatch $prefix -or $uri.AbsolutePath -cne '/common/gacha_record/api/getGachaLog') { return $null }
    $allowed = @('authkey','authkey_ver','sign_type','game_biz','lang','region')
    $values = @{}
    foreach ($part in $uri.Query.TrimStart('?').Split('&')) {
        if (-not $part) { continue }
        $pair = $part -split '=', 2
        if ($part -match '%(?![0-9a-fA-F]{2})') { return $null }
        try {
            # These are URL parameters, not form data: literal '+' must survive.
            $key = [Uri]::UnescapeDataString($pair[0])
            $value = if ($pair.Length -gt 1) { [Uri]::UnescapeDataString($pair[1]) } else { '' }
        } catch { return $null }
        if ($key -match '[\x00-\x20\x7f]' -or $value -match '[\x00-\x1f\x7f]') { return $null }
        if ($allowed -cnotcontains $key) { continue }
        if ($values.ContainsKey($key)) { return $null }
        $values[$key] = $value
    }
    if (-not $values['authkey'] -or $values['authkey'].Length -gt 18000) { return $null }
    $game = if ($Client -eq 'cn') { 'nap_cn' } else { 'nap_global' }
    if ($uri.Host -in @('public-operation-common.mihoyo.com','public-operation-common-sg.hoyoverse.com') -and $values['game_biz'] -cne $game) { return $null }
    if ($values.ContainsKey('game_biz') -and $values['game_biz'] -cne $game) { return $null }
    if (($values.ContainsKey('authkey_ver') -and $values['authkey_ver'] -cne '1') -or ($values.ContainsKey('sign_type') -and $values['sign_type'] -cne '2')) { return $null }
    if ($values.ContainsKey('lang') -and $values['lang'] -notmatch '^[a-zA-Z]{2}(?:-[a-zA-Z]{2,4})?$') { return $null }
    if ($values.ContainsKey('region')) {
        $regions = if ($Client -eq 'cn') { @('prod_gf_cn','prod_qd_cn') } else { @('prod_gf_us','prod_gf_eu','prod_gf_jp','prod_gf_sg') }
        if ($regions -cnotcontains $values['region']) { return $null }
    }
    $values['authkey_ver'] = '1'; $values['sign_type'] = '2'; $values['game_biz'] = $game
    $values['lang'] = 'zh-cn'
    $query = New-Object 'System.Collections.Generic.List[string]'
    foreach ($key in $allowed) {
        if ($values.ContainsKey($key)) { $query.Add($key + '=' + [Uri]::EscapeDataString($values[$key])) }
    }
    $normalized = 'https://' + $uri.Host + $uri.AbsolutePath + '?' + ($query -join '&')
    # Match the site's existing 4096-byte API budget, including its longest pagination fields.
    $apiBase = [regex]::Replace($normalized, '&region=[^&]*', '')
    $largestPage = $apiBase + '&gacha_type=102&real_gacha_type=102&size=20&page=5001&end_id=9999999999999999999'
    if ([Text.Encoding]::UTF8.GetByteCount($largestPage) -gt 4096) { Stop-BagelTuning 'link_length' '整理后的链接超过网站支持的长度，请重新打开游戏调频记录并获取新链接。' }
    return $normalized
}

function New-BagelHttpRequest {
    param([string]$Url)
    return [Net.HttpWebRequest]::Create($Url)
}

function Invoke-BagelHttpJson {
    param([string]$Url, [ValidateRange(1,60)][int]$TimeoutSeconds = 10)
    # No redirects, cookies, response/error URL logging, or unbounded body reads.
    $requestObject = $null; $response = $null; $stream = $null; $memory = $null
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $previousTls = [Net.ServicePointManager]::SecurityProtocol
    try {
        [Net.ServicePointManager]::SecurityProtocol = $previousTls -bor [Net.SecurityProtocolType]::Tls12
        $requestObject = New-BagelHttpRequest -Url $Url
        $requestObject.AllowAutoRedirect = $false
        $requestObject.Timeout = $TimeoutSeconds * 1000
        $requestObject.ReadWriteTimeout = $TimeoutSeconds * 1000
        $requestObject.UserAgent = 'BagelMap-TuningLink/1.0'
        $pending = $requestObject.GetResponseAsync()
        try {
            if (-not $pending.Wait($TimeoutSeconds * 1000)) { Stop-BagelTuning 'network' '官方校验等待超时，请检查网络后重试。' }
            $response = $pending.GetAwaiter().GetResult()
        } catch {
            $failure = $_.Exception
            while ($failure.InnerException) { $failure = $failure.InnerException }
            if ($failure -is [Net.WebException] -and $null -ne $failure.Response) {
                $response = $failure.Response
                if ([int]$response.StatusCode -eq 429) { Stop-BagelTuning 'rate_limit' '官方接口限流，请稍后再试，已停止继续校验。' }
            }
            Stop-BagelTuning 'network' '官方校验连接失败或超时，请检查网络后重试。'
        }
        if ([int]$response.StatusCode -eq 429) { Stop-BagelTuning 'rate_limit' '官方接口限流，请稍后再试，已停止继续校验。' }
        if ([int]$response.StatusCode -ne 200) { Stop-BagelTuning 'network' '官方接口返回异常或重定向，已停止校验。' }
        $stream = $response.GetResponseStream()
        $memory = New-Object IO.MemoryStream
        $buffer = New-Object byte[] 8192
        while ($true) {
            $remaining = $TimeoutSeconds * 1000 - [int]$watch.ElapsedMilliseconds
            if ($remaining -le 0) { Stop-BagelTuning 'network' '官方校验等待超时，请检查网络后重试。' }
            $pendingRead = $stream.ReadAsync($buffer, 0, $buffer.Length)
            if (-not $pendingRead.Wait($remaining)) { Stop-BagelTuning 'network' '官方校验等待超时，请检查网络后重试。' }
            $count = $pendingRead.GetAwaiter().GetResult()
            if ($count -eq 0) { break }
            if ($memory.Length + $count -gt 1048576) { Stop-BagelTuning 'network' '官方响应超出合理大小，已停止校验。' }
            $memory.Write($buffer, 0, $count)
        }
        return ([Text.Encoding]::UTF8.GetString($memory.ToArray()) | ConvertFrom-Json -ErrorAction Stop)
    } catch {
        if ($_.Exception.Data['BagelCode']) { throw }
        Stop-BagelTuning 'network' '官方校验连接失败或响应异常，请检查网络后重试。'
    } finally {
        if ($null -ne $requestObject) { $requestObject.Abort() }
        if ($null -ne $stream) { $stream.Dispose() }
        if ($null -ne $memory) { $memory.Dispose() }
        if ($null -ne $response) { $response.Close() }
        [Net.ServicePointManager]::SecurityProtocol = $previousTls
    }
}

function Test-BagelTuningCandidate {
    param([string]$Candidate, $Context)
    $Context.Stats.CandidatesSeen++
    $url = ConvertTo-BagelTuningUrl -Candidate $Candidate -Client $Context.Client
    if (-not $url -or -not $Context.Seen.Add($url)) { return $null }
    if ($Context.Stats.UniqueCandidates -ge $Context.MaxCandidates) { Stop-BagelTuning 'candidate_limit' '候选数量达到本次上限，检查已截断；这不代表没有记录。请重新打开调频记录后再试。' }
    $Context.Stats.UniqueCandidates++
    [void](& $Context.Status ('正在校验官方链接（第 ' + ($Context.Stats.Requests + 1) + ' 次请求，单次最多 ' + $Context.TimeoutSeconds + ' 秒）…'))
    $Context.Stats.Requests++
    try {
        $response = & $Context.Request ($url + '&gacha_type=2&real_gacha_type=2&page=1&size=1&end_id=0') $Context.TimeoutSeconds
    } catch {
        if ($_.Exception.Data['BagelCode']) { throw }
        Stop-BagelTuning 'network' '官方校验连接失败或超时，已停止继续请求，请检查网络后重试。'
    }
    $code = 0
    if ($null -eq $response -or $null -eq $response.retcode -or -not [int]::TryParse([string]$response.retcode, [ref]$code)) { Stop-BagelTuning 'network' '官方校验响应无法识别，已停止继续请求。' }
    if ($code -eq 0) { return $url }
    if ([string]$response.message -match 'frequen|too many|频繁|频率|限流' -or $code -eq -110) { Stop-BagelTuning 'rate_limit' '官方接口限流，请稍后再试，已停止继续校验。' }
    if ($code -in @(-101,-100,-10001) -or [string]$response.message -match 'authkey|expired|过期|失效') {
        $Context.Expired++
        [void](& $Context.Status '这个候选链接已失效，继续检查缓存中的其他候选…')
        return $null
    }
    Stop-BagelTuning 'official_error' ('官方校验未通过（状态码 ' + $code + '），已停止；请重新打开游戏调频记录后再试。')
}

function Find-BagelTuningUrlInCache {
    param([string]$Path, $Context)
    $stream = $null; $copyPath = $null
    try {
        try { $stream = Open-BagelSharedStream -Path $Path } catch {
            # Copy only when opening really failed. Neither path bypasses an exclusive lock or ACL.
            $length = (Get-Item -LiteralPath $Path -ErrorAction Stop).Length
            if ($length -gt $Context.MaxScanBytes - $Context.Stats.BytesRead) { Stop-BagelTuning 'scan_limit' '共享读取失败且文件超过复制预算，本次检查已截断；请关闭游戏后重试，不需要管理员权限。' }
            if (-not (Test-BagelLocalFilePath $Context.TempDirectory) -or -not (Test-Path -LiteralPath $Context.TempDirectory -PathType Container)) { Stop-BagelTuning 'path' '临时目录不可用，无法进行复制兼容读取。' }
            $copyPath = Join-Path $Context.TempDirectory ('bagel-tuning-' + [Guid]::NewGuid().ToString('N') + '.tmp')
            [void](& $Context.Status '共享读取不可用，正在通过临时副本兼容读取；副本结束后会清理…')
            Copy-BagelCacheFile -Source $Path -Destination $copyPath
            $Context.Stats.UsedCopyFallback = $true
            $Context.Stats.CopyBytes += $length
            $stream = [IO.File]::Open($copyPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        }
        $Context.Stats.FilesRead++
        $fileLength = $stream.Length
        $end = $fileLength
        # Chromium can place adjacent keys behind "1/0/" without NUL. Only split when
        # another HTTPS URL follows; a literal "1/0/" inside an authkey stays intact.
        $regex = New-Object Text.RegularExpressions.Regex('https://(?:(?!1/0/https://)[^\x00-\x20\x7f-\uffff"''<>\\]){1,32761}', [Text.RegularExpressions.RegexOptions]::CultureInvariant, [TimeSpan]::FromSeconds(2))
        while ($end -gt 0) {
            $overlap = [int][Math]::Min(32769L, $fileLength - $end)
            $remaining = $Context.MaxScanBytes - $Context.Stats.BytesRead
            if ($remaining -le $overlap) { Stop-BagelTuning 'scan_limit' '读取达到本次字节上限，检查已截断；这不代表没有记录。请重新打开调频记录后再试。' }
            $coreLength = [int][Math]::Min([Math]::Min([long]$Context.ChunkBytes, $end), $remaining - $overlap)
            $start = $end - $coreLength
            $buffer = New-Object byte[] ($coreLength + $overlap)
            [void]$stream.Seek($start, [IO.SeekOrigin]::Begin)
            $read = 0
            while ($read -lt $buffer.Length) {
                $count = $stream.Read($buffer, $read, $buffer.Length - $read)
                if ($count -eq 0) { break }
                $read += $count
                $Context.Stats.BytesRead += $count
            }
            # One byte per character keeps offsets stable even amid binary cache data.
            $text = [Text.Encoding]::GetEncoding(28591).GetString($buffer, 0, $read)
            $matchesFound = $regex.Matches($text)
            for ($i = $matchesFound.Count - 1; $i -ge 0; $i--) {
                $match = $matchesFound[$i]
                if ($match.Index -ge $coreLength -or $match.Length -gt 32768) { continue }
                if ($match.Index + $match.Length -eq $read -and $start + $read -lt $fileLength) { continue }
                $url = Test-BagelTuningCandidate -Candidate $match.Value -Context $Context
                if ($url) { return $url }
            }
            $end = $start
        }
        return $null
    } finally {
        if ($null -ne $stream) { $stream.Dispose() }
        if ($copyPath -and (Test-Path -LiteralPath $copyPath)) { Remove-Item -LiteralPath $copyPath -Force -ErrorAction Stop }
    }
}

function Get-BagelTuningLink {
    [CmdletBinding()]
    param(
        [ValidateSet('cn','os')][string]$Client = 'cn', [string]$GamePath = '',
        [scriptblock]$Request = { param($Url,$TimeoutSeconds) Invoke-BagelHttpJson -Url $Url -TimeoutSeconds $TimeoutSeconds },
        [scriptblock]$Status = { param($Message) }, [string[]]$LogPaths,
        [string]$TempDirectory = [IO.Path]::GetTempPath(),
        [ValidateRange(1,1073741824)][long]$MaxScanBytes = 268435456,
        [ValidateRange(1,1024)][int]$MaxCandidates = 256,
        [ValidateRange(1,60)][int]$TimeoutSeconds = 10,
        [ValidateRange(1024,4194304)][int]$ChunkBytes = 1048576
    )
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $stats = [pscustomobject]@{ FilesRead=0; BytesRead=0L; CandidatesSeen=0; UniqueCandidates=0; Requests=0; UsedCopyFallback=$false; CopyBytes=0L; FailedFiles=0 }
    $context = [pscustomobject]@{ Client=$Client; Request=$Request; Status=$Status; TempDirectory=$TempDirectory; MaxScanBytes=$MaxScanBytes; MaxCandidates=$MaxCandidates; TimeoutSeconds=$TimeoutSeconds; ChunkBytes=$ChunkBytes; Stats=$stats; Seen=(New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)); Expired=0 }
    try {
        [void](& $Status '正在定位绝区零目录，只检查日志头与游戏网页缓存…')
        if ([string]::IsNullOrWhiteSpace($GamePath)) {
            $arguments = @{ Client=$Client }
            if ($PSBoundParameters.ContainsKey('LogPaths')) { $arguments.LogPaths = $LogPaths }
            $GamePath = Get-BagelDefaultGamePath @arguments
            if (-not $GamePath) { Stop-BagelTuning 'path' '未能从游戏日志定位目录。请在网页中填写安装路径后重新复制命令，或使用 -GamePath 指定目录。' }
        }
        $data = Resolve-BagelTuningGamePath -Path $GamePath
        $cacheRoot = Join-Path $data 'webCaches'
        $versions = @(Get-ChildItem -LiteralPath $cacheRoot -Directory -ErrorAction Stop | Where-Object { $_.Name -match '^\d{1,4}\.\d{1,4}\.\d{1,4}\.\d{1,4}$' -and -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } | Sort-Object { [Version]$_.Name } -Descending | Select-Object -First 4)
        $directories = @($versions | ForEach-Object { Join-Path $_.FullName 'Cache\Cache_Data' }) + @(Join-Path $cacheRoot 'Cache\Cache_Data')
        # Prefer data_2 across recent versions; secondary cache files are a bounded fallback.
        foreach ($name in @('data_2','data_1','data_0','data_3')) {
            foreach ($directory in $directories) {
                $path = Join-Path $directory $name
                if (-not (Test-BagelLocalFilePath $path) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
                [void](& $Status ('正在分块读取第 ' + ($stats.FilesRead + 1) + ' 个缓存文件（' + $name + '），已读取 ' + [Math]::Round($stats.BytesRead / 1048576, 1) + ' MB…'))
                try { $url = Find-BagelTuningUrlInCache -Path $path -Context $context } catch {
                    if ($_.Exception.Data['BagelCode']) { throw }
                    $stats.FailedFiles++
                    [void](& $Status '这个缓存文件暂时无法完整读取，继续检查其他指定缓存…')
                    continue
                }
                if ($url) {
                    return [pscustomobject]@{ Url=$url; VerifiedOnline=$true; FilesRead=$stats.FilesRead; BytesRead=$stats.BytesRead; CandidatesSeen=$stats.CandidatesSeen; UniqueCandidates=$stats.UniqueCandidates; Requests=$stats.Requests; ElapsedMilliseconds=$watch.ElapsedMilliseconds; UsedCopyFallback=$stats.UsedCopyFallback; CopyBytes=$stats.CopyBytes; FailedFiles=$stats.FailedFiles }
                }
            }
        }
        if ($stats.FailedFiles) { Stop-BagelTuning 'read_failed' '部分缓存无法读取。请关闭游戏后重试，或检查所选客户端与安装路径；不需要管理员权限。' }
        if ($context.Expired) { Stop-BagelTuning 'expired' '找到的候选链接均未通过有效期校验。请重新打开游戏调频记录，等待显示后再获取。检查范围为最新四版及旧版目录。' }
        Stop-BagelTuning 'not_found' '在最新四版及旧版目录的指定缓存中未找到可用链接。请确认客户端选择正确，重新打开游戏调频记录并等待列表显示。'
    } catch {
        if ($_.Exception.Data['BagelCode']) { throw }
        Stop-BagelTuning 'read_failed' '未能完成读取，请检查安装路径并重试。错误中不会显示调频凭证。'
    } finally {
        $watch.Stop()
        [void](& $Status ('本次检查：' + $stats.FilesRead + ' 个文件，读取 ' + [Math]::Round($stats.BytesRead / 1048576, 2) + ' MB，候选 ' + $stats.CandidatesSeen + ' 个，去重后 ' + $stats.UniqueCandidates + ' 个，官方请求 ' + $stats.Requests + ' 次，耗时 ' + [Math]::Round($watch.Elapsed.TotalSeconds, 1) + ' 秒。'))
    }
}

function Set-BagelTuningClipboard {
    param([string]$Value)
    Set-Clipboard -Value $Value -ErrorAction Stop
}

function Invoke-BagelTuningMain {
    [CmdletBinding()]
    param(
        [ValidateSet('cn','os')][string]$Client = 'cn', [string]$GamePath = '', [switch]$NoClipboard,
        [scriptblock]$Request = { param($Url,$TimeoutSeconds) Invoke-BagelHttpJson -Url $Url -TimeoutSeconds $TimeoutSeconds },
        [scriptblock]$Status = { param($Message) Write-Host $Message }, [string[]]$LogPaths,
        [string]$TempDirectory = [IO.Path]::GetTempPath()
    )
    try {
        [void](& $Status 'DUKE：优化读取版。请先在游戏中打开调频记录；不会修改游戏文件。')
        $arguments = @{ Client=$Client; GamePath=$GamePath; Request=$Request; Status=$Status; TempDirectory=$TempDirectory }
        if ($PSBoundParameters.ContainsKey('LogPaths')) { $arguments.LogPaths=$LogPaths }
        $result = Get-BagelTuningLink @arguments
        [void](& $Status '已通过官方接口校验，链接如下（请勿分享）：')
        Write-Output $result.Url
        if ($NoClipboard) { [void](& $Status '已选择不写剪贴板，请手动复制上方链接到DUKE。') }
        else {
            try { Set-BagelTuningClipboard -Value $result.Url; [void](& $Status '链接已复制，可粘贴到DUKE开始导入。') }
            catch { [void](& $Status '链接已获取，但剪贴板写入失败。请手动复制上方链接；没有自动复制成功。') }
        }
    } catch {
        if ($_.Exception.Data['BagelCode']) { [void](& $Status ('未完成：' + $_.Exception.Message)) }
        else { [void](& $Status '未完成：读取过程遇到异常，请检查目录与网络后重试。') }
    }
}

# Dot-sourcing is inert: all filesystem/network/clipboard activity begins at this explicit entry.
if ($MyInvocation.InvocationName -ne '.') { Invoke-BagelTuningMain -Client $Client -GamePath $GamePath -NoClipboard:$NoClipboard }
