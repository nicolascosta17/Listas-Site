
/* Navegação horizontal de colunas — Listas-Site */
(() => {
  "use strict";

  const estilo = document.createElement("style");

  estilo.textContent = `
    #app .wrap {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: auto;
      scrollbar-color: var(--ac) var(--ln);
    }

    #app .wrap table {
      width: max-content;
      min-width: 100%;
    }

    #app .wrap table th,
    #app .wrap table td {
      white-space: nowrap;
    }

    .navegacao-colunas {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--sf);
      padding: 12px;
      border: 1px solid var(--ln);
      border-radius: var(--r);
      margin-bottom: 10px;
    }

    .navegacao-colunas span {
      font-size: 13px;
      color: var(--mu);
      white-space: nowrap;
    }

    .barra-colunas {
      flex: 1;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      height: 18px;
      scrollbar-width: auto;
      scrollbar-color: var(--ac) var(--ln);
    }

    .barra-colunas::-webkit-scrollbar,
    #app .wrap::-webkit-scrollbar {
      height: 12px;
    }

    .barra-colunas::-webkit-scrollbar-thumb,
    #app .wrap::-webkit-scrollbar-thumb {
      background: var(--ac);
      border-radius: 10px;
    }

    .barra-colunas::-webkit-scrollbar-track,
    #app .wrap::-webkit-scrollbar-track {
      background: var(--ln);
      border-radius: 10px;
    }

    .barra-colunas-conteudo {
      height: 1px;
    }

    @media (max-width: 600px) {
      .navegacao-colunas {
        gap: 8px;
        padding: 10px;
      }

      .navegacao-colunas span {
        font-size: 11px;
      }
    }

    @media print {
      .navegacao-colunas {
        display: none !important;
      }
    }
  `;

  document.head.appendChild(estilo);

  let atualizar = null;

  function instalarNavegacao() {
    const tabela = document.querySelector("#app .wrap");
    if (!tabela) return;

    if (tabela.previousElementSibling?.classList
        .contains("navegacao-colunas")) {
      return;
    }

    const container = document.createElement("div");
    container.className = "navegacao-colunas";

    const titulo = document.createElement("span");
    titulo.textContent = "Colunas ↔";

    const barra = document.createElement("div");
    barra.className = "barra-colunas";
    barra.setAttribute("aria-label", "Navegação horizontal");

    const conteudo = document.createElement("div");
    conteudo.className = "barra-colunas-conteudo";

    barra.appendChild(conteudo);
    container.appendChild(titulo);
    container.appendChild(barra);

    tabela.parentNode.insertBefore(container, tabela);

    function sincronizarTamanho() {
      conteudo.style.width = tabela.scrollWidth + "px";
      barra.scrollLeft = tabela.scrollLeft;

      container.style.display =
        tabela.scrollWidth > tabela.clientWidth + 1
          ? "flex"
          : "none";
    }

    let sincronizando = false;

    barra.addEventListener("scroll", () => {
      if (sincronizando) return;
      sincronizando = true;
      tabela.scrollLeft = barra.scrollLeft;
      requestAnimationFrame(() => sincronizando = false);
    });

    tabela.addEventListener("scroll", () => {
      if (sincronizando) return;
      sincronizando = true;
      barra.scrollLeft = tabela.scrollLeft;
      requestAnimationFrame(() => sincronizando = false);
    });

    const resize = new ResizeObserver(sincronizarTamanho);
    resize.observe(tabela);
    resize.observe(tabela.querySelector("table") || tabela);

    atualizar = sincronizarTamanho;
    sincronizarTamanho();
  }

  const observador = new MutationObserver(() => {
    instalarNavegacao();
    if (atualizar) atualizar();
  });

  const iniciar = () => {
    const app = document.querySelector("#app");

    if (!app) return;

    observador.observe(app, {
      childList: true,
      subtree: true
    });

    instalarNavegacao();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
