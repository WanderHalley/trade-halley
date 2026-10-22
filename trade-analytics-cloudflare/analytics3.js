function dashboardHTML(a,m,filteredTrades){
  const hourOrder=(x,y)=>String(x.key).localeCompare(String(y.key));
  const dayOrder=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
  const daySorter=(x,y)=>dayOrder.indexOf(x.key)-dayOrder.indexOf(y.key);
  const dirBuy=m.byDir.find(x=>x.key==='Compra'),dirSell=m.byDir.find(x=>x.key==='Venda');
  const dataQuality=(m.completeDur===m.n && m.completeDir===m.n)?'Base forte':'Base parcial';
  const filterBlock=analysisFilterHTML(a,filteredTrades.length);
  if(!m.n){
    return `${filterBlock}<div class="no-filter-results"><b>Nenhuma operação encontrada</b>Altere o ativo ou o período e clique em <strong>Analisar</strong>, ou use <strong>Todos</strong> para voltar ao histórico completo.</div>`;
  }
  return `
  ${filterBlock}
  <section class="section-title"><h2>Resumo</h2><span>${m.n} operações analisadas · ${esc(a.name)}</span></section>
  <section class="grid kpis">
    ${metricCard('Resultado líquido',money(m.net),`${m.n} operações`,cls(m.net))}
    ${metricCard('Resultado bruto',money(m.gross),`Taxas ${money(m.fees)}`,cls(m.gross))}
    ${metricCard('Taxa de acerto',pct(m.winRate),`${m.wins.length} vitórias · ${m.losses.length} perdas`,m.winRate>=50?'pos':'warn')}
    ${metricCard('Expectativa bruta',money(m.exp),'Média antes das taxas',cls(m.exp))}
    ${metricCard('Profit factor',numfmt(m.pf,2),'Lucro bruto ÷ perda bruta',m.pf>=1?'pos':'neg')}
    ${metricCard('Payoff',numfmt(m.payoff,2),'Média ganha ÷ média perdida',m.payoff>=1?'pos':'warn')}
    ${metricCard('Duração média',durationText(m.avgDur),`${m.completeDur} de ${m.n} com duração`)}
    ${metricCard('Drawdown máximo',money(m.minDD),'Curva líquida de trades encerrados','neg')}
  </section>

  ${riskLotHTML(m)}

  <section class="grid two" style="margin-top:12px">
    <div class="card">
      <b>Insights principais</b>
      ${insight('Melhor horário',m.bestHour?.key,m.bestHour?`${m.bestHour.count} operações · média ${money(m.bestHour.avg)}`:'')}
      ${insight('Melhor dia',m.bestDay?.key,m.bestDay?`${m.bestDay.count} operações · média ${money(m.bestDay.avg)}`:'')}
      ${insight('Melhor direção',m.bestDir?.key,m.bestDir?`${m.bestDir.count} operações · média ${money(m.bestDir.avg)}`:'')}
      ${insight('Melhor duração',m.bestDur?.key,m.bestDur?`${m.bestDur.count} operações · média ${money(m.bestDur.avg)}`:'')}
      ${insight('Horário de atenção',m.worstHour?.key,m.worstHour?`${money(m.worstHour.pnl)} líquido · média ${money(m.worstHour.avg)}`:'')}
      ${insight('Qualidade dos dados',dataQuality,`${m.n-m.completeDur} sem duração · ${m.n-m.completeDir} sem Compra/Venda`)}
    </div>
    <div class="card">
      <b>Risco e consistência</b>
      ${insight('Média das vitórias',money(m.avgWin),`${m.wins.length} operações vencedoras · bruto`)}
      ${insight('Média das perdas',money(m.avgLoss),`${m.losses.length} operações perdedoras · bruto`)}
      ${insight('Melhor operação',money(m.bestTrade?.pnl||0),'Resultado líquido')}
      ${insight('Pior operação',money(m.worstTrade?.pnl||0),'Resultado líquido')}
      ${insight('Maior avanço da curva',money(m.maxAdvance),`${dateText(m.advanceStart)} → ${dateText(m.advanceEnd)}`)}
      ${insight('Drawdown máximo',money(m.minDD),`${dateText(m.minDDStart)} → ${dateText(m.minDDEnd)}`)}
      ${insight('Maior sequência positiva',`${m.maxPos} operações`,'Vitórias consecutivas')}
      ${insight('Maior sequência negativa',`${m.maxNeg} operações`,'Perdas consecutivas')}
    </div>
  </section>

  <section class="section-title"><h2>Curva de resultado</h2><span>L&P líquido acumulado</span></section>
  <div class="card chartcard"><canvas id="equityCanvas"></canvas></div>

  <section class="section-title"><h2>Desempenho</h2><span>Onde sua execução tem maior expectativa</span></section>
  <section class="grid two">
    <div class="card"><b>Por horário</b><div style="height:14px"></div>${barsHTML(m.byHour,hourOrder)}</div>
    <div class="card"><b>Por dia da semana</b><div style="height:14px"></div>${barsHTML(m.byDay,daySorter)}</div>
  </section>

  <section class="section-title"><h2>Desempenho por ativo</h2><span>Compara resultado, acerto, média e Profit Factor</span></section>
  ${assetCardsHTML(m)}

  <section class="grid two" style="margin-top:12px">
    <div class="card"><b>Resultado por duração</b><div style="height:14px"></div>${barsHTML(m.byDur)}</div>
    <div class="card">
      <b>Leitura da duração</b>
      ${insight('Duração média',durationText(m.avgDur),`${m.completeDur} operações com duração`)}
      ${insight('Média das vitórias',durationText(m.avgWinDur),`${m.wins.length} vitórias`)}
      ${insight('Média das perdas',durationText(m.avgLossDur),`${m.losses.length} perdas`)}
      ${insight('Operação mais longa',durationText(Math.max(...m.sorted.map(durationMin).filter(Number.isFinite),0)),'Maior tempo em posição')}
      ${insight('Faixa mais eficiente',m.bestDur?.key,m.bestDur?`${m.bestDur.count} operações · média ${money(m.bestDur.avg)}`:'')}
    </div>
  </section>

  <section class="section-title"><h2>Compra × Venda</h2><span>Comparação por direção</span></section>
  <div class="direction-grid">${dirCard(dirBuy,m.bestDir?.key,m.sorted)}${dirCard(dirSell,m.bestDir?.key,m.sorted)}</div>

  <section class="section-title"><h2>Operações</h2><span>Edite ou exclua sem risco de o próximo CSV sobrescrever suas alterações</span></section>
  <div class="toolbar">
    <div class="filters">
      <input id="searchTrades" placeholder="Buscar símbolo ou nº">
      <select id="filterDir"><option value="">Todas as direções</option><option>Compra</option><option>Venda</option></select>
      <select id="filterResult"><option value="">Todos os resultados</option><option value="win">Vencedoras</option><option value="loss">Perdedoras</option></select>
    </div>
    <div class="note">${m.n} trades salvos</div>
  </div>
  <div class="table-wrap">
    <table><thead><tr>
      <th>#</th><th>Símbolo</th><th>Direção</th><th>Entrada</th><th>Saída</th><th>Duração</th><th>Qtd.</th><th>Preço entrada</th><th>Preço saída</th><th>Comissão</th><th>L&P líquido</th><th>Ações</th>
    </tr></thead><tbody id="tradeRows">${tradeRowsHTML(m.sorted)}</tbody></table>
  </div>`;
}
function tradeRowsHTML(trades){
  return trades.slice().reverse().map(t=>`<tr data-id="${esc(t.id)}">
    <td>${esc(t.tradeNo)}</td><td>${esc(t.symbol)}</td><td>${esc(t.direction)}</td>
    <td>${dateText(t.entryTime)}</td><td>${dateText(t.exitTime)}</td><td>${durationText(durationMin(t))}</td>
    <td>${numfmt(t.qty,2)}</td><td>${numfmt(t.entryPrice,5)}</td><td>${numfmt(t.exitPrice,5)}</td>
    <td>${money(Math.abs(+t.commission||0))}</td><td class="${cls(+t.pnl||0)}"><b>${money(t.pnl)}</b></td>
    <td><div class="row-actions"><button class="iconbtn editTrade" data-id="${esc(t.id)}">Editar</button><button class="iconbtn deleteTrade" data-id="${esc(t.id)}">Excluir</button></div></td>
  </tr>`).join('');
}
function wireFilters(baseTrades){
  const search=$('#searchTrades'),dir=$('#filterDir'),res=$('#filterResult');
  if(!search||!dir||!res)return;
  const apply=()=>{
    let t=[...baseTrades];
    const q=(search.value||'').trim().toLowerCase();
    if(q)t=t.filter(x=>String(x.symbol).toLowerCase().includes(q)||String(x.tradeNo).toLowerCase().includes(q)||assetKey(x.symbol).toLowerCase().includes(q));
    if(dir.value)t=t.filter(x=>x.direction===dir.value);
    if(res.value==='win')t=t.filter(x=>+x.pnl>0);
    if(res.value==='loss')t=t.filter(x=>+x.pnl<0);
    t.sort((a,b)=>new Date(a.exitTime||a.entryTime)-new Date(b.exitTime||b.entryTime));
    $('#tradeRows').innerHTML=tradeRowsHTML(t);
  };
  [search,dir,res].forEach(x=>x.addEventListener('input',apply));
}

