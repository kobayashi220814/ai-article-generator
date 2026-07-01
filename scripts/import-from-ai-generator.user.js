// ==UserScript==
// @name         匯入 AI 文章產生器（PressPlay 編輯器）
// @namespace    pressplay-import-ai-article
// @version      1.2
// @description  在 PressPlay 文章編輯頁，從 AI 文章產生器一鍵匯入標題與內文，並可一鍵把編輯器現有內容套成標準格式
// @author       wade7
// @match        *://*.pressplay.cc/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      ai-article-generator.wade-lin.com
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/kobayashi220814/ai-article-generator/main/scripts/import-from-ai-generator.user.js
// @downloadURL  https://raw.githubusercontent.com/kobayashi220814/ai-article-generator/main/scripts/import-from-ai-generator.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ─── 設定 ─────────────────────────────────────────────────────────────────
  // 切換來源：正式 = https://ai-article-generator.wade-lin.com；本地 = http://localhost:3000
  const API_BASE = 'https://ai-article-generator.wade-lin.com';
  const PAGE_ID_MATCH = 'cc_project_content_article_edit'; // body[data-page-id]

  // 標準格式定義（對齊 export-html/route.ts 的 STYLE）
  const FMT = { font: '18px', h2Color: 'rgb(239,135,0)', h3Color: 'rgb(21,170,191)' };

  // ─── 只在編輯頁面跑 ────────────────────────────────────────────────────────
  if (document.body?.dataset?.pageId !== PAGE_ID_MATCH) {
    // SPA 可能延遲 render，多嘗試幾次
    let tries = 0;
    const t = setInterval(() => {
      if (document.body?.dataset?.pageId === PAGE_ID_MATCH) {
        clearInterval(t);
        init();
      } else if (++tries > 40) {
        clearInterval(t);
      }
    }, 250);
    return;
  }
  init();

  // ─── Main ─────────────────────────────────────────────────────────────────
  function init() {
    waitFor(
      () => document.querySelector('.fr-element.fr-view') && document.querySelector('input[name="timeline_title"]'),
      () => {
        injectStyles();
        mountFAB();
      },
      40,
      300
    );
  }

  function injectStyles() {
    GM_addStyle(`
      #aig-fab {
        position: fixed; right: 20px; top: 70px; z-index: 99998;
        width: 56px; height: 56px; border-radius: 50%;
        background: linear-gradient(135deg, #3b82f6, #6366f1);
        color: #fff; font-size: 22px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 6px 16px rgba(59,130,246,0.4);
        cursor: pointer; border: none; user-select: none;
        transition: transform 0.15s ease;
      }
      #aig-fab:hover { transform: scale(1.05); }
      #aig-fab:active { transform: scale(0.95); }

      #aig-fab-fmt {
        position: fixed; right: 20px; top: 134px; z-index: 99998;
        width: 56px; height: 56px; border-radius: 50%;
        background: linear-gradient(135deg, #ef8700, #15aabf);
        color: #fff; font-size: 13px; font-weight: 800; letter-spacing: .5px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 6px 16px rgba(239,135,0,0.4);
        cursor: pointer; border: none; user-select: none;
        transition: transform 0.15s ease;
      }
      #aig-fab-fmt:hover { transform: scale(1.05); }
      #aig-fab-fmt:active { transform: scale(0.95); }

      #aig-modal-backdrop {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(15,23,42,0.5); backdrop-filter: blur(2px);
        display: flex; align-items: center; justify-content: center;
        font-family: 'Plus Jakarta Sans', -apple-system, system-ui, sans-serif;
      }
      #aig-modal {
        background: #fff; border-radius: 16px;
        width: 92%; max-width: 640px; max-height: 80vh;
        display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 20px 50px rgba(0,0,0,0.25);
      }
      #aig-modal header {
        padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
        display: flex; align-items: center; justify-content: space-between;
      }
      #aig-modal header h3 {
        margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;
      }
      #aig-modal header button.aig-close {
        background: none; border: none; font-size: 22px; color: #94a3b8;
        cursor: pointer; padding: 0 6px; line-height: 1;
      }
      #aig-modal header button.aig-close:hover { color: #475569; }
      .aig-search-box {
        padding: 12px 20px; border-bottom: 1px solid #f1f5f9;
      }
      .aig-search-box input {
        width: 100%; padding: 9px 12px; border: 1px solid #e2e8f0;
        border-radius: 10px; font-size: 13px; outline: none;
        background: #f8fafc;
      }
      .aig-search-box input:focus {
        border-color: #3b82f6; background: #fff;
      }
      .aig-list {
        flex: 1; overflow-y: auto; padding: 8px 12px;
      }
      .aig-item {
        padding: 12px 14px; border-radius: 10px; cursor: pointer;
        border: 1px solid transparent; margin-bottom: 4px;
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px;
      }
      .aig-item:hover { background: #f1f5f9; border-color: #e2e8f0; }
      .aig-item-main {
        flex: 1; min-width: 0;
      }
      .aig-item-title {
        font-size: 13px; font-weight: 600; color: #1e293b;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .aig-item-meta {
        font-size: 11px; color: #94a3b8; margin-top: 2px;
      }
      .aig-status {
        font-size: 10px; padding: 2px 8px; border-radius: 99px;
        font-weight: 600; flex-shrink: 0;
      }
      .aig-status.done { background: #d1fae5; color: #065f46; }
      .aig-status.pending,
      .aig-status.generating { background: #fef3c7; color: #92400e; }
      .aig-status.error { background: #fee2e2; color: #991b1b; }
      .aig-empty, .aig-loading {
        text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 13px;
      }
      .aig-error-banner {
        margin: 12px 20px 0; padding: 10px 12px;
        background: #fef2f2; border: 1px solid #fecaca;
        border-radius: 10px; color: #991b1b; font-size: 12px;
      }
      .aig-footer {
        padding: 10px 20px; border-top: 1px solid #f1f5f9;
        font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;
      }
      .aig-toast {
        position: fixed; top: 24px; right: 24px; z-index: 100000;
        background: #fff; border-radius: 10px; padding: 12px 18px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        font-size: 13px; font-weight: 600;
        font-family: 'Plus Jakarta Sans', -apple-system, system-ui, sans-serif;
      }
      .aig-toast.success { border-left: 4px solid #10b981; color: #065f46; }
      .aig-toast.error { border-left: 4px solid #ef4444; color: #991b1b; }
      .aig-toast.info { border-left: 4px solid #3b82f6; color: #1e40af; }
    `);
  }

  // ─── FAB ─────────────────────────────────────────────────────────────────
  function mountFAB() {
    if (document.getElementById('aig-fab')) return;
    const btn = document.createElement('button');
    btn.id = 'aig-fab';
    btn.title = '匯入 AI 文章';
    btn.textContent = 'AI';
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);

    const fmtBtn = document.createElement('button');
    fmtBtn.id = 'aig-fab-fmt';
    fmtBtn.title = '一鍵套用標準格式';
    fmtBtn.textContent = '套格式';
    fmtBtn.addEventListener('click', applyFormat);
    document.body.appendChild(fmtBtn);
  }

  // ─── Modal ───────────────────────────────────────────────────────────────
  function openModal() {
    if (document.getElementById('aig-modal-backdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'aig-modal-backdrop';
    backdrop.innerHTML = `
      <div id="aig-modal" role="dialog">
        <header>
          <h3>匯入 AI 文章</h3>
          <button class="aig-close" type="button">×</button>
        </header>
        <div class="aig-search-box">
          <input type="text" placeholder="搜尋關鍵字..." autocomplete="off" />
        </div>
        <div class="aig-list"><div class="aig-loading">載入中…</div></div>
        <div class="aig-footer">
          <span>來源：${API_BASE}</span>
          <span>只顯示「已完成」文章</span>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const close = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    backdrop.querySelector('.aig-close').addEventListener('click', close);

    const searchInput = backdrop.querySelector('.aig-search-box input');
    const listBox = backdrop.querySelector('.aig-list');

    let allArticles = [];

    const render = (filter = '') => {
      const q = filter.trim().toLowerCase();
      const filtered = allArticles.filter((a) =>
        !q || a.keyword.toLowerCase().includes(q)
      );
      if (!filtered.length) {
        listBox.innerHTML = `<div class="aig-empty">沒有符合的文章</div>`;
        return;
      }
      listBox.innerHTML = filtered
        .map((a) => `
          <div class="aig-item" data-id="${a.id}" data-status="${a.status}">
            <div class="aig-item-main">
              <div class="aig-item-title">${escapeHTML(a.keyword)}</div>
              <div class="aig-item-meta">${formatDate(a.createdAt)}</div>
            </div>
            <span class="aig-status ${a.status}">${statusLabel(a.status)}</span>
          </div>
        `).join('');

      listBox.querySelectorAll('.aig-item').forEach((el) => {
        el.addEventListener('click', () => {
          const id = el.dataset.id;
          const status = el.dataset.status;
          if (status !== 'done') {
            toast('該文章尚未完成生成，無法匯入', 'error');
            return;
          }
          close();
          importArticle(id);
        });
      });
    };

    searchInput.addEventListener('input', () => render(searchInput.value));
    searchInput.focus();

    fetchArticles()
      .then((articles) => {
        allArticles = articles;
        render();
      })
      .catch((err) => {
        listBox.innerHTML = `<div class="aig-error-banner">無法連線到 AI 生成器：${escapeHTML(err.message)}<br>請確認 ${API_BASE} 是否啟動</div>`;
      });
  }

  // ─── API ──────────────────────────────────────────────────────────────────
  function fetchArticles() {
    return gmRequest('GET', `${API_BASE}/api/articles`);
  }

  function fetchArticleExport(id) {
    return gmRequest('GET', `${API_BASE}/api/articles/${id}/export-html`);
  }

  function gmRequest(method, url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method, url,
        headers: { Accept: 'application/json' },
        timeout: 15000,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) {
            try { resolve(JSON.parse(res.responseText)); }
            catch (e) { reject(new Error('JSON 解析失敗')); }
          } else {
            reject(new Error(`HTTP ${res.status}: ${res.responseText?.slice(0,200) ?? ''}`));
          }
        },
        onerror: () => reject(new Error('連線失敗，請確認 dev server 開啟')),
        ontimeout: () => reject(new Error('連線逾時')),
      });
    });
  }

  // ─── 匯入動作 ──────────────────────────────────────────────────────────────
  async function importArticle(id) {
    toast('匯入中…', 'info', 1500);
    try {
      const data = await fetchArticleExport(id);
      setTitle(data.title);
      const ok = setFroalaHTML(data.html);
      if (!ok) {
        toast('內文注入失敗（找不到 Froala 編輯器）', 'error');
        return;
      }
      toast(`✓ 已匯入「${data.keyword}」`, 'success');
    } catch (err) {
      console.error('[AIG] import error:', err);
      toast(`匯入失敗：${err.message}`, 'error');
    }
  }

  function setTitle(title) {
    const input = document.querySelector('input[name="timeline_title"]');
    if (!input || !title) return;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, 'value'
    ).set;
    setter.call(input, title);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 嘗試多種路徑把 HTML append 到 Froala 現有內容之後：
   * 1. window.FroalaEditor.INSTANCES（v3+ 全域）
   * 2. jQuery data('froala.editor')
   * 3. Fallback：直接寫 contenteditable 容器 + 同步隱藏 textarea
   */
  function setFroalaHTML(html) {
    // 方法 1：全域 INSTANCES
    try {
      const FE = window.FroalaEditor || window.unsafeWindow?.FroalaEditor;
      if (FE && Array.isArray(FE.INSTANCES) && FE.INSTANCES.length) {
        const inst = FE.INSTANCES.find((i) => i.$box?.[0]?.isConnected) || FE.INSTANCES[0];
        if (inst?.html?.set && inst?.html?.get) {
          const existing = inst.html.get() ?? '';
          inst.html.set(mergeHTML(existing, html));
          inst.events?.trigger?.('contentChanged');
          inst.undo?.saveStep?.();
          return true;
        }
      }
    } catch (e) { console.warn('[AIG] FroalaEditor.INSTANCES path failed:', e); }

    // 方法 2：jQuery data
    try {
      const $ = window.jQuery || window.$;
      if ($) {
        const $box = $('.fr-box').first();
        const inst = $box.data('froala.editor');
        if (inst?.html?.set && inst?.html?.get) {
          const existing = inst.html.get() ?? '';
          inst.html.set(mergeHTML(existing, html));
          inst.events?.trigger?.('contentChanged');
          inst.undo?.saveStep?.();
          return true;
        }
      }
    } catch (e) { console.warn('[AIG] jQuery data path failed:', e); }

    // 方法 3：Fallback — 直接寫 DOM + 同步 textarea
    const editorEl = document.querySelector('.fr-element.fr-view');
    const textarea = document.querySelector('#timeline_desc, textarea.pp-froala-editor');
    if (!editorEl) return false;

    const merged = mergeHTML(editorEl.innerHTML, html);
    editorEl.innerHTML = merged;
    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
    editorEl.dispatchEvent(new Event('blur', { bubbles: true }));

    if (textarea) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
      ).set;
      setter.call(textarea, merged);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  // 把新內容接在舊內容後面；若舊內容只剩空段落（<p><br></p>）視為空、直接覆蓋
  function mergeHTML(existing, incoming) {
    const trimmed = (existing ?? '').replace(/\s+/g, '');
    const isEmpty = !trimmed
      || trimmed === '<p><br></p>'
      || trimmed === '<p></p>'
      || trimmed === '<br>';
    if (isEmpty) return incoming;
    return existing + incoming;
  }

  // ─── 套格式：讀取編輯器現有內容 → 正規化 → 寫回 ───────────────────────────
  function applyFormat() {
    const inst = getFroalaInstance();
    const editorEl = document.querySelector('.fr-element.fr-view');

    let current;
    if (inst?.html?.get) current = inst.html.get();
    else if (editorEl) current = editorEl.innerHTML;
    else { toast('找不到 Froala 編輯器', 'error'); return; }

    if (!current || !current.trim()) { toast('編輯器是空的，沒東西可套', 'info'); return; }

    let next;
    try {
      next = transformHTML(current);
    } catch (e) {
      console.error('[AIG] format transform error:', e);
      toast('轉換失敗：' + e.message, 'error');
      return;
    }

    const ok = writeFroalaHTML(inst, editorEl, next);
    if (ok) toast('✓ 已套用標準格式', 'success');
    else toast('寫回編輯器失敗', 'error');
  }

  // 強制覆蓋成標準格式（h2 橘 / h3 藍綠 / p、li 18px / 表格 span 18px；圖片不動）
  function transformHTML(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const root = doc.body;

    root.querySelectorAll('h2').forEach((el) => el.style.setProperty('color', FMT.h2Color));
    root.querySelectorAll('h3').forEach((el) => el.style.setProperty('color', FMT.h3Color));

    root.querySelectorAll('p').forEach((p) => {
      if (p.closest('li, td, th')) return;
      p.style.setProperty('font-size', FMT.font);
    });

    root.querySelectorAll('li').forEach((li) => {
      const inner = unwrapInner(li.innerHTML);
      li.innerHTML = `<p><span style="font-size: ${FMT.font};">${inner || '<br>'}</span></p>`;
    });

    root.querySelectorAll('th').forEach((th) => {
      const inner = unwrapInner(th.innerHTML);
      th.innerHTML = `<span style="font-size: ${FMT.font};"><strong>${inner || '<br>'}</strong><br></span>`;
    });

    root.querySelectorAll('td').forEach((td) => {
      if (!td.getAttribute('colspan')) td.setAttribute('colspan', '1');
      if (!td.getAttribute('rowspan')) td.setAttribute('rowspan', '1');
      const inner = unwrapInner(td.innerHTML);
      td.innerHTML = `<p><span style="font-size: ${FMT.font};">${inner || '<br>'}</span></p>`;
    });

    return root.innerHTML;
  }

  // 去掉外層排版包裝（p / span / strong）與結尾 <br>，保留 <a> <em> <s> <u> <code> 等語意標籤
  function unwrapInner(htmlStr) {
    return String(htmlStr)
      .replace(/<\/?(?:p|span|strong)\b[^>]*>/gi, '')
      .replace(/(?:<br\s*\/?>\s*)+$/i, '')
      .trim();
  }

  function getFroalaInstance() {
    try {
      const FE = window.FroalaEditor || window.unsafeWindow?.FroalaEditor;
      if (FE && Array.isArray(FE.INSTANCES) && FE.INSTANCES.length) {
        return FE.INSTANCES.find((i) => i.$box?.[0]?.isConnected) || FE.INSTANCES[0];
      }
    } catch (e) { /* noop */ }
    try {
      const $ = window.jQuery || window.$;
      if ($) {
        const inst = $('.fr-box').first().data('froala.editor');
        if (inst) return inst;
      }
    } catch (e) { /* noop */ }
    return null;
  }

  // 直接「取代」編輯器內容（與匯入的 append 不同）
  function writeFroalaHTML(inst, editorEl, html) {
    if (inst?.html?.set) {
      inst.html.set(html);
      inst.events?.trigger?.('contentChanged');
      inst.undo?.saveStep?.();
      return true;
    }
    if (!editorEl) return false;
    editorEl.innerHTML = html;
    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
    editorEl.dispatchEvent(new Event('blur', { bubbles: true }));
    const textarea = document.querySelector('#timeline_desc, textarea.pp-froala-editor');
    if (textarea) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, html);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  // ─── Util ─────────────────────────────────────────────────────────────────
  function waitFor(cond, done, maxTries = 20, interval = 300) {
    let tries = 0;
    const t = setInterval(() => {
      if (cond()) { clearInterval(t); done(); }
      else if (++tries >= maxTries) clearInterval(t);
    }, interval);
  }

  function toast(msg, type = 'info', duration = 3000) {
    const el = document.createElement('div');
    el.className = `aig-toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  function statusLabel(s) {
    return ({ done: '已完成', pending: '生成中', generating: '生成中', error: '失敗' })[s] ?? s;
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return iso; }
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }
})();
