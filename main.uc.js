// ==UserScript==
// @name        Type to Search
// @description Qualquer tecla na Speed Dial começa uma pesquisa na barra de endereços
// @include     main
// ==/UserScript==

(() => {
  if (window.__typeToSearchLoaded) return;
  window.__typeToSearchLoaded = true;

  // Troque pelo início da URL da SUA Speed Dial (copie da barra de endereços),
  // ex.: "moz-extension://a1b2c3d4-.../"
  // Assim o mod não age em outras páginas de extensões.
  const HOME_PREFIXES = ["moz-extension://"];

  const isHomePage = () => {
    const url = gBrowser.selectedBrowser?.currentURI?.spec || "";
    return HOME_PREFIXES.some((p) => url.startsWith(p));
  };

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.defaultPrevented || e.isComposing || e.repeat) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.length !== 1 || e.key === " ") return; // só caracteres imprimíveis

      // só quando o foco está na página (não na urlbar, busca, sidebar...)
      if (document.activeElement !== gBrowser.selectedBrowser) return;
      if (!isHomePage()) return;

      e.preventDefault();
      e.stopPropagation();

      const key = e.key;
      try {
        gURLBar.search(key); // foca a barra, coloca a tecla e inicia a busca
      } catch (err) {
        gURLBar.focus();
        gURLBar.value = key;
        gURLBar.startQuery();
      }

      // garante que o cursor fique no fim (texto não selecionado)
      const caretToEnd = () => gURLBar.setSelectionRange(key.length, key.length);
      caretToEnd();
      requestAnimationFrame(caretToEnd);
    },
    true
  );

  console.log("[TypeToSearch] loaded");
})();
