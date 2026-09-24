// Exemplo de trecho para adicionar ao seu main.uc.js existente:

// Função para injetar o comportamento na página da extensão quando ela abrir
function setupClickToSearch(browser) {
  try {
    const windowUtils = browser.contentWindow;
    if (!windowUtils) return;

    windowUtils.addEventListener("DOMContentLoaded", () => {
      const doc = windowUtils.document;
      // Procura pela sua barra de pesquisa personalizada
      const searchForm = doc.getElementById("searchForm") || doc.querySelector(".search-form");
      const searchInput = doc.getElementById("searchInput") || doc.querySelector(".search-input");

      const triggerNativeSearch = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Foca a barra de endereços/pesquisa nativa do navegador
        gURLBar.focus();
        
        // Opcional: Se já houver algo escrito na sua barra interna, passa para a nativa
        if (searchInput && searchInput.value) {
          gURLBar.value = searchInput.value;
          gURLBar.startQuery();
          searchInput.value = "";
        }
      };

      if (searchForm) {
        searchForm.addEventListener("click", triggerNativeSearch, true);
      }
      if (searchInput) {
        searchInput.addEventListener("focus", triggerNativeSearch, true);
      }
    });
  } catch (err) {
    log("Erro ao configurar clique na barra de pesquisa:", err);
  }
}
