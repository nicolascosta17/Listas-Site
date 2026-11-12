# Minhas Listas — React.js

Aplicação de controle de empresas e etapas, agora construída com **React 18 + Vite**, responsiva para computador, tablet e celular.

**Site de produção:** https://listasconti.netlify.app/

## Recursos
- Login/cadastro pelo Supabase Auth.
- Listas com competências independentes, empresas, números e observações.
- Etapas personalizadas: checkbox, texto e número.
- Ordenação alfabética ou numérica, busca, filtros e redimensionamento de colunas.
- Relatórios mensal e semanal, impressão / PDF e copiar texto.
- Exportação/importação de modelos JSON **sem checkpoints concluídos**.
- Backup completo da conta, incluindo marcações, com opção de restauração.
- Histórico de versões do Supabase e restauração de uma versão anterior.
- Tema claro, escuro, sépia e meia-noite, cores personalizadas.
- Salvamento automático/manual e detecção de conflito de edições em outros dispositivos.

## Dados existentes preservados
Usa o **mesmo projeto Supabase** (`dbzgcydwevpjsfindwcx`) e a **mesma tabela** (`public.listas_dados`).
O campo `dados` continua sendo JSON com `lists`, `per`, `theme`, etc.;
compatibilidade com `periodData`, `checks` e `values` do sistema anterior.

A tabela `public.listas_historico` já existente registra as novas alterações via gatilho do Postgres.
Nenhuma migração do banco é necessária para esta atualização.

## Desenvolvimento
Requisitos: Node.js 20+.

```bash
npm install
npm run dev
npm test
npm run build
```

## Publicação
A Netlify usa o `netlify.toml`: executa os testes e o build do Vite,
publicando a pasta `dist` e redirecionando rotas SPA para `index.html`.

## Modelo de transferência vs backup
- **Modelo de período JSON (v2):** copia todos os dados necessários para montar outra competência
  (empresas, números, observações, etapas, valores de texto/número e colunas),
  **mas não importa nem exporta checkboxes concluídos**.
  Ao importar, substitui somente a competência de destino após confirmação.
- **Backup completo:** preserva intencionalmente também os checkpoints, para recuperação fiel dos dados.

## Código legado
Os arquivos `Auth.js`, `campos-personalizados.js`, `periodo-edicao.js`,
`navegacao-colunas.js` e `transferencia-empresas.js` continuam no histórico do repositório
por segurança, mas **não são carregados pelo novo React**. A versão anterior
está acessível pelo histórico Git e pela ramificação de backup.
