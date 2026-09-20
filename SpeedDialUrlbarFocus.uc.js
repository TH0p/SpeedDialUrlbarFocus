// ==UserScript==
// @name          Speed Dial - foco na barra de endereço
// @description   Na página de nova aba do Speed Dial, digitar qualquer tecla
//                 foca a barra de endereço REAL do Zen e começa a escrever
//                 nela — como se você tivesse apertado Ctrl+L. Funciona
//                 tendo clicado ou não antes na página (o Quick Find do
//                 Firefox/Zen precisa estar desativado nas configurações
//                 pra não competir com isso — veja about:config →
//                 accessibility.typeaheadfind → false).
// @version       1.1.0
// ==/UserScript==

(function () {
  "use strict";

  // Ajuste aqui se o nome do arquivo de nova aba da extensão mudar.
  const NEWTAB_PAGE = "newtab.html";

  function isSpeedDialTab() {
    try {
      const uri = gBrowser.selectedBrowser.currentURI;
      return !!uri && uri.spec.endsWith("/" + NEWTAB_PAGE);
    } catch (e) {
      return false;
    }
  }

  function onKeyDown(event) {
    // Só age quando a aba ativa é a nossa página de nova aba.
    if (!isSpeedDialTab()) return;

    // Se a barra de endereço JÁ está focada (ex.: você digitou uma letra
    // e continuou digitando a segunda, terceira...), deixa ela cuidar
    // normalmente — sem isso, cada tecla apagaria a anterior.
    if (document.activeElement === gURLBar.inputField) return;

    // Não mexe em combinações com modificador (Ctrl/Cmd/Alt) — deixa o
    // navegador tratar normalmente (Ctrl+T, Ctrl+W, Ctrl+Tab, etc.).
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    // Só reage a teclas que representam um caractere de verdade
    // (letras, números, símbolos, espaço). Ignora Enter, Tab, setas,
    // Escape, F1-F12, etc.
    if (event.key.length !== 1) return;

    event.preventDefault();
    event.stopPropagation();

    gURLBar.focus();
    gURLBar.select();
    gURLBar.value = event.key;
    gURLBar.inputField.dispatchEvent(new Event("input", { bubbles: true }));

    const end = gURLBar.value.length;
    try {
      gURLBar.selectionStart = end;
      gURLBar.selectionEnd = end;
    } catch (e) {
      // alguns forks/versões não expõem selectionStart/End diretamente; sem problema.
    }
  }

  // Captura no nível da janela do navegador, antes do conteúdo da aba.
  window.addEventListener("keydown", onKeyDown, true);
})();
