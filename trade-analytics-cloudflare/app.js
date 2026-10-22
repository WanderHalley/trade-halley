function parseCSV(text){
  text=text.replace(/^\uFEFF/,'');
  const first=(text.split(/\r?\n/,1)[0]||'');
  const delimiter=(first.split(';').length>first.split(',').length)?';':',';
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='"'){
      if(q&&next==='"'){cell+='"';i++} else q=!q;
    } else if(ch===delimiter&&!q){row.push(cell);cell=''}
    else if((ch==='\n'||ch==='\r')&&!q){
      if(ch==='\r'&&next==='\n')i++;
      row.push(cell); if(row.some(v=>v!==''))rows.push(row); row=[];cell='';
    } else cell+=ch;
  }
  row.push(cell); if(row.some(v=>v!==''))rows.push(row);
  if(rows.length<2)throw new Error('CSV sem dados.');
  const headers=rows[0].map(x=>x.trim());
  return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]??'').trim()])));
}
function parseNum(v){
  if(v==null||v==='')return 0;
  let s=String(v).trim().replace(/[^\d,.\-+eE]/g,'');
  if(s.includes(',')&&s.includes('.')){
    if(s.lastIndexOf(',')>s.lastIndexOf('.')) s=s.replace(/\./g,'').replace(',','.');
    else s=s.replace(/,/g,'');
  } else if(s.includes(',')) s=s.replace(',','.');
  const n=Number(s);return Number.isFinite(n)?n:0;
}
function parsePtDate(v){
  if(!v)return null;
  const direct=new Date(v); if(!isNaN(direct))return direct.toISOString();
  const s=String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const months={jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11};
  const m=s.match(/(\d{1,2})\s+de\s+([a-z]+)\.?\s+de\s+(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if(!m)return null;
  const mon=months[m[2].slice(0,3)];if(mon==null)return null;
  return new Date(+m[3],mon,+m[1],+m[4],+m[5],+(m[6]||0)).toISOString();
}
function importRows(rows){
  const required=['Símbolo','Número da negociação','Tipo','Data e hora','ID da ordem','L&P líquido USD'];
  const headers=rows[0]?Object.keys(rows[0]):[];
  const missing=required.filter(h=>!headers.includes(h));
  if(missing.length)throw new Error('CSV incompatível. Faltam colunas: '+missing.join(', '));

  const groups=new Map();
  for(const r of rows){
    const symbol=r['Símbolo']||'';
    const no=r['Número da negociação']||'';
    const gk=symbol+'|'+no;
    if(!groups.has(gk))groups.set(gk,[]);
    groups.get(gk).push(r);
  }
  const trades=[];let incomplete=0;
  for(const [gk,rs] of groups){
    const norm=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const entry=rs.find(r=>norm(r['Tipo']).includes('entrada'));
    const exit=rs.find(r=>norm(r['Tipo']).includes('saida'));
    if(!entry||!exit){incomplete++;continue}
    const ids=rs.map(r=>r['ID da ordem']).filter(Boolean).sort();
    const fallback=rs.map(r=>`${r['Tipo']}|${r['Data e hora']}|${r['Preço']}`).sort();
    const sourceKey=[entry['Símbolo'],entry['Número da negociação'],(ids.length?ids:fallback).join('+')].join('|');
    const type=norm(entry['Tipo']);
    const direction=type.includes('long')?'Compra':type.includes('short')?'Venda':'—';
    const pnl=parseNum(exit['L&P líquido USD']||entry['L&P líquido USD']);
    const commission=Math.abs(parseNum(exit['Comissão USD']||entry['Comissão USD']));
    trades.push({
      id:uid(),sourceKey,
      symbol:entry['Símbolo']||exit['Símbolo']||'',
      tradeNo:entry['Número da negociação']||exit['Número da negociação']||'',
      direction,entryTime:parsePtDate(entry['Data e hora']),exitTime:parsePtDate(exit['Data e hora']),
      entryPrice:parseNum(entry['Preço']),exitPrice:parseNum(exit['Preço']),
      qty:parseNum(entry['Tamanho (qtd)']||exit['Tamanho (qtd)']),
      notional:parseNum(entry['Tamanho (valor)']||exit['Tamanho (valor)']),
      returnPct:parseNum(exit['Retorno %']||entry['Retorno %']),
      pnl,commission,orderIds:ids,edited:false
    });
  }
  return {trades,incomplete};
}

$('#btnNewAccount').addEventListener('click',()=>{
  accountMode='new';$('#accountDialogTitle').textContent='Nova conta';$('#accountName').value='';$('#accountDialog').showModal();
});
$('#btnRenameAccount').addEventListener('click',()=>{
  const a=account();if(!a)return;accountMode='edit';$('#accountDialogTitle').textContent='Editar conta';$('#accountName').value=a.name;$('#accountDialog').showModal();
});
$('#accountSave').addEventListener('click',e=>{
  e.preventDefault();const name=$('#accountName').value.trim();if(!name)return;
  if(accountMode==='new'){
    const id=uid();state.accounts[id]={id,name,trades:[],deletedKeys:[]};state.selectedAccountId=id;
  }else{account().name=name}
  saveState();$('#accountDialog').close();render();
});
$('#accountSelect').addEventListener('change',e=>{state.selectedAccountId=e.target.value;saveState();render()});
$('#btnUpload').addEventListener('click',()=>$('#fileInput').click());
$('#fileInput').addEventListener('change',async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{
    const text=await file.text(),rows=parseCSV(text),parsed=importRows(rows),a=account();
    const existing=new Set(a.trades.map(t=>t.sourceKey)),deleted=new Set(a.deletedKeys||[]);
    let added=0,duplicates=0,blocked=0;
    for(const t of parsed.trades){
      if(existing.has(t.sourceKey)){duplicates++;continue}
      if(deleted.has(t.sourceKey)){blocked++;continue}
      a.trades.push(t);existing.add(t.sourceKey);added++;
    }
    saveState();render();
    toast(`${added} nova(s) operação(ões) adicionada(s). ${duplicates} já existente(s) preservada(s). ${parsed.incomplete} incompleta(s) ignorada(s).`);
  }catch(err){toast('Erro ao importar: '+err.message)}
  e.target.value='';
});

document.addEventListener('click',e=>{
  const edit=e.target.closest('.editTrade'),del=e.target.closest('.deleteTrade');
  if(edit){
    const t=account().trades.find(x=>x.id===edit.dataset.id);if(!t)return;
    editingTradeId=t.id;
    $('#eSymbol').value=t.symbol;$('#eTradeNo').value=t.tradeNo;$('#eDirection').value=t.direction;
    $('#eQty').value=t.qty;$('#eEntryTime').value=toLocalInput(t.entryTime);$('#eExitTime').value=toLocalInput(t.exitTime);
    $('#eEntryPrice').value=t.entryPrice;$('#eExitPrice').value=t.exitPrice;$('#ePnl').value=t.pnl;$('#eCommission').value=t.commission;
    $('#tradeDialog').showModal();
  }
  if(del){
    const a=account(),t=a.trades.find(x=>x.id===del.dataset.id);if(!t)return;
    if(confirm(`Excluir a operação #${t.tradeNo} (${t.symbol})? Ela não será recriada ao reimportar o mesmo CSV.`)){
      a.trades=a.trades.filter(x=>x.id!==t.id);a.deletedKeys=a.deletedKeys||[];
      if(!a.deletedKeys.includes(t.sourceKey))a.deletedKeys.push(t.sourceKey);
      saveState();render();toast('Operação excluída e bloqueada para reimportação.');
    }
  }
});
$('#tradeSave').addEventListener('click',e=>{
  e.preventDefault();const t=account()?.trades.find(x=>x.id===editingTradeId);if(!t)return;
  t.symbol=$('#eSymbol').value.trim();t.tradeNo=$('#eTradeNo').value.trim();t.direction=$('#eDirection').value;
  t.qty=parseNum($('#eQty').value);t.entryTime=fromLocalInput($('#eEntryTime').value);t.exitTime=fromLocalInput($('#eExitTime').value);
  t.entryPrice=parseNum($('#eEntryPrice').value);t.exitPrice=parseNum($('#eExitPrice').value);t.pnl=parseNum($('#ePnl').value);
  t.commission=Math.abs(parseNum($('#eCommission').value));t.edited=true;
  saveState();$('#tradeDialog').close();render();toast('Operação atualizada. Futuras importações não irão sobrescrevê-la.');
});
function toLocalInput(v){
  const d=new Date(v);if(isNaN(d))return '';
  const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v){const d=new Date(v);return isNaN(d)?null:d.toISOString()}

if(!state.selectedAccountId || !state.accounts[state.selectedAccountId]){
  state.selectedAccountId=Object.keys(state.accounts)[0]||null;
}
window.addEventListener('resize',()=>{const a=account();if(a?.trades.length){const filtered=filteredAnalysisTrades(a);if(filtered.length){const m=metrics(filtered);drawEquity(m.sorted,m)}}});
render();
