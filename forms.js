/* FORMS · EDIT ACTIONS · IMPORT / EXPORT */
const newId=prefix=>`${prefix}-${globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}`;
function inputField(label,name,value='',type='text',attrs=''){return `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value??'')}" ${attrs}></label>`;}
function selectField(label,name,list,value,blank=''){return `<label>${esc(label)}<select name="${name}">${options(list,value,blank)}</select></label>`;}
const monetaryFields=new Set(['actual','adjustment','amount','balance','extra','goal','goalAmount','minimumPayment','openingBalance','planned','startingAmount','startingBalance']);
const cents=n=>Number(Number(n).toFixed(2));
const numberField=(label,name,value,attrs='min="0"')=>inputField(label,name,monetaryFields.has(name)&&value!==''&&value!==null&&value!==undefined?Number(value).toFixed(2):value,'number',`step="${monetaryFields.has(name)?'0.01':'any'}" ${attrs}`);
const dateField=(label,name,value,required=false)=>inputField(label,name,value,'date',required?'required':'');
const formGrid=html=>`<div class="form-grid">${html}</div>`;
function openDialog(title,body,onSave){$('#dialog-title').textContent=title;$('#form-body').innerHTML=body;$('#form-error').textContent='';dialogSave=onSave;$('#editor').showModal();setTimeout(()=>$('#form-body input, #form-body select')?.focus(),20);}
function closeDialog(){$('#editor').close();dialogSave=null;}
function readNumber(data,key,nullable=false){const raw=data.get(key);if(nullable&&(raw===null||raw===''))return null;const value=Number(raw);if(raw===null||raw===''||!Number.isFinite(value))throw Error('Enter a valid number.');return monetaryFields.has(key)?cents(value):value;}
function readDate(data,key,required=false){const d=data.get(key)||null;if(required&&!d)throw Error('Enter the required date.');if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||new Date(d+'T12:00Z').toISOString().slice(0,10)!==d||d<'1900-01-01'||d>'2200-12-31'))throw Error('Enter a valid date between 1900 and 2200.');return d;}
function upsert(collection,record){const at=collection.findIndex(x=>x.id===record.id);if(at>=0)collection[at]=record;else collection.push(record);}
function requiredName(data,key='name'){const name=String(data.get(key)||'').trim();if(!name)throw Error('Enter a name.');if(name.length>160)throw Error('Use a name shorter than 160 characters.');return name;}
function freezePaid(){for(const p of E.calculatePayments(state))if(p.paid){const o=state.paymentOverrides[p.id]||{};if(!o.snapshot)o.snapshot={...p.base};state.paymentOverrides[p.id]=o;}}
function setPaymentPaid(id,paid){const p=E.calculatePayments(state).find(p=>p.id===id);if(!p)throw Error('This payment no longer exists.');state.paymentOverrides[id]={date:null,amount:null,accountId:null,personId:null,note:'',...(state.paymentOverrides[id]||{}),paid,snapshot:state.paymentOverrides[id]?.snapshot||{...p.base}};}
function confirmAction(title,message,callback){openDialog(title,`<p class="explain">${esc(message)}</p>`,()=>{callback();});}
function deleteButton(action,id){return `<div style="margin-top:18px">${button('Delete','delete-'+action,id,'danger small')}</div>`;}
function rebuildRulePayments(budget,rule,through=E.today()){
 const entries=Object.keys(budget.paymentOverrides).filter(id=>id.startsWith(rule.id+':'));
 const until=[through,...entries.map(id=>id.slice(-10))].sort().at(-1);
 const payments=E.generateRecurringTransactions({...budget,recurringRules:[rule]},rule.firstDate,until);
 const ids=new Set(payments.map(p=>p.id));let removed=0,marked=0;
 for(const id of entries)if(!ids.has(id)){delete budget.paymentOverrides[id];removed++;}
 for(const payment of payments)if(payment.date<=through){
  const old=budget.paymentOverrides[payment.id]||{};
  if(!old.paid)marked++;
  budget.paymentOverrides[payment.id]={date:null,amount:null,accountId:null,personId:null,note:'',...old,paid:true,snapshot:old.snapshot||{...payment}};
 }
 return {removed,marked};
}
function transactionForm(kind,id){const recurring=kind==='recurring',existing=(recurring?state.recurringRules:state.variableTransactions).find(x=>x.id===id),record=existing||{type:recurring?'Bills':'Expenses',date:currentMonth()+'-01',firstDate:currentMonth()+'-01',frequency:'Every Month',amount:0,accountId:state.accounts[0]?.id,personId:state.people[0]?.id};
 const body=formGrid(selectField('Transaction type','type',E.TYPES,record.type)+selectField('Category','categoryId',state.categories.filter(c=>c.type===record.type),record.categoryId)+(recurring?selectField('Frequency','frequency',Object.keys(E.STEPS),record.frequency):dateField('Date','date',record.date,true))+numberField('Amount','amount',record.amount)+(recurring?dateField('First payment','firstDate',record.firstDate,true)+dateField('Last payment (optional)','lastDate',record.lastDate):'')+selectField('Account','accountId',state.accounts,record.accountId,'No account')+(multipleParticipants()?selectField('Person','personId',state.people,record.personId,'No person'):'')+`<label class="full">Description<textarea name="description" rows="2" maxlength="2000">${esc(record.description)}</textarea></label>`)+(recurring?'<p class="help-text">Future occurrences update when this rule changes. Paid occurrences retain their original details and adjustments. For two paydays each month, use two monthly rules.</p>':'')+(recurring&&existing?`<div class="explain" id="schedule-history" hidden><p>Changing the schedule can leave paid records on old dates. Choose how to handle them. Rebuilding removes records outside the new schedule and marks every scheduled payment through today Paid. Your budget totals will change. A recovery copy is saved first.</p><label>Payment history<select name="scheduleHistory"><option value="">Choose an option</option><option value="keep">Keep recorded payments</option><option value="rebuild">Rebuild payments through today</option></select></label></div>`:'')+(existing?deleteButton(kind,id):'');
 openDialog(existing?'Edit '+(recurring?'recurring transaction':'transaction'):'Add '+(recurring?'recurring transaction':'transaction'),body,data=>{
  const type=data.get('type'),categoryId=data.get('categoryId'),cat=state.categories.find(c=>c.id===categoryId&&c.type===type);if(!cat)throw Error('Add or choose a category for this transaction type.');
  const r={id:existing?.id||newId(recurring?'rule':'transaction'),type,categoryId,amount:readNumber(data,'amount'),accountId:data.get('accountId')||null,personId:multipleParticipants()?(data.get('personId')||null):existing?existing.personId:primaryParticipant(),description:String(data.get('description')||'').trim()};if(r.amount<0)throw Error('Use a positive transaction amount.');if(r.amount===0&&!r.description)throw Error('Enter an amount greater than zero or add a description.');
  if(recurring){r.firstDate=readDate(data,'firstDate',true);r.lastDate=readDate(data,'lastDate');r.frequency=data.get('frequency');if(r.lastDate&&r.lastDate<r.firstDate)throw Error('Last payment must be on or after the first payment.');const changed=existing&&['firstDate','lastDate','frequency'].some(k=>r[k]!==existing[k]);
 if(changed&&!['keep','rebuild'].includes(data.get('scheduleHistory'))){$('#schedule-history').hidden=false;throw Error('The schedule changed. Choose whether to keep or rebuild payment history.');}
 if(changed)protectBudget('Before changing a recurring schedule');
 freezePaid();upsert(state.recurringRules,r);
 if(changed&&data.get('scheduleHistory')==='rebuild')rebuildRulePayments(state,r);
 }else{r.date=readDate(data,'date',true);upsert(state.variableTransactions,r);}
 });
 if(recurring&&existing)for(const name of ['firstDate','lastDate','frequency'])$('#editor [name='+name+']').addEventListener('change',()=>{$('#schedule-history').hidden=false;});
 const type=$('#editor [name=type]');type.addEventListener('change',()=>{$('#editor [name=categoryId]').innerHTML=options(state.categories.filter(c=>c.type===type.value),null);});
}
function paymentForm(id){const p=E.calculatePayments(state).find(p=>p.id===id);if(!p)return;const o=state.paymentOverrides[id]||{};openDialog('Adjust payment',`<p class="explain"><b>${esc(catName(p.categoryId))}</b> · ${niceDate(p.base.date)} · ${money(p.base.amount)}<br>Leave an adjustment blank to use the original value.</p>`+formGrid(`<label class="check-label full"><input type="checkbox" name="paid" ${p.paid?'checked':''}> Paid</label>`+dateField('New date','date',o.date)+numberField('New amount','amount',o.amount??'')+selectField('New account','accountId',state.accounts,o.accountId,'Original account')+(multipleParticipants()?selectField('New person','personId',state.people,o.personId,'Original person'):'')+`<label class="full">Note<textarea name="note" rows="2" maxlength="2000">${esc(o.note)}</textarea></label>`),data=>{const amount=readNumber(data,'amount',true);if(amount!==null&&amount<0)throw Error('Use zero or a positive amount.');state.paymentOverrides[id]={paid:data.has('paid'),date:readDate(data,'date'),amount,accountId:data.get('accountId')||null,personId:multipleParticipants()?(data.get('personId')||null):(o.personId||null),note:String(data.get('note')||'').trim(),snapshot:o.snapshot||{...p.base}};});}
function accountForm(id){const a=state.accounts.find(a=>a.id===id)||{openingBalance:0,adjustment:0};openDialog(id?'Edit account':'Add account',formGrid(selectField('Account type','type',['Cash','Bank','Savings','Credit card','Investment'],a.type||'Bank')+inputField('Account name','name',a.name,'text','required maxlength="160"')+dateField('Opening balance date (optional)','openingDate',a.openingDate)+dateField('Last checked / adjustment date','lastChecked',a.lastChecked)+numberField('Opening balance','openingBalance',a.openingBalance,'')+numberField('Adjustment (+/−)','adjustment',a.adjustment,''))+'<p class="help-text">Opening balance is before operations on the opening date. Leave the date blank to include all recorded operations. For credit cards, enter debt as a negative balance. Changes to the adjustment total are dated by Last checked, or today if blank.</p>'+(id?deleteButton('account',id):''),data=>{const name=requiredName(data);if(state.accounts.some(x=>x.id!==id&&x.name.toLowerCase()===name.toLowerCase()))throw Error('An account already has this name.');const adjustment=readNumber(data,'adjustment'),lastChecked=readDate(data,'lastChecked'),openingDate=readDate(data,'openingDate');
 const entries=a.adjustmentEntries?[...a.adjustmentEntries]:a.adjustment?[{date:a.lastChecked||a.openingDate||E.start(state),amount:a.adjustment}]:[];
 if(adjustment!==a.adjustment)entries.push({date:lastChecked||E.today(),amount:adjustment-a.adjustment});
 const type=data.get('type');upsert(state.accounts,{...a,id:id||newId('account'),name,type,openingDate,openingBalance:readNumber(data,'openingBalance'),adjustment,adjustmentEntries:entries,lastChecked});
 for(const item of state.netWorth.items.filter(i=>i.source==='account'&&i.accountId===id)){item.side=type==='Credit card'?'liability':'asset';item.group=type==='Credit card'?'Credit Cards':type==='Investment'?'Investments':'Cash & Bank Accounts';}
});}
function personForm(id){const p=state.people.find(p=>p.id===id);openDialog(id?'Edit member':'Add member',formGrid(inputField('Name','name',p?.name,'text','required maxlength="160"'))+(id?deleteButton('person',id):''),data=>{const name=requiredName(data);if(state.people.some(x=>x.id!==id&&x.name.toLowerCase()===name.toLowerCase()))throw Error('A member already has this name.');upsert(state.people,{id:id||newId('person'),name});});}
function categoryForm(id){const c=state.categories.find(c=>c.id===id)||{type:categoryTab,budgetGroup:categoryTab==='Income'?null:categoryTab==='Debt'||categoryTab==='Savings'?'Debt & Savings':'Needs'};openDialog(id?'Edit category':'Add category',formGrid(inputField('Category name','name',c.name,'text','required maxlength="160"')+selectField('Transaction type','type',E.TYPES,c.type)+`<div id="category-budget-group" style="display:contents">${c.type==='Income'?'':selectField('Budget group','budgetGroup',['Needs','Wants','Debt & Savings'],c.budgetGroup,'Not allocated')}</div>`)+(id?'<p class="help-text">Renaming a category keeps its transactions and plans linked. Its transaction type stays fixed.</p>'+deleteButton('category',id):''),data=>{const name=requiredName(data),type=id?c.type:data.get('type'),budgetGroup=type==='Income'?null:data.get('budgetGroup');if(type!=='Income'&&!budgetGroup)throw Error('Choose a budget group for spending categories.');if(state.categories.some(x=>x.id!==id&&x.type===type&&x.name.toLowerCase()===name.toLowerCase()))throw Error('This category already exists for this type.');upsert(state.categories,{id:id||newId(type.toLowerCase()),name,type,budgetGroup});});const typeSelect=$('#editor [name=type]');if(id)typeSelect.disabled=true;else typeSelect.addEventListener('change',()=>{$('#category-budget-group').innerHTML=typeSelect.value==='Income'?'':selectField('Budget group','budgetGroup',['Needs','Wants','Debt & Savings'],['Debt','Savings'].includes(typeSelect.value)?'Debt & Savings':'Needs');});}
function goalForm(id){const g=state.savingsGoals.find(g=>g.id===id)||{startingAmount:0,goalAmount:0,startDate:currentMonth()+'-01',targetDate:E.end(state)},cats=state.categories.filter(c=>c.type==='Savings'&&(c.id===g.categoryId||!state.savingsGoals.some(g=>g.categoryId===c.id)));if(!cats.length){toast('Add a new Savings category in Settings first.');return;}openDialog(id?'Edit savings goal':'Add savings goal',formGrid(selectField('Savings category','categoryId',cats,g.categoryId)+numberField('Starting amount','startingAmount',g.startingAmount)+numberField('Savings goal','goalAmount',g.goalAmount)+dateField('Starting date','startDate',g.startDate,true)+dateField('Target date','targetDate',g.targetDate,true))+(id?deleteButton('goal',id):''),data=>{const goal={id:id||newId('goal'),categoryId:data.get('categoryId'),startingAmount:readNumber(data,'startingAmount'),goalAmount:readNumber(data,'goalAmount'),startDate:readDate(data,'startDate',true),targetDate:readDate(data,'targetDate',true)};if(goal.targetDate<goal.startDate)throw Error('Target date must be on or after the starting date.');if(goal.goalAmount<=0||goal.startingAmount<0)throw Error('Enter a positive goal and a non-negative starting amount.');upsert(state.savingsGoals,goal);});}
function debtForm(id){const d=state.debtPlan.debts.find(d=>d.id===id)||{startingBalance:0,minimumPayment:0,annualRate:0,priority:state.debtPlan.debts.length+1},cats=state.categories.filter(c=>c.type==='Debt'&&(c.id===d.categoryId||!state.debtPlan.debts.some(d=>d.categoryId===c.id)));if(!cats.length){toast('Add a new Debt category in Settings first.');return;}openDialog(id?'Edit debt':'Add debt',formGrid(selectField('Debt category','categoryId',cats,d.categoryId)+numberField('Starting balance','startingBalance',d.startingBalance)+numberField('Minimum monthly payment','minimumPayment',d.minimumPayment)+numberField('Annual interest (%)','annualRate',d.annualRate*100)+numberField('Custom priority','priority',d.priority,'min="1"'))+(id?deleteButton('debt',id):''),data=>{const r={id:id||newId('debt'),categoryId:data.get('categoryId'),startingBalance:readNumber(data,'startingBalance'),minimumPayment:readNumber(data,'minimumPayment'),annualRate:readNumber(data,'annualRate')/100,priority:readNumber(data,'priority')};if(r.startingBalance<0||r.minimumPayment<0||r.annualRate<0||r.annualRate>10||r.priority<1)throw Error('Check the debt amounts, rate and priority.');upsert(state.debtPlan.debts,r);});}
function netWorthForm(id){
 const item=state.netWorth.items.find(i=>i.id===id)||{side:'asset',group:'Cash & Bank Accounts',balances:{}},groups={asset:['Cash & Bank Accounts','Investments','Property','Other Assets'],liability:['Credit Cards','Mortgage + Loans','Other Liabilities']};
 openDialog(id?'Edit net worth item':'Add net worth item',formGrid(inputField('Item name','name',item.name,'text','required maxlength="160"')+selectField('Side','side',[{id:'asset',name:'Asset'},{id:'liability',name:'Liability'}],item.side)+selectField('Group','group',groups[item.side],item.group))+(id?deleteButton('networth',id):''),data=>{const side=data.get('side'),group=data.get('group');if(!groups[side]?.includes(group))throw Error('Choose a valid group.');upsert(state.netWorth.items,{...item,id:id||newId('net'),source:'manual',accountId:null,name:requiredName(data),side,group,balances:item.balances});});
 $('#editor [name=side]').addEventListener('change',event=>{$('#editor [name=group]').innerHTML=options(groups[event.target.value],null);});
}
function transferForm(id){
 if(state.accounts.length<2){toast('Add at least two accounts to make a transfer.');return;}
 const t=(state.transfers||[]).find(t=>t.id===id)||{date:E.today(),amount:0,fromAccountId:state.accounts[0].id,toAccountId:state.accounts[1].id,note:''};
 openDialog(id?'Edit transfer':'Transfer between accounts',formGrid(dateField('Date','date',t.date,true)+selectField('From account','fromAccountId',state.accounts,t.fromAccountId)+selectField('To account','toAccountId',state.accounts,t.toAccountId)+numberField('Amount','amount',t.amount)+inputField('Note','note',t.note))+'<p class="help-text">Moves money between your accounts without adding income or spending. Use one transfer instead of recording the same movement as a separate Savings or Debt transaction.</p>'+(id?deleteButton('transfer',id):''),data=>{
  const from=data.get('fromAccountId'),to=data.get('toAccountId'),amount=readNumber(data,'amount');if(from===to||![from,to].every(id=>state.accounts.some(a=>a.id===id)))throw Error('Choose two different accounts.');if(amount<=0)throw Error('Enter a positive amount.');
  state.transfers??=[];upsert(state.transfers,{id:id||newId('transfer'),date:readDate(data,'date',true),fromAccountId:from,toAccountId:to,amount,note:String(data.get('note')||'').trim()});
 });
}

