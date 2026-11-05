/* No-spend tracking reads actual budget transactions without changing them. */
function noSpendPreferences(s){
 const saved=s.viewPreferences.noSpend||{};
 return {weekStartsOn:saved.weekStartsOn==='Sunday'?'Sunday':'Monday',excludedCategoryIds:Array.isArray(saved.excludedCategoryIds)?saved.excludedCategoryIds:s.categories.filter(c=>c.type==='Debt'||c.type==='Savings').map(c=>c.id)};
}
function calculateNoSpend(s,asOf=E.today()){
 const prefs=noSpendPreferences(s),excluded=new Set(prefs.excludedCategoryIds),byDate=new Map();
 for(const t of E.actualTransactions(s)){
  if(t.type==='Income'||t.amount<=0||excluded.has(t.categoryId))continue;
  byDate.set(t.date,(byDate.get(t.date)||0)+Number(t.amount));
 }
 const trackingStart=E.firstTransactionDate(s)||asOf;
 let noSpend=0,spend=0,streak=0,best=0;
 const months=E.months(s).map(month=>{
  const end=E.addMonths(month+'-01',1),days=[];
  for(let date=month+'-01';date<end;date=E.addDays(date,1)){
   const amount=byDate.get(date)||0,completed=date>=trackingStart&&date<asOf;
   const status=date<trackingStart?'inactive':date>asOf?'future':amount>0?'spent':date===asOf?'today':'clear';
   if(completed){if(amount>0){spend++;streak=0;}else{noSpend++;streak++;best=Math.max(best,streak);}}
   days.push({date,amount,status});
  }
  return {month,days,noSpend:days.filter(d=>d.status==='clear').length};
 });
 return {prefs,months,noSpend,spend,best,rate:noSpend+spend?noSpend/(noSpend+spend):null};
}
function renderNoSpend(){
 const n=calculateNoSpend(state),excluded=new Set(n.prefs.excludedCategoryIds),weekdays=n.prefs.weekStartsOn==='Monday'?['M','T','W','T','F','S','S']:['S','M','T','W','T','F','S'];
 const calendars=n.months.map(({month,days,noSpend})=>{
  const weekday=new Date(month+'-01T12:00:00Z').getUTCDay(),offset=(weekday+(n.prefs.weekStartsOn==='Monday'?6:0))%7;
  return `<section class="panel ns-month"><div class="panel-head"><h2 class="section-title">${longMonth(month)}</h2></div><div class="ns-days"><div class="ns-weekdays-band">${weekdays.map(d=>`<span class="ns-weekday" aria-hidden="true">${d}</span>`).join('')}</div>${'<span class="ns-empty-day" aria-hidden="true"></span>'.repeat(offset)}${days.map(d=>{const label=niceDate(d.date)+' · '+({inactive:'Before your first transaction',future:'Future day',today:'Today — still in progress',spent:'Spending: '+money(d.amount),clear:'No recorded spending'})[d.status];return `<span class="ns-day ns-${d.status}" ${d.date===E.today()?'aria-current="date"':''} title="${label}" aria-label="${label}">${Number(d.date.slice(-2))}${d.status==='clear'?'<i aria-hidden="true">✓</i>':''}</span>`;}).join('')}${'<span class="ns-empty-day" aria-hidden="true"></span>'.repeat(42-offset-days.length)}</div><p class="ns-month-total">${noSpend} no-spend ${noSpend===1?'day':'days'}</p></section>`;
 }).join('');
 const groups=E.TYPES.filter(t=>t!=='Income').map(type=>`<details class="ns-exclusions" open><summary>${type}</summary>${state.categories.filter(c=>c.type===type).map(c=>`<label><input type="checkbox" data-no-spend-exclude="${esc(c.id)}" ${excluded.has(c.id)?'checked':''}><span>${esc(c.name)}</span></label>`).join('')}</details>`).join('');
 return heading('YOUR DAILY SPENDING HABITS','No spend tracker',`${longMonth(n.months[0].month)} — ${longMonth(n.months.at(-1).month)}`,`<label class="ns-week-control">Start week on <select id="no-spend-week">${options(['Monday','Sunday'],n.prefs.weekStartsOn)}</select></label>`)+`<div class="metrics metric-four">${metric('No-spend days',n.noSpend,'var(--teal)','Days without spending')}${metric('Spending days',n.spend,'var(--terra)','Days with spending')}${metric('No-spend rate',percent(n.rate),'var(--steel)','Share of completed days')}${metric('Longest streak',n.best+' days','var(--plum)','No-spend days in a row')}</div><div class="ns-layout"><aside class="panel ns-settings"><div class="panel-head"><h2 class="section-title">Exclude categories</h2></div><div class="panel-body"><p class="help-text">Checked categories do not count as spending. Income is always excluded.</p>${groups}</div></aside><div><div class="ns-legend"><span><i class="ns-clear"></i>No spend ✓</span><span><i class="ns-spent"></i>Spending</span><span><i class="ns-today"></i>Today / in progress</span><span><i class="ns-future"></i>Future</span></div><div class="ns-calendar-grid">${calendars}</div></div></div>`;
}
window.BudgetViews.nospend=renderNoSpend;
