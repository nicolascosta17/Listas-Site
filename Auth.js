// auth.js — login, cadastro e banco de dados (Supabase) para o Minhas listas
// 1) Preencha as duas linhas abaixo com os dados do seu projeto Supabase
//    (Project Settings > API: "Project URL" e a chave "anon public").
const SUPABASE_URL = 'https://dbzgcydwevpjsfindwcx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SJIFc-jOXfQdYJjrkH334A_UAw3_1uG';

const Auth = (() => {
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let user = null, onData = null, timer = null;

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
    const { data, error } = await sb.from('listas_dados').select('dados').eq('user_id', u.id).maybeSingle();
    if (error) { user = null; tela('in', 'Não foi possível carregar seus dados: ' + error.message); return; }
    let d = data && data.dados;
    if (!d) { // primeiro acesso: aproveita os dados que já estavam salvos neste navegador
      try { d = JSON.parse(localStorage.getItem('listas-v1')); } catch (e) {}
      if (d && d.lists) localStorage.removeItem('listas-v1');
    }
    onData(d && d.lists ? d : null);
  }

  function salvar(S) {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const { error } = await sb.from('listas_dados').upsert({ user_id: user.id, dados: S, updated_at: new Date().toISOString() });
      if (error) console.error('Erro ao salvar:', error.message);
    }, 600);
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

  return { start, save: salvar };
})();
