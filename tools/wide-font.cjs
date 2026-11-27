// Test sandboxes can't load the app's Google web fonts (Atkinson Hyperlegible, Outfit), so pages fall back to a
// narrower system font and a label that wraps on a real device can pass locally. This swaps in DejaVu Sans,
// which is at least as wide as the web fonts and is installed wherever Playwright runs, so the layout checks
// see the worst case. Use: await ctx.addInitScript(wideFont)
module.exports = function wideFont() {
  const add = () => { if (document.getElementById('kr-wide-font')) return; const s = document.createElement('style'); s.id = 'kr-wide-font';
    s.textContent = ':root{--font-display:"DejaVu Sans",sans-serif !important;--font-body:"DejaVu Sans",sans-serif !important}body,button,input,select,textarea{font-family:"DejaVu Sans",sans-serif !important}';
    (document.head || document.documentElement).appendChild(s); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
};