function globalSettings(){openDialog('Budget settings',formGrid(inputField('Budget name','budgetName',state.settings.budgetName||'My household','text','required maxlength="80"')+selectField('Currency position','currencyPosition',[{id:'before',name:'Before amount ($1,234.56)'},{id:'after',name:'After amount (1,234.56 $)'}],state.settings.currencyPosition||'before')+inputField('Currency symbol','currencySymbol',state.settings.currencySymbol,'text','required maxlength="8"')+selectField('Week starts on','weekStartsOn',['Monday','Sunday'],state.settings.weekStartsOn)),data=>{state.settings={...state.settings,budgetName:requiredName(data,'budgetName'),currencyPosition:data.get('currencyPosition')==='after'?'after':'before',currencySymbol:requiredName(data,'currencySymbol'),weekStartsOn:data.get('weekStartsOn')};});}


function allocationSettings(){const p=state.allocationPlan;openDialog('Allocation plan',formGrid(Object.entries(p.shares).map(([g,n])=>numberField(g+' (%)',g,n*100,'min="0" max="100"')).join(''))+'<p class="help-text">The three target shares must total 100%. Planned amounts use allocated spending for the selected month.</p>',data=>{const shares=Object.fromEntries(Object.keys(p.shares).map(g=>[g,readNumber(data,g)/100]));if(Object.values(shares).some(x=>x<0||x>1)||Math.abs(E.sum(Object.values(shares))-1)>1e-8)throw Error('The target shares must total 100%.');state.allocationPlan.shares=shares;});}
function debtSettings(){const p=state.debtPlan;openDialog('Debt repayment settings',formGrid(dateField('Repayment start date','startDate',p.startDate,true)+numberField('Extra monthly payment','extra',p.extraMonthlyPayment)+selectField('Strategy','strategy',['Snowball','Avalanche','Custom'],p.strategy))+'<p class="help-text">Snowball: smallest balance first. Avalanche: highest rate first. Custom: your priority order.</p>',data=>{const extra=readNumber(data,'extra');if(extra<0)throw Error('Extra payment cannot be negative.');if(Object.values(p.monthlyAdjustments).some(v=>v+extra<0))throw Error('One of your monthly adjustments would make the extra payment negative.');Object.assign(p,{startDate:readDate(data,'startDate',true),extraMonthlyPayment:extra,strategy:data.get('strategy')});});}
function removeRecord(kind,id){
 const collections={transfer:state.transfers||[],variable:state.variableTransactions,recurring:state.recurringRules,account:state.accounts,person:state.people,category:state.categories,goal:state.savingsGoals,debt:state.debtPlan.debts,networth:state.netWorth.items},items=collections[kind];if(!items)return;
 const refs=[...state.variableTransactions,...state.recurringRules,...E.calculatePayments(state)],key={account:'accountId',person:'personId',category:'categoryId'}[kind];
 if(kind==='account'&&((state.transfers||[]).some(t=>t.fromAccountId===id||t.toAccountId===id)||state.netWorth.items.some(i=>i.source==='account'&&i.accountId===id))){toast('This account is used by a transfer or Net Worth item. Remove its links before deleting.');return;}
 if(key&&(refs.some(t=>t[key]===id)||(kind==='category'&&(state.savingsGoals.some(g=>g.categoryId===id)||state.debtPlan.debts.some(d=>d.categoryId===id)||state.monthlyBudgets.some(p=>p.categoryPlans[id]))))){const message='This item is in use. Reassign its transactions, plans or goals before deleting it.';$('#form-error').textContent=message;toast(message);return;}
 closeDialog();confirmAction('Delete this '+kind+'?',kind==='recurring'?'Future payments from this rule will be removed. Paid occurrences remain in your actual records.':'This record will be removed from your budget. Export a backup first if you may need it later.',()=>{if(kind==='recurring')freezePaid();items.splice(items.findIndex(x=>x.id===id),1);if(kind==='recurring')for(const [key,o] of Object.entries(state.paymentOverrides))if(key.startsWith(id+':')&&!o.paid)delete state.paymentOverrides[key];if(kind==='category')state.monthlyBudgets.forEach(p=>delete p.categoryPlans[id]);});
}
function handleAction(action,id){
 if(action==='row-menu'){
  const menu=document.getElementById(id),trigger=document.querySelector(`[aria-controls="${CSS.escape(id)}"]`);if(!menu||!trigger)return;
  if(menu.matches(':popover-open')){menu.hidePopover();return;}
  // Position outside #main so its CSS zoom cannot scale viewport coordinates twice.
  const home=menu.parentNode,next=menu.nextSibling;
  document.body.append(menu);
  const restore=()=>{if(menu.matches(':popover-open'))return;menu.removeEventListener('toggle',restore);if(home.isConnected)home.insertBefore(menu,next?.parentNode===home?next:null);else menu.remove();};
  menu.addEventListener('toggle',restore);
  menu.style.left='0px';menu.style.top='0px';
  menu.showPopover();const r=trigger.getBoundingClientRect(),b=menu.getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(r.right-b.width,window.innerWidth-b.width-8))+'px';
  menu.style.top=Math.max(8,r.bottom+b.height+6>window.innerHeight?r.top-b.height-6:r.bottom+6)+'px';return;
 }
 document.querySelectorAll('.row-actions-popover:popover-open').forEach(menu=>menu.hidePopover());
 if(action==='payment-paid'||action==='payment-unpaid'){setPaymentPaid(id,action==='payment-paid');commit(action==='payment-paid'?'Payment marked as paid':'Payment marked as unpaid');return;}

 if(action==='toggle-filters'&&['recurring','variable','payments'].includes(id)){if(expandedFilters.has(id))expandedFilters.delete(id);else expandedFilters.add(id);render();document.querySelector('[data-action="toggle-filters"]')?.focus({preventScroll:true});return;}
 if(action==='copy-previous-plan'){copyPreviousMonthPlan();return;}
 if(action==='edit-networth-balance'){const [itemId,month]=id.split('|');netWorthBalanceForm(itemId,month);return;}
 if(action==='edit-category-plan'){categoryPlanForm(id);return;}
 if(action==='annual-category'&&E.TYPES.includes(id)){state.viewPreferences.annualSeries=id;saveState();render();$('#annual-series')?.focus();return;}
 if(action==='page-guide'){showPageGuide(id);return;}
 if(action==='close-page-guide'){$('#editor').close();return;}
 if(action==='toggle-plan-settings'&&['debt','allocation','networth','monthly'].includes(id)){
  const preferences=state.viewPreferences.hiddenPlanSettings||{},hidden=!preferences[id];state.viewPreferences.hiddenPlanSettings={...preferences,[id]:hidden};
  const panel=$('#plan-settings-'+id),control=$(`[data-action="toggle-plan-settings"][data-id="${id}"]`);
  if(panel)panel.hidden=hidden;if(control){control.textContent=hidden?'Show settings':'Hide settings';control.setAttribute('aria-expanded',String(!hidden));}saveState();return;
 }

 if(action==='settings-plan'&&['savings','debt'].includes(id)){settingsJumpTarget=id;if(location.hash==='#setup')render();else location.hash='setup';return;}

 if(action==='add-transfer'||action==='edit-transfer'){transferForm(action==='edit-transfer'?id:null);return;}
 if(action==='calendar-payday'){
  const income=E.calculatePayments(state).filter(p=>p.date===id&&p.type==='Income');
  openDialog('Payday · '+niceDate(id),`<div class="payday-details">${income.map(p=>`<div class="label-row"><span><b>${esc(catName(p.categoryId))}</b><br>${money(p.amount)} · ${p.status}</span>${button('Details','adjust-payment',p.id,'small')}</div>`).join('')}</div>`,()=>{});return;
 }

 if(action==='quick-add-account'){
  let name='New account',suffix=2;while(state.accounts.some(a=>a.name.toLowerCase()===name.toLowerCase()))name='New account '+suffix++;
  const account={id:newId('account'),name,type:'Bank',openingBalance:0,adjustment:0,lastChecked:null};state.accounts.push(account);commit('Account added');
  const input=$(`[data-account-id="${account.id}"][data-account-field="name"]`);input?.focus();input?.setSelectionRange(0,name.length);return;
 }

 if(action==='settings-tab'){if(['Budget','Accounts','Categories','Data'].includes(id)){state.viewPreferences.settingsTab=id;saveState();render();}return;}
 if(action==='add-category-type'){if(E.TYPES.includes(id)){categoryTab=id;categoryForm();}return;}
 if(action.startsWith('delete-'))return removeRecord(action.slice(7),id);
 const actions={'add-variable':()=>transactionForm('variable'),'edit-variable':()=>transactionForm('variable',id),'add-recurring':()=>transactionForm('recurring'),'edit-recurring':()=>transactionForm('recurring',id),'adjust-payment':()=>paymentForm(id),'add-account':()=>accountForm(),'edit-account':()=>accountForm(id),'add-person':()=>personForm(),'edit-person':()=>personForm(id),'add-category':()=>categoryForm(),'edit-category':()=>categoryForm(id),'add-goal':()=>goalForm(),'edit-goal':()=>goalForm(id),'add-debt':()=>debtForm(),'edit-debt':()=>debtForm(id),'add-networth':()=>netWorthForm(),'edit-networth':()=>netWorthForm(id),'global-settings':globalSettings,'allocation-settings':allocationSettings,'debt-settings':debtSettings,'export-data':exportData,'snooze-backup':()=>{storeTime(SNOOZE_KEY,Date.now()+3*864e5);render();},'export-recovery':()=>downloadRecovery(id),'import-data':()=>$('#import-file').click(),'navigate':()=>{location.hash=id;},'page-prev':()=>{filter.page=Math.max(0,filter.page-1);render();},'page-next':()=>{filter.page++;render();},'clear-filters':()=>{filter={search:'',type:'All',status:'All',account:'All',person:'All',month:'All',page:0};render();},'networth-goal':()=>openDialog('Set your net worth goal',formGrid(numberField('Goal amount','goal',state.netWorth.goal)),data=>{const n=readNumber(data,'goal');if(n<=0)throw Error('Enter a positive goal.');state.netWorth.goal=n;}),'debt-month':()=>{const d=E.calculateDebtPayoff(state),r=d.rows.find(r=>r.date===id);openDialog(longMonth(id.slice(0,7))+' · Repayment details',`<div class="table-wrap"><table><thead><tr><th>Debt</th><th>Payment</th><th>Interest</th><th>Balance</th></tr></thead><tbody>${r.detail.map(x=>`<tr><td>${esc(catName(d.debts.find(y=>y.id===x.id).categoryId))}</td><td>${money(x.payment)}</td><td>${money(x.interest)}</td><td>${money(x.balance)}</td></tr>`).join('')}</tbody></table></div>`,()=>{});},'reset-demo':()=>confirmAction('Restore demo budget?','This replaces the current budget with the demo included in this version. Export a backup before continuing.',()=>{protectBudget('Before Reset demo');state=structuredClone(window.BUDGET_DEMO);storageIssue='';storageLoadFailed=false;}),'clear-budget':()=>confirmAction('Start with an empty budget?','Transactions, payment adjustments, plans, savings balances, debt values and net worth snapshots will be cleared. Your categories, people and accounts will remain.',()=>{protectBudget('Before Clear budget');freezePaid();blankBudgetData(state);storageIssue='';storageLoadFailed=false;})};actions[action]?.();
}
function saveBudgetPreference(key,value){
 const allowed=['budgetName','currencyCode','currencySymbol','currencyPosition','weekStartsOn'];
 if(!allowed.includes(key))return;
 let next=value;
 if(['budgetName','currencySymbol'].includes(key)){next=value.trim();if(!next||next.length>(key==='budgetName'?80:8))throw Error('Enter a valid '+(key==='budgetName'?'budget name (up to 80 characters).':'currency symbol (up to 8 characters).'));}
 if(key==='currencyCode'){const currency=budgetCurrencies.find(c=>c[0]===value);if(value!=='custom'&&!currency)throw Error('Choose a currency.');state.settings.currencyCode=value;if(currency)state.settings.currencySymbol=currency[2];commit('Currency saved');return;}
 if(key==='currencyPosition'&&!['before','after'].includes(value))return;
 if(key==='weekStartsOn'&&!['Monday','Sunday'].includes(value))return;
 state.settings[key]=next;
 if(key==='currencySymbol')state.settings.currencyCode='custom';
 commit('Budget preferences saved');
}
function handleChange(event){const el=event.target;try{
 const moneyInput=el.id==='networth-goal-amount'||el.id==='debt-extra-payment'||el.dataset?.debtAdjustment||el.dataset?.accountField==='openingBalance'||el.dataset?.plan||el.dataset?.netItem;
 if(moneyInput&&el.value!==''&&Number.isFinite(Number(el.value)))el.value=Number(el.value).toFixed(2);

 if(el.dataset?.monthlyRollover!==undefined){let plan=state.monthlyBudgets.find(p=>p.month===currentMonth());if(!plan){plan=structuredClone(E.monthlyPlan(state,currentMonth()));state.monthlyBudgets.push(plan);}plan.includeRollover=el.checked;commit('Rollover saved');return;}

 if(el.id==='networth-goal-amount'){const value=Number(el.value);if(!el.value.trim()||!Number.isFinite(value)||value<=0)throw Error('Enter a positive net worth goal.');state.netWorth.goal=value;commit('Net worth goal saved');return;}
 if(el.dataset?.allocationShare!==undefined){const groups=['Needs','Wants','Debt & Savings'],fields=groups.map((_,i)=>$('#allocation-share-'+i)),values=fields.map(f=>Number(f.value)),status=$('#allocation-share-status');
  if(fields.some(f=>f.value.trim()==='')||values.some(v=>!Number.isFinite(v)||v<0||v>100)){status.textContent='Enter a percentage from 0 to 100 in each field. Changes have not been saved.';return;}
  const total=values.reduce((a,b)=>a+b,0);if(Math.abs(total-100)>0.000001){status.textContent='Total: '+Number(total.toFixed(4))+'%. Adjust the shares to total 100% to save.';return;}
  state.allocationPlan.shares=Object.fromEntries(groups.map((g,i)=>[g,values[i]/100]));commit('Allocation shares saved');return;
 }

 if(el.id==='debt-start-date'){const data=new FormData();data.set('startDate',el.value);state.debtPlan.startDate=readDate(data,'startDate',true);commit('Repayment start date saved');return;}
 if(el.id==='debt-use-actual'){state.debtPlan.useActualPayments=!!el.checked;commit('Debt payment source updated');return;}
 if(el.id==='debt-extra-payment'){const value=Number(el.value);if(el.value.trim()===''||!Number.isFinite(value)||value<0)throw Error('Enter a non-negative extra monthly payment.');if(Object.values(state.debtPlan.monthlyAdjustments).some(v=>v+value<0))throw Error('A monthly adjustment would make the extra payment negative.');state.debtPlan.extraMonthlyPayment=value;commit('Extra monthly payment saved');return;}

 if(el.dataset?.accountField){
  const account=state.accounts.find(a=>a.id===el.dataset.accountId),key=el.dataset.accountField;if(!account)return;
  let value=el.value;
  if(key==='name'){value=value.trim();if(!value||value.length>160)throw Error('Enter an account name up to 160 characters.');if(state.accounts.some(a=>a.id!==account.id&&a.name.toLowerCase()===value.toLowerCase()))throw Error('An account already has this name.');}
  else if(key==='type'){if(!['Cash','Bank','Savings','Credit card','Investment'].includes(value))throw Error('Choose an account type.');}
  else if(key==='openingBalance'){if(!value.trim()||!Number.isFinite(Number(value)))throw Error('Enter a valid opening balance.');value=Number(value);}
  else return;
  account[key]=value;if(key==='type')for(const item of state.netWorth.items.filter(i=>i.source==='account'&&i.accountId===account.id)){item.side=value==='Credit card'?'liability':'asset';item.group=value==='Credit card'?'Credit Cards':value==='Investment'?'Investments':'Cash & Bank Accounts';}commit('Account saved');return;
 }

 if(el.dataset?.budgetSetting){saveBudgetPreference(el.dataset.budgetSetting,el.value);return;}
 if(el.name==='participant-mode'){if(!['single','multiple'].includes(el.value))return;state.settings.participantMode=el.value;filter.person='All';filter.page=0;commit('Participant settings saved');return;}
 if(el.id==='primary-participant'){if(!state.people.some(p=>p.id===el.value))return;state.settings.primaryPersonId=el.value;commit('Participant saved');return;}
 if(el.dataset.filter){filter[el.dataset.filter]=el.value;filter.page=0;render();return;}
 if(el.dataset.paid){setPaymentPaid(el.dataset.paid,el.checked);commit(el.checked?'Payment marked as paid':'Payment marked as unpaid');return;}
 if(el.dataset.plan){const n=Number(el.value);if(!Number.isFinite(n)||n<0)throw Error('Enter a non-negative budget amount.');let p=state.monthlyBudgets.find(p=>p.month===currentMonth());if(!p){p=structuredClone(E.monthlyPlan(state,currentMonth()));state.monthlyBudgets.push(p);}p.categoryPlans[el.dataset.plan]=n;commit('Monthly plan updated');return;}
 if(el.dataset.netItem&&state.netWorth.items.find(i=>i.id===el.dataset.netItem)?.source==='account')return;
 if(el.dataset.netItem){const n=el.value===''?null:Number(el.value);if(n!==null&&!Number.isFinite(n))throw Error('Enter a valid balance.');const item=state.netWorth.items.find(i=>i.id===el.dataset.netItem);item.balances[el.dataset.netMonth]=n;commit('Monthly balance saved');return;}
 if(el.dataset.debtAdjustment){const n=Number(el.value);if(!Number.isFinite(n)||n+state.debtPlan.extraMonthlyPayment<0)throw Error('The adjustment cannot make the extra payment negative.');state.debtPlan.monthlyAdjustments[el.dataset.debtAdjustment]=n;commit('Debt projection updated');return;}
 if(el.id==='debt-strategy'){if(!['Snowball','Avalanche','Custom'].includes(el.value))return;state.debtPlan.strategy=el.value;commit('Strategy updated');return;}
 if(el.id==='week-start'){state.settings.weekStartsOn=el.value;commit('Calendar updated');}
 }catch(e){toast(e.message);render();}}
