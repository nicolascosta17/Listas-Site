[README-APLICACAO.md](https://github.com/user-attachments/files/34635014/README-APLICACAO.md)
# Listas-Site
Site criado para fazer listas 
# Listas-Site — alterações no código real

Este pacote foi preparado especificamente para o projeto `nicolascosta17/Listas-Site`, com base no `index.html`, `Auth.js`, `navegacao-colunas.js` e `campos-personalizados.js` do repositório GitHub em 10/11/2026.

## Funcionalidades

- Menu lateral recolhível e expansível no computador; preferência por período.
- Larguras de colunas ajustáveis arrastando a borda do cabeçalho, por período. Clique duplo ajusta ao conteúdo. Setas do teclado também funcionam. Botão para restaurar larguras.
- Botão **Salvar**, que envia os dados da conta para o banco Supabase e informa sucesso ou erro.
- Controle **Salvar automaticamente**. Desligado: alterações ficam pendentes até clicar em Salvar. Ligado: alterações são enviadas automaticamente, com pequena espera entre edições.
- Dados de empresas, número, nome, observações e definição de etapas independentes em cada período. Marcações e campos de texto/número já utilizam chaves de período no projeto original.
- Relatório mensal utiliza os cadastros e etapas do período selecionado.
- Aviso ao trocar de mês ou lista com alterações não salvas (modo manual).

## Instalação

1. Faça backup do banco Supabase antes de mudar o site.
2. Baixe o repositório GitHub para seu computador e descompacte-o.
3. Descompacte este pacote e coloque `aplicar_melhorias.py` e `periodo-edicao.js` em uma pasta (não precisa ser dentro do projeto).
4. Execute em um terminal que tenha Python 3 instalado:

   ```bash
   python aplicar_melhorias.py "CAMINHO/PARA/Listas-Site"
   ```

   O instalador modifica `index.html` e `Auth.js`, acrescenta `periodo-edicao.js` e cria cópias de segurança dos arquivos originais.
5. Teste o site fazendo login. Abra novembro e dezembro, altere uma observação e uma coluna, salve e atualize a página. Verifique que os períodos não interferem entre si.
6. Faça `git add index.html Auth.js periodo-edicao.js && git commit -m "Salvar alterações por período e redimensionar colunas" && git push` para publicar, se tiver acesso de escrita.

## Observações importantes

- O modelo atual guarda as listas num único registro JSON por usuário no Supabase. O pacote **preserva esse formato** e acrescenta `periodData` por identificador de competência dentro da lista.
- Na primeira execução, os dados compartilhados da versão antiga são atribuídos à competência que estava selecionada. Demais competências começam com cópias independentes do cadastro inicial. **Não é possível reconstruir automaticamente alterações históricas que antes eram globais.**
- Ao desligar o salvamento automático, a escolha é enviada ao banco uma vez. As edições seguintes exigem Salvar.
- As preferências são gravadas por usuário no Supabase, e não somente no navegador.
- Esse pacote **não foi publicado no GitHub**: a integração desta conversa devolveu HTTP 403 ao tentar criar uma ramificação. Não foi feita nenhuma mudança no repositório remoto.
