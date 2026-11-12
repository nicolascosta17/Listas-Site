# Minhas Listas (React + Vite)
O app usa a tabela existente `public.listas_dados` e o histórico `public.listas_historico`.
Não faça migração SQL para a versão React. O formato JSON anterior foi mantido.

A cópia/importação do modelo (`minhas-listas-modelo-periodo` v2) transfere
empresas, etapas, observações, campos preenchidos e largura de colunas, sem
checkpoints. O backup completo é diferente: conserva as marcações.

Instalação: `npm install`; desenvolvimento: `npm run dev`;
build de produção: `npm run build`.

A interface respeita o controle RLS do Supabase e não utiliza service_role.