$('#editor-form').addEventListener('submit',event=>{event.preventDefault();if(!dialogSave)return;try{dialogSave(new FormData(event.currentTarget));closeDialog();commit();}catch(e){$('#form-error').textContent=e.message;}});
$('#close-dialog').addEventListener('click',closeDialog);$('#cancel-dialog').addEventListener('click',closeDialog);$('#editor').addEventListener('cancel',()=>{dialogSave=null;});
let searchTimer;document.addEventListener('input',event=>{if(event.target.id!=='transaction-search')return;filter.search=event.target.value;filter.page=0;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{const pos=event.target.selectionStart;render();const input=$('#transaction-search');input?.focus();input?.setSelectionRange(pos,pos);},180);});
$('#import-file').addEventListener('change',async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;try{if(file.size>20*1024*1024)throw Error('Choose a budget export smaller than 20 MB.');const imported=JSON.parse(await file.text());validateBudgetImport(imported);confirmAction('Import this budget?',`${file.name} will replace your current budget. Export your current data first if you need to keep it.`,()=>{protectBudget('Before restoring a backup');E.migrateNetWorthToManual(imported);state=imported;storageIssue='';storageLoadFailed=false;storeTime(BACKUP_KEY);});}catch(e){toast('Import failed: '+e.message);}});
/* IMPORT VALIDATION — reject malformed data before modifying the current state. */
function validateBudgetImport(s){
 validateState(s);const fail=message=>{throw Error(message);},finite=(n,label)=>{if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e15)fail('Invalid number: '+label);},str=(x,label)=>{if(typeof x!=='string'||x.length>10000)fail('Invalid text: '+label);},validDate=(d,label,optional=false)=>{if(optional&&d===null)return;try{if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||d<'1900-01-01'||d>'2200-12-31'||new Date(d+'T12:00Z').toISOString().slice(0,10)!==d)fail('Invalid date: '+label);}catch(e){fail('Invalid date: '+label);}},arr=(name)=>{if(!Array.isArray(s[name]))fail('Missing '+name);const ids=new Set();for(const r of s[name]){if(!r||typeof r!=='object'||typeof r.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(r.id)||ids.has(r.id))fail('Invalid or duplicate ID in '+name);ids.add(r.id);}return ids;};
 const initialDate=E.firstTransactionDate(s)||E.today();if(s.settings.startYear===undefined)s.settings.startYear=Number(initialDate.slice(0,4));if(s.settings.startMonth===undefined)s.settings.startMonth=Number(initialDate.slice(5,7));
 if(!Number.isInteger(s.settings.startYear)||s.settings.startYear<1900||s.settings.startYear>2199||!Number.isInteger(s.settings.startMonth)||s.settings.startMonth<1||s.settings.startMonth>12)fail('Invalid budget period.');str(s.settings.currencySymbol,'currency');if(!s.settings.currencySymbol||s.settings.currencySymbol.length>8)fail('Invalid currency symbol.');if(!['Sunday','Monday'].includes(s.settings.weekStartsOn))fail('Invalid week start.');
 const people=arr('people'),accounts=arr('accounts'),cats=arr('categories');arr('recurringRules');arr('variableTransactions');arr('savingsGoals');
 for(const p of s.people)str(p.name,'person');for(const a of s.accounts){str(a.name,'account');finite(a.openingBalance,'opening balance');finite(a.adjustment,'adjustment');validDate(a.lastChecked,'last checked',true);}
 if(s.transfers!==undefined){arr('transfers');for(const t of s.transfers){validDate(t.date,'transfer date');finite(t.amount,'transfer amount');if(t.amount<=0||t.fromAccountId===t.toAccountId||!accounts.has(t.fromAccountId)||!accounts.has(t.toAccountId))fail('Invalid transfer accounts or amount.');str(t.note||'','transfer note');}}
 for(const a of s.accounts){if(a.openingDate!=null)validDate(a.openingDate,'account opening');if(a.adjustmentEntries!==undefined){if(!Array.isArray(a.adjustmentEntries))fail('Invalid account adjustments.');for(const e of a.adjustmentEntries){validDate(e.date,'adjustment date');finite(e.amount,'dated adjustment');}if(Math.abs(E.sum(a.adjustmentEntries,e=>e.amount)-a.adjustment)>0.000001)fail('Inconsistent adjustment total.');}}
 const linked=new Set();for(const item of s.netWorth.items){if(item.source!==undefined&&!['manual','account'].includes(item.source))fail('Invalid net worth source.');if(item.source==='account'){if(!accounts.has(item.accountId)||linked.has(item.accountId))fail('Unknown or duplicate linked account.');linked.add(item.accountId);}}
 for(const c of s.categories){str(c.name,'category');if(!E.TYPES.includes(c.type)||c.type!=='Income'&&!['Needs','Wants','Debt & Savings'].includes(c.budgetGroup))fail('Invalid category type or group.');}
 const transaction=(t)=>{if(!E.TYPES.includes(t.type)||!cats.has(t.categoryId)||s.categories.find(c=>c.id===t.categoryId).type!==t.type)fail('Unknown or mismatched category.');if(t.accountId!==null&&!accounts.has(t.accountId)||t.personId!==null&&!people.has(t.personId))fail('Unknown account or person.');finite(t.amount,'transaction amount');if(t.amount<0)fail('Transaction amount cannot be negative.');str(t.description||'','description');};
 for(const t of s.variableTransactions){transaction(t);validDate(t.date,'transaction');}for(const r of s.recurringRules){transaction(r);validDate(r.firstDate,'first payment');validDate(r.lastDate,'last payment',true);if(!E.STEPS[r.frequency]||r.lastDate&&r.lastDate<r.firstDate)fail('Invalid recurring schedule.');}
 if(!s.paymentOverrides||typeof s.paymentOverrides!=='object'||Array.isArray(s.paymentOverrides))fail('Invalid payment overrides.');for(const [id,o] of Object.entries(s.paymentOverrides)){if(!/^[a-zA-Z0-9_-]+:\d{4}-\d{2}-\d{2}$/.test(id)||!o||typeof o.paid!=='boolean')fail('Invalid payment ID or paid flag.');validDate(o.date,'adjusted date',true);if(o.amount!==null){finite(o.amount,'adjusted amount');if(o.amount<0)fail('Negative payment amount.');}if(o.accountId!==null&&!accounts.has(o.accountId)||o.personId!==null&&!people.has(o.personId))fail('Unknown override account or person.');str(o.note||'','payment note');if(o.snapshot){transaction(o.snapshot);validDate(o.snapshot.date,'payment snapshot');}}
 if(!Array.isArray(s.monthlyBudgets))fail('Missing monthly plans.');const planMonths=new Set();for(const p of s.monthlyBudgets){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)||planMonths.has(p.month)||typeof p.includeOpeningBalance!=='boolean')fail('Invalid monthly plan.');planMonths.add(p.month);if(p.includeRollover!==undefined&&typeof p.includeRollover!=='boolean')fail('Invalid rollover setting.');finite(p.plannedOpeningBalance,'planned opening balance');finite(p.actualOpeningBalance,'actual opening balance');if(!p.categoryPlans||typeof p.categoryPlans!=='object')fail('Invalid category plans.');for(const [id,n] of Object.entries(p.categoryPlans)){if(!cats.has(id))fail('Unknown planned category.');finite(n,'category plan');if(n<0)fail('Negative category plan.');}}
 for(const g of s.savingsGoals){if(!cats.has(g.categoryId)||s.categories.find(c=>c.id===g.categoryId).type!=='Savings')fail('Invalid savings category.');finite(g.startingAmount,'starting saved');finite(g.goalAmount,'goal');validDate(g.startDate,'savings start',true);validDate(g.targetDate,'savings target',true);if(g.startingAmount<0||g.goalAmount<0||g.startDate&&g.targetDate&&g.targetDate<g.startDate)fail('Invalid savings goal.');}
 const p=s.debtPlan;if(p&&p.useActualPayments!==undefined&&typeof p.useActualPayments!=='boolean')fail('Invalid debt payment source.');if(!p||!Array.isArray(p.debts)||!p.monthlyAdjustments||!['Snowball','Avalanche','Custom'].includes(p.strategy))fail('Invalid debt plan.');validDate(p.startDate,'debt start');finite(p.extraMonthlyPayment,'extra payment');if(p.extraMonthlyPayment<0)fail('Negative extra payment.');const debtIds=new Set();for(const d of p.debts){if(typeof d.id!=='string'||debtIds.has(d.id)||!cats.has(d.categoryId)||s.categories.find(c=>c.id===d.categoryId).type!=='Debt')fail('Invalid debt.');debtIds.add(d.id);for(const key of ['startingBalance','minimumPayment','annualRate','priority']){finite(d[key],key);if(d[key]<0)fail('Negative debt parameter.');}if(d.annualRate>10)fail('Invalid interest rate.');}for(const [m,n] of Object.entries(p.monthlyAdjustments)){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m))fail('Invalid adjustment month.');finite(n,'debt adjustment');if(n+p.extraMonthlyPayment<0)fail('Negative extra payment after adjustment.');}
 const a=s.allocationPlan;if(!a||!a.shares)fail('Missing allocation plan.');validDate(a.startDate,'allocation start');validDate(a.endDate,'allocation end');if(a.endDate<a.startDate)fail('Invalid allocation dates.');for(const g of ['Needs','Wants','Debt & Savings']){finite(a.shares[g],'allocation');if(a.shares[g]<0||a.shares[g]>1)fail('Invalid allocation share.');}if(Math.abs(E.sum(Object.values(a.shares))-1)>1e-8)fail('Allocation must total 100%.');
 if(!s.netWorth||!Array.isArray(s.netWorth.items))fail('Missing net worth.');finite(s.netWorth.goal,'net worth goal');const netIds=new Set();for(const i of s.netWorth.items){if(typeof i.id!=='string'||netIds.has(i.id)||!['asset','liability'].includes(i.side)||!i.balances)fail('Invalid net worth item.');netIds.add(i.id);str(i.name,'net worth name');str(i.group,'net worth group');for(const [m,n] of Object.entries(i.balances)){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m))fail('Invalid snapshot month.');if(n!==null)finite(n,'snapshot balance');}}
 if(s.settings.participantMode!==undefined&&!['single','multiple'].includes(s.settings.participantMode))fail('Invalid participant mode.');
 if(s.settings.currencyPosition!==undefined&&!['before','after'].includes(s.settings.currencyPosition))fail('Invalid currency position.');
 if(s.settings.budgetName!==undefined)str(s.settings.budgetName,'budget name');
 if(!s.viewPreferences)s.viewPreferences={monthIndex:0,annualSeries:'Debt'};if(!Number.isInteger(s.viewPreferences.monthIndex)||s.viewPreferences.monthIndex<0||s.viewPreferences.monthIndex>11)s.viewPreferences.monthIndex=0;if(s.viewPreferences.reportYear!==undefined&&(!Number.isInteger(s.viewPreferences.reportYear)||s.viewPreferences.reportYear<1900||s.viewPreferences.reportYear>2199))delete s.viewPreferences.reportYear;if(!E.TYPES.includes(s.viewPreferences.annualSeries))s.viewPreferences.annualSeries='Debt';return s;
}
/* Paid occurrence identities survive rule edits and reordering. */
try{validateBudgetImport(state);}catch(error){storageLoadFailed=true;storageIssue='This saved budget needs repair: '+error.message;state=structuredClone(window.BUDGET_DEMO);}
if(E.migrateNetWorthToManual(state))saveState();
freezePaid();
render();
/* WEBMCP — progressive enhancement, uses the same UI actions and state. */
if(document.modelContext?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});const tools=[{name:'get_budget_summary',description:'Read the annual financial summary from the current local budget.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(){const a=E.calculateAnnualSummary(state);return {period:[E.months(state)[0]+'-01',E.end(state)],totals:a.totals,cashFlow:a.cashFlow,leftToSpend:a.leftToSpend};}},{name:'start_transaction_creation',description:'Open the add transaction form. Does not save a transaction.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(){transactionForm('variable');return {status:'form_opened'};}},{name:'set_payment_paid',description:'Mark a specific recurring occurrence paid or unpaid and update all financial reports.',inputSchema:{type:'object',properties:{occurrenceId:{type:'string'},paid:{type:'boolean'}},required:['occurrenceId','paid'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||typeof input.occurrenceId!=='string'||typeof input.paid!=='boolean')throw Error('occurrenceId and paid are required.');setPaymentPaid(input.occurrenceId,input.paid);commit();return {occurrenceId:input.occurrenceId,paid:input.paid};}}];for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch(e){}}

