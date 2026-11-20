/* Presentation-only localization. IDs, source data, calculations and saved user input stay unchanged. */
(() => {
  'use strict';
  const KEY='duke-language-v1', VERSION='20261114-refresh-launch-1';
  const root=document.documentElement, HAN=/[\u3400-\u9fff]/;
  const valid=v=>v==='en'||v==='zh-CN';
  const requested=new URLSearchParams(location.search).get('lang');
  let saved;try{saved=localStorage.getItem(KEY);}catch{}
  let language=valid(requested)?requested:valid(saved)?saved:'zh-CN';
  let loaded=false,loading=null,observer=null,scheduled=false,searchReloadScheduled=false,languageRequest=0;
  const originals=new WeakMap(),attributes=new WeakMap(),pending=new Set(),missing=new Map(),contexts=new WeakSet(),literalContexts=new WeakSet();
  const messages=new Map(),patterns=[],terms=[],cache=new Map();let trie=new Map();
  const normalize=s=>String(s).replace(/\s+/g,' ').trim();
  const skip='script,style,noscript,pre,code,textarea,input,[contenteditable="true"],[data-i18n-skip],.language-switch';
  const builtin={
    '探索地图':'Explore Map','物资图鉴':'Item Atlas','调频分析':'Signal Search','代理人资料':'Agents',
    '资料图鉴':'Agent Guide','角色练度':'Showcase','驱动盘规划':'Drive Disc Planner','配队检查':'Team Check','养成计算':'Material Planner','卡池日历':'Banner Calendar','DUKE首页':'DUKE home',
    '主要导航':'Main navigation','代理人功能':'Agent tools','绝区零':'Zenless Zone Zero',
    '本地预览':'Local preview','本地预览 · 未发布':'Local preview · Not published','未发布':'Not published',
    '本地预览，尚未发布到 dukezzz.com':'Local preview; not published to dukezzz.com',
    '深色模式':'Dark mode','浅色模式':'Light mode','切换为浅色模式':'Switch to light mode','切换为深色模式':'Switch to dark mode',
    '读取中…':'Loading…','加载中…':'Loading…','关闭':'Close','关闭 ×':'Close ×','取消':'Cancel','保存':'Save',
    '无':'None','未知':'Unknown','未选择':'Not selected','全部':'All','查看来源':'View sources',
    '客户端原文':'Game text','中文原文':'Chinese original'
  };
  for(const[k,v]of Object.entries(builtin))messages.set(normalize(k),v);
  root.lang=language;root.dataset.language=language;

  function register(catalog){
    const dict=catalog.messages||catalog;
    for(const[k,v]of Object.entries(dict))if(typeof v==='string'&&HAN.test(k))messages.set(normalize(k),v);
    for(const p of catalog.patterns||[]){if(typeof p.source!=='string'||typeof p.target!=='string'||!p.source.startsWith('^')||!p.source.endsWith('$'))continue;try{patterns.push({re:new RegExp(p.source,'u'),target:p.target,specific:HAN.test(p.source)});}catch{}}
  }
  function compile(){
    terms.length=0;
    // Whole sentences use exact matches/templates. Fragments only combine already-known terms.
    for(const[k,v]of messages)if(k.length>=2&&k.length<=60&&HAN.test(k)&&!/[。！？\n]/.test(k))terms.push([k,v]);
    terms.sort((a,b)=>b[0].length-a[0].length);trie=new Map();
    for(const[k,v]of terms){let branch=trie;for(const char of k){if(!branch.has(char))branch.set(char,new Map());branch=branch.get(char);}branch.set('',v);}cache.clear();
  }
  function english(value,depth=0){
    const raw=String(value??'');if(!HAN.test(raw))return raw;
    if(cache.has(raw))return cache.get(raw);
    const key=normalize(raw),exact=messages.get(key);let result=exact;
    if(result===undefined&&depth<10){for(const p of patterns){if(!p.specific)continue;const m=p.re.exec(key);if(!m)continue;result=p.target.replace(/\$(\d+)/g,(_,n)=>english(m[Number(n)]||'',depth+1));break;}}
    // Prefer a complete official description over translating its individual lines.
    // Joined descriptions use blank lines; a skill heading uses a single newline.
    if(result===undefined&&depth<10&&/\n\s*\n/.test(raw.trim()))result=raw.trim().split(/(\n\s*\n)/).map(part=>/^\s*$/.test(part)?part:english(part,depth+1)).join('');
    if(result===undefined&&depth<10){const parts=/^([^\n]+)(\n+)([\s\S]+)$/.exec(raw.trim());if(parts)result=english(parts[1],depth+1)+parts[2]+english(parts[3],depth+1);}
    if(result===undefined&&depth<10){for(const p of patterns){if(p.specific)continue;const m=p.re.exec(key);if(!m)continue;result=p.target.replace(/\$(\d+)/g,(_,n)=>english(m[Number(n)]||'',depth+1));break;}}
    if(result===undefined){
      result=key;
      // Segment before replacing so one replacement is never translated a second time.
      const chunks=[];let at=0;
      while(at<result.length){let branch=trie,best=null;for(let end=at;end<result.length&&branch.has(result[end]);end++){branch=branch.get(result[end]);if(branch.has(''))best={end:end+1,value:branch.get('')};}if(best){chunks.push(best.value);at=best.end;}else chunks.push(result[at++]);}
      result=chunks.join('');
    }
    const lead=raw.match(/^\s*/)[0],tail=raw.match(/\s*$/)[0];result=lead+result+tail;
    if(loaded&&HAN.test(result)&&missing.size<4000)missing.set(key,result);
    if(cache.size>18000)cache.clear();cache.set(raw,result);return result;
  }
  function t(value){return language==='en'?english(value):String(value??'');}
  function isSkipped(node){const e=node.nodeType===1?node:node.parentElement;return !e||!!e.closest(node.nodeType===3?skip:'script,style,noscript,pre,code,[contenteditable="true"],[data-i18n-skip],.language-switch');}
  function textNode(node){
    if(isSkipped(node))return;
    const previous=originals.get(node),source=previous&&node.nodeValue===previous.rendered?previous.source:node.nodeValue;
    const parent=node.parentElement,override=parent?.childNodes.length===1?parent.dataset.i18nEn:undefined;
    if(!HAN.test(source)&&!previous&&!override)return;
    const rendered=language==='en'&&override?override:parent?.classList.contains('type-symbol')?canvasText(source):t(source);originals.set(node,{source,rendered});if(node.nodeValue!==rendered)node.nodeValue=rendered;
  }
  function element(node){
    if(isSkipped(node))return;
    // An option without a value attribute uses its text as its value. Freeze that value before changing its label.
    if(node.tagName==='OPTION'&&!node.hasAttribute('value'))node.setAttribute('value',node.value);
    let record=attributes.get(node);if(!record){record=new Map();attributes.set(node,record);}
    const names=['title','aria-label','placeholder','alt','data-tooltip'];
    if(node.matches('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]'))names.push('content');
    for(const name of names){
      if(!node.hasAttribute(name))continue;
      const current=node.getAttribute(name),prior=record.get(name),source=prior&&current===prior.rendered?prior.source:current;
      if(!HAN.test(source)&&!prior)continue;
      const rendered=t(source);record.set(name,{source,rendered});if(current!==rendered)node.setAttribute(name,rendered);
    }
  }
  function walk(node){
    if(node.nodeType===3){textNode(node);return;}
    if(node.nodeType!==1&&node.nodeType!==9)return;
    if(node.nodeType===1){if(isSkipped(node))return;element(node);}
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode(n){return isSkipped(n)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    while(walker.nextNode()){const n=walker.currentNode;if(n.nodeType===3)textNode(n);else element(n);}
  }
  function flush(){
    scheduled=false;if(language==='en'&&!loaded)return;
    const nodes=[...pending];pending.clear();
    for(const node of nodes){if(!node.isConnected)continue;let ancestor=node.parentNode,covered=false;while(ancestor){if(pending.has(ancestor)||nodes.includes(ancestor)){covered=true;break;}ancestor=ancestor.parentNode;}if(!covered)walk(node);}
    observer?.takeRecords();
  }
  function schedule(node){pending.add(node);if(!scheduled){scheduled=true;requestAnimationFrame(flush);}}
  function apply(){
    root.lang=language;root.dataset.language=language;
    for(const select of document.querySelectorAll('[data-language-select]')){select.value=language;select.setAttribute('aria-label',language==='en'?'Site language':'网站语言');}
    walk(document.documentElement);observer?.takeRecords();
    for(const input of document.querySelectorAll('input[data-i18n-value]'))if(document.activeElement!==input)input.value=t(input.dataset.i18nValue);
    for(const link of document.querySelectorAll('a[href]'))updateLink(link);
    for(const ctx of canvasRefresh())ctx?.();
    window.dispatchEvent(new CustomEvent('dukelanguagechange',{detail:{language}}));
  }
  function canvasRefresh(){return [()=>window.atlas?.draw?.(),()=>window.nativeMap2D?.draw?.()];}
  function announce(message,error=false){
    let node=document.getElementById('language-status');if(!node){node=document.createElement('div');node.id='language-status';node.className='language-status';node.dataset.i18nSkip='';node.setAttribute('role','status');document.body?.append(node);}
    node.textContent=message;node.hidden=!message;node.classList.toggle('is-error',error);
  }
  async function load(){
    if(loaded)return;if(loading)return loading;
    loading=(async()=>{
      const names=['map-tuning-en','tools-en','game-en'];
      const data=await Promise.all(names.map(async name=>{const r=await fetch(`locales/${name}.json?v=${name==='tools-en'?'20261120-v34-reveal-launch-1':VERSION}`,{cache:'no-cache'});if(!r.ok)throw Error('English catalog unavailable');return r.json();}));
      for(const d of data)register(d);compile();loaded=true;
      window.dispatchEvent(new Event('dukelanguageready'));
    })().finally(()=>{loading=null;});return loading;
  }
  async function setLanguage(next,{persist=true,url=true}={}){
    if(!valid(next))return false;
    const request=++languageRequest;
    try{
      if(next==='en'&&!loaded){announce('Loading English game terminology…');await load();}
      if(request!==languageRequest)return false;
      language=next;
      if(persist)try{localStorage.setItem(KEY,next);}catch{}
      if(url){const u=new URL(location.href);u.searchParams.set('lang',next);history.replaceState(history.state,'',u);}
      announce('');apply();return true;
    }catch{
      if(request!==languageRequest)return false;
      language='zh-CN';apply();announce('English text could not be loaded. Chinese is shown. Select English to retry.',true);return false;
    }
  }
  function updateLink(link){
    const href=link.getAttribute('href');if(!href||href.startsWith('#')||link.hasAttribute('download')||link.closest('[data-i18n-skip]'))return;
    const localized = language === 'en' ? link.dataset.hrefEn : link.dataset.hrefZh;
    if (localized && localized.startsWith('https://')) {
      if (href !== localized) link.href = localized;
      return;
    }
    let u;try{u=new URL(href,location.href);}catch{return;}
    if(u.origin!==location.origin||!/^\/(?:index|gallery|tuning|agents|showcase|disc-planner|tv-wall|oracle|banners|team|materials)?(?:\.html)?\/?$/.test(u.pathname))return;
    // Only concrete DOM URLs are updated; template literals in source files never pass through URL serialization.
    if(new URLSearchParams(location.search).has('lang')||language==='en'){u.searchParams.set('lang',language);const next=u.pathname+u.search+u.hash;if(next!==href)link.setAttribute('href',next);}
  }
  function normalizeSearch(v){return String(v??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[\s’'·-]+/g,'');}
  function matches(value,query){
    const q=normalizeSearch(query);if(!q)return true;
    const values=Array.isArray(value)?value:[value];
    if(!loaded&&/[a-z]/i.test(q)&&!searchReloadScheduled){searchReloadScheduled=true;load().then(()=>{if(language==='en')apply();for(const id of ['agent-search','search','native-search','item-search','record-search','collection-search','history-search','up-pair-search','catalog-search','disc-teammate-1','disc-teammate-2']){const n=document.getElementById(id);if(n?.value)n.dispatchEvent(new Event('input',{bubbles:true}));}}).catch(()=>{}).finally(()=>{searchReloadScheduled=false;});}
    return values.some(v=>normalizeSearch(v).includes(q)||(loaded&&normalizeSearch(english(v)).includes(q)));
  }
  const glyphs={'生':'S','撤':'E','电':'EL','机':'ME','装':'G','医':'+','包':'B','桶':'T','敌':'F','卡':'K','传':'P','点':'•','赭':'HS','起':'S','终':'E','门':'D','升':'L','复':'R','武':'W','怪':'F','箱':'C'};
  function canvasText(value){const s=String(value??'');if(language!=='en')return s;const badge=/^([生撤赭])\s*(\d+)$/.exec(s);return glyphs[s]||(badge?glyphs[badge[1]]+badge[2]:english(s));}
  function canvasContext(ctx){
    if(!ctx||contexts.has(ctx))return ctx;contexts.add(ctx);
    for(const name of ['fillText','strokeText','measureText']){const original=ctx[name].bind(ctx);ctx[name]=(value,...args)=>original(literalContexts.has(ctx)?value:canvasText(value),...args);}return ctx;
  }
  function canvasLiteral(ctx,render){const nested=literalContexts.has(ctx);literalContexts.add(ctx);try{return render();}finally{if(!nested)literalContexts.delete(ctx);}}
  const api={t,english,load,setLanguage,matches,canvasContext,canvasText,canvasLiteral,number:(v,options)=>Number(v).toLocaleString(language==='en'?'en-US':'zh-CN',options),get language(){return language;},get ready(){return loaded||language==='zh-CN';},getMissing:()=>[...missing].map(([source,display])=>({source,display})),clearMissing:()=>{missing.clear();cache.clear();}};
  window.DUKE_I18N=api;
  for(const name of ['alert','confirm','prompt']){const original=window[name].bind(window);window[name]=(message,...args)=>original(t(message),...args);}
  function mount(){
    const actions=document.querySelector('.site-header-actions');
    if(actions&&!actions.querySelector('[data-language-select]')){
      const wrap=document.createElement('label');wrap.className='language-switch';wrap.dataset.i18nSkip='';
      const icon=document.createElement('span');icon.textContent='◎';icon.setAttribute('aria-hidden','true');
      const select=document.createElement('select');select.dataset.languageSelect='';select.autocomplete='off';select.setAttribute('aria-label',language==='en'?'Site language':'网站语言');
      for(const[value,label]of [['zh-CN','简体中文'],['en','English']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}select.value=language;
      select.addEventListener('change',()=>setLanguage(select.value));wrap.append(icon,select);actions.prepend(wrap);
    }
    observer=new MutationObserver(records=>{for(const r of records){if(r.type==='childList')for(const n of r.addedNodes)schedule(n);else schedule(r.target);}});
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','alt','data-tooltip','content']});
    document.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(link)updateLink(link);},true);
    setLanguage(language,{persist:valid(requested),url:valid(requested)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  window.addEventListener('storage',e=>{if(e.key===KEY&&valid(e.newValue))setLanguage(e.newValue,{persist:false});});
  window.addEventListener('popstate',()=>{const l=new URLSearchParams(location.search).get('lang');if(valid(l)&&l!==language)setLanguage(l,{persist:false,url:false});});
})();
