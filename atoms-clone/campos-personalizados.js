/* Extensão para Listas-Site — carregar DEPOIS do script principal do index.html.
   Preserva o Auth, as listas existentes, períodos, temas e relatórios. */
(() => {
  'use strict';
  const originalRender = render;
  const localSort = {};
  const getType = task => ['check','text','number'].includes(task.type) ? task.type : 'check';
  const valueKey = (period,company,task) => `${period.id}|${company.id}|${task.id}`;
  const collator = new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
  const numeric = c => Number.isFinite(Number(c.number)) && c.number !== '' && c.number != null ? Number(c.number) : Number.MAX_SAFE_INTEGER;
  const ensure = l => {
    if (!l.values || typeof l.values !== 'object') l.values = {};
    // Numeração pré-existente não é reordenada nem sobrescrita.
    let used = l.companies.reduce((a,c)=>Math.max(a,Number(c.number)||0),0);
    l.companies.forEach((c,index)=>{if(c.number==null || c.number===''){c.number = ++used;}});
    l.tasks.forEach(t=>{if(!t.type)t.type='check'});
  };
  const getSort = l => (S.sortOrders && S.sortOrders[l.id]) || localSort[l.id] || 'number-asc';
  const setSort = (l,val) => { if (!S.sortOrders) S.sortOrders={}; S.sortOrders[l.id]=val; localSort[l.id]=val; save(); };
  const ordered = (l,arr) => {
    const mode=getSort(l);
    return [...arr].sort((a,b)=>{
      let delta=0;
      if(mode.startsWith('alpha')) delta=collator.compare(a.name,b.name);
      else delta=numeric(a)-numeric(b);
      if(mode.endsWith('desc'))delta=-delta;
      return delta || collator.compare(a.name,b.name) || String(a.id).localeCompare(String(b.id));
    });
  };
  const typeName={check:'Checkbox',text:'Texto',number:'Número'};
  const selectTypes = task => `<select class="in type-select" data-kind aria-label="Tipo do campo">
    ${Object.entries(typeName).map(([key,label])=>`<option value="${key}" ${getType(task)===key?'selected':''}>${label}</option>`).join('')}
  </select>`;

  // Editor com nome e tipo para cada etapa.
  function openTypedEditor(){
    const l=L(); ensure(l);
    const row=t=>`<div class="type-row" data-task-id="${esc(t.id||'')}">
      <input class="in" data-task-name placeholder="Nome da etapa" value="${esc(t.name||'')}">
      ${selectTypes(t)}<button class="btn" type="button" data-remove-task title="Remover etapa">×</button>
    </div>`;
    const overlay=document.createElement('div'); overlay.className='ov';
    overlay.innerHTML=`<div class="md typed-modal" role="dialog" aria-modal="true" aria-label="Configurar etapas">
      <h3>Etapas e tipos de campo</h3><p class="type-hint">Escolha como cada etapa será preenchida: checkbox, texto ou número.</p>
      <div id="typed-rows">${l.tasks.map(row).join('')}</div>
      <button class="btn" type="button" id="typed-add">+ Adicionar etapa</button>
      <div class="ma"><button class="btn" type="button" id="typed-cancel">Cancelar</button><button class="btn pri" type="button" id="typed-save">Salvar etapas</button></div>
    </div>`;
    document.body.append(overlay);
    const close=()=>overlay.remove();
    overlay.addEventListener('click',e=>{
      if(e.target===overlay || e.target.id==='typed-cancel'){close();return;}
      if(e.target.id==='typed-add'){
        const tmp=document.createElement('div');tmp.innerHTML=row({id:'',name:'',type:'check'});
        overlay.querySelector('#typed-rows').append(tmp.firstElementChild);
        overlay.querySelector('#typed-rows .type-row:last-child input').focus();return;
      }
      if(e.target.closest('[data-remove-task]')){e.target.closest('.type-row').remove();return;}
      if(e.target.id==='typed-save'){
        const tasks=[...overlay.querySelectorAll('.type-row')].map(el=>({
          id:el.dataset.taskId||uid(),name:el.querySelector('[data-task-name]').value.trim(),
          type:el.querySelector('[data-kind]').value
        })).filter(t=>t.name);
        if(!tasks.length){alert('Cadastre pelo menos uma etapa.');return;}
            // Apaga apenas dados de etapas removidas ou que mudaram de tipo.
        const modified=new Set(l.tasks.filter(t=>!tasks.some(x=>x.id===t.id&&x.type===getType(t))).map(t=>t.id));
        for(const k of Object.keys(l.checks)) if(modified.has(k.split('|')[2]))delete l.checks[k];
        for(const k of Object.keys(l.values)) if(modified.has(k.split('|')[2]))delete l.values[k];
        l.tasks=tasks;
        save();close();render();
      }
    });
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    overlay.querySelector('input')?.focus();
  }
  // Intercepta somente o comando Etapas, preservando os outros comandos do original.
  document.addEventListener('click',e=>{
    if(!e.target.closest('[data-a="tasks"]'))return;
    e.preventDefault();e.stopImmediatePropagation();openTypedEditor();
  },true);

  // Mantém o renderizador original (temas, navegação, relatórios e gerenciamento de listas).
  render = function(){
    if(S && S.lists)S.lists.forEach(ensure);
    originalRender();
    const toolbar=document.querySelector('#app .tb');
    if(toolbar){
      const sort=document.createElement('label');sort.className='sort-wrapper';
      sort.innerHTML=`<span>Ordenar por</span><select class="in" id="company-sort" aria-label="Ordenar empresas">
        <option value="number-asc">Número: crescente</option><option value="number-desc">Número: decrescente</option>
        <option value="alpha-asc">Nome: A–Z</option><option value="alpha-desc">Nome: Z–A</option></select>`;
      toolbar.append(sort);
      sort.querySelector('select').value=getSort(L());
    }
    const head=document.querySelector('#app table thead tr');
    if(head){const th=document.createElement('th');th.textContent='Nº';th.title='Número editável da empresa';head.prepend(th);}
    upd();
  };

  upd = function(){
    const l=L(),p=P(l);ensure(l);
    const n=l.companies.length,d=l.companies.filter(c=>stat(l,p,c)==='done').length,pc=n?Math.round(d/n*100):0;
    const stats=document.querySelector('#stats');if(!stats)return;
    stats.innerHTML=`<div><b>${n}</b><span>empresas</span></div><div><b>${d}</b><span>concluídas</span></div><div><b>${n-d}</b><span>pendentes</span></div><div><b>${pc}%</b><span>de ${esc(p.name)}</span></div><div class="bar"><i style="width:${pc}%"></i></div>`;
    const q=Q.trim().toLocaleLowerCase('pt-BR');
    const rows=ordered(l,l.companies.filter(c=>(!q||c.name.toLocaleLowerCase('pt-BR').includes(q)||String(c.number).includes(q))&&(F==='all'||(F==='done')===(stat(l,p,c)==='done'))));
    const inputFor=(c,t)=>{
      const key=valueKey(p,c,t),type=getType(t);
      if(type==='check')return `<input type="checkbox" data-t="${esc(t.id)}" ${ck(l,p,c,t)?'checked':''} aria-label="${esc(t.name)}">`;
      const value=l.values[key]??'';
      return `<input class="cell-field" type="${type==='number'?'number':'text'}" ${type==='number'?'step="any" inputmode="decimal"':''}
        data-val="${esc(t.id)}" value="${esc(value)}" placeholder="${type==='number'?'0':'Preencher…'}" aria-label="${esc(t.name)} - ${esc(c.name)}">`;
    };
    document.querySelector('#rows').innerHTML=rows.map(c=>{
      const status=stat(l,p,c);
      return `<tr data-c="${esc(c.id)}"><td><input class="company-number" type="number" step="1" min="0" data-number value="${esc(c.number)}" aria-label="Número da empresa ${esc(c.name)}"></td>
        <td><input class="ni" data-f="name" value="${esc(c.name)}" aria-label="Nome da empresa"></td>
        ${l.tasks.map(t=>`<td class="c">${inputFor(c,t)}</td>`).join('')}
        <td><span class="st ${status}">${LBL[status]}</span></td>
        <td><input class="no" data-f="note" value="${esc(c.note)}" placeholder="Anotar..." aria-label="Observação"></td>
        <td><button class="x" data-a="delC" aria-label="Remover empresa">×</button></td></tr>`;
    }).join('')||`<tr><td colspan="${l.tasks.length+5}" class="empty">${n?'Nenhuma empresa nesse filtro.':'Lista vazia. Digite o nome de uma empresa e aperte Enter.'}</td></tr>`;
  };

  // Novos campos são independentes do handler original (data-f e data-t).
  document.addEventListener('change',e=>{
    const target=e.target;
    if(target.id==='company-sort'){setSort(L(),target.value);upd();return;}
    const tr=target.closest('tr[data-c]');if(!tr)return;
    const l=L(),p=P(l),c=l.companies.find(x=>x.id===tr.dataset.c);if(!c)return;
    if('number' in target.dataset){
      const value=target.value.trim();
      if(value==='' || !Number.isSafeInteger(Number(value)) || Number(value)<0){target.value=c.number;return;}
      c.number=Number(value);save();upd();return;
    }
    if(target.dataset.val){
      ensure(l);
      const task=l.tasks.find(t=>t.id===target.dataset.val);if(!task)return;
      const key=valueKey(p,c,task),value=target.value.trim();
      if(getType(task)==='number' && value!=='' && !Number.isFinite(Number(value))){target.value=l.values[key]??'';return;}
      if(value===''){delete l.values[key];delete l.checks[key];}
      else {l.values[key]=value;if(!l.checks[key])l.checks[key]=Date.now();}
      save();upd();
      const sidebar=document.querySelector(`#sb [data-id="${CSS.escape(l.id)}"] small`);
      if(sidebar)sidebar.textContent=l.companies.filter(x=>stat(l,p,x)==='done').length+'/'+l.companies.length;
    }
  });

  // Novas empresas recebem o próximo número; não altera números existentes.
  document.addEventListener('keydown',e=>{
    const input=e.target;
    if(input.id!=='addc' || e.key!=='Enter')return;
    e.stopImmediatePropagation();
    const name=input.value.trim();if(!name)return;
    const l=L();ensure(l);
    const next=l.companies.reduce((max,c)=>Math.max(max,Number(c.number)||0),0)+1;
    l.companies.push({id:uid(),name,note:'',number:next});
    input.value='';save();upd();
  },true);

  const css=document.createElement('style');
  css.textContent=`
    .sort-wrapper{display:flex;align-items:center;gap:8px;color:var(--mu);font-size:13px;white-space:nowrap}
    .sort-wrapper select{max-width:210px}
    .company-number{width:68px;min-width:68px;border:1px solid transparent;border-radius:6px;background:transparent;padding:8px 5px;font:inherit;text-align:center}
    .company-number:focus,.company-number:hover{border-color:var(--ln);background:var(--bg)}
    .cell-field{width:150px;min-width:110px;max-width:240px;border:1px solid var(--ln);background:var(--sf);border-radius:7px;padding:8px;color:var(--tx)}
    .cell-field:focus{outline:2px solid var(--ac);outline-offset:-1px}
    .typed-modal{width:min(620px,100%)}.type-hint{color:var(--mu);margin:-4px 0 16px;font-size:13px}
    .type-row{display:grid;grid-template-columns:minmax(100px,1fr) 135px 38px;gap:8px;margin:8px 0}
    .type-row input{width:100%;min-width:0}.type-select{width:100%;min-width:0}
    @media(max-width:600px){.sort-wrapper{width:100%;justify-content:space-between}.sort-wrapper select{flex:1;max-width:none}.type-row{grid-template-columns:minmax(90px,1fr) 110px 38px}}
    @media print{.company-number,.cell-field{border:0}}
  `;
  document.head.append(css);

  // O script original inicia o Auth assincronamente; para não haver corrida,
  // a primeira renderização é adaptada após Auth.start terminar.
  // Normalmente render só é chamado no callback do Auth e já foi sobrescrito.
  if (typeof S !== 'undefined' && S && Array.isArray(S.lists)) render();
})();
