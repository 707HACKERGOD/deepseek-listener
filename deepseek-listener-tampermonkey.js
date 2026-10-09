// ==UserScript==
// @name         DeepSeek → VS Code File Sync
// @namespace    local.deepseek.sync
// @version      1.0.0
// @description  Posts [FILE:...] blocks from DeepSeek replies to a local Node server
// @match        https://chat.deepseek.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const ENDPOINT  = 'http://localhost:3000/update-files';
  const TOKEN     = 'change-me-1234';   // must match SYNC_TOKEN on the server
  const SETTLE_MS = 1500;               // text must be unchanged this long
  const MSG_SEL   = '.ds-markdown';     // last assistant message; adjust if DOM changes

  const state = new WeakMap();
  let scheduled = false;

  /* ---------- DOM → markdown ---------- */

  function toMarkdown(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll('button, svg, [role="button"], .ds-icon-button')
         .forEach(n => n.remove());

    // Turn rendered code blocks back into fenced markdown
    clone.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code') || pre;
      const lang = ((code.className || '').match(/language-([\w+#-]+)/) || [])[1] || '';
      const body = code.innerText.replace(/\n+$/, '');
      pre.replaceWith(document.createTextNode(`\n\`\`\`${lang}\n${body}\n\`\`\`\n`));
    });

    return clone.innerText.replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------- transport ---------- */

  function sendToIDE(textData) {
    GM_xmlhttpRequest({
      method: 'POST',
      url: ENDPOINT,
      data: JSON.stringify({ textData, token: TOKEN }),
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      onload: r => {
        let info = r.responseText;
        try { info = JSON.stringify(JSON.parse(r.responseText).written); } catch {}
        console.log(`[DS-Sync] HTTP ${r.status} → ${info}`);
      },
      onerror:   () => console.error('[DS-Sync] could not reach the local server'),
      ontimeout: () => console.error('[DS-Sync] request timed out'),
    });
  }

  /* ---------- watch for a settled response ---------- */

  function consider(el) {
    const text = toMarkdown(el);
    if (!text.includes('[FILE:')) return;

    let s = state.get(el);
    if (!s) { s = { pending: null, lastSent: null, timer: null }; state.set(el, s); }

    if (text === s.pending) return;          // no new characters this tick
    s.pending = text;
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      if (s.pending === s.lastSent) return;  // already sent this exact revision
      s.lastSent = s.pending;
      console.log('[DS-Sync] sending settled response…');
      sendToIDE(s.pending);
    }, SETTLE_MS);
  }

  function scan() {
    scheduled = false;
    const nodes = document.querySelectorAll(MSG_SEL);
    if (nodes.length) consider(nodes[nodes.length - 1]);   // last message only
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(scan, 200);                                  // cheap throttle
  }

  new MutationObserver(schedule).observe(document.body, {
    childList: true, subtree: true, characterData: true,
  });
  schedule();

  /* ---------- manual trigger: Ctrl+Alt+S ---------- */

  document.addEventListener('keydown', e => {
    if (!e.ctrlKey || !e.altKey || e.key.toLowerCase() !== 's') return;
    e.preventDefault();
    const nodes = document.querySelectorAll(MSG_SEL);
    if (!nodes.length) return;
    console.log('[DS-Sync] manual send');
    sendToIDE(toMarkdown(nodes[nodes.length - 1]));
  });
})();
