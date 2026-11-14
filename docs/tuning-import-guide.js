const TLS='[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; ';
export function getLinkCommand({region='cn',gamePath='',origin=location.origin,pathname=globalThis.location?.pathname||'/'}={}) {
  if(!['cn','os'].includes(region))throw new Error('请选择游戏客户端。');
  const pages=origin==='https://dotty77.github.io'&&pathname.startsWith('/dukezzz-pages-test/');
  const local=new URL('/get-tuning-link-fast.ps1',pages?'https://dukezzz.com':origin);
  const permitted=(local.protocol==='https:'&&local.hostname==='dukezzz.com'&&!local.port)||(local.protocol==='http:'&&['localhost','127.0.0.1'].includes(local.hostname));
  if(!permitted||local.username||local.password)throw new Error('获取脚本仅可从本站或本机预览下载。');
  let path=gamePath.trim();
  if(/[\x00-\x1f\x7f]/.test(path))throw new Error('安装路径不能包含换行或控制字符。');
  if(path.startsWith('"')&&path.endsWith('"'))path=path.slice(1,-1);
  // Pass the selected client and literal installation path to the optimized script.
  path=path.replace(/`/g,'``').replace(/\$/g,'`$').replace(/"/g,'`"');
  const download=url=>`$bagelDownload = $bagelScriptClient.DownloadStringTaskAsync("${url}"); if (-not $bagelDownload.Wait(15000)) { Write-Host '脚本下载超过 15 秒，已停止。尚未读取游戏记录，请检查或切换网络后重试。'; return }; $bagelScriptText = $bagelDownload.GetAwaiter().GetResult()`;
  const failed=`Write-Host '脚本下载失败，尚未开始读取游戏记录。请检查网络后重试；如本命令来自本地预览，请保持预览服务运行，或从 dukezzz.com 重新复制命令。'; return`;
  // Bound the whole download, including a stalled response body. Compile and execute once.
  return `& { $bagelPreviousTls=[Net.ServicePointManager]::SecurityProtocol; ${TLS}$bagelScriptText=$null; $bagelScriptClient=New-Object Net.WebClient; $bagelScriptClient.Encoding=[Text.Encoding]::UTF8; Write-Host '正在从本站下载调频链接获取脚本（最多 15 秒）…'; try { ${download(local.href)} } catch { ${failed} } finally { $bagelScriptClient.CancelAsync(); $bagelScriptClient.Dispose(); [Net.ServicePointManager]::SecurityProtocol=$bagelPreviousTls }; if ([string]::IsNullOrWhiteSpace($bagelScriptText)) { Write-Host '下载内容为空，尚未开始读取游戏记录，请稍后重试。'; return }; $bagelScriptText=$bagelScriptText.TrimStart([char]0xFEFF); try { if ($bagelScriptText -match '^\\s*<') { throw 'Unexpected document' }; $bagelScriptBlock=[ScriptBlock]::Create($bagelScriptText) } catch { Write-Host '下载内容不是有效的获取脚本，可能收到了网络错误页。尚未读取游戏记录，请稍后重试。'; return }; try { & $bagelScriptBlock -Client "${region}" -GamePath "${path}" } catch { Write-Host '获取脚本运行失败，请重新复制命令；自动定位失败时，可在网页填写游戏目录后重试。' } }`;
}

export function mountRngGuide(host,{status,isBusy}) {
  host.innerHTML=`<summary>获取调频记录链接</summary>
    <div class="rng-platforms" role="tablist" aria-label="获取链接的平台">
      <button id="rng-tab-windows" type="button" role="tab" aria-controls="rng-panel-windows" aria-selected="true" data-platform="windows">PC · Windows 10 / 11</button>
      <button id="rng-tab-ios" type="button" role="tab" aria-controls="rng-panel-ios" aria-selected="false" tabindex="-1" data-platform="ios">iOS</button>
      <button id="rng-tab-android" type="button" role="tab" aria-controls="rng-panel-android" aria-selected="false" tabindex="-1" data-platform="android">Android</button>
    </div>
    <div id="rng-panel-windows" class="rng-panel" role="tabpanel" aria-labelledby="rng-tab-windows">
      <p class="rng-source-note"><strong>本站优化版</strong> · 在 rng.moe 原版基础上改进缓存读取与链接验证。<a href="tuning-script-notice.txt" target="_blank" rel="noreferrer">来源与许可 ↗</a></p>
      <ol class="link-steps">
        <li>启动电脑版《绝区零》，打开<strong>调频 → 调频记录</strong>，等待列表出现。</li>
        <li>在 Windows 搜索中打开 <strong>Windows PowerShell</strong>。也可按 Win + R，输入 <code>powershell</code> 后回车。</li>
        <li><strong>自动查找游戏目录</strong><div class="rng-selectors"><label>游戏客户端<select id="rng-region"><option value="cn">中国大陆客户端</option><option value="os">海外客户端</option></select></label></div>
          <pre class="link-command"><code id="link-command-text"></code></pre><div class="link-script-actions"><button id="copy-link-script" type="button">复制获取命令</button><a id="rng-script-download" download>下载优化版脚本</a></div>
          <p class="rng-tip" id="rng-source-hint">获取脚本直接从本站下载。复制命令后，在 PowerShell 粘贴并按回车。</p>
          <p class="rng-tip">单独下载脚本后运行时，国服需指定 <code>-Client cn</code>，海外服需指定 <code>-Client os</code>。上方复制命令会自动带上所选客户端。如果运行文件时提示系统禁止运行脚本，使用上方“复制获取命令”即可。</p>
        </li>
        <li><strong>手动指定目录</strong>（自动查找失败时使用）<label class="rng-path-label" for="rng-game-path">填写以 ZenlessZoneZero_Data 结尾的游戏数据目录</label><input id="rng-game-path" type="text" autocomplete="off" spellcheck="false" placeholder="C:\\Program Files\\ZenlessZoneZero Game\\ZenlessZoneZero_Data" maxlength="1000"><pre class="link-command"><code id="rng-manual-command"></code></pre><button id="rng-copy-manual" type="button">复制手动路径命令</button></li>
        <li>终端会依次显示<strong>查找游戏目录 → 读取缓存 → 验证链接</strong>。看到<strong>链接已复制</strong>后，把剪贴板中的记录链接粘贴到下方，点击<strong>开始导入</strong>。若提示剪贴板不可用，手动复制终端中已验证的链接即可。</li>
      </ol>
      <p class="rng-tip">脚本读取游戏日志和缓存，向游戏官方接口验证链接；重复链接不反复验证，结束后会显示耗时。自动查找失败时可使用上方手动路径命令。获取链接完成后，网页仍需逐页导入抽卡记录。</p>
    </div>
    <div id="rng-panel-ios" class="rng-panel" role="tabpanel" aria-labelledby="rng-tab-ios" hidden>
      <p>使用 Stream 获取游戏发出的调频记录请求。</p>
      <ol class="link-steps"><li>按<a href="https://zzz.rng.moe/zh/tracker/import" target="_blank" rel="noreferrer">参考站 iOS 图文教程 ↗</a>完成 Stream 的 HTTPS 捕获配置。</li><li>在 Stream 开始捕获，再进入《绝区零》的<strong>调频 → 调频详情 → 调频记录</strong>，等待记录出现；返回 Stream 停止捕获。</li><li>打开 <strong>Sniff History（捕获历史）</strong>中的最新记录，选择路径包含 <code>/common/gacha_record/api/getGachaLog</code> 的请求，在 <strong>Request → Request Line</strong> 复制完整的 <code>https://…</code> 链接。</li><li>把链接粘贴到下方，点击<strong>开始导入</strong>。不用手动删除手机附加参数，也不用逐页复制；本站会自动读取六类频段。</li></ol>
      <p class="rng-tip">复制请求 URL 即可，不要复制整份请求头或响应 JSON。完成后停止捕获，并移除不再使用的临时 VPN / CA 配置。若提示链接过期，请重新打开游戏调频记录后获取新链接。</p>
    </div>
    <div id="rng-panel-android" class="rng-panel" role="tabpanel" aria-labelledby="rng-tab-android" hidden>
      <p>参考站使用 <a href="https://github.com/4o3F/Ascent/releases/latest" target="_blank" rel="noreferrer">Ascent 获取链接 ↗</a>。按该项目的说明安装，并选择《绝区零》。</p>
      <ol class="link-steps"><li>按 Ascent 指引开启开发者选项与<strong>无线调试</strong>，完成配对和连接；不支持无线调试的设备需按项目教程借助电脑。</li><li>保持 Ascent 连接，在游戏内打开<strong>调频 → 调频详情 → 调频记录</strong>，等待记录显示。</li><li>回到 Ascent 复制获取到的<strong>完整调频记录链接</strong>，粘贴到下方并点击<strong>开始导入</strong>。</li></ol>
      <p class="rng-tip">官方调频记录网页链接和记录接口链接均可导入，无需手动更换域名或删除参数。完成后关闭不再使用的无线调试；链接过期时需重新获取。</p>
    </div>
    <p class="rng-attribution">获取方式来源：<a href="https://zzz.rng.moe/zh/tracker/import" target="_blank" rel="noreferrer">rng.moe ↗</a>。原版 Windows 脚本 © 2026 rng.moe；本站优化版由DUKE修改，采用 <a href="vendor/rng-moe/LICENSE.txt" target="_blank" rel="noreferrer">Apache-2.0</a> 许可。只能读取官方仍保留的记录；新增抽取后请再次导入。</p>`;
  const $=id=>host.querySelector('#'+id);
  const options=()=>({region:$('rng-region').value});
  function updateCommands() {
    const settings=options();
    $('link-command-text').textContent=getLinkCommand(settings);
    $('rng-script-download').href='get-tuning-link-fast.ps1';
    const localPreview=['localhost','127.0.0.1'].includes(location.hostname);
    $('rng-source-hint').textContent='获取脚本从 DUKE 下载。复制命令后，在 PowerShell 粘贴并按回车。'+(localPreview?' 当前命令连接本机预览，需保持预览服务运行；给其他人使用时请从 dukezzz.com 复制命令。':'');
    try {const path=$('rng-game-path').value.trim();$('rng-manual-command').textContent=path?getLinkCommand({...settings,gamePath:path}):'先填写上方游戏数据目录，再复制生成的命令。';$('rng-copy-manual').disabled=!path;}
    catch(error){$('rng-manual-command').textContent=error.message;$('rng-copy-manual').disabled=true;}
  }
  $('rng-region').onchange=updateCommands;$('rng-game-path').oninput=updateCommands;
  async function copy(manual=false) {
    try {if(isBusy())return;const command=getLinkCommand({...options(),gamePath:manual?$('rng-game-path').value:''});await navigator.clipboard.writeText(command);const button=$(manual?'rng-copy-manual':'copy-link-script');button.textContent='已复制 ✓';setTimeout(()=>{button.textContent=manual?'复制手动路径命令':'复制获取命令';},1800);status('获取命令已复制。请在 Windows PowerShell 粘贴并按回车，完成后将记录链接粘贴到下方。','success');}
    catch{status('无法自动复制，请选中命令后手动复制。','warning');}
  }
  $('copy-link-script').onclick=()=>copy();$('rng-copy-manual').onclick=()=>copy(true);
  const tabs=[...host.querySelectorAll('[role="tab"]')];
  function selectTab(tab) {for(const candidate of tabs){const selected=candidate===tab;candidate.setAttribute('aria-selected',String(selected));candidate.tabIndex=selected?0:-1;$(candidate.getAttribute('aria-controls')).hidden=!selected;}}
  for(const tab of tabs) {tab.onclick=()=>selectTab(tab);tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=event.key==='Home'?0:event.key==='End'?tabs.length-1:(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[i]);tabs[i].focus();};}
  updateCommands();
  return {setBusy(value){for(const control of host.querySelectorAll('button,input,select'))control.disabled=value;if(!value)updateCommands();}};
}
