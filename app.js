/* STATE MANAGEMENT · LOCAL STORAGE */
'use strict';
const E=window.BudgetEngine, STORAGE_KEY='allocate-studio-budget-v1';
let settingsJumpTarget=null;
let storageLoadFailed=false,lastStoredBudget=null;
let storageIssue='',state=loadState(),route='annual',filter={search:'',type:'All',status:'All',account:'All',person:'All',month:'All',page:0},categoryTab='Income',dialogSave=null;
const $=s=>document.querySelector(s),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadState(){try{const saved=localStorage.getItem(STORAGE_KEY);lastStoredBudget=saved;if(saved){const s=JSON.parse(saved);validateState(s);return s;}}catch(e){storageLoadFailed=true;storageIssue='Saved data could not be loaded. Export or repair your saved file before replacing it.';}return structuredClone(window.BUDGET_DEMO);}
function updateSaveStatus(){const el=$('#save-state');if(!el)return;const paused=storageLoadFailed||!!storageIssue;el.textContent=paused?'Saving paused':lastStoredBudget?'Saved on this device':'Local workspace';el.title=paused?storageIssue:'Budget data stays in this browser';el.dataset.status=paused?'paused':'ready';}
function recoveryDateLabel(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))return 'Unknown date';return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short'}).format(d);}
function saveState(){if(storageLoadFailed){storageIssue='Saved data could not be loaded. Restore a valid backup or explicitly reset the budget before saving. Your original saved data has been kept.';updateSaveStatus();return false;}try{if(localStorage.getItem(STORAGE_KEY)!==lastStoredBudget){storageIssue='Another tab changed this budget. Saving is paused to protect those changes. Download this tab as a backup before reloading.';updateSaveStatus();return false;}const serialized=JSON.stringify(state);localStorage.setItem(STORAGE_KEY,serialized);lastStoredBudget=serialized;storageIssue='';updateSaveStatus();return true;}catch(e){storageIssue='Your browser could not save changes. Export your data to keep a copy.';toast(storageIssue);updateSaveStatus();return false;}}
function commit(message='Changes saved'){const saved=saveState();render();toast(saved?message:storageIssue);}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4500);}
function validateState(s){if(!s||s.schemaVersion!==1||!s.settings||!Array.isArray(s.recurringRules)||!Array.isArray(s.variableTransactions)||!Array.isArray(s.categories)||!s.paymentOverrides||!s.netWorth||!s.debtPlan)throw Error('This is not an AllocateStudio budget export.');}
// Keep recoverable copies before deliberate replacement, independently of the live budget.
const RECOVERY_KEY=STORAGE_KEY+'-recovery-v1';
function recoveryCopies(){const raw=localStorage.getItem(RECOVERY_KEY);if(!raw)return [];const copies=JSON.parse(raw);if(!Array.isArray(copies))throw Error('Recovery history could not be read.');return copies;}
function protectBudget(reason){
 if(localStorage.getItem(STORAGE_KEY)!==lastStoredBudget)throw Error('Another tab changed this budget. Download this tab as a backup and reload before replacing data.');
 const copies=recoveryCopies(),date=new Date().toISOString();
 if(storageLoadFailed&&lastStoredBudget)copies.push({date,reason:'Original unreadable saved data',data:lastStoredBudget});
 copies.push({date,reason,data:JSON.stringify(state)});
 try{localStorage.setItem(RECOVERY_KEY,JSON.stringify(copies.slice(-10)));}catch(e){throw Error('Could not create a safety copy. No budget data was replaced. Download a backup and free browser storage first.');}
}
function downloadRecovery(index){const copy=recoveryCopies()[Number(index)];if(!copy)throw Error('Recovery copy not found.');download(copy.data,'AllocateStudio-recovery-'+copy.date.replace(/[:.]/g,'-')+'.json','application/json');}
function exportData(){const d=new Date(),pad=n=>String(n).padStart(2,'0'),stamp=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;download(JSON.stringify(state,null,2),`AllocateStudio-budget-${stamp}.json`,'application/json');}
function download(content,name,type){const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
/* UTILITIES */
const colors={Income:'#44766F',Bills:'#819db7',Expenses:'#978ba8',Debt:'#9e7574',Savings:'#759d96'};
const categoryTones={Income:'income',Bills:'steel',Expenses:'plum',Debt:'terra',Savings:'teal'};
// Google Sheets «Палитра», A2:E2.
const typeBadgeColors={Income:'#548881',Bills:'#7A9EBA',Expenses:'#9A8AAA',Debt:'#A57373',Savings:'#6A9E96'};
const multipleParticipants=(s=state)=>s.settings.participantMode?s.settings.participantMode==='multiple':s.people.length>1;
const primaryParticipant=()=>state.people.find(p=>p.id===state.settings.primaryPersonId)?.id||state.people[0]?.id||null;
const money=(n,_digits=2)=>{const digits=2;if(n===null||n===undefined)return '—';const amount=Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}),symbol=esc(state.settings.currencySymbol);return `${n<0?'−':''}${state.settings.currencyPosition==='after'?amount+' '+symbol:symbol+amount}`;};
const percent=n=>n===null||n===undefined?'—':(n*100).toFixed(1)+'%';
const shortMonth=m=>new Date(m+'-01T12:00:00Z').toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
const longMonth=m=>new Date(m+'-01T12:00:00Z').toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
const niceDate=d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'—';
const catName=id=>state.categories.find(c=>c.id===id)?.name||'Uncategorized';
const accountName=id=>state.accounts.find(c=>c.id===id)?.name||'—';
const personName=id=>state.people.find(c=>c.id===id)?.name||'—';
const currentMonth=()=>E.months(state)[state.viewPreferences.monthIndex||0];
const button=(label,action,id='',cls='')=>`<button type="button" class="button ${cls}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
const empty=(title,message)=>`<div class="empty"><h3>${title}</h3><p>${message}</p></div>`;
const options=(list,value,emptyLabel)=>`${emptyLabel?`<option value="">${esc(emptyLabel)}</option>`:''}${list.map(x=>{const v=typeof x==='object'?x.id:x,label=typeof x==='object'?x.name:x;return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`;}).join('')}`;
function availableBudgetMonths(s=state){
 const months=new Set();
 const add=value=>{if(typeof value==='string'&&/^(19|20|21)\d{2}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(value))months.add(value.slice(0,7));};
 s.variableTransactions.forEach(t=>add(t.date));
 Object.entries(s.paymentOverrides).forEach(([id,o])=>add(o.date||o.snapshot?.date||id.slice(-10)));
 s.monthlyBudgets.forEach(p=>{if(p.created||Object.keys(p.categoryPlans||{}).length||p.includeOpeningBalance||p.plannedOpeningBalance||p.actualOpeningBalance)add(p.month);});
 s.netWorth.items.forEach(item=>Object.entries(item.balances||{}).forEach(([month,value])=>{if(value!==null&&value!==undefined&&value!=='')add(month);}));
 for(const year of availableReportYears(s))for(const t of E.generateRecurringTransactions(s,`${year}-01-01`,`${year}-12-31`))add(t.date);
 return [...months].sort();
}
function monthSelector(){
 return renderMonthPicker({value:currentMonth(),min:'1900-01',max:'2199-12',id:'month-selector',availableMonths:route==='monthly'?availableBudgetMonths():undefined,addMonth:route==='monthly'});
}
let budgetWasEmpty=null;
function ensureReportYear(){
 state.viewPreferences ||= {};
 const first=E.firstTransactionDate(state);
 if((budgetWasEmpty===true&&first)||!Number.isInteger(state.viewPreferences.reportYear)||state.viewPreferences.reportYear<1900||state.viewPreferences.reportYear>2199){
  const date=first||E.today();
  state.viewPreferences.reportYear=Number(date.slice(0,4));
  state.viewPreferences.monthIndex=Number(date.slice(5,7))-1;
 }
 budgetWasEmpty=!first;
}
function availableReportYears(s=state){
 const years=new Set((Array.isArray(s.viewPreferences?.openedReportYears)?s.viewPreferences.openedReportYears:[]).filter(y=>Number.isInteger(y)&&y>=1900&&y<=2199));
 const add=date=>{if(typeof date==='string'&&/^\d{4}-\d{2}(?:-\d{2})?$/.test(date)){const year=Number(date.slice(0,4));if(year>=1900&&year<=2199)years.add(year);}};
 s.variableTransactions.forEach(t=>add(t.date));
 s.recurringRules.forEach(r=>{add(r.firstDate);add(r.lastDate);});
 Object.entries(s.paymentOverrides).forEach(([id,o])=>add(o.date||o.snapshot?.date||id.slice(-10)));
 s.monthlyBudgets.forEach(p=>{if(p.created||Object.keys(p.categoryPlans||{}).length||p.includeOpeningBalance||p.plannedOpeningBalance||p.actualOpeningBalance)add(p.month);});
 s.netWorth.items.forEach(item=>Object.entries(item.balances||{}).forEach(([month,value])=>{if(value!==null&&value!==undefined&&value!=='')add(month);}));
 return [...years].sort((a,b)=>a-b);
}
function yearSelector(){
 const year=state.viewPreferences.reportYear,years=availableReportYears(),canOpen=route==='payments'&&Math.max(year,...years)<2199;
 return `<div class="year-picker"><select id="report-year" aria-label="Report year" ${years.length||canOpen?'':'disabled'}>${!years.includes(year)?'<option value="" selected disabled>'+(years.length?'Choose year':'No data')+'</option>':''}${years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}${canOpen?'<option value="next-year">+ Open next year</option>':''}</select></div>`;
}
function openNextPaymentYear(){
 const year=Math.max(state.viewPreferences.reportYear,...availableReportYears())+1;
 if(year>2199)return;
 const saved=Array.isArray(state.viewPreferences.openedReportYears)?state.viewPreferences.openedReportYears:[];
 state.viewPreferences.openedReportYears=[...new Set([...saved,year])];
 selectReportYear(year);
}
function selectReportYear(value){
 const year=Number(value);if(!Number.isInteger(year)||year<1900||year>2199)return;
 state.viewPreferences.reportYear=year;filter.month='All';filter.page=0;saveState();render();
}
function heading(eyebrow,title,description='',actions=''){return `<div class="page-heading"><div><h1>${title}</h1>${description?`<p>${description}</p>`:''}</div><div class="heading-actions">${button('How to use','page-guide',route)}${['annual','nospend','networth','payments','variable'].includes(route)?yearSelector():''}${actions}</div></div>`;}
function metric(label,value,tone,note=''){return `<div class="metric" style="--tone:${tone}"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></div>`;}
function panel(title,body,extra='',cls=''){
 if(title==='Account balances')cls+=' accounts-balance-panel';
 if(['Budget preferences','Participants','Accounts'].includes(title))cls+=' settings-colored-panel item-'+(title==='Accounts'?'steel':'plum');
 const table=body.includes('<table'),tone=cls.match(/item-(teal|steel|plum|terra|olive|income)/)?.[1]||title.match(/data-tone="(teal|steel|plum|terra|olive|income)"/)?.[1]||categoryTones[title]||(title==='Categories'?categoryTones[categoryTab]:null)||({Assets:'teal','Net worth':'steel',Liabilities:'terra',Needs:'steel',Wants:'plum','Savings & Debt':'teal','Debt & Savings':'teal','Monthly repayment schedule':'steel'})[title]||'plum';
 return `<section class="panel ${cls} ${table?'table-panel':''} ${body.includes('cartesian-chart')||body.includes('donut-wrap')?'chart-panel':''}" data-tone="${tone}"><div class="panel-head"><h2 class="section-title">${title}</h2>${extra}</div>${body}</section>`;
}
/* CHARTS — responsive SVG with accessible labels and native data tooltips. */
function chartAxisLabels(labels,positions,y,left,right,maxTicks=Infinity){
 if(!labels.length)return '';
 const width=text=>String(text).length*8.5;
 const layout=i=>{const size=width(labels[i]),x=Math.max(left+size/2,Math.min(right-size/2,positions[i]));return {i,x,size};};
 let ticks=[];
 for(let count=Math.min(labels.length,maxTicks);count>=1;count--){
  ticks=Array.from({length:count},(_,j)=>layout(count===1?0:Math.round(j*(labels.length-1)/(count-1))));
  if(ticks.every((t,j)=>!j||t.x-t.size/2>=ticks[j-1].x+ticks[j-1].size/2+12))break;
 }
 return ticks.map(t=>`<text class="axis-label" x="${t.x}" y="${y}" text-anchor="middle">${esc(labels[t.i])}</text>`).join('');
}
function lineChart(labels,series,{height=165,area=false,width=360,annual=false,debtTimeline=false}={}){
 const w=width,h=height,left=debtTimeline?60:annual?48:43,right=debtTimeline?24:annual?18:12,top=debtTimeline?20:annual?16:13,bottom=debtTimeline?40:annual?36:31,pw=w-left-right,ph=h-top-bottom,all=series.flatMap(s=>s.values),min=Math.min(0,...all),max=Math.max(1,...all),span=max-min;
 const x=i=>left+(annual?pw*(i+.5)/Math.max(1,labels.length):labels.length<=1?pw/2:i*pw/(labels.length-1)),y=v=>top+(max-v)/span*ph;
 let html=`<svg class="chart cartesian-chart" data-chart="${esc(JSON.stringify({kind:'line',labels,series,options:{area,annual,debtTimeline}}))}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(series.map(s=>s.name).join(' and '))} over time">`;
 for(let i=0;i<4;i++){const v=min+span*i/3,yy=y(v);html+=`<line class="grid" x1="${left}" y1="${yy}" x2="${w-right}" y2="${yy}"/><text x="${left-7}" y="${yy+3}" text-anchor="end">${Math.abs(v)>=1000?(v/1000).toFixed(1)+'k':Math.round(v)}</text>`;}
 html+=chartAxisLabels(labels,labels.map((_,i)=>x(i)),h-10,left,w-right,debtTimeline?6:labels.length>12?7:Infinity);
 for(const s of series){const points=s.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');if(area)html+=`<polygon points="${x(0)},${y(0)} ${points} ${x(labels.length-1)},${y(0)}" fill="${s.color}" opacity=".14"/>`;html+=`<polyline class="volume-line" points="${points}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;s.values.forEach((v,i)=>{html+=`<circle class="point" cx="${x(i)}" cy="${y(v)}" r="2.5" fill="${s.color}"><title>${esc(labels[i])} · ${esc(s.name)}: ${money(v)}</title></circle>`;});}return html+'</svg>';
}
let chartVolumeId=0;
function barChart(labels,series,{height=175,width=420,annual=false}={}){
 const w=width,h=height,left=annual?48:40,top=annual?16:14,bottom=annual?36:33,pw=w-left-(annual?18:12),ph=h-top-bottom,values=series.flatMap(s=>s.values),min=Math.min(0,...values),max=Math.max(1,...values),span=max-min,y=v=>top+(max-v)/span*ph,group=pw/Math.max(labels.length,1),bw=Math.min(28,group*.65/series.length);
 let html=`<svg class="chart cartesian-chart" data-chart="${esc(JSON.stringify({kind:'bar',labels,series,options:{annual}}))}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(series.map(s=>s.name).join(' versus '))}">`;
 const volumeId='bar-volume-'+(++chartVolumeId);
 html+=`<defs>${series.map((s,j)=>`<linearGradient id="${volumeId}-${j}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="color-mix(in srgb, ${s.color} 94%, white)"/><stop offset="1" stop-color="${s.color}"/></linearGradient>`).join('')}</defs>`;
 for(let i=0;i<4;i++){const v=min+span*i/3;html+=`<line class="grid" x1="${left}" y1="${y(v)}" x2="${w-(annual?18:10)}" y2="${y(v)}"/><text x="${left-6}" y="${y(v)+3}" text-anchor="end">${Math.abs(v)>=1000?(v/1000).toFixed(1)+'k':Math.round(v)}</text>`;}
 html+=chartAxisLabels(labels,labels.map((_,i)=>left+group*(i+.5)),h-10,left,w-(annual?18:12));
 labels.forEach((l,i)=>{const center=left+group*(i+.5);series.forEach((s,j)=>{const v=s.values[i]||0,x=center-bw*series.length/2+j*bw;html+=`<rect class="volume-bar" x="${x}" y="${Math.min(y(v),y(0))}" width="${Math.max(1,bw-2)}" height="${Math.max(.5,Math.abs(y(v)-y(0)))}" rx="2" fill="url(#${volumeId}-${j})"><title>${esc(l)} · ${esc(s.name)}: ${money(v)}</title></rect>`;});});return html+'</svg>';
}
let chartResizeObserver;
function fitBudgetCharts(){
 if(typeof ResizeObserver==='undefined')return;
 chartResizeObserver?.disconnect();
 const redraw=svg=>{
  const {width,height}=svg.getBoundingClientRect();
  if(width<1||height<1)return;
  // Bounds include CSS zoom; SVG viewBox uses unscaled layout coordinates.
  const zoom=typeof getComputedStyle==='function'?(parseFloat(getComputedStyle($('#main')).zoom)||1):1;
  const w=Math.round(width/zoom),h=Math.round(height/zoom);
  if(svg.dataset.chartSize===`${w}x${h}`)return;
  const spec=JSON.parse(svg.dataset.chart);
  const markup=(spec.kind==='line'?lineChart:barChart)(spec.labels,spec.series,{...spec.options,width:w,height:h});
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  svg.innerHTML=markup.slice(markup.indexOf('>')+1,markup.lastIndexOf('</svg>'));
  svg.dataset.chartSize=`${w}x${h}`;
 };
 chartResizeObserver=new ResizeObserver(entries=>entries.forEach(entry=>redraw(entry.target)));
 document.querySelectorAll('#main .cartesian-chart').forEach(svg=>{redraw(svg);chartResizeObserver.observe(svg);});
}
function legend(series){return `<div class="legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;}
function donut(parts,centerLabel='SPENDING',value=null,{separators=true}={}){const total=E.sum(parts,p=>Math.max(0,p.value)),circ=2*Math.PI*42;let offset=0;
 // Filled annular sectors share exact radial edges; dashed circles can wrap at their seam.
 const point=(radius,angle)=>`${60+radius*Math.cos(angle)},${60+radius*Math.sin(angle)}`;
 const segments=parts.filter(p=>p.value>0).map(p=>{
  const share=p.value/total,start=offset/total*2*Math.PI-Math.PI/2;offset+=p.value;
  const end=offset/total*2*Math.PI-Math.PI/2,title=`<title>${esc(p.name)}: ${money(p.value)} (${percent(share)})</title>`;
  if(share===1)return `<circle cx="60" cy="60" r="42" fill="none" stroke="${p.color}" stroke-width="15">${title}</circle>`;
  const large=share>.5?1:0;
  return `<path d="M${point(49.5,start)} A49.5,49.5 0 ${large} 1 ${point(49.5,end)} L${point(34.5,end)} A34.5,34.5 0 ${large} 0 ${point(34.5,start)} Z" fill="${p.color}" stroke="none">${title}</path>`;
 }).join('');
 const visible=parts.filter(p=>p.value>0);let boundary=0;
 const dividers=separators&&visible.length>1?visible.map(p=>{const angle=boundary/circ*2*Math.PI-Math.PI/2;boundary+=p.value/total*circ;return `<line x1="${60+34.5*Math.cos(angle)}" y1="${60+34.5*Math.sin(angle)}" x2="${60+49.5*Math.cos(angle)}" y2="${60+49.5*Math.sin(angle)}" stroke="var(--donut-border-color, #fff)" stroke-width="1.2" pointer-events="none"/>`;}).join(''):'';
 return `<div class="donut-wrap"><svg class="chart" viewBox="8 8 104 104" role="img" aria-label="${esc(centerLabel)} breakdown"><circle cx="60" cy="60" r="42" fill="none" stroke="#f1eef4" stroke-width="15"/><g class="volume-ring">${segments}${dividers}</g>${separators?'<circle cx="60" cy="60" r="49" fill="none" stroke="#ffffff" stroke-opacity=".3" stroke-width=".7" pointer-events="none"/>':''}</svg><div class="donut-center">${value??money(total,0)}<small>${centerLabel}</small></div></div><div class="donut-legend">${parts.map(p=>`<span><i style="background:${p.color}"></i>${esc(p.name)}<b>${percent(total?p.value/total:0)}</b></span>`).join('')}</div>`;}
/* NAVIGATION · RENDERING */
const navItems=[['annual','Annual overview','overview'],['monthly','Monthly budget','overview'],['recurring','Recurring transactions','manage'],['payments','Payment schedule','manage'],['variable','Variable transactions','manage'],['calendar','Bill calendar','manage'],['accounts','Accounts','plan'],['savings','Savings','plan'],['debt','Debt payoff','plan'],['allocation','50/30/20 budget','plan'],['networth','Net worth','plan'],['nospend','No spend tracker','plan'],['setup','Settings','workspace'],['backup','Backup','workspace'],['help','Help & guide','workspace']];
const iconPaths={backup:'M4 3h11l4 4v12H3V3zM7 3v6h8V3M7 19v-6h8v6',nospend:'M3 5h16v14H3zM3 9h16M7 2v6M15 2v6M7 14l3 3 5-5',annual:'M3 3h6v6H3zM13 3h6v6h-6zM3 13h6v6H3zM13 13h6v6h-6z',monthly:'M3 5h16v14H3zM3 9h16M7 2v6M15 2v6',recurring:'M4 8a7 7 0 0 1 12-3l3 3M19 3v5h-5M18 14a7 7 0 0 1-12 3l-3-3M3 19v-5h5',payments:'M5 3h12v17H5zM8 7h6M8 11h6M8 15h3',variable:'M4 4h14v14H4zM7 8h8M7 12h4',calendar:'M3 5h16v14H3zM3 9h16M7 2v6M15 2v6M7 12h2M12 12h2M7 16h2',accounts:'M2 8l9-5 9 5M3 9h16M5 10v7M10 10v7M16 10v7M3 19h16',savings:'M11 19V9M11 14C3 14 3 8 3 8s8 0 8 6M11 10c0-7 8-7 8-7s0 7-8 7',debt:'M4 4v15h15M7 7l4 4 3-2 5 7',allocation:'M11 3v8h8A8 8 0 1 1 11 3zM14 2v6h6',networth:'M3 19V4M3 19h17M6 15l4-5 4 2 5-7',setup:'M8 3h6l1 4 4 1v6l-4 1-1 4H8l-1-4-4-1V8l4-1zM8 11a3 3 0 1 0 6 0 3 3 0 1 0-6 0',help:'M11 3a8 8 0 1 0 0 16 8 8 0 1 0 0-16M8 8a3 3 0 0 1 6 1c0 2-3 2-3 4M11 15v1'};
function renderNav(){let group='';$('#nav').innerHTML=navItems.map(([id,name,g])=>{let heading='';if(g!==group){heading=`<div class="nav-group">${g.toUpperCase()}</div>`;group=g;}return heading+`<button type="button" data-action="navigate" data-id="${id}" class="nav-link ${id===route?'active':''}" ${id===route?'aria-current="page"':''}><svg viewBox="0 0 22 22" aria-hidden="true"><path d="${iconPaths[id]}"/></svg>${name}</button>`;}).join('');}
function render(){updateSaveStatus();window.closeMonthPicker?.(false);ensureReportYear();const budgetLabel=$('#budget-name');if(budgetLabel)budgetLabel.textContent=state.settings.budgetName||'My household';route=location.hash.slice(1)||'annual';if(!navItems.some(n=>n[0]===route))route='annual';renderNav();$('#breadcrumb').textContent=navItems.find(n=>n[0]===route)[1];const renderers={annual:renderAnnual,...(window.BudgetViews||{})};$('#main').innerHTML=(storageIssue?`<div class="notice" role="alert">${esc(storageIssue)}</div>`:'')+(renderers[route]?renderers[route]():heading('YOUR BUDGET',navItems.find(n=>n[0]===route)[1])+empty('This view is being prepared','Your annual overview is ready to explore.'));fitBudgetCharts();if(route==='setup'&&settingsJumpTarget){const target=$('#settings-category-'+settingsJumpTarget);const addButton=target?.querySelector('[data-action="add-category-type"]');(addButton||target)?.scrollIntoView({block:'center'});const categoryType=settingsJumpTarget==='savings'?'Savings':'Debt';settingsJumpTarget=null;handleAction('add-category-type',categoryType);}}
function renderAnnual(){
 const a=E.calculateAnnualSummary(state),labels=a.rows.map(r=>shortMonth(r.month)),incomeSeries=[{name:'Income',color:colors.Income,values:a.rows.map(r=>r.income)},{name:'Spending',color:colors.Debt,values:a.rows.map(r=>r.spending)}],budgetSeries=[{name:'Budget',color:colors.Expenses,values:a.rows.map(r=>r.expectedBalance)},{name:'Actual',color:colors.Bills,values:a.rows.map(r=>r.balance)}],series=state.viewPreferences.annualSeries||'Debt';
 let html=heading('THE BIG PICTURE',`<span class="period-title">${state.viewPreferences.reportYear}</span>`,'A little clarity for your whole year.','');
 html+=`<div class="metrics">${metric('Total income',money(a.income),'var(--income)','All recorded income')}${metric('Total spending',money(a.spending),'var(--plum)','Bills, expenses, debt & savings')}${metric('Total saved',money(a.totals.Savings),'var(--teal)','Contributions this budget year')}${metric('Total debt paid',money(a.totals.Debt),'var(--terra)','Recorded debt payments')}${metric('Left to spend',money(a.leftToSpend),'var(--steel)','Planned less actual leftover')}</div>`;
 html+=`<div class="chart-grid annual-charts">${panel('Income & spending',legend(incomeSeries)+`<div class="chart-inner">${lineChart(labels,incomeSeries,{area:true,width:480,height:220,annual:true})}</div>`)}${panel('Spending breakdown',`<div class="chart-inner annual-spending-chart">${donut(E.TYPES.slice(1).map(t=>({name:t,value:a.totals[t],color:colors[t]})))}</div>`)}${panel('Budget vs actual',legend(budgetSeries)+`<div class="chart-inner">${barChart(labels,budgetSeries,{width:480,height:220,annual:true})}</div>`)}${panel('Running balance',`<div class="legend">Cumulative net cash flow</div><div class="chart-inner">${lineChart(labels,[{name:'Balance',color:colors.Income,values:a.rows.map(r=>r.runningBalance)}],{area:true,width:480,height:220,annual:true})}</div>`)}</div>`;
 html+=`<div class="summary-grid">${panel('Cash flow summary',`<div class="table-wrap"><table class="compact"><thead><tr><th>Month</th>${E.TYPES.map(t=>`<th class="numeric">${t}</th>`).join('')}<th class="numeric">Balance</th></tr></thead><tbody>${a.rows.map(r=>`<tr><td>${shortMonth(r.month)}</td>${E.TYPES.map(t=>`<td class="numeric">${money(r.groups[t].actual,0)}</td>`).join('')}<td class="numeric ${r.cashFlow<0?'negative':'positive'}">${money(r.cashFlow,0)}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td>${E.TYPES.map(t=>`<td class="numeric">${money(a.totals[t],0)}</td>`).join('')}<td class="numeric">${money(a.cashFlow,0)}</td></tr></tfoot></table></div>`)}${panel('Monthly overview',`<div class="panel-body annual-monthly-chart" style="--overview-tone:var(--${categoryTones[series]})"><div class="goal-value" style="color:var(--${categoryTones[series]})">${money(a.totals[series])}</div><p class="help-text">${series} across your budget year</p>${barChart(labels,[{name:series,color:colors[series],values:a.rows.map(r=>r.groups[series].actual)}],{width:720,height:400,annual:true})}</div>`,`<div class="annual-monthly-controls"><details class="annual-category-picker"><summary id="annual-series" style="--choice-color:${typeBadgeColors[series]}"><span>${series}</span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></summary><div class="annual-category-options" aria-label="Monthly overview category">${E.TYPES.map(type=>`<button type="button" data-action="annual-category" data-id="${type}" aria-pressed="${type===series}" style="--choice-color:${typeBadgeColors[type]}"><span>${type}</span><span aria-hidden="true">${type===series?'✓':''}</span></button>`).join('')}</div></details></div>`)}</div>`;
 const cats=state.categories.filter(c=>c.type===categoryTab);html+=`<section class="panel category-panel table-panel" data-tone="${categoryTones[categoryTab]}"><div class="tabs" role="tablist">${E.TYPES.map(t=>`<button class="tab ${t===categoryTab?'active':''}" data-action="category-tab" data-id="${t}" role="tab" aria-selected="${t===categoryTab}">${t}</button>`).join('')}</div><div class="table-wrap"><table class="category-table"><thead><tr><th>${categoryTab} category</th>${labels.map(l=>`<th class="numeric">${l}</th>`).join('')}<th class="numeric">Plan</th><th class="numeric">Actual</th><th class="numeric">Difference</th></tr></thead><tbody>${cats.map(c=>{const vals=a.rows.map(r=>E.sum(r.transactions.filter(t=>t.categoryId===c.id),t=>t.amount)),actual=E.sum(vals),expected=E.sum(a.rows,r=>r.plan.categoryPlans[c.id]);return `<tr><td>${esc(c.name)}</td>${vals.map(v=>`<td class="numeric">${v?money(v,0):'—'}</td>`).join('')}<td class="numeric">${money(expected,0)}</td><td class="numeric">${money(actual,0)}</td><td class="numeric">${money(expected-actual,0)}</td></tr>`;}).join('')}</tbody></table></div></section>`;return html;
}
/* EVENTS · FORMS are extended by the complete module below. */
document.addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(!b)return;const {action,id}=b.dataset;if(action==='navigate'){if(navItems.some(n=>n[0]===id)){location.hash=id;document.body.classList.remove('menu-open');}}else if(action==='report-year'){selectReportYear(id);}else if(action==='category-tab'){categoryTab=id;render();}else if(typeof handleAction==='function')handleAction(action,id);});
document.addEventListener('change',event=>{if(event.target.id==='report-year'){if(event.target.value==='next-year'&&route==='payments')openNextPaymentYear();else selectReportYear(event.target.value);return;}if(event.target.id==='no-spend-week'||event.target.dataset.noSpendExclude){const pref=noSpendPreferences(state);if(event.target.id==='no-spend-week'){pref.weekStartsOn=event.target.value==='Sunday'?'Sunday':'Monday';}else{const ids=new Set(pref.excludedCategoryIds),id=event.target.dataset.noSpendExclude;if(event.target.checked)ids.add(id);else ids.delete(id);pref.excludedCategoryIds=[...ids];}state.viewPreferences.noSpend=pref;saveState();render();return;}if(event.target.id==='annual-series'){state.viewPreferences.annualSeries=event.target.value;saveState();render();}else if(event.target.id==='month-selector'){const value=event.target.value;if(value==='add-month'){event.target.value=availableBudgetMonths().includes(currentMonth())?currentMonth():'';addBudgetMonthForm();return;}if(!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value))return;state.viewPreferences.reportYear=Number(value.slice(0,4));state.viewPreferences.monthIndex=Number(value.slice(5,7))-1;saveState();render();}else if(typeof handleChange==='function')handleChange(event);});
$('#export-top').addEventListener('click',exportData);$('#menu-toggle').addEventListener('click',()=>{if(window.innerWidth>=1100&&window.innerWidth<=1700){document.body.classList.toggle('sidebar-collapsed');if(typeof fitBudgetCharts==='function')fitBudgetCharts();}else document.body.classList.toggle('menu-open');});window.addEventListener('hashchange',()=>{filter.page=0;document.body.classList.remove('menu-open');window.scrollTo({top:0,left:0,behavior:'instant'});render();});
