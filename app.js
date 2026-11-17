'use strict';

const defaultGroups = navigationGroups;

const byId = id => document.getElementById(id);
let resources = [];
let allSites = [];
let customSites = [];
let category = 'all';
let savedOnly = false;
let compact = false;
let saved = new Set();

function validWebURL(value) {
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol) && !!parsed.hostname && !parsed.username && !parsed.password;
  } catch { return false; }
}

function rebuildResources() {
  resources = defaultGroups.map(group => ({ ...group, sites: [...group.sites] }));
  for (const site of customSites) {
    let group = resources.find(item => item.name === site.category);
    if (!group) {
      group = { id: 'group-' + site.id, name: site.category, icon: 'globe', sites: [] };
      resources.push(group);
    }
    group.sites.push([site.id, site.name, site.url, site.description || new URL(site.url).hostname, site.name.slice(0, 1).toUpperCase(), 'green']);
  }
  allSites = resources.flatMap(group => group.sites);
}

try {
  const stored = JSON.parse(localStorage.getItem('index-custom') || '[]');
  const ids = new Set();
  if (Array.isArray(stored)) customSites = stored.filter(site => {
    const valid = site && typeof site.id === 'string' && site.id.startsWith('custom-') && !ids.has(site.id) &&
      typeof site.name === 'string' && site.name.trim() && site.name.length <= 100 &&
      typeof site.category === 'string' && site.category.trim() && site.category.length <= 40 &&
      typeof site.url === 'string' && site.url.length <= 2048 && validWebURL(site.url) &&
      (site.description === undefined || (typeof site.description === 'string' && site.description.length <= 100));
    if (valid) ids.add(site.id);
    return valid;
  });
} catch {}
rebuildResources();
try {
  const stored = JSON.parse(localStorage.getItem('index-saved') || '[]');
  const ids = new Set(allSites.map(site => site[0]));
  if (Array.isArray(stored)) saved = new Set(stored.filter(id => ids.has(id)));
  compact = localStorage.getItem('index-compact') === 'true';
} catch {}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name, className) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  if (className) node.setAttribute('class', className);
  node.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-' + name);
  node.append(use);
  return node;
}

function logo(site) {
  const container = element('span', 'site-logo logo-' + site[5]);
  container.setAttribute('aria-hidden', 'true');
  const fallback = element('span', 'logo-fallback', site[4]);
  const image = element('img', 'website-favicon is-loading');
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('load', () => {
    image.classList.remove('is-loading');
    fallback.hidden = true;
  });
  image.addEventListener('error', () => image.remove(), { once: true });
  image.src = new URL('/favicon.ico', site[2]).href;
  container.append(fallback, image);
  return container;
}

function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function selectCategory(id) {
  category = id;
  savedOnly = false;
  render();
}

function showSaved() {
  savedOnly = true;
  category = 'all';
  render();
}

function renderNavigation() {
  byId('all-count').textContent = allSites.length;
  byId('total-count').textContent = allSites.length;
  byId('saved-count').textContent = saved.size;
  byId('all-button').classList.toggle('active', category === 'all' && !savedOnly);
  byId('saved-button').classList.toggle('active', savedOnly);
  byId('all-button').setAttribute('aria-pressed', String(category === 'all' && !savedOnly));
  byId('saved-button').setAttribute('aria-pressed', String(savedOnly));
  byId('sidebar-categories').replaceChildren();
  byId('category-tabs').replaceChildren();
  byId('ai-topics').replaceChildren();
  for (const group of resources.filter(item => item.id === 'ai' || item.id.startsWith('ai-'))) {
    const topic = element('button', 'ai-topic');
    topic.type = 'button';
    topic.dataset.tone = String(Math.max(0, resources.findIndex(item => item.id === group.id)) % 8);
    topic.setAttribute('aria-pressed', String(category === group.id && !savedOnly));
    topic.append(icon(group.icon), element('span', '', group.name), element('span', 'ai-topic-count', group.sites.length));
    topic.onclick = () => {
      byId('search').value = '';
      selectCategory(group.id);
    };
    byId('ai-topics').append(topic);
  }
  for (const group of [{ id: 'all', name: '全部资源' }, ...resources]) {
    const selected = category === group.id && !savedOnly;
    const tab = element('button', 'category-tab', group.name);
    tab.dataset.tone = String(Math.max(0, resources.findIndex(item => item.id === group.id)) % 8);
    tab.type = 'button';
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-pressed', String(selected));
    tab.onclick = () => selectCategory(group.id);
    byId('category-tabs').append(tab);
    if (group.id !== 'all') {
      const button = element('button', 'rail-item');
      button.dataset.tone = tab.dataset.tone;
      button.type = 'button';
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.append(icon(group.icon), element('span', '', group.name), element('span', 'rail-count', group.sites.length));
      button.onclick = () => selectCategory(group.id);
      byId('sidebar-categories').append(button);
    }
  }
  const tab = element('button', 'category-tab', '我的收藏');
  tab.type = 'button';
  tab.classList.toggle('active', savedOnly);
  tab.setAttribute('aria-pressed', String(savedOnly));
  tab.onclick = showSaved;
  byId('category-tabs').append(tab);
}