function addBudgetMonthForm(){
 openDialog('Add month',formGrid(selectField('Month','month',Array.from({length:12},(_,i)=>({id:String(i+1).padStart(2,'0'),name:new Date(Date.UTC(2026,i,1)).toLocaleDateString('en-US',{month:'long',timeZone:'UTC'})})),currentMonth().slice(5,7))+inputField('Year','year',currentMonth().slice(0,4),'number','min="1900" max="2199" step="1" required'))+'<p class="help-text">Choose a month to start planning. If it already exists, its saved plan will open.</p>',data=>{
  const month=String(data.get('year')||'').trim()+'-'+String(data.get('month')||'');
  if(typeof month!=='string'||!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Choose a valid month and year.');
  let plan=state.monthlyBudgets.find(p=>p.month===month);
  if(!plan){plan=structuredClone(E.monthlyPlan(state,month));state.monthlyBudgets.push(plan);}
  plan.created=true;
  state.viewPreferences.reportYear=Number(month.slice(0,4));
  state.viewPreferences.monthIndex=Number(month.slice(5,7))-1;
 });
}

function categoryPlanForm(categoryId){
 const category=state.categories.find(c=>c.id===categoryId);if(!category)return;
 const month=currentMonth(),amount=E.monthlyPlan(state,month).categoryPlans[categoryId]||0;
 openDialog('Edit plan',`<p class="help-text">${esc(category.name)} · ${longMonth(month)}</p>`+formGrid(numberField('Planned amount','amount',amount,'min="0" required')),data=>{
  const value=readNumber(data,'amount');if(value<0)throw Error('Enter a non-negative budget amount.');
  let plan=state.monthlyBudgets.find(p=>p.month===month);
  if(!plan){plan=structuredClone(E.monthlyPlan(state,month));state.monthlyBudgets.push(plan);}
  plan.categoryPlans[categoryId]=value;
 });
}

function netWorthBalanceForm(itemId,month){
 const item=state.netWorth.items.find(i=>i.id===itemId);
 if(!item||item.source==='account'||!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month))return;
 openDialog('Edit balance',`<p class="help-text">${esc(item.name)} · ${longMonth(month)}</p>`+formGrid(numberField('Balance','balance',item.balances[month]??'',''))+'<p class="help-text">Leave blank to remove this month’s value. Enter 0 to record a zero balance.</p>',data=>{
  const value=readNumber(data,'balance',true);
  item.balances[month]=value;
 });
}

