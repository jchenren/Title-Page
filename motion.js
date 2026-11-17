'use strict';

(() => {
  const root = document.documentElement;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = true;
  try { enabled = localStorage.getItem('index-motion') !== 'off'; } catch {}
  const animations = new Set();
  const seen = new WeakSet();
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  const tools = document.createElement('div');
  tools.className = 'motion-tools';
  tools.setAttribute('role', 'group');
  tools.setAttribute('aria-label', '页面显示工具');
  const toggle = document.createElement('button');
  toggle.className = 'motion-tool';
  toggle.type = 'button';
  toggle.append(icon('spark'));
  const toggleLabel = document.createElement('span');
  toggle.append(toggleLabel);
  const top = document.createElement('button');
  top.className = 'motion-tool';
  top.type = 'button';
  top.textContent = '↑ 顶部';
  top.setAttribute('aria-label', '返回页面顶部');
  top.hidden = true;
  tools.append(toggle, top);
  document.body.append(progress, tools);

  function canAnimate() {
    return enabled && !preference.matches && typeof Element.prototype.animate === 'function';
  }

  function play(node, frames, options) {
    if (!canAnimate()) return;
    const animation = node.animate(frames, options);
    animations.add(animation);
    const complete = () => animations.delete(animation);
    animation.addEventListener('finish', complete, { once: true });
    animation.addEventListener('cancel', complete, { once: true });
    return animation;
  }

  function applyPreference() {
    const active = canAnimate();
    root.dataset.motion = active ? 'on' : 'off';
    toggle.setAttribute('aria-pressed', String(active));
    toggleLabel.textContent = active ? '动效已开启' : '静态模式';
    toggle.title = preference.matches ? '系统已设置减少动态效果' : '切换页面动态效果';
    toggle.disabled = preference.matches;
    if (!active) {
      for (const animation of animations) animation.cancel();
      document.querySelectorAll('.motion-particle').forEach(node => node.remove());
    }
  }

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem('index-motion', enabled ? 'on' : 'off'); } catch {}
    applyPreference();
  });
  preference.addEventListener('change', applyPreference);
  top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: canAnimate() ? 'smooth' : 'auto' }));
  applyPreference();

  let scrollFrame = 0;
  function updateProgress() {
    scrollFrame = 0;
    const distance = root.scrollHeight - window.innerHeight;
    const ratio = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
    progress.style.transform = 'scaleX(' + ratio + ')';
    top.hidden = window.scrollY < 420;
  }
  function queueProgress() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress);
  }
  window.addEventListener('scroll', queueProgress, { passive: true });
  window.addEventListener('resize', queueProgress);
  if (typeof ResizeObserver === 'function') new ResizeObserver(queueProgress).observe(document.body);
  updateProgress();

  function reveal(node, delay = 0) {
    play(node, [
      { opacity: .35, transform: 'translateY(14px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 380, delay, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }

  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    let visibleIndex = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      reveal(entry.target, Math.min(visibleIndex++ * 45, 180));
    }
  }, { threshold: .04 }) : null;

  function observeGroups() {
    if (observer) observer.disconnect();
    const container = document.getElementById('resource-groups');
    container.querySelectorAll('.resource-group').forEach(node => {
      if (seen.has(node)) return;
      seen.add(node);
      if (observer) observer.observe(node);
    });
    queueProgress();
  }
  observeGroups();
  new MutationObserver(observeGroups).observe(document.getElementById('resource-groups'), { childList: true });
  ['.welcome', '.search-section', '.ai-section', '.quick-section'].forEach((selector, index) => {
    const node = document.querySelector(selector);
    if (node) reveal(node, index * 65);
  });

  document.addEventListener('click', event => {
    if (!canAnimate() || !(event.target instanceof Element)) return;
    const button = event.target.closest('.ai-topic, .category-tab, .save-button, .add-site-button');
    if (!button) return;
    const bounds = button.getBoundingClientRect();
    if (!button.matches('.save-button')) {
      play(button, [{ scale: '1' }, { scale: '.96' }, { scale: '1' }], { duration: 210, easing: 'ease-out' });
      return;
    }
    if (button.getAttribute('aria-pressed') === 'true') return;
    const colors = ['#6387d0', '#a17bd1', '#d786aa', '#e1b859', '#64aa91', '#60a5b9'];
    colors.forEach((color, index) => {
      const particle = document.createElement('span');
      particle.className = 'motion-particle';
      particle.setAttribute('aria-hidden', 'true');
      particle.style.backgroundColor = color;
      particle.style.left = bounds.left + bounds.width / 2 - 2 + 'px';
      particle.style.top = bounds.top + bounds.height / 2 - 2 + 'px';
      document.body.append(particle);
      const angle = index * Math.PI / 3;
      const animation = play(particle, [
        { opacity: 1, transform: 'translate(0, 0) rotate(0)' },
        { opacity: 0, transform: 'translate(' + Math.cos(angle) * 29 + 'px, ' + (Math.sin(angle) * 25 - 10) + 'px) rotate(100deg)' }
      ], { duration: 480, easing: 'cubic-bezier(.1,.6,.3,1)' });
      if (animation) {
        animation.addEventListener('finish', () => particle.remove(), { once: true });
        animation.addEventListener('cancel', () => particle.remove(), { once: true });
      } else particle.remove();
    });
  }, true);
})();
