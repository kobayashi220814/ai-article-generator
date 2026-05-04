// ==UserScript==
// @name         ICS 廣告連結自動填入（AI 文章產生器）
// @namespace    pressplay-ics-autofill-ai-generator
// @version      1.0
// @description  從 AI 文章產生器開啟時，自動填入廣告連結所有欄位
// @author       wade7
// @match        https://ics-admin.pressplay.cc/admin/pressplay/promote/ad_link/add*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const params = new URLSearchParams(location.search);
    const note = params.get('note');
    const redirectUrl = params.get('redirect_url');

    // 不是從 AI 文章產生器過來的，直接離開
    if (!note || !redirectUrl) return;

    function setSelect(id, value) {
        const el = document.getElementById(id);
        if (!el) { console.warn('[ICS自動填入] 找不到欄位:', id); return; }
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function setInput(id, value) {
        const el = document.getElementById(id);
        if (!el) { console.warn('[ICS自動填入] 找不到欄位:', id); return; }
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function setSelect2(value, callback) {
        const wrapperDiv = document.querySelector('.condition-add[title="廣告連結分群"]');
        if (!wrapperDiv) { console.warn('[ICS自動填入] 找不到連結分群容器'); callback && callback(false); return; }

        const selectEl = wrapperDiv.querySelector('select');

        if (window.$ && selectEl && $(selectEl).data('select2')) {
            $(selectEl).val(value).trigger('change');
            callback && callback(true);
            return;
        }

        const select2Container = (selectEl && selectEl.nextElementSibling)
                               || wrapperDiv.querySelector('.select2-container');

        if (!select2Container) { console.warn('[ICS自動填入] 找不到 Select2 容器'); callback && callback(false); return; }

        const clickTarget = select2Container.querySelector('.select2-selection') || select2Container;
        clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        clickTarget.click();

        setTimeout(() => {
            const searchInput = document.querySelector('.select2-search__field');
            if (searchInput) {
                const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(searchInput, value);
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
            }

            let attempts = 0;
            const poll = setInterval(() => {
                const opts = document.querySelectorAll('.select2-results__option');
                for (const opt of opts) {
                    const text = opt.textContent.trim();
                    if (text === value || text.includes(value)) {
                        opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        opt.click();
                        clearInterval(poll);
                        callback && callback(true);
                        return;
                    }
                }
                if (++attempts > 40) {
                    clearInterval(poll);
                    console.warn('[ICS自動填入] 找不到選項:', value);
                    callback && callback(false);
                }
            }, 100);
        }, 350);
    }

    function showStatus(msg, color) {
        let el = document.getElementById('_ics_ai_status');
        if (!el) {
            el = document.createElement('div');
            el.id = '_ics_ai_status';
            el.style.cssText = `
                position: fixed;
                top: 20px;
                right: 24px;
                background: #fff;
                border: 2px solid #e05c2a;
                border-radius: 10px;
                padding: 12px 18px;
                z-index: 99999;
                box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                font-family: 'Noto Sans TC', Arial, sans-serif;
                font-size: 14px;
                font-weight: 600;
            `;
            document.body.appendChild(el);
        }
        el.style.color = color || '#444';
        el.textContent = msg;
    }

    const redirectPath = (() => {
        try { return new URL(redirectUrl).pathname; } catch { return redirectUrl; }
    })();

    function fillAll() {
        setSelect('type', 'in_article');
        setSelect('referral_type', 'internal');
        setSelect('dep', 'bd');

        // 等 Vue 處理完前三個 select 的變更後再觸發 Select2
        setTimeout(() => {
            setSelect2('SEO2', (ok) => {
                setInput('note', note);
                setInput('redirect_url', redirectPath);

                if (ok) {
                    showStatus('✓ 欄位已自動填入！', '#28a745');
                } else {
                    showStatus('⚠ 連結分群填入失敗，請手動選取', '#dc3545');
                }
                setTimeout(() => {
                    const el = document.getElementById('_ics_ai_status');
                    if (el) el.remove();
                }, 4000);
            });
        }, 300);
    }

    // 等待表單元素出現後自動填入，額外延遲讓 Vue 完成初始化
    const timer = setInterval(() => {
        if (document.getElementById('type')) {
            clearInterval(timer);
            setTimeout(fillAll, 800);
        }
    }, 300);
})();
