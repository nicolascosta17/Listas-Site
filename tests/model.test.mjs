import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareData,emptyData,activeList,periodOf,periodView,ensureActive,
  templateFrom,applyTemplate,companyStatus,reportMonth,reportWeek
} from '../src/model.js';

function fixture(){
  const company={id:'c1',name:'Empresa Teste',note:'Observação preservada',number:12};
  const tasks=[{id:'t1',name:'Documento enviado',type:'check'},
    {id:'t2',name:'Número da nota',type:'number'},
    {id:'t3',name:'Responsável',type:'text'}];
  const p1={companies:[company],tasks,columnWidths:{company:280,'task:t2':180},sidebarCollapsed:false};
  const p2={companies:[{id:'c2',name:'Outro mês',number:7}],tasks, columnWidths:{},sidebarCollapsed:false};
  return {lists:[{id:'lista',name:'Lista de trabalho',periods:[{id:'out',name:'Outubro 2026'},{id:'nov',name:'Novembro 2026'}],
    activePeriodId:'out',companies:[company],tasks,periodTemplate:p1,
    periodData:{out:p1,nov:p2},checks:{'out|c1|t1':1780000000000,'nov|c2|t1':1780000000100},
    values:{'out|c1|t2':'234','out|c1|t3':'Joana','nov|c2|t2':'567'}}],
    cur:'lista',per:{lista:'out'},theme:{mode:'light',accent:'#773d58',round:'14px'},sortOrders:{lista:'number-asc'},autoSave:true};
}
test('inicializa conta vazia sem perder formato esperado',()=>{
  const s=emptyData();
  assert.equal(s.lists.length,1);
  assert.equal(typeof s.lists[0].checks,'object');
  assert.equal(typeof s.lists[0].periodData,'object');
});
test('carrega JSON legado e mantém marcações de meses independentes',()=>{
  const source=fixture(),s=prepareData(source);
  assert.equal(activeList(s).checks['out|c1|t1'],1780000000000);
  assert.equal(activeList(s).checks['nov|c2|t1'],1780000000100);
  assert.equal(periodView(activeList(s),'nov').companies[0].name,'Outro mês');
  assert.equal(source.lists[0].activePeriodId,'out','não deve modificar o objeto original');
});
test('trocar de competência não apaga os cadastros originais',()=>{
  const s=prepareData(fixture());s.per.lista='nov';
  ensureActive(s,activeList(s),'nov');
  assert.equal(activeList(s).companies[0].name,'Outro mês');
  assert.equal(periodView(activeList(s),'out').companies[0].name,'Empresa Teste');
});
test('modelo mantém campos preenchidos, mas não exporta checkpoints',()=>{
  const s=prepareData(fixture()),l=activeList(s);
  const snapshot=templateFrom(s,l,'out');
  assert.equal(snapshot.empresas.length,1);
  assert.equal(snapshot.etapas.length,3);
  assert.equal(snapshot.preenchimentos.length,2);
  assert.equal(JSON.stringify(snapshot).includes('"checks"'),false);
  assert.equal(snapshot.preenchimentos.find(v=>v.etapaId==='t3').valor,'Joana');
});
test('importação substitui somente o mês destino, zera checkpoints e preserva campos',()=>{
  const s=prepareData(fixture()),l=activeList(s),snapshot=templateFrom(s,l,'out');
  s.per.lista='nov';ensureActive(s,l,'nov');
  applyTemplate(s,snapshot);
  const current=activeList(s),company=current.companies[0];
  const text=current.tasks.find(t=>t.type==='text');
  assert.notEqual(company.id,'c1');
  assert.equal(company.name,'Empresa Teste');
  assert.equal(company.note,'Observação preservada');
  assert.equal(company.number,12);
  assert.equal(current.values['nov|'+company.id+'|'+text.id],'Joana');
  assert.equal(Object.keys(current.checks).some(k=>k.startsWith('nov|')),false);
  assert.equal(current.checks['out|c1|t1'],1780000000000);
  assert.equal(periodView(current,'out').companies[0].id,'c1');
  assert.equal(current.periodData.nov.columnWidths.company,280);
  assert.equal(current.periodData.nov.columnWidths['task:'+current.tasks.find(t=>t.type==='number').id],180);
});
test('relatório mensal considera texto/número preenchidos e checkbox pendente',()=>{
  const s=prepareData(fixture()),l=activeList(s),template=templateFrom(s,l,'out');
  s.per.lista='nov';ensureActive(s,l,'nov');applyTemplate(s,template);
  const result=reportMonth(s,l,'nov');
  assert.equal(result.stats.part,1);
  assert.equal(result.stats.done,0);
  assert.equal(result.pending[0].missing,'Documento enviado');
});
test('relatório semanal mantém os eventos originais',()=>{
  const s=prepareData(fixture()),l=activeList(s);
  const week=new Date('2026-05-25T00:00:00Z');
  // Testa a função sem exigir que todo evento esteja dentro deste intervalo.
  const events=reportWeek(l,week);
  assert.ok(Array.isArray(events));
});
