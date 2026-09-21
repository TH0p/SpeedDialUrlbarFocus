// ==UserScript==
// @name        Type to Search
// @description Qualquer tecla na Speed Dial começa uma pesquisa na barra de endereços. Ctrl+V cola o conteúdo copiado direto na barra.
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

  // Coloca o texto (digitado ou colado) na urlbar e inicia a busca/autocomplete.
  function pushToUrlBar(text) {
    try {
      gURLBar.search(text); // foca a barra, coloca o texto e inicia a busca
    } catch (err) {
      log("search() falhou, usando fallback:", err);
      gURLBar.focus();
      gURLBar.value = text;
      gURLBar.startQuery();
    }
    // garante que o cursor fique no fim (texto não selecionado)
    const caretToEnd = () => gURLBar.setSelectionRange(text.length, text.length);
    caretToEnd();
    requestAnimationFrame(caretToEnd);
  }

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

        if (e.defaultPrevented || e.isComposing || e.repeat) return;
        if (!contentFocused) return; // foco na urlbar, busca, sidebar etc.

        // --- Ctrl+V / Cmd+V: cola o que estiver na área de transferência ---
        const isPasteShortcut =
          (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "v";

        if (isPasteShortcut) {
          log("Ctrl/Cmd+V detectado na home, colando da área de transferência");
          e.preventDefault();
          e.stopPropagation();

          navigator.clipboard
            .readText()
            .then((text) => {
              if (!text) {
                log("área de transferência vazia ou sem texto");
                return;
              }
              pushToUrlBar(text);
            })
            .catch((err) => {
              log("navigator.clipboard falhou, tentando nsIClipboard:", err);
              // Fallback privilegiado (não depende de permissão de foco/documento)
              try {
                const trans = Components.classes[
                  "@mozilla.org/widget/transferable;1"
                ].createInstance(Components.interfaces.nsITransferable);
                trans.init(null);
                trans.addDataFlavor("text/unicode");
                Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
                const str = {};
                const strLength = {};
                trans.getTransferData("text/unicode", str, strLength);
                if (str.value) {
                  const text = str.value
                    .QueryInterface(Components.interfaces.nsISupportsString)
                    .data.substring(0, strLength.value / 2);
                  pushToUrlBar(text);
                }
              } catch (err2) {
                console.error("[TypeToSearch] falha ao ler a área de transferência:", err2);
              }
            });

          return;
        }

        // --- daqui pra baixo é o comportamento original: digitar já busca ---
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (e.key.length !== 1 || e.key === " ") return; // só caracteres imprimíveis

        log("tecla na home:", e.key, {
          url,
          contentFocused,
          activeElement: document.activeElement?.localName,
          defaultPrevented: e.defaultPrevented,
        });

        e.preventDefault();
        e.stopPropagation();
        pushToUrlBar(e.key);
      } catch (err) {
        console.error("[TypeToSearch] erro:", err);
      }
    },
    true
  );

  console.log("[TypeToSearch] loaded");
})();
