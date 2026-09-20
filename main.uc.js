// ==UserScript==
// @name        Type to Search
// @description Qualquer tecla na Speed Dial começa uma pesquisa na barra de endereços
// @include     main
// ==/UserScript==

(() => {
  if (window.__typeToSearchLoaded) return;
  window.__typeToSearchLoaded = true;

  // Deixe true para diagnosticar (Ctrl+Shift+J e filtre por "TypeToSearch").
  // Quando estiver funcionando, troque para false.
  const DEBUG = true;

  // Início da URL da sua Speed Dial. Se você souber a URL exata
  // (ex.: "moz-extension://a1b2c3d4-.../"), coloque aqui no lugar do genérico.
  // about:newtab / about:home cobrem o caso da extensão ser só um override da nova aba.
  const HOME_PREFIXES = ["moz-extension://", "about:newtab", "about:home"];

  const log = (...a) => DEBUG && console.log("[TypeToSearch]", ...a);
  const currentUrl = () => gBrowser.selectedBrowser?.currentURI?.spec || "";
  const isHomePage = () => HOME_PREFIXES.some((p) => currentUrl().startsWith(p));

  let lastIgnoredUrl = "";

  window.addEventListener(
    "keydown",
    (e) => {
      try {
        const url = currentUrl();

        if (!isHomePage()) {
          // loga só uma vez por URL, e sem registrar as teclas
          if (DEBUG && url !== lastIgnoredUrl) {
            lastIgnoredUrl = url;
            log("ignorado: a URL da aba não bate com HOME_PREFIXES ->", url);
          }
          return;
        }

        const contentFocused = document.activeElement === gBrowser.selectedBrowser;
        log("tecla na home:", e.key, {
          url,
          contentFocused,
          activeElement: document.activeElement?.localName,
          defaultPrevented: e.defaultPrevented,
        });

        if (e.defaultPrevented || e.isComposing || e.repeat) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (e.key.length !== 1 || e.key === " ") return; // só caracteres imprimíveis
        if (!contentFocused) return; // foco na urlbar, busca, sidebar etc.

        e.preventDefault();
        e.stopPropagation();

        const key = e.key;
        try {
          gURLBar.search(key); // foca a barra, coloca a tecla e inicia a busca
        } catch (err) {
          log("search() falhou, usando fallback:", err);
          gURLBar.focus();
          gURLBar.value = key;
          gURLBar.startQuery();
        }

        // garante que o cursor fique no fim (texto não selecionado)
        const caretToEnd = () => gURLBar.setSelectionRange(key.length, key.length);
        caretToEnd();
        requestAnimationFrame(caretToEnd);
      } catch (err) {
        console.error("[TypeToSearch] erro:", err);
      }
    },
    true
  );

  console.log("[TypeToSearch] loaded");
})();
