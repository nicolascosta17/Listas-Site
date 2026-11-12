// Data model compatible with the existing listas_dados JSON record (no SQL migration).
export const clone = value => JSON.parse(JSON.stringify(value));
export const makeId = () => crypto.randomUUID();
export const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const periodKey = (periodId, companyId, taskId) => [periodId,companyId,taskId].join('|');
export const safeType = type => ['check','text','number'].includes(type) ? type : 'check';

export function blankList(name='Nova lista') {
  const p = {id:makeId(), name:'Geral'};
  return {
    id:makeId(), name, periods:[p], companies:[], tasks:[{id:makeId(),name:'Concluído',type:'check'}],
    checks:{},values:{},periodData:{},activePeriodId:p.id
  };
}
export function emptyData() {
  const list = blankList('Minha primeira lista');
  const active = list.periods[0].id;
  list.periodTemplate = {companies:[],tasks:clone(list.tasks)};
  list.periodData[active] = {companies:[],tasks:clone(list.tasks),columnWidths:{},sidebarCollapsed:false};
  return {lists:[list],cur:list.id,per:{[list.id]:active},
    theme:{mode:'light',accent:'#773d58',round:'14px'},sortOrders:{},autoSave:true};
}
export function activeList(s) {
  return s?.lists?.find(l => l.id === s.cur) || s?.lists?.[0] || null;
}
export function periodOf(s,l) {
  if (!l) return null;
  return l.periods?.find(p=>p.id === s.per?.[l.id]) || l.periods?.[0] || null;
}
export function periodView(l,pid) {
  if (!l) return {companies:[],tasks:[],columnWidths:{},sidebarCollapsed:false};
  const from = l.periodData?.[pid] || l.periodTemplate || {};
  if (l.activePeriodId === pid || (!l.activePeriodId && !l.periodData?.[pid])) {
    return {companies:l.companies||[],tasks:l.tasks||[],columnWidths:from.columnWidths||{},
      sidebarCollapsed:!!from.sidebarCollapsed};
  }
  return {companies:from.companies||l.companies||[],tasks:from.tasks||l.tasks||[],
    columnWidths:from.columnWidths||{},sidebarCollapsed:!!from.sidebarCollapsed};
}
export function ensureActive(s,l,pid=periodOf(s,l)?.id) {
  if (!l || !pid) return;
  l.companies ||= []; l.tasks ||= []; l.periods ||= [];
  l.values ||= {}; l.checks ||= {}; l.periodData ||= {};
  if (!l.periodTemplate) l.periodTemplate={companies:clone(l.companies),tasks:clone(l.tasks)};
  if (!l.activePeriodId) {
    l.activePeriodId=pid;
    l.periodData[pid] ||= {companies:clone(l.companies),tasks:clone(l.tasks),columnWidths:{},sidebarCollapsed:false};
  } else if (l.activePeriodId!==pid) {
    const old = l.activePeriodId;
    const oldRecord = l.periodData[old] || {};
    l.periodData[old] = {...oldRecord,companies:clone(l.companies),tasks:clone(l.tasks)};
    const next = l.periodData[pid] || {companies:clone(l.periodTemplate.companies||[]),
      tasks:clone(l.periodTemplate.tasks||[]),columnWidths:{},sidebarCollapsed:false};
    l.periodData[pid]=next;
    l.companies=clone(next.companies);l.tasks=clone(next.tasks);
    l.activePeriodId=pid;
  }
}
export function syncActive(s,l) {
  const p=periodOf(s,l);
  if (!l || !p) return;
  ensureActive(s,l,p.id);
  const previous=l.periodData[p.id]||{};
  l.periodData[p.id]={...previous,companies:clone(l.companies),tasks:clone(l.tasks)};
}
export function prepareData(raw) {
  if (!raw || !Array.isArray(raw.lists)) return emptyData();
  const s=clone(raw);
  s.lists ||= [];
  s.per ||= {};s.sortOrders ||= {};
  s.theme ||= {mode:'light',accent:'#773d58',round:'14px'};
  if (typeof s.autoSave!=='boolean') s.autoSave=true;
  if (!s.lists.length) return emptyData();
  s.cur = s.lists.some(l=>l.id===s.cur) ? s.cur : s.lists[0].id;
  for (const l of s.lists) {
    l.periods ||= [{id:makeId(),name:'Geral'}];
    if (!l.periods.length) l.periods=[{id:makeId(),name:'Geral'}];
    l.companies ||= [];l.tasks ||= [{id:makeId(),name:'Concluído',type:'check'}];
    l.values ||= {};l.checks ||= {};l.periodData ||= {};
    if (!l.periodTemplate) l.periodTemplate={companies:clone(l.companies),tasks:clone(l.tasks)};
    if (!l.periods.some(p=>p.id===s.per[l.id])) s.per[l.id]=l.activePeriodId||l.periods[0].id;
    ensureActive(s,l,s.per[l.id]);
  }
  return s;
}
export function normalizedName(v) {
  return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ').trim().toLocaleLowerCase('pt-BR');
}
export function taskDone(l,pid,c,t) {
  const key=periodKey(pid,c.id,t.id);
  if (safeType(t.type)==='check') return Boolean(l.checks?.[key]);
  const val=l.values?.[key];
  return val!==undefined && val!==null && String(val).trim()!=='';
}
export function companyStatus(l,pid,c,tasks) {
  if (!tasks?.length) return 'pend';
  const count=tasks.filter(t=>taskDone(l,pid,c,t)).length;
  return count===0?'pend':count===tasks.length?'done':'part';
}
export function counter(l,pid,view) {
  const res={total:view.companies.length,done:0,part:0,pend:0};
  for (const c of view.companies) res[companyStatus(l,pid,c,view.tasks)]++;
  res.percent=res.total?Math.round(100*res.done/res.total):0;
  return res;
}
export function viewCompanies(s,l,pid,view,query,filter='all') {
  const needle=normalizedName(query);
  const list=view.companies.filter(c=>{
    const status=companyStatus(l,pid,c,view.tasks);
    const matches=!needle || normalizedName(c.name).includes(needle) ||
      String(c.number??'').includes(needle);
    return matches && (filter==='all'||(filter==='done'?status==='done':status!=='done'));
  });
  const sort=s.sortOrders?.[l.id]||'number-asc';
  const collate=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
  const num=c=>c.number===null||c.number===undefined||c.number===''?Number.MAX_SAFE_INTEGER:Number(c.number);
  return [...list].sort((a,b)=>{
    let d=sort.startsWith('alpha')?collate.compare(a.name,b.name):num(a)-num(b);
    if (!Number.isFinite(d)) d=0;
    if (sort.endsWith('desc')) d=-d;
    return d||collate.compare(a.name,b.name);
  });
}
export function purgeEntries(l,pid,companyId,taskId) {
  const keys=[l.checks||{},l.values||{}];
  for (const map of keys) for (const key of Object.keys(map)) {
    const [p,c,t]=key.split('|');
    if (p===pid && (companyId===undefined||c===companyId) &&
        (taskId===undefined||t===taskId)) delete map[key];
  }
}
export function addCompany(l,name) {
  const max=Math.max(0,...l.companies.map(c=>Number(c.number)||0));
  l.companies.push({id:makeId(),name:name.trim(),note:'',number:max+1});
}
export function templateFrom(s,l,pid) {
  const view=periodView(l,pid);
  const allowedCompanies=new Set(view.companies.map(c=>String(c.id)));
  const textTaskIds=new Set(view.tasks.filter(t=>safeType(t.type)!=='check').map(t=>String(t.id)));
  const values=[];
  for (const [key,value] of Object.entries(l.values||{})) {
    const [period,company,task]=key.split('|');
    if (period===pid&&allowedCompanies.has(company)&&textTaskIds.has(task))
      values.push({empresaId:company,etapaId:task,valor:clone(value)});
  }
  return {formato:'minhas-listas-modelo-periodo',versao:2,listaOrigem:l.name,
    periodoOrigem:l.periods.find(p=>p.id===pid)?.name||'',
    empresas:clone(view.companies),etapas:clone(view.tasks),preenchimentos:values,
    larguras:clone(view.columnWidths),menuRecolhido:view.sidebarCollapsed,
    ordenacao:s.sortOrders?.[l.id]||'number-asc'};
}
export function validateTemplate(t) {
  if (!t||t.formato!=='minhas-listas-modelo-periodo'||t.versao!==2||
    !Array.isArray(t.empresas)||!Array.isArray(t.etapas)||
    !Array.isArray(t.preenchimentos)||!t.etapas.length||
    t.empresas.length>20000||t.etapas.length>500) throw Error('Arquivo de modelo inválido.');
  const companies=t.empresas.map(c=>String(c?.id||''));
  const tasks=t.etapas.map(e=>String(e?.id||''));
  if (companies.some(id=>!id)||tasks.some(id=>!id)||
    new Set(companies).size!==companies.length||new Set(tasks).size!==tasks.length)
    throw Error('IDs duplicados ou ausentes no arquivo.');
}
export function applyTemplate(s,template) {
  validateTemplate(template);
  const l=activeList(s),p=periodOf(s,l);ensureActive(s,l,p.id);
  const companyIds=new Map(),taskIds=new Map();
  const companies=template.empresas.map(c=>{
    const copy=clone(c);copy.id=makeId();companyIds.set(String(c.id),copy.id);return copy;
  });
  const tasks=template.etapas.map(t=>{
    const copy=clone(t);copy.id=makeId();copy.type=safeType(copy.type);
    taskIds.set(String(t.id),copy.id);return copy;
  });
  // Only replace the current period's completion keys and values.
  purgeEntries(l,p.id);
  const typeFor = new Map(tasks.map(t=>[t.id,t.type]));
  for (const value of template.preenchimentos) {
    const c=companyIds.get(String(value.empresaId));
    const t=taskIds.get(String(value.etapaId));
    if (c&&t&&typeFor.get(t)!=='check')
      l.values[periodKey(p.id,c,t)]=clone(value.valor);
  }
  const widths={};
  for (const [key,value] of Object.entries(template.larguras||{})) {
    const newKey=key.startsWith('task:')?'task:'+taskIds.get(key.slice(5)):key;
    if (!newKey.endsWith('undefined')&&Number.isFinite(Number(value))) widths[newKey]=Number(value);
  }
  l.companies=companies;l.tasks=tasks;
  l.periodData[p.id]={companies:clone(companies),tasks:clone(tasks),
    columnWidths:widths,sidebarCollapsed:!!template.menuRecolhido};
  if (['number-asc','number-desc','alpha-asc','alpha-desc'].includes(template.ordenacao))
    s.sortOrders[l.id]=template.ordenacao;
  return {companies:companies.length,tasks:tasks.length};
}
export function downloadFile(filename,content,type) {
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function filename(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'minhas-listas';
}
export function reportMonth(s,l,pid) {
  const view=periodView(l,pid), stats=counter(l,pid,view);
  const perTask=view.tasks.map(t=>({
    name:t.name,done:view.companies.filter(c=>taskDone(l,pid,c,t)).length
  }));
  const pending=view.companies.filter(c=>companyStatus(l,pid,c,view.tasks)!=='done')
    .map(c=>({name:c.name,note:c.note||'',
      missing:view.tasks.filter(t=>!taskDone(l,pid,c,t)).map(t=>t.name).join(', ')}));
  return {view,stats,perTask,pending,period:l.periods.find(p=>p.id===pid)?.name||'Período'};
}
export function startOfWeek(date) {
  const d=new Date(date);d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return d;
}
export function reportWeek(l,start) {
  const end=new Date(start);end.setDate(end.getDate()+7);
  const events=[];
  for (const [key,time] of Object.entries(l.checks||{})) {
    const [pid,cid,tid]=key.split('|');
    const ts=Number(time);
    if (!Number.isFinite(ts)||ts<1e12||ts<+start||ts>=+end) continue;
    const view=periodView(l,pid);
    const company=view.companies.find(c=>c.id===cid);
    const task=view.tasks.find(t=>t.id===tid);
    if (!company||!task) continue;
    events.push({time:ts,company:company.name,task:task.name,
      period:l.periods.find(p=>p.id===pid)?.name||''});
  }
  return events.sort((a,b)=>a.time-b.time);
}
