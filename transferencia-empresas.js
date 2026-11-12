/* Minhas Listas: copiar e exportar TODOS os dados do periodo, sem conclusoes.
 * Mantem empresas, observacoes, numeros, etapas/tipos, campos de texto/numero e larguras.
 * NUNCA copia checks (checkpoints de conclusao); outros periodos ficam intactos.
 */
(() => {
  'use strict';
  const clonar = valor => JSON.parse(JSON.stringify(valor));
  const idUnico = () => uid();
  const resetarFeedback = () => document.querySelector('.transfer-feedback')?.remove();

  function aviso(texto, falha = false) {
    resetarFeedback();
    const e = document.createElement('div');
    e.className = 'transfer-feedback';
    e.setAttribute('role', 'status');
    e.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:100;max-width:420px;' +
      'padding:14px 17px;border:1px solid ' + (falha ? '#dc2626' : 'var(--ac)') +
      ';border-radius:10px;background:var(--sf);color:var(--tx);box-shadow:0 8px 22px #0003';
    e.textContent = texto;
    document.body.append(e);
    setTimeout(() => e.remove(), 6500);
  }

  // Retorna a versao mais recente do periodo, inclusive modificacoes locais ainda nao salvas.
  function dadosPeriodo(lista, periodoId) {
    const d = lista.periodData?.[periodoId] || lista.periodTemplate || {};
    return {
      companies: lista.activePeriodId === periodoId ? (lista.companies || []) :
        (d.companies || lista.companies || []),
      tasks: lista.activePeriodId === periodoId ? (lista.tasks || []) :
        (d.tasks || lista.tasks || []),
      columnWidths: d.columnWidths || {},
      sidebarCollapsed: !!d.sidebarCollapsed
    };
  }

  function extrairPeriodo(lista, periodoId) {
    const d = dadosPeriodo(lista, periodoId);
    const empresas = clonar(d.companies);
    const etapas = clonar(d.tasks);
    const idsEmpresas = new Set(empresas.map(c => String(c.id)));
    const tipos = new Map(etapas.map(t => [String(t.id), t.type || 'check']));
    const prefixo = periodoId + '|';
    const preenchimentos = [];
    for (const [chave, valor] of Object.entries(lista.values || {})) {
      if (!chave.startsWith(prefixo)) continue;
      const resto = chave.slice(prefixo.length).split('|');
      if (resto.length !== 2) continue;
      const [empresaId, etapaId] = resto;
      if (!idsEmpresas.has(empresaId) || !['text','number'].includes(tipos.get(etapaId))) continue;
      preenchimentos.push({empresaId, etapaId, valor: clonar(valor)});
    }
    return {
      formato: 'minhas-listas-modelo-periodo',
      versao: 2,
      listaOrigem: lista.name,
      periodoOrigem: lista.periods.find(p => p.id === periodoId)?.name || '',
      empresas,
      etapas,
      preenchimentos,
      larguras: clonar(d.columnWidths),
      menuRecolhido: d.sidebarCollapsed,
      ordenacao: S.sortOrders?.[lista.id] || 'number-asc'
      // Intencionalmente NAO inclui lista.checks, estados ou timestamps de conclusao.
    };
  }

  function validar(snapshot) {
    if (!snapshot || snapshot.formato !== 'minhas-listas-modelo-periodo' ||
        snapshot.versao !== 2 ||
        !Array.isArray(snapshot.empresas) || !Array.isArray(snapshot.etapas) ||
        !Array.isArray(snapshot.preenchimentos) || !snapshot.etapas.length ||
        snapshot.empresas.length > 20000 || snapshot.etapas.length > 500) {
      throw new Error('O arquivo nao e um modelo de periodo valido do Minhas Listas.');
    }
    if (snapshot.empresas.some(c => !c || typeof c !== 'object' ||
        !String(c.id || '').trim() || !String(c.name || '').trim()) ||
        snapshot.etapas.some(t => !t || typeof t !== 'object' ||
        !String(t.id || '').trim() || !String(t.name || '').trim())) {
      throw new Error('Empresas ou etapas invalidas no arquivo.');
    }
    const codigosEmpresas = snapshot.empresas.map(c => String(c.id));
    const codigosEtapas = snapshot.etapas.map(t => String(t.id));
    if (new Set(codigosEmpresas).size !== codigosEmpresas.length ||
        new Set(codigosEtapas).size !== codigosEtapas.length) {
      throw new Error('O arquivo contem identificadores duplicados.');
    }
  }

  function aplicarNoPeriodo(snapshot) {
    validar(snapshot);
    const lista = L();
    const periodoId = P(lista).id;
    if (!lista.periodData || typeof lista.periodData !== 'object') lista.periodData = {};
    if (!lista.checks || typeof lista.checks !== 'object') lista.checks = {};
    if (!lista.values || typeof lista.values !== 'object') lista.values = {};

    // Os IDs novos evitam que marcacoes antigas reaparecam por acidente.
    const idsEmpresa = new Map(), idsEtapa = new Map();
    const empresas = snapshot.empresas.map(empresa => {
      const nova = clonar(empresa);
      const novoId = idUnico();
      idsEmpresa.set(String(empresa.id), novoId);
      nova.id = novoId;
      return nova;
    });
    const etapas = snapshot.etapas.map(etapa => {
      const nova = clonar(etapa);
      const novoId = idUnico();
      idsEtapa.set(String(etapa.id), novoId);
      nova.id = novoId;
      if (!['check','text','number'].includes(nova.type)) nova.type = 'check';
      return nova;
    });
    const valores = {};
    for (const item of snapshot.preenchimentos) {
      if (!item || !idsEmpresa.has(String(item.empresaId)) ||
          !idsEtapa.has(String(item.etapaId))) continue;
      const etapa = etapas.find(t => t.id === idsEtapa.get(String(item.etapaId)));
      if (!etapa || !['text','number'].includes(etapa.type)) continue;
      const chave = periodoId + '|' + idsEmpresa.get(String(item.empresaId)) +
        '|' + idsEtapa.get(String(item.etapaId));
      valores[chave] = clonar(item.valor);
    }
    const larguras = {};
    if (snapshot.larguras && typeof snapshot.larguras === 'object' &&
        !Array.isArray(snapshot.larguras)) {
      for (const [chave, largura] of Object.entries(snapshot.larguras)) {
        if (!Number.isFinite(Number(largura))) continue;
        let novaChave = chave;
        if (chave.startsWith('task:')) {
          const trocado = idsEtapa.get(chave.slice(5));
          if (!trocado) continue;
          novaChave = 'task:' + trocado;
        }
        larguras[novaChave] = Number(largura);
      }
    }

    // Limpa APENAS o periodo destino. Outros meses/listas nao sao afetados.
    for (const mapa of [lista.checks, lista.values]) {
      for (const chave of Object.keys(mapa)) {
        if (chave.startsWith(periodoId + '|')) delete mapa[chave];
      }
    }
    Object.assign(lista.values, valores); // Campos textuais/numericos mantidos.
    // Nenhum checkpoint concluido e copiado.
    lista.periodData[periodoId] = {
      companies: clonar(empresas),
      tasks: clonar(etapas),
      columnWidths: larguras,
      sidebarCollapsed: !!snapshot.menuRecolhido
    };
    lista.companies = empresas;
    lista.tasks = etapas;
    lista.activePeriodId = periodoId;
    S.sortOrders ||= {};
    if (['number-asc','number-desc','alpha-asc','alpha-desc'].includes(snapshot.ordenacao)) {
      S.sortOrders[lista.id] = snapshot.ordenacao;
    }
    // Sistema de salvamento existente respeita o modo automatico/manual.
    save();
    render();
    aviso(snapshot.empresas.length + ' empresas e ' + snapshot.etapas.length +
      ' etapas copiadas, com campos preenchidos. Checkpoints desmarcados.' +
      (S.autoSave === false ? ' Clique em Salvar para confirmar.' : ''));
  }

  function confirmar(snapshot, titulo) {
    try { validar(snapshot); } catch (e) { aviso(e.message, true); return; }
    const lista = L();
    const periodo = P(lista);
    modal(titulo, 
      '<p>Destino: <b>' + esc(lista.name) + ' / ' + esc(periodo.name) + '</b>.</p>' +
      '<p>Serão transferidos <b>' + snapshot.empresas.length + ' empresas</b>, <b>' +
      snapshot.etapas.length + ' etapas</b>, observações, números, campos de texto/número e configurações das colunas.</p>' +
      '<p style="color:#b45309"><b>Atenção:</b> os dados atuais deste mês serão substituídos. ' +
      'Nenhum outro período será modificado. Todos os checkpoints do destino ficarão desmarcados.</p>' +
      '<label style="display:flex;gap:9px;align-items:center;margin:12px 0">' +
      '<input type="checkbox" id="confirmar-modelo"> Confirmo que quero substituir os dados deste mês.</label>',
      [{t:'Cancelar'}, {t:'Aplicar e zerar checkpoints',c:'pri',f:o => {
        if (!o.querySelector('#confirmar-modelo').checked) {
          aviso('Marque a confirmacao para substituir os dados deste mes.', true);
          return false;
        }
        try { aplicarNoPeriodo(snapshot); }
        catch (e) { aviso('Erro ao copiar: ' + e.message, true); return false; }
      }}]);
  }

  function copiarOutraCompetencia() {
    const atual = L(), p = P(atual);
    const fontes = S.lists.flatMap(lista => (lista.periods || [])
      .filter(periodo => lista.id !== atual.id || periodo.id !== p.id)
      .map(periodo => ({
        lista, periodo, d: dadosPeriodo(lista, periodo.id)
      })));
    if (!fontes.length) { aviso('Nao ha outra lista ou mes para copiar.', true); return; }
    const opcoes = fontes.map((fonte,i) => '<option value="' + i + '">' +
      esc(fonte.lista.name) + ' — ' + esc(fonte.periodo.name) +
      ' (' + fonte.d.companies.length + ' empresas, ' + fonte.d.tasks.length +
      ' etapas)</option>').join('');
    modal('Copiar todos os dados de outra lista ou mes',
      '<p>Escolha a lista/mês de origem. Os checkpoints de conclusão não serão copiados.</p>' +
      '<select class="in" id="origem-modelo" style="width:100%">' + opcoes + '</select>',
      [{t:'Cancelar'}, {t:'Continuar',c:'pri',f:o => {
        const fonte = fontes[Number(o.querySelector('#origem-modelo').value)];
        if (!fonte) return false;
        const snapshot = extrairPeriodo(fonte.lista, fonte.periodo.id);
        // So abrir confirmacao apos fechar o primeiro dialogo.
        setTimeout(() => confirmar(snapshot,'Confirmar copia completa do periodo'), 0);
      }}]);
  }

  function exportarJson() {
    try {
      const lista = L(), periodo = P(lista);
      const snapshot = extrairPeriodo(lista, periodo.id);
      validar(snapshot);
      const blob = new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const nome = ('modelo-' + lista.name + '-' + periodo.name)
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
      const link = document.createElement('a');
      link.href = url; link.download = (nome || 'modelo-minhas-listas') + '.json';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      aviso('Modelo exportado com campos preenchidos e sem checkpoints concluidos.');
    } catch (e) { aviso('Falha na exportacao: ' + e.message, true); }
  }

  async function importarJson(arquivo) {
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) {
      aviso('O arquivo JSON deve ter no maximo 10 MB.', true);
      return;
    }
    try {
      const snapshot = JSON.parse(await arquivo.text());
      validar(snapshot);
      confirmar(snapshot, 'Importar modelo com dados completos');
    } catch(e) { aviso('Falha na importacao: ' + e.message, true); }
  }

  const renderAnterior = render;
  render = function () {
    renderAnterior();
    const barra = document.querySelector('#app .tb');
    if (!barra || !S || !Array.isArray(S.lists) || !S.lists.length) return;
    const acoes = document.createElement('div');
    acoes.className = 'transferencia-modelo';
    acoes.innerHTML =
      '<button class="btn" type="button" data-modelo="copiar">Copiar tudo de outra lista / mês</button>' +
      '<button class="btn" type="button" data-modelo="exportar">Exportar dados (JSON)</button>' +
      '<button class="btn" type="button" data-modelo="importar">Importar dados (JSON)</button>' +
      '<input type="file" id="arquivo-modelo" accept=".json,application/json" hidden aria-label="Arquivo de modelo">';
    barra.after(acoes);
  };

  document.addEventListener('click',e => {
    const botao = e.target.closest('[data-modelo]');
    if (!botao || !S) return;
    if (botao.dataset.modelo === 'copiar') copiarOutraCompetencia();
    if (botao.dataset.modelo === 'exportar') exportarJson();
    if (botao.dataset.modelo === 'importar') {
      const entrada = document.querySelector('#arquivo-modelo');
      if (entrada) { entrada.value = ''; entrada.click(); }
    }
  });
  document.addEventListener('change',e => {
    if (e.target.id === 'arquivo-modelo') importarJson(e.target.files?.[0]);
  });
  const css = document.createElement('style');
  css.textContent = '.transferencia-modelo{display:flex;flex-wrap:wrap;gap:9px;margin:10px 0 14px}' +
    '.transferencia-modelo .btn{white-space:normal;text-align:center}' +
    '@media(max-width:600px){.transferencia-modelo .btn{flex:1 1 180px}}' +
    '@media print{.transferencia-modelo,.transfer-feedback{display:none!important}}';
  document.head.append(css);
  if (typeof S !== 'undefined' && S && Array.isArray(S.lists)) render();
})();