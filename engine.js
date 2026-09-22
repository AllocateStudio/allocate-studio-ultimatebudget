/* APP CONFIG · UTILITIES · CALCULATIONS · RECURRING ENGINE · PAYMENT ENGINE */
(function(root){
  'use strict';
  const TYPES=['Income','Bills','Expenses','Debt','Savings'];
  const STEPS={'Every Week':7,'Every 2 Weeks':14,'Every 4 Weeks':28,'Every Month':-1,'Every 2 Months':-2,'Every 3 Months':-3,'Every 6 Months':-6,'Every Year':-12};
  const sum=(a,fn=x=>x)=>a.reduce((n,x)=>n+Number(fn(x)||0),0);
  const date=s=>new Date(s+'T12:00:00Z');
  const iso=d=>d.toISOString().slice(0,10);
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function addMonths(s,n){const d=date(s),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,end));return iso(d);}
  function addDays(s,n){const d=date(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);}
  function firstTransactionDate(s){
    const dates=[...(s.variableTransactions||[]).map(t=>t.date),...(s.recurringRules||[]).map(t=>t.firstDate)];
    for(const [id,o] of Object.entries(s.paymentOverrides||{}))if(o.paid)dates.push(o.date||o.snapshot?.date||id.slice(-10));
    return dates.filter(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0]||null;
  }
  const start=s=>`${s.settings.startYear}-${String(s.settings.startMonth).padStart(2,'0')}-01`;
  const periodStart=s=>Number.isInteger(s.viewPreferences?.reportYear)?`${s.viewPreferences.reportYear}-01-01`:start(s);
  const months=s=>Array.from({length:12},(_,i)=>addMonths(periodStart(s),i).slice(0,7));
  const end=s=>addDays(addMonths(periodStart(s),12),-1);
  function fullMonths(a,b){if(!a||!b||b<a)return null;const x=date(a),y=date(b);return (y.getUTCFullYear()-x.getUTCFullYear())*12+y.getUTCMonth()-x.getUTCMonth()-(y.getUTCDate()<x.getUTCDate()?1:0);}
  const category=(s,id)=>s.categories.find(c=>c.id===id);
  function generateRecurringTransactions(s,from=periodStart(s),to=end(s)){
    const result=[];
    for(const rule of s.recurringRules){
      const step=STEPS[rule.frequency];if(!step||!rule.firstDate)continue;
      const stop=rule.lastDate&&rule.lastDate<to?rule.lastDate:to;
      let n=0;
      // Jump close to the budget period; dates always anchor to the original first date.
      if(rule.firstDate<from){const a=date(rule.firstDate),b=date(from);n=step>0?Math.max(0,Math.floor((b-a)/86400000/step)-1):Math.max(0,Math.floor(((b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth())/(-step))-1);}
      for(;n<100000;n++){
        const day=step>0?addDays(rule.firstDate,n*step):addMonths(rule.firstDate,n*(-step));if(day>stop)break;
        if(day<from)continue;
        result.push({id:`${rule.id}:${day}`,ruleId:rule.id,date:day,type:rule.type,categoryId:rule.categoryId,amount:rule.amount,accountId:rule.accountId,personId:rule.personId,description:rule.description});
      }
    }
    return result.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  }
  function calculatePayments(s,asOf=today()){
    const generated=generateRecurringTransactions(s),ids=new Set(generated.map(p=>p.id));
    for(const [id,o] of Object.entries(s.paymentOverrides)){
      if(ids.has(id))continue;
      if(o.paid&&o.snapshot){generated.push({...o.snapshot,id});continue;}
      if(!o.paid&&!(o.date&&o.date>=periodStart(s)&&o.date<=end(s)))continue;
      const day=id.slice(-10),ruleId=id.slice(0,-11),rule=s.recurringRules.find(r=>r.id===ruleId);
      if(rule&&/^\d{4}-\d{2}-\d{2}$/.test(day)){
        const occurrence=generateRecurringTransactions({...s,recurringRules:[rule]},day,day).find(p=>p.id===id);
        if(occurrence)generated.push(occurrence);
      }
    }
    return generated.map(p=>{
      const o=s.paymentOverrides[p.id]||{},base=o.paid&&o.snapshot?o.snapshot:p;
      const effective={...base,id:p.id,date:o.date??base.date,amount:o.amount??base.amount,accountId:o.accountId??base.accountId,personId:o.personId??base.personId,paid:!!o.paid,note:o.note||'',base};
      effective.status=effective.paid?'Paid':effective.date<asOf?'Overdue':'Upcoming';
      return effective;
    }).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  }
  function actualTransactions(s,payments=calculatePayments(s)){return [...payments.filter(p=>p.paid).map(p=>({...p,source:'recurring'})),...s.variableTransactions.filter(t=>t.date).map(t=>({...t,source:'variable'}))];}
  function monthlyPlan(s,month){return s.monthlyBudgets.find(p=>p.month===month)||{month,includeOpeningBalance:false,plannedOpeningBalance:0,actualOpeningBalance:0,categoryPlans:{}};}
  // A month with rollover disabled starts a new chain; its own cash flow can roll forward.
  function monthlyRollover(s,month,actual=actualTransactions(s)){
    if(monthlyPlan(s,month).includeRollover===false)return 0;
    const reset=s.monthlyBudgets.filter(p=>p.month<month&&p.includeRollover===false).map(p=>p.month).sort().at(-1)||'';
    return Number(sum(actual.filter(t=>t.date.slice(0,7)<month&&t.date.slice(0,7)>=reset),t=>t.type==='Income'?t.amount:-t.amount).toFixed(2));
  }
  function calculateMonthlySummary(s,month,actual=actualTransactions(s),withRollover=true){
    const tx=actual.filter(t=>t.date.slice(0,7)===month),plan=monthlyPlan(s,month),groups={};
    for(const type of TYPES)groups[type]={actual:sum(tx.filter(t=>t.type===type),t=>t.amount),expected:sum(s.categories.filter(c=>c.type===type),c=>plan.categoryPlans[c.id]||0)};
    const spending=sum(TYPES.slice(1),t=>groups[t].actual),plannedSpending=sum(TYPES.slice(1),t=>groups[t].expected),rollover=withRollover?monthlyRollover(s,month,actual):0;
    return {month,groups,transactions:tx,plan,rollover,income:groups.Income.actual,spending,balance:groups.Income.actual-spending+rollover,cashFlow:groups.Income.actual-spending,expectedBalance:groups.Income.expected-plannedSpending+rollover,plannedSpending,budgetUsed:plannedSpending?spending/plannedSpending:null};
  }
  function calculateAnnualSummary(s){
    const actual=actualTransactions(s),rows=months(s).map(m=>calculateMonthlySummary(s,m,actual,false)),totals={};
    for(const t of TYPES)totals[t]=sum(rows,r=>r.groups[t].actual);
    let running=0;rows.forEach(r=>{r.runningBalance=running+=r.cashFlow;});
    const income=totals.Income,spending=sum(TYPES.slice(1),t=>totals[t]);
    return {rows,totals,income,spending,cashFlow:income-spending,leftToSpend:sum(rows,r=>r.expectedBalance-r.balance),actual};
  }
  function dailyBalances(s,month,actual=actualTransactions(s)){
    const m=calculateMonthlySummary(s,month,actual),last=addDays(addMonths(month+'-01',1),-1);let balance=m.rollover;const rows=[];
    for(let d=month+'-01';d<=last;d=addDays(d,1)){const tx=m.transactions.filter(t=>t.date===d),income=sum(tx.filter(t=>t.type==='Income'),t=>t.amount),out=sum(tx.filter(t=>t.type!=='Income'),t=>t.amount);balance+=income-out;rows.push({date:d,income,spending:out,balance});}return rows;
  }
  function calculateAccountBalances(s,asOf=null){const actual=actualTransactions(s);return s.accounts.map(a=>{
    const from=a.openingDate||'1900-01-01',to=asOf||'2200-12-31',tx=actual.filter(t=>t.accountId===a.id&&t.date>=from&&t.date<=to),transfers=(s.transfers||[]).filter(t=>t.date>=from&&t.date<=to);
    const deposits=sum(tx.filter(t=>t.type==='Income'),t=>t.amount),withdrawals=sum(tx.filter(t=>t.type!=='Income'),t=>t.amount),transfersIn=sum(transfers.filter(t=>t.toAccountId===a.id),t=>t.amount),transfersOut=sum(transfers.filter(t=>t.fromAccountId===a.id),t=>t.amount);
    const adjustments=a.adjustmentEntries?sum(a.adjustmentEntries.filter(e=>e.date<=to&&e.date>=from),e=>e.amount):(to>=(a.lastChecked||a.openingDate||start(s))?a.adjustment:0);
    return {...a,deposits,withdrawals,transfersIn,transfersOut,adjustment:adjustments,currentBalance:to<from?0:a.openingBalance+deposits-withdrawals+transfersIn-transfersOut+adjustments};
  });}
  function linkedNetWorthSnapshot(s,asOf=today()){
    const connected=s.netWorth.items.some(i=>i.source==='account'),ms=months(s);
    const accountMonths=Object.fromEntries(ms.filter(m=>m<=asOf.slice(0,7)).map(m=>[m,calculateAccountBalances(s,m===asOf.slice(0,7)?asOf:addDays(addMonths(m+'-01',1),-1))]));
    return s.netWorth.items.map(i=>{
      if(i.source==='account'){
        const account=s.accounts.find(a=>a.id===i.accountId);
        return {...i,name:account?.name||i.name,balances:Object.fromEntries(ms.map(m=>{const a=accountMonths[m]?.find(a=>a.id===i.accountId);return [m,a?(i.side==='liability'?-a.currentBalance:a.currentBalance):null];}))};
      }
      if(!connected)return i;
      return {...i,balances:Object.fromEntries(ms.map(m=>{const latest=Object.keys(i.balances).filter(k=>k<=m&&i.balances[k]!=null).sort().at(-1);return [m,m>asOf.slice(0,7)?null:latest?i.balances[latest]:null];}))};
    });
  }
  function migrateNetWorthToManual(s){
    if(!s.netWorth.items.some(i=>i.source==='account'))return false;
    const snapshots=linkedNetWorthSnapshot(s);
    for(const item of s.netWorth.items)if(item.source==='account'){
      const snapshot=snapshots.find(i=>i.id===item.id);
      item.balances={...item.balances,...Object.fromEntries(Object.entries(snapshot.balances).filter(([,v])=>v!==null))};item.name=snapshot.name;item.source='manual';delete item.accountId;
    }
    return true;
  }
  function netWorthItems(s){return s.netWorth.items;}
  function calculateSavingsProgress(s,asOf=today()){
    const actual=actualTransactions(s);return s.savingsGoals.map(g=>{const saved=g.startingAmount+sum(actual.filter(t=>t.categoryId===g.categoryId),t=>t.amount),duration=fullMonths(g.startDate,g.targetDate);return {...g,saved,remaining:g.goalAmount-saved,progress:g.goalAmount?saved/g.goalAmount:null,saveMonthly:duration===null?null:(g.goalAmount-g.startingAmount)/Math.max(1,duration),monthsLeft:fullMonths(asOf,g.targetDate)};});
  }
  function calculate503020(s){const p=s.allocationPlan,month=months(s)[s.viewPreferences?.monthIndex||0],tx=actualTransactions(s).filter(t=>t.date.slice(0,7)===month&&t.type!=='Income');const groups=Object.keys(p.shares).map(name=>{const cats=s.categories.filter(c=>c.budgetGroup===name&&c.type!=='Income').map(c=>({...c,actual:sum(tx.filter(t=>t.categoryId===c.id),t=>t.amount)}));return {name,actual:sum(cats,c=>c.actual),categories:cats.filter(c=>c.actual!==0),share:p.shares[name]};});const total=sum(groups,g=>g.actual);return {groups:groups.map(g=>({...g,expected:total*g.share,actualShare:total?g.actual/total:null})),total};}
  function calculateDebtPayoff(s,asOf=today()){
    const p=s.debtPlan,useActual=p.useActualPayments!==false,currentMonth=asOf.slice(0,7),debts=p.debts.filter(d=>d.startingBalance>0).slice().sort((a,b)=>p.strategy==='Avalanche'?b.annualRate-a.annualRate:p.strategy==='Custom'?a.priority-b.priority:a.startingBalance-b.startingBalance);
    const paidByMonth=new Map();
    if(useActual)for(const t of actualTransactions(s))if(t.type==='Debt'&&t.date>=p.startDate&&t.date.slice(0,7)<currentMonth){const key=t.categoryId+':'+t.date.slice(0,7);paidByMonth.set(key,(paidByMonth.get(key)||0)+t.amount);}
    let balances=debts.map(d=>d.startingBalance);const rows=[];
    for(let i=0;i<372&&debts.length;i++){
      const date=addMonths(p.startDate,i),month=date.slice(0,7),isActual=useActual&&month<currentMonth,adjustment=isActual?0:p.monthlyAdjustments[month]||0;let carry=p.extraMonthlyPayment+adjustment;
      const detail=debts.map((d,j)=>{
        const before=balances[j],available=Math.max(0,d.minimumPayment+carry),payment=isActual?(paidByMonth.get(d.categoryId+':'+month)||0):Math.min(before,available),remaining=Math.max(0,before-payment),interest=remaining*d.annualRate/12;
        balances[j]=remaining+interest;
        if(!isActual)carry=balances[j]<=0?available-payment:0;
        return {id:d.id,before,payment,interest,balance:balances[j]};
      });
      rows.push({date,detail,payment:sum(detail,d=>d.payment),interest:sum(detail,d=>d.interest),balance:sum(balances),adjustment,isActual});
      if(balances.every(b=>b<1e-8)&&(!isActual||addMonths(date,1).slice(0,7)>=currentMonth))break;
    }
    const current=rows.find(r=>r.date.slice(0,7)===currentMonth),paidOff=rows.length&&rows.at(-1).balance<1e-8,payoffRow=paidOff?rows.find((r,i)=>r.balance<1e-8&&rows.slice(i).every(x=>x.balance<1e-8)):null;
    return {debts,rows,useActual,total:sum(debts,d=>d.startingBalance),currentBalance:current?current.balance:currentMonth<p.startDate.slice(0,7)?sum(debts,d=>d.startingBalance):rows.at(-1)?.balance??0,payoffDate:payoffRow?.date||null,interest:sum(rows,r=>r.interest)};
  }
  function calculateNetWorth(s,asOf=today()){
    const items=netWorthItems(s,asOf),connected=items.some(i=>i.source==='account'),rows=months(s).map(month=>{const future=connected&&month>asOf.slice(0,7),assets=future?null:sum(items.filter(i=>i.side==='asset'),i=>i.balances[month]),liabilities=future?null:sum(items.filter(i=>i.side==='liability'),i=>i.balances[month]);return {month,assets,liabilities,netWorth:future?null:assets-liabilities};});
    const last=rows.filter(r=>r.month<=asOf.slice(0,7)).at(-1),lastAssets=connected?last:rows.filter(r=>items.some(i=>i.side==='asset'&&i.balances[r.month]!=null)).at(-1),lastLiabilities=connected?last:rows.filter(r=>items.some(i=>i.side==='liability'&&i.balances[r.month]!=null)).at(-1),assets=lastAssets?.assets||0,liabilities=lastLiabilities?.liabilities||0;
    return {items,rows,connected,assets,liabilities,netWorth:assets-liabilities,goal:s.netWorth.goal,remaining:s.netWorth.goal-(assets-liabilities),assetsMonth:lastAssets?.month,liabilitiesMonth:lastLiabilities?.month};
  }
  root.BudgetEngine={firstTransactionDate,TYPES,STEPS,sum,today,addMonths,addDays,start,end,months,fullMonths,category,generateRecurringTransactions,calculatePayments,actualTransactions,monthlyPlan,monthlyRollover,calculateMonthlySummary,calculateAnnualSummary,dailyBalances,calculateAccountBalances,netWorthItems,migrateNetWorthToManual,calculateSavingsProgress,calculate503020,calculateDebtPayoff,calculateNetWorth};
})(typeof window!=='undefined'?window:globalThis);
