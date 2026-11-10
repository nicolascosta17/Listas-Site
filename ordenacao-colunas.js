/* Listas-Site: reorganizacao de colunas por competencia.
   Carregar apos periodo-edicao.js. */
(() => {
  'use strict';
  const renderAnterior = render;
  const updAnterior = upd;
  let duranteRender = false;
  let arrastando = null;

  function atual() {
    if (!S?.lists?.length) return null;
    const lista = L(), periodo = P(lista);
    const dados = lista.periodData?.[periodo.id];
    if (!dados) return null;
    const chaves = ['number','company',...lista.tasks.map(t=>'task:'+t.id),'status','note','actions'];
    const nomes = ['Nº','Empresa',...lista.tasks.map(t=>t.name),'Status','Observação','Ações'];
    return {lista,periodo,dados,chaves,nomes};
  }

  function ordem(c) {
    const antigas = Array.isArray(c.dados.columnOrder) ? c.dados.columnOrder : [];
    const resultado = antigas.filter((chave,i)=>c.chaves.includes(chave) && antigas.indexOf(chave)===i);
    // Campos criados posteriormente entram perto da posição padrão.
    c.chaves.forEach((chave,i)=>{
      if (resultado.includes(chave)) return;
      const seguinte = c.chaves.slice(i+1).find(k=>resultado.includes(k));
      resultado.splice(seguinte ? resultado.indexOf(seguinte) : resultado.length,0,chave);
    });
    return resultado;
  }

  function identificar(t,c) {
    const cab = t.tHead?.rows[0], cols = [...(t.querySelector('colgroup')?.children||[])];
    if (!cab || cab.cells.length!==c.chaves.length || cols.length!==c.chaves.length) return false;
    [...cab.cells].forEach((el,i)=>{if (!el.dataset.colKey) el.dataset.colKey=c.chaves[i]});
    cols.forEach((el,i)=>{if (!el.dataset.colKey) el.dataset.colKey=c.chaves[i]});
    return true;
  }

  function marcarLinhas(t,c) {
    [...(t.tBodies[0]?.rows||[])].forEach(tr=>{
      if (tr.cells.length!==c.chaves.length) return;
      [...tr.cells].forEach((cel,i)=>{if(!cel.dataset.colKey)cel.dataset.colKey=c.chaves[i]});
    });
  }

  function reorganizar(pai,elementos,desejada) {
    if (!pai || elementos.length!==desejada.length) return;
    const mapa = new Map(elementos.map(el=>[el.dataset.colKey,el]));
    const ordenados = desejada.map(chave=>mapa.get(chave));
    if (ordenados.some(el=>!el) || ordenados.every((el,i)=>el===elementos[i])) return;
    ordenados.forEach(el=>pai.append(el));
  }

  function aplicar() {
    const c=atual(),t=document.querySelector('#app .wrap table');
    if (!c || !t || !identificar(t,c)) return;
    marcarLinhas(t,c);
    const sequencia=ordem(c);
    const cab=t.tHead.rows[0],grupo=t.querySelector('colgroup');
    reorganizar(cab,[...cab.cells],sequencia);
    reorganizar(grupo,[...grupo.children],sequencia);
    [...(t.tBodies[0]?.rows||[])].forEach(tr=>{
      if(tr.cells.length===sequencia.length) reorganizar(tr,[...tr.cells],sequencia);
    });
  }

  function guardar(sequencia) {
    const c=atual();
    if(!c || sequencia.length!==c.chaves.length || new Set(sequencia).size!==sequencia.length ||
       sequencia.some(k=>!c.chaves.includes(k))) return;
    c.dados.columnOrder=[...sequencia];
    aplicar();
    save(); // Respeita o modo manual ou automatico do projeto.
  }

  function deslocar(chave,delta) {
    const c=atual();if(!c)return;
    const lista=ordem(c),i=lista.indexOf(chave),j=i+delta;
    if(i<0||j<0||j>=lista.length)return;
    [lista[i],lista[j]]=[lista[j],lista[i]];
    guardar(lista);
  }

  function soltarSobre(origem,destino) {
    const c=atual();if(!c||origem===destino)return;
    const lista=ordem(c),i=lista.indexOf(origem),j=lista.indexOf(destino);
    if(i<0||j<0)return;
    lista.splice(i,1);
    lista.splice(lista.indexOf(destino)+(i<j?1:0),0,origem);
    guardar(lista);
  }

  function instalar() {
    const c=atual(),t=document.querySelector('#app .wrap table');
    if(!c||!t||!identificar(t,c))return;
    [...t.tHead.rows[0].cells].forEach(th=>{
      if(th.querySelector('.reorder-grip'))return;
      const nome=c.nomes[c.chaves.indexOf(th.dataset.colKey)]||'Coluna';
      const grip=document.createElement('span');
      grip.className='reorder-grip';grip.draggable=true;grip.tabIndex=0;
      grip.setAttribute('role','button');grip.setAttribute('aria-label','Mover coluna '+nome);
      grip.title='Arraste para reorganizar, ou use Alt + setas';grip.textContent='⠿';
      th.prepend(grip);
    });
    const barra=document.querySelector('#app .save-controls');
    if(barra&&!barra.querySelector('[data-organizar-colunas]')){
      const botao=document.createElement('button');
      botao.className='btn';botao.type='button';botao.dataset.organizarColunas='1';
      botao.textContent='⇄ Organizar colunas';
      barra.insertBefore(botao,barra.querySelector('[data-feature="reset-widths"]'));
    }
  }

  function abrirEditor() {
    const c=atual();if(!c)return;
    document.querySelector('.reorder-overlay')?.remove();
    const overlay=document.createElement('div');overlay.className='ov reorder-overlay';
    overlay.innerHTML='<div class="md reorder-modal" role="dialog" aria-modal="true" aria-label="Organizar colunas">'+
      '<h3>Organizar colunas</h3><p class="reorder-help"></p><div class="reorder-rows"></div>'+
      '<div class="ma"><button class="btn" data-reset-order>Restaurar ordem</button>'+
      '<button class="btn pri" data-close-order>Concluir</button></div></div>';
    overlay.querySelector('.reorder-help').textContent='Use as setas para organizar '+c.periodo.name+'. Cada período tem sua própria ordem.';
    function atualizar() {
      const c=atual();if(!c)return;
      const sequencia=ordem(c),raiz=overlay.querySelector('.reorder-rows');
      raiz.replaceChildren();
      sequencia.forEach((chave,i)=>{
        const linha=document.createElement('div');linha.className='reorder-row';
        const nome=document.createElement('span');nome.textContent=c.nomes[c.chaves.indexOf(chave)];
        const esquerda=document.createElement('button'),direita=document.createElement('button');
        [esquerda,direita].forEach((b,j)=>{
          b.type='button';b.className='btn';b.textContent=j?'→':'←';
          b.setAttribute('aria-label','Mover '+nome.textContent+(j?' para a direita':' para a esquerda'));
          b.disabled=j?i===sequencia.length-1:i===0;
          b.onclick=()=>{deslocar(chave,j?1:-1);atualizar()};
        });
        linha.append(nome,esquerda,direita);raiz.append(linha);
      });
    }
    overlay.addEventListener('click',ev=>{
      if(ev.target===overlay||ev.target.closest('[data-close-order]'))overlay.remove();
      else if(ev.target.closest('[data-reset-order]')){guardar([...atual().chaves]);atualizar()}
    });
    overlay.addEventListener('keydown',ev=>{if(ev.key==='Escape')overlay.remove()});
    document.body.append(overlay);atualizar();overlay.querySelector('[data-close-order]').focus();
  }

  render=function(...args) {
    duranteRender=true;
    try{return renderAnterior.apply(this,args)}
    finally{duranteRender=false;aplicar();instalar()}
  };
  upd=function(...args) {
    const resultado=updAnterior.apply(this,args);
    if(!duranteRender)aplicar();
    return resultado;
  };

  document.addEventListener('click',ev=>{
    if(ev.target.closest('[data-organizar-colunas]'))abrirEditor();
  });
  document.addEventListener('dragstart',ev=>{
    const grip=ev.target.closest?.('.reorder-grip');
    if(!grip)return;
    arrastando=grip.closest('th')?.dataset.colKey||null;
    if(!arrastando)return;
    ev.dataTransfer.effectAllowed='move';
    ev.dataTransfer.setData('text/plain',arrastando);
    document.body.classList.add('reordering');
  });
  document.addEventListener('dragover',ev=>{
    if(!arrastando)return;
    const th=ev.target.closest?.('#app .wrap th[data-col-key]');
    if(!th||th.dataset.colKey===arrastando)return;
    ev.preventDefault();ev.dataTransfer.dropEffect='move';
    document.querySelectorAll('.reorder-target').forEach(el=>el.classList.remove('reorder-target'));
    th.classList.add('reorder-target');
  });
  function limpar(){
    document.querySelectorAll('.reorder-target').forEach(el=>el.classList.remove('reorder-target'));
    document.body.classList.remove('reordering');arrastando=null;
  }
  document.addEventListener('drop',ev=>{
    if(!arrastando)return;
    const th=ev.target.closest?.('#app .wrap th[data-col-key]');
    ev.preventDefault();
    if(th)soltarSobre(arrastando,th.dataset.colKey);
    limpar();
  });
  document.addEventListener('dragend',limpar);
  document.addEventListener('keydown',ev=>{
    const grip=ev.target.closest?.('.reorder-grip');
    if(!grip)return;
    if(ev.altKey&&(ev.key==='ArrowLeft'||ev.key==='ArrowRight')){
      ev.preventDefault();deslocar(grip.closest('th')?.dataset.colKey,ev.key==='ArrowLeft'?-1:1);
      grip.focus();
    }else if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();abrirEditor()}
  });

  const css=document.createElement('style');
  css.textContent=`
    .reorder-grip{display:inline-flex;align-items:center;justify-content:center;
      min-width:18px;height:22px;margin-right:6px;border-radius:4px;font-size:17px;
      line-height:1;vertical-align:middle;color:var(--mu);cursor:grab;
      user-select:none;touch-action:manipulation}
    .reorder-grip:hover,.reorder-grip:focus-visible{
      background:color-mix(in srgb,var(--ac) 16%,transparent);
      color:var(--tx);outline:2px solid var(--ac)}
    body.reordering .reorder-grip{cursor:grabbing}
    #app .wrap th.reorder-target{
      background:color-mix(in srgb,var(--ac) 17%,var(--sf));
      box-shadow:inset 3px 0 var(--ac)}
    .reorder-modal{width:min(550px,100%)}
    .reorder-help{font-size:13px;color:var(--mu);margin:0 0 14px}
    .reorder-rows{display:flex;flex-direction:column;gap:7px;max-height:52vh;overflow:auto}
    .reorder-row{display:flex;align-items:center;gap:8px;padding:7px 9px;
      border:1px solid var(--ln);border-radius:8px;background:var(--bg)}
    .reorder-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .reorder-row .btn{padding:6px 12px}
    .reorder-row .btn:disabled{opacity:.35;cursor:default}
    @media print{.reorder-grip,[data-organizar-colunas]{display:none!important}}
  `;
  document.head.append(css);
  if(typeof S!=='undefined'&&S?.lists?.length)render();
})();