function drawEquity(trades,m){
  const c=$('#equityCanvas'); if(!c)return;
  const rect=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  c.width=Math.max(1,rect.width*dpr); c.height=Math.max(1,280*dpr);
  const ctx=c.getContext('2d'); ctx.scale(dpr,dpr);
  const w=rect.width,h=280,pad={l:56,r:18,t:18,b:32};
  const pts=m.equityPts;if(!pts.length)return;
  const vals=[0,...pts.map(p=>p.value)],min=Math.min(...vals),max=Math.max(...vals);
  const span=(max-min)||1;
  const x=i=>pad.l+(w-pad.l-pad.r)*(i/Math.max(1,pts.length-1));
  const y=v=>pad.t+(h-pad.t-pad.b)*(1-(v-min)/span);
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#263747';ctx.lineWidth=1;ctx.fillStyle='#8fb1cf';ctx.font='11px system-ui';
  for(let i=0;i<=4;i++){const yy=pad.t+(h-pad.t-pad.b)*i/4;ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();
    const val=max-span*i/4;ctx.fillText('$'+numfmt(val,0),6,yy+4)}
  if(min<=0&&max>=0){ctx.strokeStyle='#526578';ctx.beginPath();ctx.moveTo(pad.l,y(0));ctx.lineTo(w-pad.r,y(0));ctx.stroke()}
  ctx.strokeStyle=m.net>=0?'#27d17f':'#ff4d5e';ctx.lineWidth=2.2;ctx.beginPath();
  pts.forEach((p,i)=>{const xx=x(i),yy=y(p.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();
  ctx.fillStyle='#8fb1cf';ctx.fillText('Início',pad.l,h-9);ctx.textAlign='right';ctx.fillText(dateText(pts[pts.length-1].time),w-pad.r,h-9);ctx.textAlign='left';
}
