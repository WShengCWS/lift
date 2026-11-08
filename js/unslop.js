/* LIFT unslop pass (preview): loading states (19) and useful feedback (20). */
(function () {
'use strict';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 19 · show a spinner on the pressed button while slow work runs, then let the screen re-render */
window.busy = function (el, fn) {
  if (el && el.setAttribute) el.setAttribute('aria-busy', 'true');
  setTimeout(() => { try { fn(); } finally { if (el && el.isConnected) el.removeAttribute('aria-busy'); } }, 30);
};
['doImport'].forEach(k => {
  const orig = A[k]; if (!orig) return;
  A[k] = (d, el, e) => busy(el, () => orig(d, el, e));
});

})();