function render() {
  renderNavigation();
  const query = byId('search').value.trim().toLocaleLowerCase();
  const groups = resources.filter(group => category === 'all' || category === group.id).map(group => ({
    ...group,
    sites: group.sites.filter(site =>
      (!savedOnly || saved.has(site[0])) &&
      (!query || [group.name, site[1], site[2], site[3], ...(site[6] || []), group.id === 'ai' || group.id.startsWith('ai-') ? 'AI 人工智能' : ''].join(' ').toLocaleLowerCase().includes(query))
    )
  })).filter(group => group.sites.length);
  const count = groups.reduce((total, group) => total + group.sites.length, 0);
  const label = savedOnly ? '我的收藏' : category === 'all' ? '探索资源' : resources.find(group => group.id === category).name;
  byId('view-title').textContent = label;
  byId('breadcrumb').textContent = savedOnly ? '我的收藏' : category === 'all' ? '发现全部' : label;
  byId('view-count').textContent = count + ' 个网站';
  byId('result-status').textContent = query ? '“' + byId('search').value.trim() + '” 的搜索结果 · ' + count + ' 个网站' : '';
  byId('empty-state').hidden = count !== 0;
  byId('empty-description').textContent = savedOnly && !query ? '点击网站右侧的书签，把常用网站留在这里。' : '换一个关键词，或查看其他分类。';
  byId('resource-groups').replaceChildren();
  byId('resource-groups').classList.toggle('compact', compact);
  byId('resource-groups').classList.toggle('single-group', groups.length === 1);
  byId('view-toggle').setAttribute('aria-pressed', String(compact));
  for (const group of groups) {
    const section = element('section', 'resource-group');
    section.dataset.tone = String(Math.max(0, resources.findIndex(item => item.id === group.id)) % 8);
    const heading = element('div', 'group-head');
    const title = element('h3', '', group.name);
    title.id = 'title-' + group.id;
    section.setAttribute('aria-labelledby', title.id);
    heading.append(icon(group.icon), title, element('span', 'group-count', String(group.sites.length).padStart(2, '0')));
    section.append(heading);
    const siteList = element('div', 'group-sites');
    for (const site of group.sites) {
      const row = element('div', 'site-row');
      const anchor = element('a', 'site-link');
      anchor.href = site[2];
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.title = site[1] + ' · ' + new URL(site[2]).hostname;
      const copy = element('span', 'site-copy');
      copy.append(element('span', 'site-name', site[1]), element('span', 'site-description', site[3]));
      if (site[6] && (group.id === 'ai' || group.id.startsWith('ai-'))) {
        const tags = element('span', 'site-tags');
        for (const tag of site[6].slice(0, 2)) tags.append(element('span', 'site-tag', tag));
        copy.append(tags);
      }
      anchor.append(logo(site), copy);
      const save = element('button', 'save-button');
      save.type = 'button';
      const selected = saved.has(site[0]);
      save.classList.toggle('saved', selected);
      save.setAttribute('aria-pressed', String(selected));
      save.setAttribute('aria-label', (selected ? '取消收藏 ' : '收藏 ') + site[1]);
      save.title = selected ? '取消收藏' : '收藏网站';
      save.append(icon('bookmark'));
      save.onclick = () => {
        if (saved.has(site[0])) saved.delete(site[0]);
        else saved.add(site[0]);
        persist('index-saved', [...saved]);
        render();
        const replacement = [...document.querySelectorAll('.save-button')].find(button =>
          button.getAttribute('aria-label') === (saved.has(site[0]) ? '取消收藏 ' : '收藏 ') + site[1]
        );
        if (replacement) replacement.focus({ preventScroll: true });
      };
      row.append(anchor, save);
      siteList.append(row);
    }
    section.append(siteList);
    byId('resource-groups').append(section);
  }
}

for (const id of ['github', 'figma', 'chatgpt', 'notion']) {
  const site = allSites.find(item => item[0] === id);
  const anchor = element('a', 'quick-link');
  anchor.href = site[2];
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  const copy = element('span', 'quick-copy');
  copy.append(element('strong', '', site[1]), element('small', '', { github: '打开你的代码世界', figma: '让灵感开始成形', chatgpt: '和好想法聊一聊', notion: '整理今天的思绪' }[id]));
  anchor.append(logo(site), copy, icon('arrow', 'arrow'));
  byId('quick-links').append(anchor);
}

function resetView() {
  byId('search').value = '';
  category = 'all';
  savedOnly = false;
  render();
}
byId('all-button').onclick = () => selectCategory('all');
byId('saved-button').onclick = showSaved;
byId('search').addEventListener('input', render);
byId('view-toggle').onclick = () => {
  compact = !compact;
  persist('index-compact', compact);
  render();
};
byId('reset-button').onclick = resetView;
byId('home-button').onclick = resetView;
byId('breadcrumb').onclick = resetView;
document.querySelectorAll('[data-query]').forEach(button => {
  button.onclick = () => {
    category = 'all';
    savedOnly = false;
    byId('search').value = button.dataset.query;
    render();
    byId('search').focus();
  };
});
document.addEventListener('keydown', event => {
  const editing = event.target.closest('input, textarea, select, [contenteditable="true"]');
  if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    byId('search').focus();
  }
  if (event.key === 'Escape' && document.activeElement === byId('search')) {
    byId('search').value = '';
    render();
  }
});

