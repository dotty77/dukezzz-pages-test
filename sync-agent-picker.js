// A roster-only combobox. Typing never imports equipment or adds an arbitrary ID.
export function createAgentPicker({id,getAgentName=()=>'',onChange=()=>{}}){
  const node=(tag,cls='')=>{const element=document.createElement(tag);element.className=cls;return element;};
  const element=node('div','disc-combo disc-field'),input=node('input'),toggle=node('button','disc-combo-toggle'),list=node('div','disc-combo-list');
  let agents=[],selected='',query='',editing=false,opened=false,disabled=true,active=-1,matches=[],options=[],disposed=false;
  element.dataset.agentPicker='';input.id=id;input.type='text';input.autocomplete='off';input.spellcheck=false;input.dataset.i18nSkip='';
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',`${id}-listbox`);
  toggle.type='button';toggle.textContent='⌄';toggle.tabIndex=-1;toggle.dataset.i18nSkip='';
  list.id=`${id}-listbox`;list.setAttribute('role','listbox');list.dataset.i18nSkip='';list.hidden=true;element.append(input,toggle,list);
  const english=()=>window.DUKE_I18N?.language==='en';
  const translate=value=>english()&&window.DUKE_I18N?.english?window.DUKE_I18N.english(value):value;
  const normalize=value=>String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[\s’'·-]+/g,'');
  function names(agent){
    const clean=value=>{const name=String(value||'').trim();return /^\d+$/.test(name)?'':name;};
    return {local:clean(getAgentName(String(agent.id))),source:clean(agent.name)};
  }
  function display(agent){
    const {local,source}=names(agent);
    return local?translate(local):source?`${translate(source)} (${agent.id})`:english()?`Unlisted agent (${agent.id})`:`未收录角色（${agent.id}）`;
  }
  function highlight(index,scroll=false){
    active=index;options.forEach((option,i)=>{option.classList.toggle('is-active',i===active);option.setAttribute('aria-selected',String(i===active));});
    if(options[active]){input.setAttribute('aria-activedescendant',options[active].id);if(scroll)options[active].scrollIntoView({block:'nearest'});}
    else input.removeAttribute('aria-activedescendant');
  }
  function close(){opened=false;list.hidden=true;input.setAttribute('aria-expanded','false');highlight(-1);}
  function render(){
    const term=editing?query:'';
    matches=agents.filter(agent=>{const name=names(agent),values=[name.local,name.source,String(agent.id)];return !term||(window.DUKE_I18N?.matches?window.DUKE_I18N.matches(values,term):values.some(value=>normalize(value).includes(normalize(term))));});
    list.replaceChildren();options=[];
    for(const [index,agent] of matches.entries()){
      const option=node('div','disc-combo-option');option.id=`${id}-option-${agent.id}`;option.setAttribute('role','option');option.dataset.agentId=String(agent.id);option.textContent=display(agent);option.classList.toggle('is-selected',String(agent.id)===selected);
      option.onmousedown=event=>event.preventDefault();option.onclick=()=>choose(String(agent.id));option.onpointermove=event=>{if(event.pointerType==='mouse')highlight(index);};list.append(option);options.push(option);
    }
    if(!matches.length){const empty=node('div','disc-combo-empty');empty.setAttribute('role','status');empty.textContent=english()?'No matching agents':'没有找到匹配的代理人';list.append(empty);}
    highlight(editing&&matches.length?0:matches.findIndex(agent=>String(agent.id)===selected));
  }
  function open(){if(disabled||disposed)return;opened=true;render();list.hidden=false;input.setAttribute('aria-expanded','true');}
  function setValue(value){
    const agent=agents.find(agent=>String(agent.id)===String(value));selected=agent?String(agent.id):'';query='';editing=false;input.value=agent?display(agent):'';close();
  }
  function choose(value){
    if(disabled||!agents.some(agent=>String(agent.id)===value))return;
    setValue(value);onChange(value);
  }
  input.onfocus=()=>{open();if(selected)input.select();};
  input.onclick=()=>{if(!opened)open();};
  input.oninput=()=>{
    if(disabled)return;
    query=input.value;editing=true;const hadSelection=Boolean(selected);selected='';if(hadSelection)onChange('');open();
  };
  input.onkeydown=event=>{
    if(disabled||event.isComposing||event.keyCode===229)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key==='Tab'){close();return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();if(!opened){open();if(active<0&&matches.length)highlight(event.key==='ArrowDown'?0:matches.length-1,true);return;}
      if(matches.length)highlight(active<0?(event.key==='ArrowDown'?0:matches.length-1):(active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length,true);return;
    }
    if(event.key==='Enter'&&opened){event.preventDefault();if(active>=0&&matches[active])choose(String(matches[active].id));}
  };
  toggle.onmousedown=event=>event.preventDefault();toggle.onclick=()=>{if(disabled)return;if(opened)close();else{input.focus();open();}};
  function language(){
    const hint=english()?'Select or search agents':'选择或搜索角色';input.placeholder=hint;input.setAttribute('aria-label',hint);toggle.setAttribute('aria-label',english()?'Show agent choices':'展开角色候选');list.setAttribute('aria-label',english()?'Agent choices':'角色候选');
    if(selected&&!editing){const agent=agents.find(agent=>String(agent.id)===selected);input.value=agent?display(agent):'';}
    if(opened)render();
  }
  const outside=event=>{if(!element.contains(event.target))close();};
  const blur=event=>{if(!element.contains(event.relatedTarget))close();};
  document.addEventListener('pointerdown',outside);element.addEventListener('focusout',blur);window.addEventListener('dukelanguagechange',language);window.addEventListener('dukelanguageready',language);
  language();input.disabled=true;toggle.disabled=true;
  return {element,input,getValue:()=>selected,
    setAgents(value){const seen=new Set();agents=(Array.isArray(value)?value:[]).filter(agent=>{const key=String(agent?.id||'');if(!/^\d+$/.test(key)||Number(key)<=0||seen.has(key))return false;seen.add(key);return true;});setValue('');},
    setValue,
    setDisabled(value){disabled=Boolean(value);input.disabled=disabled;toggle.disabled=disabled;if(disabled)close();},
    destroy(){disposed=true;close();document.removeEventListener('pointerdown',outside);element.removeEventListener('focusout',blur);window.removeEventListener('dukelanguagechange',language);window.removeEventListener('dukelanguageready',language);}
  };
}
