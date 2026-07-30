// Agent Kernel Landing Page Script — Tabs, Copying & Interactivity
(function () {
  'use strict';

  // Smooth scroll
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

  // Install Bar Tab Switching
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

  // Copy Command to Clipboard
  const copyBtn = document.getElementById('copy-cmd-btn');
  const toast = document.getElementById('toast');

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const activeCmd = document.querySelector('.ib-cmd:not([hidden])');
      if (!activeCmd) return;
      
      const textToCopy = activeCmd.textContent.trim();
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('Copied to clipboard!');
      }).catch(() => {
        showToast('Failed to copy');
      });
    });
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Terminal Explorer Tab Switching
  const termTabs = document.querySelectorAll('.term-tab');
  const termOutputs = document.querySelectorAll('.term-output');

  termTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.term;
      termTabs.forEach((t) => t.classList.toggle('is-active', t === tab));
      termOutputs.forEach((out) => {
        if (out.id === `output-${target}`) out.removeAttribute('hidden');
        else out.setAttribute('hidden', '');
      });
    });
  });
})();