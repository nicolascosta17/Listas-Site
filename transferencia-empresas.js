/* Transferencia de cadastros entre listas e periodos e arquivos CSV.
 * Compativel com o armazenamento atual de Listas-Site e com periodo-edicao.js.
 * Nao altera marcacoes, etapas, relatorios ou dados de outros usuarios.
 */
(() => {
  'use strict';

  const normalizar = valor => String(valor ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
    .trim().toLocaleLowerCase('pt-BR');

  function empresasDoPeriodo(lista, periodoId) {
    if (lista.activePeriodId === periodoId) return lista.companies || [];
    return lista.periodData?.[periodoId]?.companies
      || lista.periodTemplate?.companies || lista.companies || [];
  }

  function adicionarSemDuplicar(empresas) {
    const destino = L();
    if (!Array.isArray(destino.companies)) destino.companies = [];
    const existentes = new Set(destino.companies.map(c => normalizar(c.name)));
    const numeros = new Set(destino.companies.map(c => Number(c.number))
      .filter(n => Number.isSafeInteger(n) && n >= 0));
    let proximo = Math.max(0, ...numeros);
    let adicionadas = 0;
    let repetidas = 0;

    for (const original of empresas) {
      const nome = String(original.name ?? '').replace(/\s+/g, ' ').trim();
      const chave = normalizar(nome);
      if (!chave) continue;
      if (existentes.has(chave)) { repetidas++; continue; }
      let numero = Number(original.number);
      if (original.number === '' || original.number == null ||
          !Number.isSafeInteger(numero) || numero < 0 || numeros.has(numero)) {
        do { numero = ++proximo; } while (numeros.has(numero));
      }
      numeros.add(numero);
      proximo = Math.max(proximo, numero);
      destino.companies.push({
        id: uid(), name: nome, note: String(original.note ?? ''), number: numero
      });
      existentes.add(chave);
      adicionadas++;
    }
    if (adicionadas) { save(); render(); }
    return { adicionadas, repetidas };
  }

  function mensagem(texto, erro = false) {
    document.querySelector('.empresas-feedback')?.remove();
    const el = document.createElement('div');
    el.className = 'empresas-feedback';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;bottom:24px;right:18px;z-index:110;max-width:400px;padding:13px 17px;border-radius:10px;box-shadow:0 8px 24px #0003;background:var(--sf);color:var(--tx);border:1px solid ' +
      (erro ? '#dc2626' : 'var(--ac)');
    el.textContent = texto;
    document.body.append(el);
    setTimeout(() => el.remove(), 6500);
  }

  function copiarDeOutroPeriodo() {
    const atual = L(), periodoAtual = P(atual);
    const fontes = S.lists.flatMap(lista => (lista.periods || [])
      .filter(p => !(lista.id === atual.id && p.id === periodoAtual.id))
      .map(p => ({
        lista, periodo: p,
        quantidade: empresasDoPeriodo(lista, p.id).length
      })));
    if (!fontes.length) {
      mensagem('Crie outro periodo ou outra lista para utilizar a copia de empresas.', true);
      return;
    }

    const opcoes = fontes.map((fonte, i) =>
      `<option value="${i}">${esc(fonte.lista.name)} — ${esc(fonte.periodo.name)} (${fonte.quantidade} empresas)</option>`).join('');
    modal('Copiar empresas de outra lista ou periodo',
      `<p>Destino: <b>${esc(atual.name)} / ${esc(periodoAtual.name)}</b>.</p>
       <p>Escolha de onde deseja copiar o cadastro:</p>
       <select class="in" id="empresa-origem" style="width:100%">${opcoes}</select>
       <p style="font-size:13px;color:var(--mu)">Somente nome, numero e observacao sao copiados.
       Empresas ja existentes nao serao duplicadas. Etapas, marcacoes e preenchimentos permanecem como estao.</p>`,
      [{t:'Cancelar'}, {t:'Copiar empresas', c:'pri', f:janela => {
        const idx = Number(janela.querySelector('#empresa-origem').value);
        const fonte = fontes[idx];
        if (!fonte) return false;
        const {adicionadas, repetidas} = adicionarSemDuplicar(
          empresasDoPeriodo(fonte.lista, fonte.periodo.id));
        mensagem(`${adicionadas} empresa(s) copiada(s). ${repetidas} repetida(s) ignorada(s).` +
          (S.autoSave === false && adicionadas ? ' Clique em Salvar para confirmar.' : ''));
      }}]);
  }

  const valorCsv = valor => {
    let s = String(valor ?? '');
    // Impede interpretacao de nomes/observacoes como formulas ao abrir no Excel.
    if (/^\s*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };

  function exportarCsv() {
    const lista = L(), periodo = P(lista);
    const linhas = [['Numero','Empresa','Observacao'],
      ...lista.companies.map(c => [c.number ?? '', c.name, c.note ?? ''])];
    const conteudo = '\uFEFF' + linhas.map(r => r.map(valorCsv).join(';')).join('\r\n');
    const arquivo = new Blob([conteudo], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement('a');
    const nome = `empresas-${lista.name}-${periodo.name}`
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    link.href = url;
    link.download = (nome || 'empresas') + '.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    mensagem(`${lista.companies.length} empresa(s) exportada(s) em CSV.`);
  }

  function detectarSeparador(texto) {
    const primeira = texto.split(/\r?\n/, 1)[0] || '';
    const contar = sep => {
      let aspas = false, total = 0;
      for (let i = 0; i < primeira.length; i++) {
        if (primeira[i] === '"') {
          if (aspas && primeira[i+1] === '"') i++;
          else aspas = !aspas;
        } else if (!aspas && primeira[i] === sep) total++;
      }
      return total;
    };
    return [';',',','\t'].sort((a,b) => contar(b)-contar(a))[0];
  }

  function lerCsv(texto) {
    texto = texto.replace(/^\uFEFF/, '');
    const sep = detectarSeparador(texto);
    const linhas = [];
    let linha = [], valor = '', aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (c === '"') {
        if (aspas && texto[i+1] === '"') { valor += '"'; i++; }
        else aspas = !aspas;
      } else if (c === sep && !aspas) {
        linha.push(valor); valor = '';
      } else if ((c === '\r' || c === '\n') && !aspas) {
        if (c === '\r' && texto[i+1] === '\n') i++;
        linha.push(valor);
        if (linha.some(v => v.trim())) linhas.push(linha);
        linha = []; valor = '';
      } else valor += c;
    }
    if (aspas) throw new Error('O arquivo CSV possui aspas nao fechadas.');
    linha.push(valor);
    if (linha.some(v => v.trim())) linhas.push(linha);
    if (!linhas.length) return [];
    const cabecalho = linhas[0].map(normalizar);
    let idxNome = cabecalho.findIndex(v =>
      ['empresa','nome','razao social','nome da empresa'].includes(v));
    const idxNumero = cabecalho.findIndex(v =>
      ['numero','n','nº','num','codigo'].includes(v));
    const idxNota = cabecalho.findIndex(v =>
      ['observacao','observacoes','nota','anotacao'].includes(v));
    const temCabecalho = idxNome !== -1;
    if (!temCabecalho) idxNome = linhas[0].length > 1 ? 1 : 0;
    return linhas.slice(temCabecalho ? 1 : 0).map(col => ({
      name: String(col[idxNome] || '').trim(),
      number: idxNumero >= 0 ? String(col[idxNumero] || '').trim() : null,
      note: idxNota >= 0 ? String(col[idxNota] || '').trim() : ''
    })).filter(c => c.name);
  }

  async function importarCsv(arquivo) {
    if (!arquivo) return;
    if (arquivo.size > 4 * 1024 * 1024) {
      mensagem('O arquivo deve ter no maximo 4 MB.', true); return;
    }
    try {
      const empresas = lerCsv(await arquivo.text());
      if (!empresas.length) { mensagem('Nenhuma empresa encontrada no arquivo.', true); return; }
      const lista = L(), periodo = P(lista);
      const pre = empresas.slice(0, 4).map(e => esc(e.name)).join(', ');
      modal('Confirmar importacao de empresas',
        `<p>Foram encontradas <b>${empresas.length} empresas</b> em <b>${esc(arquivo.name)}</b>.</p>
         <p>Elas serao adicionadas a <b>${esc(lista.name)} / ${esc(periodo.name)}</b>, sem apagar os cadastros existentes.</p>
         <p style="font-size:13px;color:var(--mu)">Exemplos: ${pre}${empresas.length > 4 ? '…' : ''}. Nomes repetidos serao ignorados.</p>`,
        [{t:'Cancelar'}, {t:'Importar empresas', c:'pri', f:() => {
          const {adicionadas, repetidas} = adicionarSemDuplicar(empresas);
          mensagem(`${adicionadas} empresa(s) importada(s). ${repetidas} repetida(s) ignorada(s).` +
            (S.autoSave === false && adicionadas ? ' Clique em Salvar para confirmar.' : ''));
        }}]);
    } catch (e) {
      mensagem('Nao foi possivel ler o CSV: ' + e.message, true);
    }
  }

  const renderAnterior = render;
  render = function() {
    renderAnterior();
    const barra = document.querySelector('#app .tb');
    if (!barra || !S || !S.lists?.length) return;
    const acoes = document.createElement('div');
    acoes.className = 'transferencia-empresas';
    acoes.innerHTML = `
      <button class="btn" type="button" data-transferir="copiar">Copiar empresas de outra lista / mes</button>
      <button class="btn" type="button" data-transferir="exportar">Exportar empresas (CSV)</button>
      <button class="btn" type="button" data-transferir="importar">Importar empresas (CSV)</button>
      <input type="file" id="arquivo-empresas" accept=".csv,text/csv,text/plain" hidden aria-label="Selecionar arquivo CSV de empresas">`;
    barra.after(acoes);
  };

  document.addEventListener('click', e => {
    const botao = e.target.closest('[data-transferir]');
    if (!botao || !S) return;
    if (botao.dataset.transferir === 'copiar') copiarDeOutroPeriodo();
    if (botao.dataset.transferir === 'exportar') exportarCsv();
    if (botao.dataset.transferir === 'importar') {
      const input = document.querySelector('#arquivo-empresas');
      if (input) { input.value = ''; input.click(); }
    }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'arquivo-empresas') importarCsv(e.target.files?.[0]);
  });

  const css = document.createElement('style');
  css.textContent = `
    .transferencia-empresas{display:flex;gap:9px;flex-wrap:wrap;margin:10px 0 14px}
    .transferencia-empresas .btn{white-space:normal;text-align:center}
    @media(max-width:600px){.transferencia-empresas .btn{flex:1 1 180px}}
    @media print{.transferencia-empresas,.empresas-feedback{display:none!important}}
  `;
  document.head.append(css);
  if (typeof S !== 'undefined' && S && Array.isArray(S.lists)) render();
})();
