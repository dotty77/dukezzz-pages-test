// Presentation-only layout. Account records and budget drafts stay in their
// existing modules; switching tasks never remounts or clears them.
export function mountTuningWorkspace(){
 const $=id=>document.getElementById(id);
 const make=(tag,cls,zh,en)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(zh)n.textContent=zh;if(en)n.dataset.i18nEn=en;return n;};
 const switcher=make('div','tuning-task-switch');switcher.setAttribute('role','tablist');switcher.setAttribute('aria-label','调频分析');
 const records=make('section','tuning-task-view'),budget=make('section','tuning-task-view');
 records.id='tuning-records-view';budget.id='tuning-budget-view';
 const views={records,budget},buttons={};let selected='records';
 for(const [key,zh,en] of [['records','记录分析','Record analysis'],['budget','抽卡预算','Pull budget']]){
  const b=make('button','tuning-task-tab',zh,en);b.type='button';b.id='tuning-task-'+key;b.dataset.tuningView=key;b.setAttribute('role','tab');b.setAttribute('aria-controls',views[key].id);buttons[key]=b;switcher.append(b);
  views[key].setAttribute('role','tabpanel');views[key].setAttribute('aria-labelledby',b.id);
 }
 document.querySelector('.tuning-intro').after(switcher);
 $('guarantee-hub').before(records);records.after(budget);
 records.append($('empty-state'),$('guarantee-hub'),$('dashboard'));
 budget.append($('personal-budget'),$('target-expectation'));

 // Keep optional material out of the main reading path.
 const guide=make('details','tuning-fold guarantee-help');guide.id='guarantee-help';
 guide.append(make('summary','','保底规则与判断说明','Pity rules and how we assess them'));
 const special=$('guarantee-hub').querySelector(':scope > .guarantee-guide');
 guide.append($('guarantee-explanation'),document.querySelector('.guarantee-hub-note'),special);
 const scope=make('p','tuning-scope-note','依据已导入记录；记录缺失或后续抽卡会影响判断。','Based on imported records. Missing or subsequent pulls can change the result.');
 $('guarantee-hub').append(scope,guide);
 const history=document.querySelector('.history-panel'),historyFold=make('details','tuning-fold panel history-fold');
 historyFold.id='tuning-history-fold';history.before(historyFold);historyFold.append(make('summary','','全部调频记录','All Signal Search records'),history);history.classList.remove('panel');
 const overview=make('details','tuning-fold panel tuning-optional');overview.id='tuning-overview-fold';
 overview.append(make('summary','','账号总览','Account overview'),$('tuning-overview'));
 const rating=make('details','tuning-fold panel tuning-optional'),luckPanel=$('luck-panel');rating.id='tuning-rating-fold';
 luckPanel.classList.remove('panel');rating.append(make('summary','','娱乐评级与统计依据','For-fun rating and methodology'),luckPanel);
 $('dashboard').append(overview,rating);
 const settings=make('details','export-menu tuning-account-settings');settings.append(make('summary','','账号设置','Account settings'));
 const settingsItems=make('div','export-options');settingsItems.append($('timezone-open'),$('clear-account'));settings.append(settingsItems);document.querySelector('.account-actions').append(settings);
 const migration=$('rng-import-open');if(migration)document.querySelector('#import-guide .guide-content > div').append(migration);
 const budgetShortcut=make('button','text-button tuning-budget-shortcut','不导入记录，也能算预算 →','Plan a budget without importing records →');budgetShortcut.type='button';budgetShortcut.dataset.tuningView='budget';$('empty-state').append(budgetShortcut);

 function select(key,{focus=false}={}){
  selected=key==='budget'?'budget':'records';
  for(const name of Object.keys(views)){const on=name===selected;views[name].hidden=!on;buttons[name].setAttribute('aria-selected',String(on));buttons[name].tabIndex=on?0:-1;}
  if(focus)buttons[selected].focus({preventScroll:true});
 }
 function reveal(id){
  const target=$(id);if(!target)return;
  select(budget.contains(target)?'budget':'records');
  for(let n=target;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;
  requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 }
 document.querySelector('.tuning-main').addEventListener('click',event=>{
  const task=event.target.closest('[data-tuning-view]');if(task){select(task.dataset.tuningView);return;}
  const link=event.target.closest('a[href^="#"]');if(!link)return;
  const id=link.getAttribute('href').slice(1);
  if(!['guarantee-hub','target-expectation','import-guide','personal-budget'].includes(id))return;
  event.preventDefault();reveal(id);
 });
 switcher.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();select(event.key==='Home'?'records':event.key==='End'?'budget':selected==='records'?'budget':'records',{focus:true});
 });
 $('demo-open').addEventListener('click',()=>select('records'));
 const initial=()=>{const id=location.hash.slice(1);if(['guarantee-hub','target-expectation','import-guide','personal-budget'].includes(id))reveal(id);};
 addEventListener('hashchange',initial);
 select('records');
 const api={select,reveal,applyLocation(){select(new URL(location.href).searchParams.get('tool')==='budget'?'budget':'records');initial();},getState:()=>({view:selected}),sync({account,pairs=false}){$('guarantee-hub').hidden=!account;overview.hidden=!account;rating.hidden=!account||pairs;}};
 window.tuningWorkspace=api;return api;
}
