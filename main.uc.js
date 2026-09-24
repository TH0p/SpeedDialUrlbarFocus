// ==UserScript==
// @name        Type to Search
// @description Qualquer tecla na Speed Dial começa uma pesquisa na barra de endereços. Ctrl+V cola o conteúdo copiado direto na barra.
// @include     main
// ==/UserScript==

(() => {
  if (window.__typeToSearchLoaded) return;
  window.__typeToSearchLoaded = true;

  // Deixe true para diagnosticar (Ctrl+Shift+J e filtre por "TypeToSearch").
  const DEBUG = true;

  const HOME_PREFIXES = ["moz-extension://", "about:newtab", "about:home"];

  const log = (...a) => DEBUG && console.log("[TypeToSearch]", ...a);
  const currentUrl = () => gBrowser.selectedBrowser?.currentURI?.spec || "";
  const isHomePage = () => HOME_PREFIXES.some((p) => currentUrl().startsWith(p));

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

  function pushToUrlBar(text) {
    log("colocando na urlbar:", text);
    try {
      gURLBar.search(text);
    } catch (err) {
      log("search() falhou, usando fallback:", err);
      gURLBar.focus();
      gURLBar.value = text;
      gURLBar.startQuery();
    }
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
          if (DEBUG && url !== lastIgnoredUrl) {
            lastIgnoredUrl = url;
            log("ignorado: a URL da aba não bate com HOME_PREFIXES ->", url);
          }
          return;
        }

        const contentFocused = document.activeElement === gBrowser.selectedBrowser;

        if (e.defaultPrevented || e.isComposing || e.repeat) return;
        if (!contentFocused) return;

        const isPasteShortcut =
          (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "v";

        if (isPasteShortcut) {
          e.preventDefault();
          e.stopPropagation();
          handlePaste();
          return;
        }

        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (e.key.length !== 1 || e.key === " ") return;

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

  // --- Integração: Clique/Foco na barra da extensão abre a barra nativa do navegador ---
  function setupClickToSearch(browser) {
    try {
      const windowUtils = browser.contentWindow;
      if (!windowUtils) return;

      windowUtils.addEventListener("DOMContentLoaded", () => {
        const doc = windowUtils.document;
        const searchForm = doc.getElementById("searchForm") || doc.querySelector(".search-form");
        const searchInput = doc.getElementById("searchInput") || doc.querySelector(".search-input");

        const triggerNativeSearch = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          gURLBar.focus();
          
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

  // --- Esconde o texto "Nova aba" e força o ícone da extensão ---
  function isHomeUri(uri) {
    try {
      return HOME_PREFIXES.some((p) => (uri?.spec || "").startsWith(p));
    } catch (err) {
      return false;
    }
  }

  function applyHomeTabAppearance(tab) {
    try {
      const browser = tab?.linkedBrowser;
      const uri = browser?.currentURI;
      if (!isHomeUri(uri)) return;

      if (tab.getAttribute("label") !== " ") {
        log("escondendo o rótulo da aba");
        tab.setAttribute("label", " ");
      }

      if (uri.scheme === "moz-extension") {
        const iconUrl = uri.prePath + "/icons/icon32.png";
        if (tab.getAttribute("image") !== iconUrl) {
          log("forçando o ícone da aba:", iconUrl);
          gBrowser.setIcon(tab, iconUrl);
        }
        // Ativa o gancho da barra de pesquisa nesta aba da extensão
        setupClickToSearch(browser);
      }
    } catch (err) {
      log("falha ao aplicar aparência da aba:", err);
    }
  }

  function applyHomeTabAppearanceWithRetries(tab) {
    applyHomeTabAppearance(tab);
    setTimeout(() => applyHomeTabAppearance(tab), 200);
    setTimeout(() => applyHomeTabAppearance(tab), 800);
    setTimeout(() => applyHomeTabAppearance(tab), 2000);
  }

  function setupTabAppearanceOverride() {
    if (!window.gBrowser || !gBrowser.tabContainer) {
      log("gBrowser ainda não está pronto, tentando de novo em breve...");
      setTimeout(setupTabAppearanceOverride, 500);
      return;
    }

    try {
      gBrowser.tabContainer.addEventListener("TabAttrModified", (e) => {
        if (e.detail?.changed?.includes("label") || e.detail?.changed?.includes("image")) {
          applyHomeTabAppearance(e.target);
        }
      });

      gBrowser.tabContainer.addEventListener("TabOpen", (e) => {
        applyHomeTabAppearanceWithRetries(e.target);
      });

      const progressListener = {
        onLocationChange(webProgress, request, location) {
          if (!webProgress.isTopLevel) return;
          try {
            const tab = gBrowser.getTabForBrowser(webProgress.browser);
            if (tab) applyHomeTabAppearanceWithRetries(tab);
          } catch (err) {
            log("falha no onLocationChange:", err);
          }
        },
      };
      gBrowser.addTabsProgressListener(progressListener);

      for (const tab of gBrowser.tabs) applyHomeTabAppearanceWithRetries(tab);

      log("aparência da aba da home: configurado com sucesso");
    } catch (err) {
      console.error("[TypeToSearch] falha ao configurar a aparência da aba:", err);
    }
  }

  setupTabAppearanceOverride();

  console.log("[TypeToSearch] loaded");
})();