function copyPreviousMonthPlan(){
 const targetMonth=currentMonth(),sourceMonth=E.addMonths(targetMonth+'-01',-1).slice(0,7);
 const source=state.monthlyBudgets.find(p=>p.month===sourceMonth);
 const entries=Object.entries(source?.categoryPlans||{}).filter(([id])=>state.categories.some(c=>c.id===id));
 if(!entries.length){toast('No category plan saved for '+longMonth(sourceMonth)+'.');return;}
 const copied=Object.fromEntries(entries);
 const totals=E.TYPES.map(type=>({type,total:E.sum(state.categories.filter(c=>c.type===type),c=>copied[c.id]||0)}));
 openDialog('Copy previous month',`<p class="explain">Copy the category plan from <b>${longMonth(sourceMonth)}</b> to <b>${longMonth(targetMonth)}</b>?</p><div class="table-wrap"><table><thead><tr><th>Type</th><th>Plan to copy</th></tr></thead><tbody>${totals.map(t=>`<tr><td>${t.type}</td><td>${money(t.total)}</td></tr>`).join('')}</tbody></table></div><p class="help-text">Save changes replaces all category plans for ${longMonth(targetMonth)}. Actual transactions and rollover settings stay unchanged.</p>`,()=>{
  let target=state.monthlyBudgets.find(p=>p.month===targetMonth);
  if(!target){target=structuredClone(E.monthlyPlan(state,targetMonth));state.monthlyBudgets.push(target);}
  target.categoryPlans=structuredClone(copied);target.created=true;
 });
}

/* Row activation must never intercept its independent controls or text selection. */
function activateTransactionRow(event){
 const row=event.target.closest('[data-row-action]');if(!row)return;
 if(event.target.closest('button,input,select,textarea,label,a,[popover]'))return;
 if(event.type==='keydown'){if(event.target!==row||!['Enter',' '].includes(event.key))return;event.preventDefault();}
 else if(window.getSelection()?.toString())return;
 handleAction(row.dataset.rowAction,row.dataset.rowId);
}
document.addEventListener('click',activateTransactionRow);
document.addEventListener('keydown',activateTransactionRow);
window.addEventListener('scroll',()=>document.querySelectorAll('.row-actions-popover:popover-open').forEach(menu=>menu.hidePopover()),{passive:true});

window.addEventListener('resize',()=>document.querySelectorAll('.row-actions-popover:popover-open').forEach(menu=>menu.hidePopover()));
