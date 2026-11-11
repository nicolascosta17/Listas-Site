/* Recursos do Listas-Site: isolamento de dados por período, colunas ajustáveis,
   barra lateral compacta e salvamento manual/automático no Supabase.
   Carregar DEPOIS de campos-personalizados.js. */
(() => {
  'use strict';

  const copiar = valor => JSON.parse(JSON.stringify(valor));
  const renderAnterior = render;
  const relatorioAnterior = reportData;
  const gravarAutomatico = Auth.save.bind(Auth);
  const porVersao = new Map();
  let ultimoSalvo = null;
  let ultimaFila = null;
  let pendente = false;
  let salvando = false;
  let erro = '';

  const periodoAtual = l => P(l).id;
  const existePeriodo = (l, id) => l.periods.some(p => p.id === id);
  const modelo = l => ({
    companies: copiar(l.periodTemplate.companies),
    tasks: copiar(l.periodTemplate.tasks),
    columnWidths: {},
    sidebarCollapsed: false
  });

  function prepararLista(l) {
    if (!l || !l.periods?.length) return;
    if (!l.periodData || typeof l.periodData !== 'object') l.periodData = {};
    // Migração conservadora: o conteúdo já existente permanece no período aberto.
    // Nos demais períodos, usa-se uma cópia independente dos dados originais.
    if (!l.periodTemplate) l.periodTemplate = {
      companies: copiar(l.companies || []), tasks: copiar(l.tasks || [])
    };
    if (!l.activePeriodId) {
      const id = periodoAtual(l);
      if (!l.periodData[id]) l.periodData[id] = {
        companies: copiar(l.companies || []), tasks: copiar(l.tasks || []),
        columnWidths: {}, sidebarCollapsed: false
      };
      l.activePeriodId = id;
      l.companies = copiar(l.periodData[id].companies);
      l.tasks = copiar(l.periodData[id].tasks);
    }
  }

  function dadosDoPeriodo(l, id) {
    prepararLista(l);
    if (!l.periodData[id]) l.periodData[id] = modelo(l);
    return l.periodData[id];
  }

  function capturar(l) {
    prepararLista(l);
    if (!l?.activePeriodId) return;
    const d = dadosDoPeriodo(l, l.activePeriodId);
    d.companies = copiar(l.companies);
    d.tasks = copiar(l.tasks);
  }

  function capturarTudo() {
    if (!S || !Array.isArray(S.lists)) return;
    S.lists.forEach(capturar);
  }

  function sincronizarPeriodo(l) {
    prepararLista(l);
    const id = periodoAtual(l);
    if (id !== l.activePeriodId) {
      capturar(l);
      const d = dadosDoPeriodo(l, id);
      l.companies = copiar(d.companies);
      l.tasks = copiar(d.tasks);
      l.activePeriodId = id;
    }
    return dadosDoPeriodo(l, id);
  }

  function textoStatus() {
    if (erro) return 'Erro ao salvar: ' + erro;
    if (salvando) return 'Salvando na sua conta…';
    if (pendente) return S?.autoSave === false ? 'Alterações não salvas' : 'Aguardando salvamento…';
    return 'Tudo salvo na sua conta';
  }

  function atualizarStatus() {
    const b = document.querySelector('[data-feature="save"]');
    const s = document.querySelector('#save-status');
    const a = document.querySelector('#auto-save');
    if (b) b.disabled = salvando;
    if (s) {
      s.textContent = textoStatus();
      s.dataset.state = erro ? 'error' : pendente ? 'pending' : 'saved';
    }
    if (a && S) a.checked = S.autoSave !== false;
  }

  // Filtra as gravações automáticas: no modo manual, mudanças ficam pendentes
  // e o estado não é enviado ao Supabase até clicar em Salvar.
  Auth.isDirty = () => pendente || salvando || !!erro;

  Auth.save = function(estado) {
    if (!estado || !estado.lists) return;
    if (Auth.isRefreshing) {
      ultimoSalvo = JSON.stringify(estado);
      ultimaFila = ultimoSalvo;
      pendente = false;
      erro = '';
      atualizarStatus();
      return;
    }
    capturarTudo();
    const json = JSON.stringify(estado);
    if (ultimoSalvo === null) {
      ultimoSalvo = json;
      ultimaFila = null;
    }
    if (json === ultimaFila && !erro) {
      pendente = json !== ultimoSalvo;
      atualizarStatus();
      return;
    }
    pendente = json !== ultimoSalvo;
    erro = '';
    ultimaFila = json;
    if (estado.autoSave !== false && pendente) {
      const versao = gravarAutomatico(estado);
      if (versao != null) {
        porVersao.set(versao, json);
        if (porVersao.size > 60) porVersao.delete(porVersao.keys().next().value);
      }
    }
    atualizarStatus();
  };

  document.addEventListener('listas:remote', () => {
    ultimoSalvo = JSON.stringify(S);
    ultimaFila = ultimoSalvo;
    pendente = false;
    erro = '';
    atualizarStatus();
  });

  document.addEventListener('listas:save', e => {
    const {status, version, message} = e.detail || {};
    if (status === 'saving') { salvando = true; erro = ''; }
    if (status === 'saved') {
      salvando = false;
      if (porVersao.has(version)) {
        ultimoSalvo = porVersao.get(version);
        for (const key of [...porVersao.keys()]) if (key <= version) porVersao.delete(key);
      }
      capturarTudo();
      pendente = JSON.stringify(S) !== ultimoSalvo;
      erro = '';
    }
    if (status === 'error') {
      salvando = false;
      pendente = true;
      erro = message || 'Falha na conexão';
    }
    atualizarStatus();
  });

  async function salvarAgora() {
    if (!S) return false;
    capturarTudo();
    const json = JSON.stringify(S);
    salvando = true;
    erro = '';
    atualizarStatus();
    try {
      await Auth.saveNow(S);
      ultimoSalvo = json;
      ultimaFila = json;
      pendente = JSON.stringify(S) !== json;
      salvando = false;
      atualizarStatus();
      return true;
    } catch (e) {
      salvando = false;
      pendente = true;
      erro = e.message || 'Falha na conexão';
      atualizarStatus();
      return false;
    }
  }

  function instalarBarra() {
    const top = document.querySelector('#app .top');
    const tabs = document.querySelector('#app .tabs');
    if (!top || !tabs) return;
    const d = sincronizarPeriodo(L());
    document.body.classList.toggle('side-collapsed', !!d.sidebarCollapsed);
    const esconder = document.createElement('button');
    esconder.className = 'btn toggle-sidebar';
    esconder.type = 'button';
    esconder.dataset.feature = 'sidebar';
    esconder.textContent = d.sidebarCollapsed ? '▶ Menu' : '◀ Menu';
    esconder.setAttribute('aria-label', d.sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral');
    esconder.setAttribute('aria-expanded', String(!d.sidebarCollapsed));
    top.insertBefore(esconder, top.querySelector('h1'));

    const barra = document.createElement('div');
    barra.className = 'save-controls';
    barra.innerHTML = '<button class="btn pri" type="button" data-feature="save">💾 Salvar</button>' +
      '<label class="autosave-option"><input id="auto-save" type="checkbox"> Salvar automaticamente</label>' +
      '<button class="btn" type="button" data-feature="reset-widths">Restaurar larguras</button>' +
      '<span id="save-status" role="status" aria-live="polite"></span>';
    tabs.after(barra);
    atualizarStatus();
  }

  function instalarColunas() {
    const table = document.querySelector('#app .wrap table');
    const cabecalho = table?.tHead?.rows[0];
    const l = L();
    if (!cabecalho || !l) return;
    const d = sincronizarPeriodo(l);
    const keys = ['number','company',...l.tasks.map(t => 'task:' + t.id),'status','note','actions'];
    if (cabecalho.cells.length !== keys.length) return;
    const defaults = [78,280,...l.tasks.map(t => t.type === 'number' ? 140 : t.type === 'text' ? 200 : Math.max(145, Math.min(250, t.name.length * 8 + 35))),145,235,58];
    const larguras = keys.map((key,i) => {
      const w = Number(d.columnWidths?.[key]);
      return Number.isFinite(w) && w >= 52 ? w : defaults[i];
    });
    const group = document.createElement('colgroup');
    const cols = larguras.map(w => {
      const c = document.createElement('col'); c.style.width = w + 'px'; group.append(c); return c;
    });
    table.prepend(group);
    table.style.tableLayout = 'fixed';

    function ajustarTabela() {
      const sum = larguras.reduce((a,b)=>a+b,0);
      const wrap = table.closest('.wrap');
      table.style.width = Math.max(sum, wrap?.clientWidth || 0) + 'px';
      table.style.minWidth = sum + 'px';
    }
    function dimensionar(i, largura) {
      const min = keys[i] === 'actions' ? 52 : keys[i] === 'company' ? 125 : 70;
      larguras[i] = Math.round(Math.max(min, Math.min(900, largura)));
      cols[i].style.width = larguras[i] + 'px';
      ajustarTabela();
    }
    function concluir(i) {
      if (!d.columnWidths) d.columnWidths = {};
      d.columnWidths[keys[i]] = larguras[i];
      save();
    }

    [...cabecalho.cells].forEach((th, i) => {
      const h = document.createElement('span');
      h.className = 'col-resizer';
      h.setAttribute('role', 'separator');
      h.setAttribute('tabindex', '0');
      h.setAttribute('aria-orientation', 'vertical');
      h.setAttribute('aria-label', 'Redimensionar ' + (th.textContent.trim() || 'coluna') + '. Use as setas esquerda e direita.');
      h.title = 'Arraste para alterar a largura; clique duas vezes para ajustar';
      let x = 0, inicial = 0, arrastando = false;
      h.addEventListener('pointerdown', ev => {
        if (ev.button !== 0) return;
        ev.preventDefault(); ev.stopPropagation();
        x = ev.clientX; inicial = larguras[i]; arrastando = true;
        document.body.classList.add('resizing-column');
        h.setPointerCapture?.(ev.pointerId);
      });
      h.addEventListener('pointermove', ev => {
        if (arrastando) dimensionar(i, inicial + ev.clientX - x);
      });
      function terminar() {
        if (!arrastando) return;
        arrastando = false;
        document.body.classList.remove('resizing-column');
        concluir(i);
      }
      h.addEventListener('pointerup', terminar);
      h.addEventListener('pointercancel', terminar);
      h.addEventListener('lostpointercapture', terminar);
      h.addEventListener('dblclick', ev => {
        ev.preventDefault(); ev.stopPropagation();
        const cells = [...table.rows].slice(0,120).map(row => row.cells[i]).filter(Boolean);
        const largura = Math.max(70, ...cells.map(c => {
          const inp = c.querySelector('input');
          const texto = inp ? (inp.value || inp.placeholder || '') : c.textContent;
          return (texto || '').length * 7.7 + 42;
        }));
        dimensionar(i, largura); concluir(i);
      });
      h.addEventListener('keydown', ev => {
        if (!['ArrowLeft','ArrowRight'].includes(ev.key)) return;
        ev.preventDefault();
        dimensionar(i, larguras[i] + (ev.key === 'ArrowRight' ? 10 : -10));
        concluir(i);
      });
      th.append(h);
    });
    ajustarTabela();
  }

  render = function() {
    if (S && Array.isArray(S.lists) && S.lists.length) sincronizarPeriodo(L());
    renderAnterior();
    if (S && S.lists.length) {
      instalarBarra();
      instalarColunas();
    }
  };

  // Relatórios mensais consultam exatamente as empresas e etapas da competência
  // escolhida, mesmo quando outra aba está ativa.
  reportData = function() {
    const l = L();
    if (!l) return relatorioAnterior();
    capturar(l);
    const id = R.t === 'month' && existePeriodo(l,R.p) ? R.p : periodoAtual(l);
    const d = dadosDoPeriodo(l,id);
    const anteriores = {companies:l.companies,tasks:l.tasks};
    l.companies = d.companies;
    l.tasks = d.tasks;
    try { return relatorioAnterior(); }
    finally { l.companies = anteriores.companies; l.tasks = anteriores.tasks; }
  };

  function trocar(a, id) {
    document.body.classList.remove('sbo');
    if (a === 'list') { S.cur = id; Q = ''; }
    else if (a === 'per') S.per[L().id] = id;
    render();
  }

  // Intercepta a mudança de lista/período para não perder alterações no modo manual.
  document.addEventListener('click', ev => {
    const alvo = ev.target.closest('[data-a="per"], [data-a="list"]');
    if (!alvo || !S || S.autoSave !== false || !pendente) return;
    const a = alvo.dataset.a, id = alvo.dataset.id;
    if ((a === 'per' && id === periodoAtual(L())) || (a === 'list' && id === S.cur)) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    modal('Alterações ainda não salvas',
      '<p>Você modificou esta competência. Salve os dados antes de mudar de período ou lista.</p><p class="change-error" style="color:#dc2626"></p>',
      [{t:'Cancelar'},{t:'Salvar e continuar',c:'pri',f:o => {
        const b = o.querySelector('.pri');
        b.disabled = true;
        salvarAgora().then(ok => {
          if (ok) { o.remove(); trocar(a,id); }
          else { b.disabled = false; o.querySelector('.change-error').textContent = textoStatus(); }
        });
        return false;
      }}]);
  }, true);

  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-feature]');
    if (!b || !S) return;
    const action = b.dataset.feature;
    if (action === 'save') { await salvarAgora(); return; }
    const l = L(), d = sincronizarPeriodo(l);
    if (action === 'sidebar') {
      d.sidebarCollapsed = !d.sidebarCollapsed;
      document.body.classList.toggle('side-collapsed', d.sidebarCollapsed);
      b.textContent = d.sidebarCollapsed ? '▶ Menu' : '◀ Menu';
      b.setAttribute('aria-expanded', String(!d.sidebarCollapsed));
      b.setAttribute('aria-label', d.sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral');
      save();
    }
    if (action === 'reset-widths') {
      d.columnWidths = {};
      save();
      render();
    }
  });

  document.addEventListener('change', async ev => {
    if (ev.target.id !== 'auto-save' || !S) return;
    if (ev.target.checked) {
      S.autoSave = true;
      save();
    } else {
      S.autoSave = false;
      // Persiste a própria escolha e eventuais alterações já feitas.
      await salvarAgora();
    }
    atualizarStatus();
  });

  window.addEventListener('beforeunload', ev => {
    if (S && S.autoSave === false && pendente) {
      ev.preventDefault(); ev.returnValue = '';
    }
  });

  const css = document.createElement('style');
  css.textContent = `
    .save-controls{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 15px}
    .autosave-option{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--tx);cursor:pointer}
    .autosave-option input{appearance:auto;width:17px;height:17px;accent-color:var(--ac);margin:0}
    #save-status{font-size:12px;color:var(--mu)}
    #save-status[data-state="error"]{color:#dc2626}
    #save-status[data-state="pending"]{color:var(--wa)}
    #app .wrap table th,#app .wrap table td{overflow:hidden;text-overflow:ellipsis}
    #app .wrap table th{position:relative;padding-right:17px}
    #app .wrap .ni,#app .wrap .no,#app .wrap .cell-field{
      display:block;box-sizing:border-box;width:100%;min-width:0;max-width:none
    }
    .col-resizer{position:absolute;right:-4px;top:0;bottom:0;width:10px;z-index:3;cursor:col-resize;touch-action:none}
    .col-resizer:hover,.col-resizer:focus-visible{background:color-mix(in srgb,var(--ac) 23%,transparent);outline:none}
    body.resizing-column,body.resizing-column *{cursor:col-resize!important;user-select:none!important}
    @media(min-width:801px){
      body.side-collapsed #sb{width:72px;padding-left:7px;padding-right:7px}
      body.side-collapsed #sb .brand{font-size:0;padding:0;height:35px}
      body.side-collapsed #sb .brand::before{content:'☷';font-size:24px}
      body.side-collapsed #sb .li{justify-content:center;min-height:42px}
      body.side-collapsed #sb .li span,body.side-collapsed #sb .li small{display:none}
      body.side-collapsed #sb .li::before{content:'▤';font-size:21px;line-height:23px}
      body.side-collapsed #sb .sbf button{font-size:0;min-height:40px;padding:8px}
      body.side-collapsed #sb .sbf button::before{font-size:20px;content:'⚙'}
      body.side-collapsed #sb .sbf [data-a="newList"]::before{content:'+'}
      body.side-collapsed #sb .sbf [data-lo]::before{content:'⇥'}
    }
    @media(max-width:800px){.toggle-sidebar{display:none}}
    @media print{.save-controls,.toggle-sidebar,.col-resizer{display:none!important}}
  `;
  document.head.append(css);
  // Caso a autenticação tenha terminado antes do carregamento desta extensão.
  if (typeof S !== 'undefined' && S && Array.isArray(S.lists)) render();
})();
