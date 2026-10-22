'use strict';
const STORE='trade_analytics_v1';
let state=loadState();
let editingTradeId=null;
let accountMode='new';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const uid=()=> (crypto.randomUUID ? crypto.randomUUID() : 'id_'+Date.now()+'_'+Math.random().toString(36).slice(2));
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(Number(n)||0);
const numfmt=(n,d=2)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(n)||0);
const pct=n=>`${numfmt(n,2)}%`;
const cls=n=>n>0?'pos':n<0?'neg':'';
const safeDiv=(a,b)=>b? a/b : 0;

function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(STORE));
    if(s && s.accounts) return s;
  }catch(e){}
  return {accounts:{},selectedAccountId:null};
}
function saveState(){ localStorage.setItem(STORE,JSON.stringify(state)); }
function account(){ return state.accounts[state.selectedAccountId]||null; }
function toast(msg){
  const t=$('#toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),3600);
}
function renderAccountSelect(){
  const s=$('#accountSelect');
  const arr=Object.values(state.accounts);
  if(!arr.length){s.innerHTML='<option value="">Nenhuma conta</option>';s.disabled=true;return}
  s.disabled=false;s.innerHTML=arr.map(a=>`<option value="${esc(a.id)}" ${a.id===state.selectedAccountId?'selected':''}>${esc(a.name)}</option>`).join('');
}
function assetKey(symbol){
  const raw=String(symbol||'').trim().toUpperCase();
  const suffix=(raw.includes(':')?raw.split(':').pop():raw).trim();
  if(/^MNQ/.test(suffix)) return 'MNQ';
  return suffix||'—';
}
function dateOnly(v){
  const d=new Date(v); if(isNaN(d))return '';
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function analysisFilter(a){
  if(!a.analysisFilter)a.analysisFilter={asset:'',start:'',end:''};
  return a.analysisFilter;
}
function filteredAnalysisTrades(a){
  const f=analysisFilter(a);
  return a.trades.filter(t=>{
    if(f.asset && assetKey(t.symbol)!==f.asset)return false;
    const d=new Date(t.entryTime||t.exitTime);
    if(isNaN(d))return !f.start&&!f.end;
    if(f.start){
      const start=new Date(f.start+'T00:00:00');
      if(d<start)return false;
    }
    if(f.end){
      const end=new Date(f.end+'T23:59:59.999');
      if(d>end)return false;
    }
    return true;
  });
}
function render(){
  renderAccountSelect();
  const a=account(), main=$('#mainContent');
  $('#btnUpload').disabled=!a; $('#btnRenameAccount').disabled=!a;
  if(!a){
    main.innerHTML=`<div class="empty"><b>Crie sua primeira conta</b>Depois, importe o CSV do histórico de negociações para gerar toda a análise.</div>`;
    return;
  }
  if(!a.trades.length){
    main.innerHTML=`<div class="empty"><b>${esc(a.name)}</b>Nenhuma operação importada. Clique em <strong>Importar CSV</strong>.</div>`;
    return;
  }
  const filtered=filteredAnalysisTrades(a);
  const m=metrics(filtered);
  main.innerHTML = dashboardHTML(a,m,filtered);
  wireAnalysisFilters();
  wireFilters(filtered);
  if(filtered.length)drawEquity(m.sorted,m);
}

function metrics(trades){
  const sorted=[...trades].sort((a,b)=>new Date(a.exitTime||a.entryTime)-new Date(b.exitTime||b.entryTime));
  const n=sorted.length;
  const net=sorted.reduce((s,t)=>s+(+t.pnl||0),0);
  const fees=sorted.reduce((s,t)=>s+Math.abs(+t.commission||0),0);
  const gross=net+fees;
  const wins=sorted.filter(t=>(+t.pnl||0)>0), losses=sorted.filter(t=>(+t.pnl||0)<0);
  const grossOf=t=>(+t.pnl||0)+Math.abs(+t.commission||0);
  const grossWin=wins.reduce((s,t)=>s+Math.max(0,grossOf(t)),0);
  const grossLoss=Math.abs(losses.reduce((s,t)=>s+Math.min(0,grossOf(t)),0));
  const avgWin=safeDiv(wins.reduce((s,t)=>s+grossOf(t),0),wins.length);
  const avgLoss=safeDiv(losses.reduce((s,t)=>s+grossOf(t),0),losses.length);
  const pf=safeDiv(grossWin,grossLoss);
  const payoff=safeDiv(avgWin,Math.abs(avgLoss));
  const exp=safeDiv(gross,n);

  let equity=0,peak=0,minDD=0,minDDStart=null,minDDEnd=null,peakTime=null;
  let trough=0,maxAdvance=0,advanceStart=null,advanceEnd=null,troughTime=null;
  let posStreak=0,negStreak=0,maxPos=0,maxNeg=0;
  const equityPts=[];
  sorted.forEach(t=>{
    const time=t.exitTime||t.entryTime;
    equity += (+t.pnl||0);
    equityPts.push({time,value:equity});
    if(equity>peak){peak=equity;peakTime=time}
    const dd=equity-peak;
    if(dd<minDD){minDD=dd;minDDStart=peakTime;minDDEnd=time}
    if(equity<trough){trough=equity;troughTime=time}
    const adv=equity-trough;
    if(adv>maxAdvance){maxAdvance=adv;advanceStart=troughTime;advanceEnd=time}
    if((+t.pnl||0)>0){posStreak++;negStreak=0;maxPos=Math.max(maxPos,posStreak)}
    else if((+t.pnl||0)<0){negStreak++;posStreak=0;maxNeg=Math.max(maxNeg,negStreak)}
  });

  const durations=sorted.map(t=>durationMin(t)).filter(Number.isFinite);
  const avgDur=safeDiv(durations.reduce((a,b)=>a+b,0),durations.length);
  const winDur=wins.map(durationMin).filter(Number.isFinite);
  const lossDur=losses.map(durationMin).filter(Number.isFinite);

  const byHour=groupStats(sorted,t=>{
    const d=new Date(t.entryTime);return isNaN(d)?'—':String(d.getHours()).padStart(2,'0')+':00'
  });
  const days=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const byDay=groupStats(sorted,t=>{const d=new Date(t.entryTime);return isNaN(d)?'—':days[d.getDay()]});
  const byDir=groupStats(sorted,t=>t.direction||'—');
  const byAsset=groupStats(sorted,t=>assetKey(t.symbol));
  const byDur=groupStats(sorted,t=>{
    const d=durationMin(t); if(!Number.isFinite(d))return 'Sem duração';
    if(d<10)return 'Menos de 10 min'; if(d<30)return '10–29 min'; if(d<60)return '30–59 min'; if(d<120)return '1–2 h'; return 'Mais de 2 h';
  });
  const best=(arr)=>[...arr].filter(x=>x.key!=='—').sort((a,b)=>b.pnl-a.pnl)[0];
  const worst=(arr)=>[...arr].filter(x=>x.key!=='—').sort((a,b)=>a.pnl-b.pnl)[0];

  const bestTrade=[...sorted].sort((a,b)=>(+b.pnl||0)-(+a.pnl||0))[0];
  const worstTrade=[...sorted].sort((a,b)=>(+a.pnl||0)-(+b.pnl||0))[0];

  return {sorted,n,net,fees,gross,wins,losses,winRate:safeDiv(wins.length,n)*100,pf,payoff,exp,
    avgWin,avgLoss,minDD,minDDStart,minDDEnd,maxAdvance,advanceStart,advanceEnd,maxPos,maxNeg,
    avgDur,avgWinDur:safeDiv(winDur.reduce((a,b)=>a+b,0),winDur.length),avgLossDur:safeDiv(lossDur.reduce((a,b)=>a+b,0),lossDur.length),
    byHour,byDay,byDir,byAsset,byDur,bestHour:best(byHour),worstHour:worst(byHour),bestDay:best(byDay),bestDir:best(byDir),bestDur:best(byDur),
    bestTrade,worstTrade,equityPts,completeDur:durations.length,completeDir:sorted.filter(t=>t.direction==='Compra'||t.direction==='Venda').length
  };
}
function groupStats(trades,keyFn){
  const m=new Map();
  for(const t of trades){
    const k=keyFn(t); if(!m.has(k))m.set(k,{key:k,count:0,wins:0,losses:0,pnl:0});
    const x=m.get(k),p=+t.pnl||0;x.count++;x.pnl+=p;if(p>0)x.wins++;if(p<0)x.losses++;
  }
  return [...m.values()].map(x=>({...x,winRate:safeDiv(x.wins,x.count)*100,avg:safeDiv(x.pnl,x.count)}));
}
function durationMin(t){
  const a=new Date(t.entryTime),b=new Date(t.exitTime);
  if(isNaN(a)||isNaN(b))return NaN;
  return Math.max(0,(b-a)/60000);
}
function durationText(min){
  if(!Number.isFinite(min))return '—';
  const total=Math.round(min*60),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
  return h?`${h}h ${m}min ${s}s`:`${m}min ${s}s`;
}
function dateText(v){
  const d=new Date(v);if(isNaN(d))return '—';
  return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d);
}
function metricCard(label,value,sub,c=''){
  return `<div class="card kpi"><div class="label">${label}</div><div class="value ${c}">${value}</div><div class="sub">${sub}</div></div>`
}
function insight(name,item,sub=''){
  return `<div class="insight-row"><div class="name">${name}</div><div class="main">${item||'—'}${sub?`<small>${sub}</small>`:''}</div></div>`
}
function barsHTML(items,order){
  let arr=[...items];
  if(order) arr.sort(order);
  const max=Math.max(1,...arr.map(x=>Math.abs(x.pnl)));
  return `<div class="bar-list">${arr.map(x=>{
    const w=Math.max(2,Math.abs(x.pnl)/max*100), c=x.pnl>=0?'posbar':'negbar';
    return `<div class="bar-row"><div class="bar-label">${esc(x.key)}</div><div class="bar-track"><div class="bar-fill ${c}" style="width:${w}%"></div></div><div class="bar-meta"><strong class="${cls(x.pnl)}">${money(x.pnl)}</strong><small>${x.count} op. · ${pct(x.winRate)} acerto</small></div></div>`
  }).join('')}</div>`
}
function dirCard(x,bestKey,baseTrades){
  if(!x)return '';
  const pf=directionPF(baseTrades||[],x.key);
  return `<div class="direction-card ${x.key===bestKey?'best':''}">
    <div class="direction-head"><b>${esc(x.key)}</b><span class="pill">${x.count} operações</span></div>
    <div class="direction-result ${cls(x.pnl)}">${money(x.pnl)}</div>
    <div class="mini-grid">
      <div class="mini"><span>Taxa de acerto</span><b>${pct(x.winRate)}</b></div>
      <div class="mini"><span>Média</span><b class="${cls(x.avg)}">${money(x.avg)}</b></div>
      <div class="mini"><span>Profit factor</span><b>${numfmt(pf,2)}</b></div>
      <div class="mini"><span>Vitórias / perdas</span><b>${x.wins} / ${x.losses}</b></div>
    </div></div>`
}
function directionPF(trades,dir){
  const xs=trades.filter(t=>t.direction===dir), win=xs.filter(t=>+t.pnl>0).reduce((s,t)=>s+(+t.pnl||0),0),
        loss=Math.abs(xs.filter(t=>+t.pnl<0).reduce((s,t)=>s+(+t.pnl||0),0));
  return safeDiv(win,loss);
}
