// auth.js — login, cadastro e banco de dados (Supabase) para o Minhas listas
// 1) Preencha as duas linhas abaixo com os dados do seu projeto Supabase
//    (Project Settings > API: "Project URL" e a chave "anon public").
const SUPABASE_URL = 'https://dbzgcydwevpjsfindwcx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SJIFc-jOXfQdYJjrkH334A_UAw3_1uG';

// Dados desta versão ficam isolados dos registros do projeto original.
const STORAGE_TABLE = 'atoms_listas_dados';

const Auth = (() => {
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let user = null, onData = null, timer = null, pendente = null, salvando = null, version = 0;
  let ultimaAtualizacao = null, verificacao = null, aplicandoRemoto = false, consultando = false;

  const erro = m => ({
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Este e-mail já tem cadastro. Use "Já tenho conta".',
    'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos e tente de novo.'
  }[m] || m);

  function tela(modo, msg) {
    document.querySelector('.au')?.remove();
    const entrar = modo === 'in';
    const o = document.createElement('div');
    o.className = 'au';
    o.style.cssText = 'position:fixed;inset:0;z-index:50;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:16px';
    o.innerHTML = `<form class="md" style="display:flex;flex-direction:column;gap:10px">
      <h3>${entrar ? 'Entrar' : 'Criar conta'}</h3>
      <input class="in" name="e" type="email" placeholder="E-mail" autocomplete="email" required>
      <input class="in" name="p" type="password" placeholder="Senha (mínimo 6 caracteres)" minlength="6" autocomplete="${entrar ? 'current-password' : 'new-password'}" required>
      <div class="m" style="color:var(--mu);font-size:13px;min-height:18px"></div>
      <button class="btn pri">${entrar ? 'Entrar' : 'Cadastrar'}</button>
      <button type="button" class="btn" data-sw>${entrar ? 'Não tenho conta' : 'Já tenho conta'}</button></form>`;
    document.body.append(o);
    const f = o.querySelector('form'), m = o.querySelector('.m');
    m.textContent = msg || '';
    f.e.focus();
    f.querySelector('[data-sw]').onclick = () => tela(entrar ? 'up' : 'in');
    f.onsubmit = async ev => {
      ev.preventDefault();
      m.textContent = 'Aguarde...';
      const cred = { email: f.e.value.trim(), password: f.p.value };
      const r = entrar ? await sb.auth.signInWithPassword(cred) : await sb.auth.signUp(cred);
      if (r.error) { m.textContent = erro(r.error.message); return; }
      if (!r.data.session) { tela('in', 'Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.'); return; }
      entrou(r.data.session.user);
    };
  }

  async function entrou(u) {
    user = u;
    document.querySelector('.au')?.remove();
    const { data, error } = await sb.from(STORAGE_TABLE).select('dados, updated_at').eq('user_id', u.id).maybeSingle();
    if (error) { user = null; tela('in', 'Não foi possível carregar seus dados: ' + error.message); return; }
    ultimaAtualizacao = data?.updated_at || null;
    let d = data && data.dados;
    if (!d) { // primeiro acesso: aproveita os dados que já estavam salvos neste navegador
      try { d = JSON.parse(localStorage.getItem('listas-v1')); } catch (e) {}
      if (d && d.lists) localStorage.removeItem('listas-v1');
    }
    onData(d && d.lists ? d : null);
    if (verificacao) clearInterval(verificacao);
    verificacao = setInterval(verificarOutrosComputadores, 10000);
  }

  // Consulta alterações feitas com a mesma conta em outros computadores.
  // Nunca substitui edições locais pendentes, salvamentos em andamento ou formulários abertos.
  async function verificarOutrosComputadores() {
    if (!user || consultando || pendente || salvando || document.hidden ||
        document.querySelector('.ov, .au') ||
        document.activeElement?.matches('input, textarea, select, [contenteditable="true"]') ||
        (typeof Auth.isDirty === 'function' && Auth.isDirty())) return;
    consultando = true;
    try {
      const {data, error} = await sb.from(STORAGE_TABLE)
        .select('dados, updated_at').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!data?.dados?.lists || !data.updated_at || data.updated_at === ultimaAtualizacao) return;
      if (pendente || salvando || document.querySelector('.ov, .au') ||
          document.activeElement?.matches('input, textarea, select, [contenteditable="true"]') ||
          (typeof Auth.isDirty === 'function' && Auth.isDirty())) return;
      aplicandoRemoto = true;
      try {
        onData(data.dados);
        ultimaAtualizacao = data.updated_at;
        document.dispatchEvent(new CustomEvent('listas:remote', {detail:{updatedAt:ultimaAtualizacao}}));
      } finally { aplicandoRemoto = false; }
    } catch (e) { console.warn('Não foi possível verificar atualizações:', e.message); }
    finally { consultando = false; }
  }

  // Persistência no Supabase com confirmação de sucesso/erro.
  // O snapshot evita que uma gravação anterior use dados modificados posteriormente.
  const avisar = (status, version, message = '') =>
    document.dispatchEvent(new CustomEvent('listas:save', {detail:{status,version,message}}));

  function enfileirar(dados) {
    const item = {dados: JSON.parse(JSON.stringify(dados)), versao: ++version};
    pendente = item;
    avisar('queued', item.versao);
    return item.versao;
  }

  async function enviar() {
    clearTimeout(timer);
    timer = null;
    if (salvando) {
      try { await salvando; } catch(e) { /* o erro já foi informado */ }
    }
    if (!pendente) return;
    const item = pendente;
    pendente = null;
    avisar('saving', item.versao);
    const tentativa = (async () => {
      const {data, error} = await sb.from(STORAGE_TABLE).upsert({
        user_id: user.id, dados: item.dados, updated_at: new Date().toISOString()
      }).select('updated_at').single();
      if (error) throw new Error(error.message);
      ultimaAtualizacao = data.updated_at;
    })();
    salvando = tentativa;
    try {
      await tentativa;
      avisar('saved', item.versao);
    } catch (e) {
      if (!pendente) pendente = item;
      avisar('error', item.versao, e.message);
      throw e;
    } finally {
      if (salvando === tentativa) salvando = null;
    }
    if (pendente) return enviar();
  }

  function salvar(S) {
    if (!user) return;
    const v = enfileirar(S);
    clearTimeout(timer);
    timer = setTimeout(() => enviar().catch(e => {
      console.error('Erro ao salvar:', e.message);
    }), 600);
    return v;
  }

  async function salvarAgora(S) {
    if (!user) throw new Error('Faça login para salvar seus dados.');
    const v = enfileirar(S);
    await enviar();
    return v;
  }

  function start(cb) {
    onData = cb;
    sb.auth.getSession().then(({ data }) => data.session ? entrou(data.session.user) : tela('in'));
  }

  // botão "Sair" na barra lateral
  new MutationObserver(() => {
    const s = document.querySelector('#sb .sbf');
    if (s && !s.querySelector('[data-lo]')) {
      const b = document.createElement('button');
      b.className = 'btn'; b.dataset.lo = 1; b.textContent = 'Sair';
      s.append(b);
    }
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-lo]')) sb.auth.signOut().then(() => location.reload());
  });

  return { start, save: salvar, saveNow: salvarAgora,
    get isRefreshing() { return aplicandoRemoto; }
  };
})();
