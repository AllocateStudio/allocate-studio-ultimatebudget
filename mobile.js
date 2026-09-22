/* Phases 1–2: phone-only, reversible DOM enhancements. No budget/storage mutations. */
(() => {
 'use strict';
 const media=matchMedia('(max-width:600px)'),main=document.querySelector('#main'),editor=document.querySelector('#editor'),menu=document.querySelector('#menu-toggle'),sidebar=document.querySelector('#sidebar');
 if(!main||!editor||!menu||!sidebar)return;
 let lifecycle=null,frame=0,backdrop=null,drawerWasOpen=false;
 const changedAttributes=new Map();
 function rememberAttribute(el,name,value){
  let attributes=changedAttributes.get(el);if(!attributes){attributes=new Map();changedAttributes.set(el,attributes);}
  if(!attributes.has(name))attributes.set(name,el.getAttribute(name));
  if(el.getAttribute(name)!==value)el.setAttribute(name,value);
 }
 function formEnhancements(root){
  root.querySelectorAll('input[type="number"]').forEach(input=>{
   // Decimal keyboard for amounts and fractional rates, not integer counters.
   if(input.step!=='1')rememberAttribute(input,'inputmode','decimal');
  });
  root.querySelectorAll('input[type="checkbox"],input[type="radio"]').forEach(input=>{
   if(input.closest('label'))return;
   const label=document.createElement('label');label.className='mobile-tap-label';
   label.setAttribute('aria-label',input.getAttribute('aria-label')||(input.type==='checkbox'?'Paid':'Select'));
   input.before(label);label.append(input);
  });
 }
 function fitMetrics(){
  main.querySelectorAll('.metric').forEach(card=>{
   card.classList.remove('mobile-metric-wide');
   const value=card.querySelector('.metric-value');if(!value)return;
   if(value.scrollWidth>value.clientWidth+1)card.classList.add('mobile-metric-wide');
  });
 }
 function mark(el,name){if(!el.classList.contains(name))rememberAttribute(el,'class',((el.getAttribute('class')||'')+' '+name).trim());}
 function enhanceTables(){
  const route=location.hash.slice(1)||'annual';
  const stacked=['recurring','variable','payments','accounts','debt'].includes(route);
  main.querySelectorAll('.table-wrap').forEach(wrap=>{
   const table=wrap.querySelector('table');if(!table)return;
   const headers=[...(table.tHead?.rows[0]?.cells||[])].map(th=>th.textContent.trim());
   if(stacked){
    mark(table,'mobile-record-table');rememberAttribute(table,'role','table');
    table.querySelectorAll('tr').forEach(tr=>rememberAttribute(tr,'role','row'));
    table.querySelectorAll('thead th').forEach(th=>rememberAttribute(th,'role','columnheader'));
    table.querySelectorAll('tbody tr,tfoot tr').forEach(tr=>{
     let column=0;
     [...tr.cells].forEach(td=>{
      const text=headers[column]||'';column+=td.colSpan||1;
      rememberAttribute(td,'data-label',text);rememberAttribute(td,'role','cell');
      if(td.colSpan>1)mark(td,'mobile-full-cell');
      if(td.querySelector('button[data-action]')&&!text)mark(td,'mobile-row-actions');
     });
    });
   }else{
    mark(wrap,'mobile-analytic-scroll');
    rememberAttribute(wrap,'tabindex','0');rememberAttribute(wrap,'role','region');
    if(!wrap.hasAttribute('aria-label'))rememberAttribute(wrap,'aria-label',(wrap.closest('.panel')?.querySelector('.section-title')?.textContent.trim()||'Budget table')+' — scroll horizontally');
   }
  });
  if(route==='setup')main.querySelectorAll('.settings-category-row').forEach(row=>mark(row,'mobile-setting-card'));
 }
 function enhanceCalendar(){
  const grid=main.querySelector('.calendar-grid');if(!grid)return;
  mark(grid,'mobile-agenda');
  let count=0;
  grid.querySelectorAll('.calendar-day').forEach(day=>{
   const hasEvents=!!day.querySelector('.event,.payday-date');
   if(!hasEvents){mark(day,'mobile-empty-day');return;}
   count++;
   const header=day.querySelector('.calendar-date-header');
   if(!header||header.querySelector('.mobile-agenda-date'))return;
   const dayNumber=Number(header.querySelector('.day-number')?.textContent);
   const month=currentMonth(),date=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5))-1,dayNumber));
   const text=document.createElement('span');text.className='mobile-agenda-date';
   text.textContent=new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date);
   header.prepend(text);
  });
  if(!count&&!grid.querySelector('.mobile-agenda-empty')){
   const empty=document.createElement('p');empty.className='mobile-agenda-empty';empty.textContent='No scheduled payments this month.';grid.append(empty);
  }
 }

 function enhance(){
  frame=0;if(!media.matches)return;
  // Drop references to controls removed by the app's render, even on long sessions.
  for(const el of changedAttributes.keys())if(!el.isConnected)changedAttributes.delete(el);
  formEnhancements(main);formEnhancements(editor);enhanceTables();enhanceCalendar();fitMetrics();
 }
 function schedule(){if(media.matches&&!frame)frame=requestAnimationFrame(enhance);}
 function syncDrawer(){
  const open=media.matches&&document.body.classList.contains('menu-open');
  rememberAttribute(menu,'aria-expanded',String(open));
  if(open===drawerWasOpen)return;
  drawerWasOpen=open;
  document.body.classList.toggle('mobile-drawer-open',open);
  if(open){
   backdrop=document.createElement('button');backdrop.className='mobile-drawer-backdrop';backdrop.type='button';backdrop.tabIndex=-1;backdrop.setAttribute('aria-label','Close navigation');
   backdrop.addEventListener('click',closeDrawer);document.body.append(backdrop);
   sidebar.querySelector('[aria-current="page"],button,a')?.focus();
  }else{backdrop?.remove();backdrop=null;}
 }
 function closeDrawer(){document.body.classList.remove('menu-open');syncDrawer();menu.focus();}
 function drawerKeys(event){
  if(!drawerWasOpen||editor.open||document.querySelector('.mp-dialog[open]'))return;
  if(event.key==='Escape'){event.preventDefault();closeDrawer();return;}
  if(event.key!=='Tab')return;
  const items=[...sidebar.querySelectorAll('button:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);
  if(!items.length)return;
  const index=items.indexOf(document.activeElement);
  if(event.shiftKey?index<=0:index===items.length-1||index<0){event.preventDefault();items[event.shiftKey?items.length-1:0].focus();}
 }
 function redraw(){if(!media.matches)return;fitBudgetCharts();schedule();}
 function start(){
  if(lifecycle)return;
  const abort=new AbortController(),on=(target,type,fn)=>target.addEventListener(type,fn,{signal:abort.signal});
  const mainObserver=new MutationObserver(()=>{schedule();});mainObserver.observe(main,{childList:true});
  const editorObserver=new MutationObserver(schedule);editorObserver.observe(editor,{childList:true,subtree:true});
  const bodyObserver=new MutationObserver(syncDrawer);bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  lifecycle={abort,observers:[mainObserver,editorObserver,bodyObserver]};
  on(document,'keydown',drawerKeys);on(window,'resize',redraw);
  // Keep a focused form field visible when the phone keyboard resizes its viewport.
  if(window.visualViewport)on(window.visualViewport,'resize',()=>{if(editor.open&&editor.contains(document.activeElement))document.activeElement.scrollIntoView({block:'nearest'});});
  on(window,'hashchange',()=>{document.body.classList.remove('menu-open');syncDrawer();});
  document.fonts?.ready.then(()=>{if(lifecycle&&media.matches)redraw();});
  syncDrawer();redraw();
 }
 function stop(){
  if(!lifecycle)return;
  lifecycle.abort.abort();lifecycle.observers.forEach(o=>o.disconnect());lifecycle=null;
  cancelAnimationFrame(frame);frame=0;
  backdrop?.remove();backdrop=null;
  if(drawerWasOpen)document.body.classList.remove('menu-open');
  drawerWasOpen=false;document.body.classList.remove('mobile-drawer-open');
  document.querySelectorAll('.mobile-tap-label').forEach(label=>label.replaceWith(...label.childNodes));
  main.querySelectorAll('.mobile-agenda-date,.mobile-agenda-empty').forEach(el=>el.remove());
  main.querySelectorAll('.mobile-metric-wide').forEach(el=>el.classList.remove('mobile-metric-wide'));
  for(const [el,attrs] of changedAttributes)for(const [name,value] of attrs){if(value===null)el.removeAttribute(name);else el.setAttribute(name,value);}
  changedAttributes.clear();
 }
 media.addEventListener('change',()=>{if(media.matches)start();else{stop();fitBudgetCharts();}});
 if(media.matches)start();
})();
