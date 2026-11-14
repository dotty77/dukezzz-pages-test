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

# This ensures that TLS 1.2 is enabled for secure web requests, which is required for modern HTTPS
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

# Loading the System.Web assembly so that we can check URLs for validity and use HttpUtility to parse query strings
Add-Type -AssemblyName System.Web

$ProgressPreference = 'SilentlyContinue'

$game_path = ""

Write-Output "Attempting to locate Warp Url!"

# First we need to locate the game path, which is required to find the cache data that contains the url
if ($set_path) {
    # If we have manually set the path, use it
    $game_path = $set_path
} else {
    # Start searching the game's logs for the game path
    $app_data = [Environment]::GetFolderPath('ApplicationData')
    $locallow_path = "$app_data\..\LocalLow\miHoYo\$([char]0x7edd)$([char]0x533a)$([char]0x96f6)\"

    $log_path = "$locallow_path\Player.log"

    # The global client of the game has a different folder name
    # so if we can't find it, its possible that they are using
    # the global client
    if (-Not [IO.File]::Exists($log_path)) {
        Write-Output "Failed to locate log file!"
        Write-Output "Try using the Global region script?"
        return
    }

    # Read the first 16 lines of the log file
    $log_lines = Get-Content $log_path -First 16

    # If we can't read the log file, try reading the previous log file
    if ([string]::IsNullOrEmpty($log_lines)) {
        $log_path = "$locallow_path\Player-prev.log"

        if (-Not [IO.File]::Exists($log_path)) {
            Write-Output "Failed to locate log file!"
            Write-Output "Try using the Global region script?"
            return
        }

        $log_lines = Get-Content $log_path -First 16
    }

    # If we still can't read the log file, we can't locate the game path, so we should exit
    if ([string]::IsNullOrEmpty($log_lines)) {
        Write-Output "Failed to locate game path! (1)"
        Write-Output "Please contact support at discord.gg/e48fzqxuPM"
        return
    }

    $log_lines = $log_lines.split([Environment]::NewLine)

    # The log file should contain a line that starts with "[Subsystems] Discovering subsystems at path " followed by the game path, so we need to find that line and extract the game path from it
    for ($i = 0; $i -lt 16; $i++) {
        $log_line = $log_lines[$i]

        if ($log_line.startsWith("[Subsystems] Discovering subsystems at path ")) {
            $game_path = $log_line.replace("[Subsystems] Discovering subsystems at path ", "").replace("UnitySubsystems", "")
            break
        }
    }
}

# If we still can't locate the game path, we should exit
if ([string]::IsNullOrEmpty($game_path)) {
    Write-Output "Failed to locate game path! (2)"
    Write-Output "Please contact support at discord.gg/e48fzqxuPM"
}

# Prepare a temporary file path to copy the cache data to, since we can't read it directly from the game folder due to permission issues
$copy_path = [IO.Path]::GetTempPath() + [Guid]::NewGuid().ToString()

$cache_path = "$game_path/webCaches/Cache/Cache_Data/data_2"
$cache_folders = Get-ChildItem "$game_path/webCaches/" -Directory
$max_version = 0

# Locate the latest cache folder, which should be the one with the highest version number
for ($i = 0; $i -le $cache_folders.Length; $i++) {
    $cache_folder = $cache_folders[$i].Name
    if ($cache_folder -match '^\d+\.\d+\.\d+\.\d+$') {
        $version = [int]-join($cache_folder.Split(".") | ForEach-Object { $_.PadLeft(3, "0") })
        if ($version -ge $max_version) {
            $max_version = $version
            $cache_path = "$game_path/webCaches/$cache_folder/Cache/Cache_Data/data_2"
        }
    }
}

# Copy the cache data to the temporary file path, read it, and then delete the temporary file
Copy-Item -Path $cache_path -Destination $copy_path
$cache_data = Get-Content -Encoding UTF8 -Raw $copy_path
Remove-Item -Path $copy_path

$cache_data_split = $cache_data -split '1/0/'

# The cache data should contain the url we are looking for, so we need to find the line that starts with "http" and contains "getGachaLog", which should be the url we are looking for
for ($i = $cache_data_split.Length - 1; $i -ge 0; $i--) {
    $line = $cache_data_split[$i]

    if ($line.StartsWith('http') -and $line.Contains("getGachaLog")) {
        $url = ($line -split "\0")[0]

        # Make a web request to the url to check if it is valid and contains the data we are looking for
        $res = Invoke-WebRequest -Uri $url -ContentType "application/json" -UseBasicParsing | ConvertFrom-Json

        if ($res.retcode -eq 0) {
            # If the web request is successful, we should have the data we are looking for, so we can extract the url and save it to the clipboard
            $uri = [Uri]$url
            $query = [Web.HttpUtility]::ParseQueryString($uri.Query)

            # The url normally contains extra information like device model, etc. We don't need that information so we remove it
            # and only keep what is absolutely necessary for the url to work as a gacha log tracker, though I know that some sites
            # which fork this script decide to remove this part of the code
            $keys = $query.AllKeys
            foreach ($key in $keys) {
                # Retain required params
                if ($key -eq "authkey") { continue }
                if ($key -eq "authkey_ver") { continue }
                if ($key -eq "sign_type") { continue }
                if ($key -eq "game_biz") { continue }
                if ($key -eq "lang") { continue }

                $query.Remove($key)
            }

            # Reconstruct the url with the remaining query parameters
            $latest_url = $uri.Scheme + "://" + $uri.Host + $uri.AbsolutePath + "?" + $query.ToString()

            # Output the url and save it to the clipboard
            Write-Output "Search History Url Found!"
            Write-Output $latest_url
            Set-Clipboard -Value $latest_url
            Write-Output "Search History Url has been saved to clipboard."
            return;
        }
    }
}

Write-Output "Could not locate Search History Url."
Write-Output "Please make sure to open the Search history before running the script."
