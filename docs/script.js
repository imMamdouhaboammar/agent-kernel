// agent-kernel landing — smooth anchor scroll + install tab switcher
(function () {
  'use strict';

  // smooth anchor scroll
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + id);
    });
  });

  // install bar tab switching
  const bar = document.querySelector('.install-bar');
  if (bar) {
    const tabs = bar.querySelectorAll('.install-tab');
    const cmds = bar.querySelectorAll('.ib-cmd');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
        cmds.forEach((c) => {
          if (c.dataset.cmd === target) c.removeAttribute('hidden');
          else c.setAttribute('hidden', '');
        });
      });
    });
  }
})();