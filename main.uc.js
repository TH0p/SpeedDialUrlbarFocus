// ==UserScript==
// @name        Type to Search
// @description Qualquer tecla na Speed Dial começa uma pesquisa na barra de endereços. Ctrl+V cola o conteúdo copiado direto na barra.
// @include     main
// ==/UserScript==

(() => {
  if (window.__typeToSearchLoaded) return;
  window.__typeToSearchLoaded = true;

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
    } catch (e) {}
    try {
      if (typeof Cc !== "undefined" && typeof Ci !== "undefined") {
        return { cc: Cc, ci: Ci };
      }
    } catch (e) {}
    return null;
  })();

  function readClipboardTextSync() {
    if (!XPCOM) return "";
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
      } catch (err) {}
    }
    return "";
  }

  function pushToUrlBar(text) {
    log("colocando na urlbar:", text);
    try {
      gURLBar.search(text);
    } catch (err) {
      gURLBar.focus();
      gURLBar.value = text;
      gURLBar.startQuery();
    }
    const caretToEnd = () => gURLBar.setSelectionRange(text.length, text.length);
    caretToEnd();
    requestAnimationFrame(caretToEnd);
  }

  function handlePaste() {
    const syncText = readClipboardTextSync();
    if (syncText) {
      pushToUrlBar(syncText);
      return;
    }
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then((asyncText) => {
        if (asyncText) pushToUrlBar(asyncText);
      }).catch(() => {});
    }
  }

  // --- Ouve o clique vindo da Speed Dial para focar na urlbar ---
  window.addEventListener("message", (e) => {
    try {
      if (!isHomePage()) return;
      if (e.data && e.data.type === "SPEED_DIAL_FOCUS_SEARCH") {
        log("Clique na pesquisa da extensão detectado, ativando urlbar");
        gURLBar.focus();
        gURLBar.select();
      }
    } catch (err) {
      log("Erro ao processar mensagem da extensão:", err);
    }
  });

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

        e.preventDefault();
        e.stopPropagation();
        pushToUrlBar(e.key);
      } catch (err) {
        console.error("[TypeToSearch] erro:", err);
      }
    },
    true
  );

  function isHomeUri(uri) {
    try {
      return HOME_PREFIXES.some((p) => (uri?.spec || "").startsWith(p));
    } catch (err) {
      return false;
    }
  }

  function applyHomeTabAppearance(tab) {
    try {
      const uri = tab?.linkedBrowser?.currentURI;
      if (!isHomeUri(uri)) return;

      if (tab.getAttribute("label") !== " ") {
        tab.setAttribute("label", " ");
      }

      if (uri.scheme === "moz-extension") {
        const iconUrl = uri.prePath + "/icons/icon32.png";
        if (tab.getAttribute("image") !== iconUrl) {
          gBrowser.setIcon(tab, iconUrl);
        }
      }
    } catch (err) {}
  }

  function applyHomeTabAppearanceWithRetries(tab) {
    applyHomeTabAppearance(tab);
    setTimeout(() => applyHomeTabAppearance(tab), 200);
    setTimeout(() => applyHomeTabAppearance(tab), 800);
    setTimeout(() => applyHomeTabAppearance(tab), 2000);
  }

  function setupTabAppearanceOverride() {
    if (!window.gBrowser || !gBrowser.tabContainer) {
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
          } catch (err) {}
        },
      };
      gBrowser.addTabsProgressListener(progressListener);

      for (const tab of gBrowser.tabs) applyHomeTabAppearanceWithRetries(tab);
    } catch (err) {
      console.error("[TypeToSearch] falha ao configurar aparência da aba:", err);
    }
  }

  setupTabAppearanceOverride();
  console.log("[TypeToSearch] loaded");
})();
