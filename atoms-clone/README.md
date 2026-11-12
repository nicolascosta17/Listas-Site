# Site de listas — versão independente com Supabase

Esta pasta contém uma **versão funcional baseada no código do repositório Listas-Site**. Não é o código-fonte exportado do Atoms e não deve ser considerada uma cópia pixel a pixel de https://i2ygy4.pub.atoms.world/.

## Funcionalidades
- Cadastro e login com Supabase Auth
- Listas, empresas, etapas, meses/períodos, marcações, textos, números e observações
- Relatórios mensais e semanais
- Ajuste da largura de colunas e menu recolhível
- Salvamento manual/automático no Supabase, aviso de erro de gravação
- Leitura da mesma conta em outros dispositivos

## Banco
Projeto Supabase: `dbzgcydwevpjsfindwcx`
Tabela exclusiva desta versão: `public.atoms_listas_dados`.
Existe política RLS vinculada a `auth.uid() = user_id`; os dados de `listas_dados` não são modificados.

## Executar
Abrir `index.html` por um servidor HTTP estático, publicando **todos os arquivos desta pasta juntos**.
O cliente usa apenas a chave *publishable* do Supabase; **não publicar service_role/secret keys**.

## Atenção
- Esta pasta ainda não tem implantação pública confirmada.
- Os dados do site Atoms não foram importados.
- Para uma cópia exata, exportar o código-fonte original do Atoms (e disponibilizar os arquivos) antes de substituir esta base.
- A sincronização entre aparelhos com a mesma conta busca atualizações periodicamente; edições simultâneas do mesmo usuário podem sobrescrever dados, pois o estado é salvo como um único JSON.
- Atualize senhas fracas e revise as URLs permitidas pelo Supabase Auth.
