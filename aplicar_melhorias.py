#!/usr/bin/env python3
"""Aplica as melhorias sobre os arquivos REAIS do repositório Listas-Site.

Uso: python aplicar_melhorias.py /caminho/para/Listas-Site
É criado um backup de Auth.js e index.html antes de qualquer mudança.
"""
from pathlib import Path
import argparse
import shutil
import datetime

SAVE_OLD = """  function salvar(S) {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const { error } = await sb.from('listas_dados').upsert({ user_id: user.id, dados: S, updated_at: new Date().toISOString() });
      if (error) console.error('Erro ao salvar:', error.message);
    }, 600);
  }
"""

SAVE_NEW = """  // Persistência no Supabase com confirmação de sucesso/erro.
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
      const {error} = await sb.from('listas_dados').upsert({
        user_id: user.id, dados: item.dados, updated_at: new Date().toISOString()
      });
      if (error) throw new Error(error.message);
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
"""

REPORT_OLD = "for(const k in l.checks){const v=l.checks[k],[pi,ci,ti]=k.split('|'),pp=l.periods.find(x=>x.id===pi),c=l.companies.find(x=>x.id===ci),t=l.tasks.find(x=>x.id===ti);"
REPORT_NEW = """for(const k in l.checks){
const v=l.checks[k],[pi,ci,ti]=k.split('|'),pp=l.periods.find(x=>x.id===pi);
const historico=l.periodData?.[pi];
const c=(historico?.companies||l.companies).find(x=>x.id===ci),t=(historico?.tasks||l.tasks).find(x=>x.id===ti);"""


def replace_once(text, old, new, path):
    if old not in text:
        raise RuntimeError(f"O arquivo {path} mudou e não contém o trecho esperado: {old[:90]!r}")
    if text.count(old) != 1:
        raise RuntimeError(f"O trecho esperado aparece mais de uma vez em {path}")
    return text.replace(old, new, 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repo', nargs='?', default='.', help='Pasta do repositório Listas-Site')
    args = parser.parse_args()
    repo = Path(args.repo).expanduser().resolve()
    index = repo / 'index.html'
    auth = repo / 'Auth.js'
    novo = repo / 'periodo-edicao.js'
    origem = Path(__file__).with_name('periodo-edicao.js')
    for required in (index, auth, origem):
        if not required.is_file():
            raise SystemExit(f"Arquivo ausente: {required}")
    original_index = index.read_text(encoding='utf-8')
    original_auth = auth.read_text(encoding='utf-8')
    if 'periodo-edicao.js' in original_index or 'saveNow: salvarAgora' in original_auth:
        raise SystemExit('As melhorias parecem já estar aplicadas; nenhuma mudança foi feita.')

    updated_index = replace_once(original_index, '<script src="auth.js"></script>', '<script src="Auth.js"></script>', 'index.html')
    updated_index = replace_once(updated_index, REPORT_OLD, REPORT_NEW, 'index.html')
    updated_index = replace_once(updated_index,
        '<script src="campos-personalizados.js"></script>',
        '<script src="campos-personalizados.js"></script>\n<script src="periodo-edicao.js"></script>',
        'index.html')
    updated_auth = replace_once(original_auth,
        '  let user = null, onData = null, timer = null;',
        '  let user = null, onData = null, timer = null, pendente = null, salvando = null, version = 0;',
        'Auth.js')
    updated_auth = replace_once(updated_auth, SAVE_OLD, SAVE_NEW, 'Auth.js')
    updated_auth = replace_once(updated_auth,
        '  return { start, save: salvar };',
        '  return { start, save: salvar, saveNow: salvarAgora };',
        'Auth.js')

    backup = repo.parent / (repo.name + '-backup-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    backup.mkdir(exist_ok=False)
    shutil.copy2(index, backup / index.name)
    shutil.copy2(auth, backup / auth.name)
    if novo.exists():
        shutil.copy2(novo, backup / novo.name)
    index.write_text(updated_index, encoding='utf-8')
    auth.write_text(updated_auth, encoding='utf-8')
    shutil.copy2(origem, novo)
    print('OK! Código atualizado em:', repo)
    print('Arquivos alterados: index.html, Auth.js, periodo-edicao.js')
    print('Backup original em:', backup)
    print('Confira com git diff e faça o commit somente após testar sua conta.')


if __name__ == '__main__':
    main()
