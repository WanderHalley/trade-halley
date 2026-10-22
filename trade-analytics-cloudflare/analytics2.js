function subsetPF(trades,predicate){
  const xs=trades.filter(predicate);
  const win=xs.filter(t=>+t.pnl>0).reduce((s,t)=>s+(+t.pnl||0),0);
  const loss=Math.abs(xs.filter(t=>+t.pnl<0).reduce((s,t)=>s+(+t.pnl||0),0));
  return safeDiv(win,loss);
}
function analysisFilterHTML(a,filteredCount){
  const f=analysisFilter(a);
  const assets=[...new Set(a.trades.map(t=>assetKey(t.symbol)).filter(x=>x&&x!=='—'))].sort();
  const dates=a.trades.map(t=>dateOnly(t.entryTime||t.exitTime)).filter(Boolean).sort();
  const minDate=dates[0]||'',maxDate=dates[dates.length-1]||'';
  const active=[];
  if(f.asset)active.push(`Ativo: ${esc(f.asset)}`);
  if(f.start)active.push(`De: ${esc(f.start.split('-').reverse().join('/'))}`);
  if(f.end)active.push(`Até: ${esc(f.end.split('-').reverse().join('/'))}`);
  return `<div class="card analysis-filter-card">
    <div class="analysis-filter-head">
      <div><b>Filtros da análise</b><small>Os filtros abaixo recalculam todo o painel, não apenas a tabela de operações.</small></div>
      <span class="pill">${filteredCount} de ${a.trades.length} operações</span>
    </div>
    <div class="analysis-filter-grid">
      <div class="field"><label>Ativo</label>
        <select id="analysisAsset">
          <option value="">Todos os ativos</option>
          ${assets.map(x=>`<option value="${esc(x)}" ${f.asset===x?'selected':''}>${esc(x)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Data inicial</label><input id="analysisStart" type="date" min="${minDate}" max="${maxDate}" value="${esc(f.start||'')}"></div>
      <div class="field"><label>Data final</label><input id="analysisEnd" type="date" min="${minDate}" max="${maxDate}" value="${esc(f.end||'')}"></div>
      <button class="btn primary" id="applyAnalysis">Analisar</button>
      <button class="btn" id="resetAnalysis">Todos</button>
    </div>
    <div class="filter-status">
      <span>Período disponível: ${minDate?minDate.split('-').reverse().join('/'):'—'} até ${maxDate?maxDate.split('-').reverse().join('/'):'—'}</span>
      ${active.map(x=>`<span class="filter-chip">${x}</span>`).join('')}
      ${!active.length?'<span class="filter-chip">Sem filtros — histórico completo</span>':''}
    </div>
  </div>`;
}
function assetCardsHTML(m){
  if(!m.byAsset.length)return '';
  const sorted=[...m.byAsset].sort((a,b)=>b.pnl-a.pnl);
  return `<div class="asset-grid">${sorted.map(x=>{
    const pf=subsetPF(m.sorted,t=>assetKey(t.symbol)===x.key);
    return `<div class="asset-card">
      <div class="asset-head"><div class="asset-name">${esc(x.key)}</div><span class="pill">${x.count} operações</span></div>
      <div class="asset-pnl ${cls(x.pnl)}">${money(x.pnl)}</div>
      <div class="asset-stats">
        <div class="asset-stat"><span>Acerto</span><b>${pct(x.winRate)}</b></div>
        <div class="asset-stat"><span>Média</span><b class="${cls(x.avg)}">${money(x.avg)}</b></div>
        <div class="asset-stat"><span>Profit factor</span><b>${numfmt(pf,2)}</b></div>
        <div class="asset-stat"><span>Vitórias / perdas</span><b>${x.wins} / ${x.losses}</b></div>
      </div>
    </div>`;
  }).join('')}</div>`;
}
function wireAnalysisFilters(){
  const a=account(); if(!a)return;
  const asset=$('#analysisAsset'),start=$('#analysisStart'),end=$('#analysisEnd');
  $('#applyAnalysis')?.addEventListener('click',()=>{
    if(start.value&&end.value&&start.value>end.value){
      toast('A data inicial não pode ser posterior à data final.');
      return;
    }
    a.analysisFilter={asset:asset.value,start:start.value,end:end.value};
    saveState();render();
  });
  $('#resetAnalysis')?.addEventListener('click',()=>{
    a.analysisFilter={asset:'',start:'',end:''};
    saveState();render();
  });
}
function lotStats(trades){
  const groups=new Map();
  for(const t of trades){
    const q=Number(t.qty);
    if(!Number.isFinite(q)||q<=0)continue;
    const asset=assetKey(t.symbol);
    const key=asset+'|'+String(q);
    if(!groups.has(key))groups.set(key,{asset,qty:q,trades:[]});
    groups.get(key).trades.push(t);
  }
  return [...groups.values()].map(g=>{
    const xs=g.trades;
    const wins=xs.filter(t=>(+t.pnl||0)>0),losses=xs.filter(t=>(+t.pnl||0)<0);
    const pnl=xs.reduce((s,t)=>s+(+t.pnl||0),0);
    const avg=safeDiv(pnl,xs.length);
    const avgWin=safeDiv(wins.reduce((s,t)=>s+(+t.pnl||0),0),wins.length);
    const avgLoss=Math.abs(safeDiv(losses.reduce((s,t)=>s+(+t.pnl||0),0),losses.length));
    const grossWin=wins.reduce((s,t)=>s+(+t.pnl||0),0);
    const grossLoss=Math.abs(losses.reduce((s,t)=>s+(+t.pnl||0),0));
    const pf=grossLoss?grossWin/grossLoss:(grossWin>0?Infinity:0);
    const winRate=safeDiv(wins.length,xs.length)*100;
    const payoff=avgLoss?avgWin/avgLoss:0;
    const worst=Math.min(...xs.map(t=>+t.pnl||0));
    const best=Math.max(...xs.map(t=>+t.pnl||0));
    return {asset:g.asset,qty:g.qty,count:xs.length,wins:wins.length,losses:losses.length,pnl,avg,avgWin,avgLoss,pf,winRate,payoff,worst,best};
  }).sort((a,b)=>a.asset.localeCompare(b.asset)||a.qty-b.qty);
}
function lotConfidence(count,total){
  const minSample=Math.max(5,Math.min(10,Math.ceil(total*.08)));
  if(count>=Math.max(10,minSample*2))return {label:'Forte',class:'strong',eligible:true,minSample};
  if(count>=minSample)return {label:'Utilizável',class:'medium',eligible:true,minSample};
  return {label:'Amostra fraca',class:'weak',eligible:false,minSample};
}
function chooseBestLot(stats,total){
  const eligible=stats.filter(s=>{
    const c=lotConfidence(s.count,total);
    return c.eligible && s.avg>0 && s.pnl>0 && s.pf>=1;
  });
  if(!eligible.length)return null;
  const finitePF=s=>Number.isFinite(s.pf)?Math.min(s.pf,6):6;
  const maxAvg=Math.max(...eligible.map(s=>Math.max(0,s.avg)),1);
  const maxCount=Math.max(...eligible.map(s=>s.count),1);
  const scored=eligible.map(s=>{
    const expectancyScore=Math.max(0,s.avg)/maxAvg;
    const pfScore=Math.min(1,finitePF(s)/3);
    const winScore=Math.min(1,s.winRate/70);
    const sampleScore=Math.min(1,s.count/maxCount);
    const score=expectancyScore*.36+pfScore*.27+winScore*.20+sampleScore*.17;
    return {...s,score};
  });
  return scored.sort((a,b)=>b.score-a.score)[0];
}
function riskRewardAnalysis(trades){
  const wins=trades.filter(t=>(+t.pnl||0)>0),losses=trades.filter(t=>(+t.pnl||0)<0);
  const avgWin=safeDiv(wins.reduce((s,t)=>s+(+t.pnl||0),0),wins.length);
  const avgLoss=Math.abs(safeDiv(losses.reduce((s,t)=>s+(+t.pnl||0),0),losses.length));
  const winRate=safeDiv(wins.length,trades.length);
  const observed=avgLoss?avgWin/avgLoss:0;
  const breakeven=winRate>0 ? (1-winRate)/winRate : 0;
  const edge=observed-breakeven;
  return {avgWin,avgLoss,observed,breakeven,edge,winRate};
}
function fmtPF(v){return Number.isFinite(v)?numfmt(v,2):'∞'}
function riskLotHTML(m){
  const stats=lotStats(m.sorted),assets=[...new Set(m.sorted.map(t=>assetKey(t.symbol)))];
  const singleAsset=assets.length===1;
  const sameAssetStats=singleAsset?stats.filter(s=>s.asset===assets[0]):[];
  const best=singleAsset?chooseBestLot(sameAssetStats,m.n):null;
  const rr=riskRewardAnalysis(m.sorted);
  const minSample=stats.length?lotConfidence(0,m.n).minSample:5;
  const rrPct=Math.max(4,Math.min(100,rr.observed/Math.max(1.5,rr.observed)*100));
  const recommendation=!singleAsset
    ? 'Selecione um ativo'
    : best
      ? `${numfmt(best.qty,2).replace(/,00$/,'')} contrato${best.qty===1?'':'s'}`
      : 'Sem amostra suficiente';
  const bestSub=!singleAsset
    ? 'Lotes de ativos diferentes usam unidades e exposições diferentes. Filtre um único ativo para receber uma recomendação válida.'
    : best
      ? `${best.count} operações · ${pct(best.winRate)} acerto · PF ${fmtPF(best.pf)} · média ${money(best.avg)}`
      : `É preciso pelo menos ${minSample} operações no mesmo lote com resultado e PF positivos.`;
  const rrClass=rr.edge>0?'pos':rr.edge<0?'neg':'warn';
  return `
  <section class="section-title"><h2>Lote ideal e Risco/Retorno</h2><span>Calculado exclusivamente a partir das operações do filtro atual</span></section>
  <div class="risk-grid">
    <div class="risk-card">
      <div class="risk-label">Melhor lote histórico</div>
      <div class="risk-value ${best?'pos':'warn'}">${recommendation}</div>
      <div class="risk-sub">${bestSub}</div>
    </div>
    <div class="risk-card">
      <div class="risk-label">Risco : Retorno observado</div>
      <div class="risk-value ${rrClass}">1 : ${numfmt(rr.observed,2)}</div>
      <div class="risk-sub">Perda média ${money(rr.avgLoss)} → ganho médio ${money(rr.avgWin)}.${singleAsset?'':' Para precisão operacional, filtre um ativo.'}</div>
      <div class="rr-meter"><div style="width:${rrPct}%"></div></div>
    </div>
    <div class="risk-card">
      <div class="risk-label">R:R mínimo de equilíbrio</div>
      <div class="risk-value">1 : ${numfmt(rr.breakeven,2)}</div>
      <div class="risk-sub">Com ${pct(rr.winRate*100)} de acerto, abaixo disso a expectativa matemática tende a ficar negativa.</div>
    </div>
    <div class="risk-card">
      <div class="risk-label">Margem do seu R:R</div>
      <div class="risk-value ${rrClass}">${rr.edge>=0?'+':''}${numfmt(rr.edge,2)}</div>
      <div class="risk-sub">${rr.edge>0?'Seu retorno médio por unidade de risco está acima do ponto de equilíbrio.':'Seu retorno médio por unidade de risco não cobre confortavelmente o ponto de equilíbrio.'}</div>
    </div>
  </div>
  <div class="card" style="margin-top:12px">
    <b>Desempenho por lote</b>
    <div class="note" style="margin-top:5px">O sistema só recomenda como “melhor lote” uma quantidade com amostra mínima. Lotes com poucas operações continuam visíveis, mas não vencem o ranking apenas por terem 1 ou 2 trades muito grandes.</div>
    <div class="lot-table-wrap"><table class="lot-table"><thead><tr>
      <th>Ativo</th><th>Lote</th><th>Operações</th><th>Resultado</th><th>Média/trade</th><th>Acerto</th><th>PF</th><th>R:R observado</th><th>Pior trade</th><th>Confiança</th>
    </tr></thead><tbody>
      ${stats.map(s=>{
        const c=lotConfidence(s.count,m.n),isBest=best&&s.qty===best.qty;
        return `<tr class="${isBest?'best-lot':''}">
          <td><b>${esc(s.asset)}</b></td>
          <td><b>${numfmt(s.qty,2).replace(/,00$/,'')}</b>${isBest?'<span class="badge-best">Melhor histórico</span>':''}</td>
          <td>${s.count}</td>
          <td class="${cls(s.pnl)}"><b>${money(s.pnl)}</b></td>
          <td class="${cls(s.avg)}">${money(s.avg)}</td>
          <td>${pct(s.winRate)}</td>
          <td>${fmtPF(s.pf)}</td>
          <td>1 : ${numfmt(s.payoff,2)}</td>
          <td class="neg">${money(s.worst)}</td>
          <td><span class="confidence ${c.class}">${c.label}</span></td>
        </tr>`;
      }).join('')}
    </tbody></table></div>
  </div>`;
}
