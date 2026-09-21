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

  // Alguns loaders (fx-autoconfig/Sine) expõem "Components" completo,
  // outros só os atalhos globais Cc/Ci. Tenta os dois.
  const XPCOM = (() => {
    try {
      if (typeof Components !== "undefined" && Components.classes) {
        return { cc: Components.classes, ci: Components.interfaces };
      }
    } catch (e) {
      /* ignora */
    }
    try {
      if (typeof Cc !== "undefined" && typeof Ci !== "undefined") {
        return { cc: Cc, ci: Ci };
      }
    } catch (e) {
      /* ignora */
    }
    return null;
  })();

  // Lê a área de transferência de forma síncrona via nsIClipboard
  // (API privilegiada do próprio Firefox — mais confiável em páginas chrome
  // do que navigator.clipboard, que às vezes falha silenciosamente ali).
  function readClipboardTextSync() {
    if (!XPCOM) {
      log("Components/Cc/Ci indisponíveis nesse loader, pulando leitura síncrona");
      return "";
    }
    const flavors = ["text/plain", "text/unicode"];
    for (const flavor of flavors) {
      try {
        const trans = XPCOM.cc["@mozilla.org/widget/transferable;1"].createInstance(
          XPCOM.ci.nsITransferable
        );
        trans.init(null);
        trans.addDataFlavor(flavor);
        Services.clipboard.getData(trans, Services.clipboard.kGlobalClipboard);
        const data = {};
        trans.getTransferData(flavor, data);
        if (data.value) {
          const text = data.value.QueryInterface(XPCOM.ci.nsISupportsString).data;
          if (text) return text;
        }
      } catch (err) {
        log(`leitura via nsIClipboard (${flavor}) falhou:`, err);
      }
    }
    return "";
  }

  // Coloca o texto (digitado ou colado) na urlbar e inicia a busca/autocomplete.
  function pushToUrlBar(text) {
    log("colocando na urlbar:", text);
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

  function handlePaste() {
    log("Ctrl/Cmd+V detectado na home, tentando ler a área de transferência");

    const syncText = readClipboardTextSync();
    if (syncText) {
      pushToUrlBar(syncText);
      return;
    }

    // Fallback assíncrono, só se o método privilegiado não trouxe nada.
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard
        .readText()
        .then((asyncText) => {
          if (asyncText) pushToUrlBar(asyncText);
          else log("área de transferência vazia (nenhum dos métodos encontrou texto)");
        })
        .catch((err) => log("navigator.clipboard também falhou:", err));
    } else {
      log("nenhum método de leitura de área de transferência disponível");
    }
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
          e.preventDefault();
          e.stopPropagation();
          handlePaste();
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