const navigationDialog = byId('navigation-dialog');
const customForm = byId('custom-form');

function customMessage(text, error = false) {
  byId('custom-message').textContent = text;
  byId('custom-message').classList.toggle('error', error);
}

function resetCustomForm() {
  customForm.reset();
  byId('custom-id').value = '';
  byId('save-custom').textContent = '添加并保存';
  byId('cancel-custom').hidden = true;
}

function commitCustomSites(next) {
  try {
    localStorage.setItem('index-custom', JSON.stringify(next));
  } catch {
    customMessage('保存失败：浏览器存储不可用或空间不足，请检查浏览器设置。', true);
    return false;
  }
  customSites = next;
  rebuildResources();
  if (!resources.some(group => group.id === category)) category = 'all';
  render();
  renderCustomList();
  return true;
}

function renderCustomList() {
  byId('custom-count').textContent = customSites.length;
  byId('export-custom').disabled = customSites.length === 0;
  byId('category-options').replaceChildren();
  for (const group of resources) {
    const option = element('option');
    option.value = group.name;
    byId('category-options').append(option);
  }
  const list = byId('custom-list');
  list.replaceChildren();
  if (!customSites.length) list.append(element('p', 'custom-list-empty', '还没有添加网址，从上方添加第一个吧。'));
  for (const site of customSites) {
    const row = element('div', 'custom-list-row');
    const copy = element('div', 'custom-list-copy');
    copy.append(element('strong', '', site.name), element('small', '', site.category + ' · ' + site.url));
    const actions = element('div', 'custom-row-actions');
    const edit = element('button', '', '编辑');
    edit.type = 'button';
    edit.setAttribute('aria-label', '编辑 ' + site.name);
    edit.onclick = () => {
      byId('custom-id').value = site.id;
      byId('custom-name').value = site.name;
      byId('custom-category').value = site.category;
      byId('custom-url').value = site.url;
      byId('custom-description').value = site.description || '';
      byId('save-custom').textContent = '保存修改';
      byId('cancel-custom').hidden = false;
      customMessage('');
      byId('custom-name').focus();
    };
    const remove = element('button', 'delete-custom', '删除');
    remove.type = 'button';
    remove.setAttribute('aria-label', '删除 ' + site.name);
    remove.onclick = () => {
      if (!confirm('确定删除“' + site.name + '”吗？')) return;
      if (!commitCustomSites(customSites.filter(item => item.id !== site.id))) return;
      saved.delete(site.id);
      persist('index-saved', [...saved]);
      render();
      if (byId('custom-id').value === site.id) resetCustomForm();
      customMessage('网址已删除。');
    };
    actions.append(edit, remove);
    row.append(logo([site.id, site.name, site.url, '', site.name.slice(0, 1), 'green']), copy, actions);
    list.append(row);
  }
}

function openCustomNavigation() {
  resetCustomForm();
  customMessage('');
  renderCustomList();
  navigationDialog.showModal();
}
byId('custom-button').onclick = openCustomNavigation;
byId('add-site-button').onclick = openCustomNavigation;
byId('close-dialog').onclick = () => navigationDialog.close();
byId('cancel-custom').onclick = () => {
  resetCustomForm();
  customMessage('');
};
navigationDialog.addEventListener('click', event => {
  if (event.target !== navigationDialog) return;
  const bounds = navigationDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) navigationDialog.close();
});
customForm.addEventListener('submit', event => {
  event.preventDefault();
  const name = byId('custom-name').value.trim();
  const groupName = byId('custom-category').value.trim();
  let url = byId('custom-url').value.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
  if (!name || !groupName || !validWebURL(url)) {
    customMessage('请填写名称、分类和有效的 HTTP(S) 网站地址。', true);
    return;
  }
  url = new URL(url).href;
  const editingID = byId('custom-id').value;
  if (customSites.some(site => site.id !== editingID && site.url === url && site.category === groupName)) {
    customMessage('这个分类中已经添加过该网址。', true);
    return;
  }
  const site = {
    id: editingID || 'custom-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)),
    name,
    category: groupName,
    url,
    description: byId('custom-description').value.trim()
  };
  const next = editingID ? customSites.map(item => item.id === editingID ? site : item) : [...customSites, site];
  if (!commitCustomSites(next)) return;
  resetCustomForm();
  customMessage(editingID ? '修改已保存，首页已更新。' : '网址已保存，已添加到首页对应分类。');
});
byId('export-custom').onclick = () => {
  const blob = new Blob([JSON.stringify(customSites, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = element('a');
  anchor.href = url;
  anchor.download = '序页-自定义导航.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
render();
