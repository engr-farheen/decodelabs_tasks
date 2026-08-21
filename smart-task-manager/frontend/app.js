'use strict';

/* =========================================================
   STATE
   ========================================================= */

const state = {
  apiBase: localStorage.getItem('stm_api_base') || 'https://smarttaskmanager-djgllckn.b4a.run/api',
  token: localStorage.getItem('stm_token') || '',
  currentUser: null,

  projects: [],
  selectedProjectId: '', // '' = All projects
  tags: [],
  profile: null,

  tasks: [],
  pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 },
  filters: { search: '', status: '', priority: '', tag: '' },
  searchDebounce: null,
  taskRequestSeq: 0, // guards against a slow older request overwriting a newer one

  editingTaskId: null,
  online: false,
};

/* =========================================================
   DOM REFERENCES
   ========================================================= */

const el = {
  authScreen: document.getElementById('authScreen'),
  tabLogin: document.getElementById('tabLogin'),
  tabRegister: document.getElementById('tabRegister'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  loginError: document.getElementById('loginError'),
  registerName: document.getElementById('registerName'),
  registerEmail: document.getElementById('registerEmail'),
  registerPassword: document.getElementById('registerPassword'),
  registerError: document.getElementById('registerError'),
  authSettingsBtn: document.getElementById('authSettingsBtn'),

  settingsPopover: document.getElementById('settingsPopover'),
  apiBaseInput: document.getElementById('apiBaseInput'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),

  appScreen: document.getElementById('appScreen'),
  userGreeting: document.getElementById('userGreeting'),
  sheetDate: document.getElementById('sheetDate'),
  docsLink: document.getElementById('docsLink'),
  statusBtn: document.getElementById('statusBtn'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  profileBtn: document.getElementById('profileBtn'),
  logoutBtn: document.getElementById('logoutBtn'),

  profilePopover: document.getElementById('profilePopover'),
  profileBio: document.getElementById('profileBio'),
  profilePhone: document.getElementById('profilePhone'),
  profileAvatar: document.getElementById('profileAvatar'),
  cancelProfileBtn: document.getElementById('cancelProfileBtn'),
  saveProfileBtn: document.getElementById('saveProfileBtn'),

  statTotal: document.getElementById('statTotal'),
  statPending: document.getElementById('statPending'),
  statCompleted: document.getElementById('statCompleted'),
  statHigh: document.getElementById('statHigh'),

  projectList: document.getElementById('projectList'),
  projectAddForm: document.getElementById('projectAddForm'),
  projectAddInput: document.getElementById('projectAddInput'),

  tagList: document.getElementById('tagList'),
  tagAddForm: document.getElementById('tagAddForm'),
  tagAddInput: document.getElementById('tagAddInput'),

  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  priorityFilter: document.getElementById('priorityFilter'),
  tagFilter: document.getElementById('tagFilter'),
  clearFiltersBtn: document.getElementById('clearFiltersBtn'),

  ledgerBody: document.getElementById('ledgerBody'),
  resultsCount: document.getElementById('resultsCount'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  pageLabel: document.getElementById('pageLabel'),

  fab: document.getElementById('newTaskBtn'),
  drawerBackdrop: document.getElementById('drawerBackdrop'),
  drawer: document.getElementById('taskDrawer'),
  taskForm: document.getElementById('taskForm'),
  drawerEyebrow: document.getElementById('drawerEyebrow'),
  drawerTitle: document.getElementById('drawerTitle'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  cancelDrawerBtn: document.getElementById('cancelDrawerBtn'),
  deleteTaskBtn: document.getElementById('deleteTaskBtn'),
  fieldTitle: document.getElementById('fieldTitle'),
  fieldDesc: document.getElementById('fieldDesc'),
  fieldProject: document.getElementById('fieldProject'),
  fieldTags: document.getElementById('fieldTags'),
  noTagsHint: document.getElementById('noTagsHint'),
  fieldPriority: document.getElementById('fieldPriority'),
  fieldStatus: document.getElementById('fieldStatus'),
  fieldDue: document.getElementById('fieldDue'),

  toastRegion: document.getElementById('toastRegion'),
};

/* =========================================================
   API HELPER
   ========================================================= */

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  let res;
  try {
    res = await fetch(`${state.apiBase}${path}`, { headers, ...options });
  } catch (err) {
    setOnline(false);
    throw new Error('Could not reach the API. Check the connection and endpoint.');
  }

  let body = null;
  const text = await res.text();
  if (text) {
    try { body = JSON.parse(text); } catch (err) { body = null; }
  }

  if (!res.ok) {
    setOnline(true);
    if (res.status === 401 && state.token) {
      handleSessionExpired();
    }
    const message = (body && body.message)
      || (body && body.errors && body.errors[0] && body.errors[0].message)
      || `Request failed (${res.status})`;
    throw new Error(message);
  }

  setOnline(true);
  return body;
}

function setOnline(isOnline) {
  if (state.online === isOnline) return;
  state.online = isOnline;
  if (el.statusDot) {
    el.statusDot.classList.toggle('status-dot--online', isOnline);
    el.statusDot.classList.toggle('status-dot--offline', !isOnline);
  }
  if (el.statusText) el.statusText.textContent = isOnline ? 'Live' : 'Offline';
}

function handleSessionExpired() {
  state.token = '';
  state.currentUser = null;
  localStorage.removeItem('stm_token');
  resetAppState();
  showAuthScreen();
  showToast('Your session expired. Please log in again.', 'error');
}

// Clears every piece of the previous session's in-memory data and its
// rendered DOM, so switching accounts in the same tab never briefly
// flashes the prior user's projects/tasks/tags/stats before fresh data
// arrives.
function resetAppState() {
  state.projects = [];
  state.selectedProjectId = '';
  state.tags = [];
  state.profile = null;
  state.tasks = [];
  state.pagination = { page: 1, limit: 10, totalCount: 0, totalPages: 1 };
  state.filters = { search: '', status: '', priority: '', tag: '' };
  state.editingTaskId = null;

  el.projectList.innerHTML = '';
  el.tagList.innerHTML = '';
  el.ledgerBody.innerHTML = '';
  el.tagFilter.innerHTML = '<option value="">All tags</option>';
  el.statTotal.textContent = '—';
  el.statPending.textContent = '—';
  el.statCompleted.textContent = '—';
  el.statHigh.textContent = '—';
  el.searchInput.value = '';
  el.statusFilter.value = '';
  el.priorityFilter.value = '';
  el.resultsCount.textContent = '—';
  el.pageLabel.textContent = 'Page 1 of 1';
}

/* =========================================================
   TOASTS
   ========================================================= */

function showToast(message, kind = 'default') {
  const toast = document.createElement('div');
  toast.className = `toast${kind === 'error' ? ' toast--error' : ''}${kind === 'success' ? ' toast--success' : ''}`;
  toast.textContent = message;
  el.toastRegion.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

/* =========================================================
   SCREEN SWITCHING
   ========================================================= */

function showAuthScreen() {
  el.appScreen.hidden = true;
  el.fab.hidden = true;
  el.authScreen.hidden = false;
}

function showAppScreen() {
  el.authScreen.hidden = true;
  el.appScreen.hidden = false;
  el.fab.hidden = false;
}

/* =========================================================
   AUTH TABS
   ========================================================= */

el.tabLogin.addEventListener('click', () => {
  el.tabLogin.classList.add('is-active');
  el.tabRegister.classList.remove('is-active');
  el.loginForm.hidden = false;
  el.registerForm.hidden = true;
});
el.tabRegister.addEventListener('click', () => {
  el.tabRegister.classList.add('is-active');
  el.tabLogin.classList.remove('is-active');
  el.registerForm.hidden = false;
  el.loginForm.hidden = true;
});

/* =========================================================
   AUTH: LOGIN / REGISTER / LOGOUT
   ========================================================= */

el.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.loginError.hidden = true;
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: el.loginEmail.value.trim(),
        password: el.loginPassword.value,
      }),
    });
    onAuthenticated(data.token, data.user);
  } catch (err) {
    el.loginError.textContent = err.message;
    el.loginError.hidden = false;
  }
});

el.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.registerError.hidden = true;
  try {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: el.registerName.value.trim(),
        email: el.registerEmail.value.trim(),
        password: el.registerPassword.value,
      }),
    });
    onAuthenticated(data.token, data.user);
  } catch (err) {
    el.registerError.textContent = err.message;
    el.registerError.hidden = false;
  }
});

function onAuthenticated(token, user) {
  state.token = token;
  state.currentUser = user;
  localStorage.setItem('stm_token', token);
  el.userGreeting.textContent = `Signed in as ${user.name}`;
  showAppScreen();
  el.loginForm.reset();
  el.registerForm.reset();
  bootAppData();
}

el.logoutBtn.addEventListener('click', () => {
  state.token = '';
  state.currentUser = null;
  localStorage.removeItem('stm_token');
  resetAppState();
  showAuthScreen();
});

/* =========================================================
   SETTINGS (API base URL)
   ========================================================= */

function openSettings() {
  el.profilePopover.hidden = true;
  el.apiBaseInput.value = state.apiBase;
  el.settingsPopover.hidden = false;
  el.apiBaseInput.focus();
}
el.authSettingsBtn.addEventListener('click', openSettings);
el.statusBtn.addEventListener('click', openSettings);
el.cancelSettingsBtn.addEventListener('click', () => { el.settingsPopover.hidden = true; });
el.saveSettingsBtn.addEventListener('click', () => {
  const value = el.apiBaseInput.value.trim();
  if (!value) return;
  state.apiBase = value.replace(/\/$/, '');
  localStorage.setItem('stm_api_base', state.apiBase);
  el.settingsPopover.hidden = true;
  updateDocsLink();
  showToast('Endpoint updated.');
  if (state.token) bootAppData();
});
document.addEventListener('click', (event) => {
  if (!el.settingsPopover.hidden
    && !el.settingsPopover.contains(event.target)
    && event.target !== el.authSettingsBtn
    && event.target !== el.statusBtn) {
    el.settingsPopover.hidden = true;
  }
});

function updateDocsLink() {
  const base = state.apiBase.replace(/\/api\/?$/, '');
  el.docsLink.href = `${base}/api-docs`;
}

/* =========================================================
   PROFILE (1:1 User <-> UserProfile)
   ========================================================= */

async function loadProfile() {
  try {
    const profile = await apiFetch('/profile');
    state.profile = profile;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

el.profileBtn.addEventListener('click', () => {
  el.settingsPopover.hidden = true;
  el.profileBio.value = state.profile ? state.profile.bio || '' : '';
  el.profilePhone.value = state.profile ? state.profile.phone || '' : '';
  el.profileAvatar.value = state.profile ? state.profile.avatarUrl || '' : '';
  el.profilePopover.hidden = false;
});
el.cancelProfileBtn.addEventListener('click', () => { el.profilePopover.hidden = true; });
el.saveProfileBtn.addEventListener('click', async () => {
  try {
    const updated = await apiFetch('/profile', {
      method: 'PUT',
      body: JSON.stringify({
        bio: el.profileBio.value.trim(),
        phone: el.profilePhone.value.trim(),
        avatarUrl: el.profileAvatar.value.trim(),
      }),
    });
    state.profile = updated;
    el.profilePopover.hidden = true;
    showToast('Profile saved.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});
document.addEventListener('click', (event) => {
  if (!el.profilePopover.hidden
    && !el.profilePopover.contains(event.target)
    && event.target !== el.profileBtn) {
    el.profilePopover.hidden = true;
  }
});

/* =========================================================
   BOOT APP DATA (after login / on reconnect)
   ========================================================= */

async function bootAppData() {
  renderSheetDate();
  updateDocsLink();
  await Promise.all([loadProjects(), loadTags(), loadDashboard(), loadProfile()]);
  await loadTasks(1);
}

/* =========================================================
   RENDER: SHEET DATE
   ========================================================= */

function renderSheetDate() {
  const today = new Date();
  const formatted = today.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  el.sheetDate.textContent = `No. 01 — ${formatted}`;
}

/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {
  try {
    const summary = await apiFetch('/tasks/dashboard/summary');
    el.statTotal.textContent = summary.total;
    el.statPending.textContent = summary.pending;
    el.statCompleted.textContent = summary.completed;
    el.statHigh.textContent = summary.highPriorityOpen;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* =========================================================
   PROJECTS
   ========================================================= */

async function loadProjects() {
  try {
    const projects = await apiFetch('/projects');
    state.projects = projects || [];
    renderProjects();
    renderTaskFormProjectOptions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderProjects() {
  el.projectList.innerHTML = '';

  const totalTaskCount = state.projects.reduce((sum, p) => sum + (p.taskCount || 0), 0);

  const allItem = buildProjectRow({ _id: '', name: 'All projects', taskCount: totalTaskCount }, true);
  el.projectList.appendChild(allItem);

  state.projects.forEach((project) => {
    el.projectList.appendChild(buildProjectRow(project, false));
  });
}

function buildProjectRow(project, isAll) {
  const li = document.createElement('li');
  li.className = 'layer-row';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `layer-item${state.selectedProjectId === project._id ? ' is-active' : ''}`;

  const name = document.createElement('span');
  name.className = 'layer-item__name';
  name.textContent = project.name;

  const count = document.createElement('span');
  count.className = 'layer-item__count';
  count.textContent = project.taskCount ?? 0;

  btn.append(name, count);
  btn.addEventListener('click', () => {
    state.selectedProjectId = project._id;
    renderProjects();
    loadTasks(1);
  });

  li.appendChild(btn);

  if (!isAll) {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'layer-item__del';
    del.setAttribute('aria-label', `Delete project ${project.name}`);
    del.textContent = '×';
    del.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteProject(project._id, project.name);
    });
    li.appendChild(del);
  }

  return li;
}

el.projectAddForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = el.projectAddInput.value.trim();
  if (!name) return;
  try {
    await apiFetch('/projects', { method: 'POST', body: JSON.stringify({ name }) });
    el.projectAddInput.value = '';
    await loadProjects();
    showToast('Project created.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function deleteProject(id, name) {
  if (!window.confirm(`Delete project "${name}" and all of its tasks? This cannot be undone.`)) return;
  try {
    await apiFetch(`/projects/${id}`, { method: 'DELETE' });
    if (state.selectedProjectId === id) state.selectedProjectId = '';
    await loadProjects();
    await loadDashboard();
    await loadTasks(1);
    showToast('Project deleted.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTaskFormProjectOptions() {
  el.fieldProject.innerHTML = '';
  if (state.projects.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Create a project first';
    el.fieldProject.appendChild(opt);
    el.fab.disabled = true;
    el.fab.title = 'Create a project before adding tasks';
    return;
  }
  el.fab.disabled = false;
  el.fab.title = '';
  state.projects.forEach((project) => {
    const opt = document.createElement('option');
    opt.value = project._id;
    opt.textContent = project.name;
    el.fieldProject.appendChild(opt);
  });
}

/* =========================================================
   TAGS (Many-to-Many with Task)
   ========================================================= */

async function loadTags() {
  try {
    const tags = await apiFetch('/tags');
    state.tags = tags || [];
    renderTagsRail();
    renderTagFilterOptions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTagsRail() {
  el.tagList.innerHTML = '';

  if (state.tags.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.style.padding = '4px 8px';
    empty.textContent = 'No tags yet.';
    el.tagList.appendChild(empty);
    return;
  }

  state.tags.forEach((tag) => {
    const li = document.createElement('li');
    li.className = 'layer-row';

    const name = document.createElement('span');
    name.className = 'layer-item';
    name.style.cursor = 'default';
    name.textContent = tag.name;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'layer-item__del';
    del.setAttribute('aria-label', `Delete tag ${tag.name}`);
    del.textContent = '×';
    del.addEventListener('click', () => deleteTag(tag._id, tag.name));

    li.append(name, del);
    el.tagList.appendChild(li);
  });
}

function renderTagFilterOptions() {
  const previousValue = state.filters.tag;
  el.tagFilter.innerHTML = '<option value="">All tags</option>';
  state.tags.forEach((tag) => {
    const opt = document.createElement('option');
    opt.value = tag._id;
    opt.textContent = tag.name;
    el.tagFilter.appendChild(opt);
  });
  const stillExists = state.tags.some((t) => t._id === previousValue);
  state.filters.tag = stillExists ? previousValue : '';
  el.tagFilter.value = state.filters.tag;
}

el.tagAddForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = el.tagAddInput.value.trim();
  if (!name) return;
  try {
    await apiFetch('/tags', { method: 'POST', body: JSON.stringify({ name }) });
    el.tagAddInput.value = '';
    await loadTags();
    showToast('Tag created.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function deleteTag(id, name) {
  if (!window.confirm(`Delete tag "${name}"? It will be removed from every task.`)) return;
  try {
    await apiFetch(`/tags/${id}`, { method: 'DELETE' });
    if (state.filters.tag === id) state.filters.tag = '';
    await loadTags();
    await loadTasks(state.pagination.page);
    showToast('Tag deleted.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTagCheckboxes(selectedIds) {
  el.fieldTags.innerHTML = '';
  if (state.tags.length === 0) {
    const hint = document.createElement('p');
    hint.className = 'muted';
    hint.textContent = 'No tags yet — add one from the Tags rail.';
    el.fieldTags.appendChild(hint);
    return;
  }
  state.tags.forEach((tag) => {
    const label = document.createElement('label');
    label.className = 'checkbox-chip';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = tag._id;
    input.checked = selectedIds.includes(tag._id);

    label.append(input, document.createTextNode(tag.name));
    el.fieldTags.appendChild(label);
  });
}

/* =========================================================
   TASKS: FILTERS + SEARCH + PAGINATION
   ========================================================= */

el.searchInput.addEventListener('input', () => {
  clearTimeout(state.searchDebounce);
  state.searchDebounce = setTimeout(() => {
    state.filters.search = el.searchInput.value.trim();
    loadTasks(1);
  }, 400);
});

el.statusFilter.addEventListener('change', () => {
  state.filters.status = el.statusFilter.value;
  loadTasks(1);
});
el.priorityFilter.addEventListener('change', () => {
  state.filters.priority = el.priorityFilter.value;
  loadTasks(1);
});
el.tagFilter.addEventListener('change', () => {
  state.filters.tag = el.tagFilter.value;
  loadTasks(1);
});
el.clearFiltersBtn.addEventListener('click', () => {
  state.filters = { search: '', status: '', priority: '', tag: '' };
  el.searchInput.value = '';
  el.statusFilter.value = '';
  el.priorityFilter.value = '';
  el.tagFilter.value = '';
  loadTasks(1);
});

el.prevPageBtn.addEventListener('click', () => {
  if (state.pagination.page > 1) loadTasks(state.pagination.page - 1);
});
el.nextPageBtn.addEventListener('click', () => {
  if (state.pagination.page < state.pagination.totalPages) loadTasks(state.pagination.page + 1);
});

async function loadTasks(page) {
  const requestId = ++state.taskRequestSeq; // this call's ticket number
  try {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', state.pagination.limit);
    if (state.filters.search) params.set('search', state.filters.search);
    if (state.filters.status) params.set('status', state.filters.status);
    if (state.filters.priority) params.set('priority', state.filters.priority);
    if (state.filters.tag) params.set('tag', state.filters.tag);
    if (state.selectedProjectId) params.set('project', state.selectedProjectId);

    const data = await apiFetch(`/tasks?${params.toString()}`);

    // If a newer loadTasks() call has started since this one began (e.g.
    // the user kept typing), discard this now-stale response instead of
    // letting it overwrite the more recent one.
    if (requestId !== state.taskRequestSeq) return;

    // If the requested page no longer exists — e.g. the last task on the
    // last page was just deleted — snap back to the real last page
    // instead of rendering an empty, out-of-range page.
    if (data.totalCount > 0 && data.page > data.totalPages) {
      return loadTasks(data.totalPages);
    }

    state.tasks = data.tasks || [];
    state.pagination = {
      page: data.page,
      limit: data.limit,
      totalCount: data.totalCount,
      totalPages: data.totalPages,
    };
    renderLedger();
  } catch (err) {
    if (requestId !== state.taskRequestSeq) return;
    showToast(err.message, 'error');
    state.tasks = [];
    renderLedger();
  }
}

/* =========================================================
   RENDER: LEDGER TABLE
   ========================================================= */

// Parses a "YYYY-MM-DD" (or ISO datetime) string into a LOCAL-time Date
// representing that calendar date, without any UTC-to-local shifting.
// `new Date(isoString)` would instead treat a date-only string as UTC
// midnight, which can display or compare as one day off for anyone in a
// timezone behind UTC — this avoids that entirely.
function parseDateOnly(dateStr) {
  const [year, month, day] = dateStr.substring(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isOverdue(task) {
  if (!task.dueDate || task.status === 'completed') return false;
  const due = parseDateOnly(task.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function renderLedger() {
  el.ledgerBody.innerHTML = '';

  if (state.tasks.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'ledger-empty';
    cell.textContent = state.online
      ? 'No tasks match this sheet. Log a new work order to begin.'
      : 'Offline — connect to the API to load tasks.';
    row.appendChild(cell);
    el.ledgerBody.appendChild(row);
  } else {
    const startIndex = (state.pagination.page - 1) * state.pagination.limit;
    state.tasks.forEach((task, i) => {
      el.ledgerBody.appendChild(buildRow(task, startIndex + i + 1));
    });
  }

  const { page, totalPages, totalCount, limit } = state.pagination;
  const shownFrom = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const shownTo = Math.min(page * limit, totalCount);
  el.resultsCount.textContent = `Showing ${shownFrom}-${shownTo} of ${totalCount}`;
  el.pageLabel.textContent = `Page ${page} of ${totalPages}`;
  el.prevPageBtn.disabled = page <= 1;
  el.nextPageBtn.disabled = page >= totalPages;
}

function buildRow(task, itemNumber) {
  const tr = document.createElement('tr');

  const numTd = document.createElement('td');
  numTd.className = 'col-num';
  numTd.textContent = String(itemNumber).padStart(2, '0');
  tr.appendChild(numTd);

  const titleTd = document.createElement('td');
  const titleEl = document.createElement('span');
  titleEl.className = 'task-title';
  titleEl.textContent = task.title;
  titleTd.appendChild(titleEl);
  if (task.description) {
    const descEl = document.createElement('span');
    descEl.className = 'task-desc';
    descEl.textContent = task.description;
    titleTd.appendChild(descEl);
  }
  if (task.tags && task.tags.length > 0) {
    const tagsWrap = document.createElement('span');
    tagsWrap.className = 'task-tags';
    task.tags.forEach((tag) => {
      const tagName = typeof tag === 'string'
        ? (state.tags.find((t) => t._id === tag) || {}).name
        : tag.name;
      if (!tagName) return;
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.textContent = tagName;
      tagsWrap.appendChild(chip);
    });
    titleTd.appendChild(tagsWrap);
  }
  tr.appendChild(titleTd);

  const projectTd = document.createElement('td');
  projectTd.textContent = task.project && task.project.name ? task.project.name : '—';
  tr.appendChild(projectTd);

  const priorityTd = document.createElement('td');
  const priorityChip = document.createElement('span');
  priorityChip.className = `chip chip--priority-${task.priority}`;
  priorityChip.textContent = task.priority;
  priorityTd.appendChild(priorityChip);
  tr.appendChild(priorityTd);

  const statusTd = document.createElement('td');
  const statusChip = document.createElement('span');
  statusChip.className = `chip chip--status-${task.status}`;
  statusChip.textContent = task.status.replace('-', ' ');
  statusTd.appendChild(statusChip);
  tr.appendChild(statusTd);

  const dueTd = document.createElement('td');
  dueTd.className = 'due-cell';
  if (task.dueDate) {
    const dueDate = parseDateOnly(task.dueDate);
    dueTd.textContent = dueDate.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
    if (isOverdue(task)) {
      dueTd.classList.add('due-cell--overdue');
      dueTd.textContent += ' (overdue)';
    }
  } else {
    dueTd.textContent = '—';
  }
  tr.appendChild(dueTd);

  const actionsTd = document.createElement('td');
  const actionsWrap = document.createElement('div');
  actionsWrap.className = 'row-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => openDrawer(task));

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'row-del';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => deleteTask(task._id, task.title));

  actionsWrap.append(editBtn, delBtn);
  actionsTd.appendChild(actionsWrap);
  tr.appendChild(actionsTd);

  return tr;
}

/* =========================================================
   DRAWER (create / edit task)
   ========================================================= */

function openDrawer(task = null) {
  if (state.projects.length === 0) {
    showToast('Create a project before adding tasks.', 'error');
    return;
  }

  state.editingTaskId = task ? task._id : null;
  el.drawerEyebrow.textContent = task ? 'Work Order — Edit' : 'Work Order — New';
  el.drawerTitle.textContent = task ? 'Edit Task' : 'New Task';
  el.deleteTaskBtn.hidden = !task;

  el.fieldTitle.value = task ? task.title : '';
  el.fieldDesc.value = task && task.description ? task.description : '';
  el.fieldProject.value = task
    ? (task.project && task.project._id ? task.project._id : task.project)
    : (state.selectedProjectId || state.projects[0]._id);
  el.fieldPriority.value = task ? task.priority : 'medium';
  el.fieldStatus.value = task ? task.status : 'todo';
  el.fieldDue.value = task && task.dueDate ? task.dueDate.substring(0, 10) : '';

  const selectedTagIds = task
    ? (task.tags || []).map((t) => (typeof t === 'string' ? t : t._id))
    : [];
  renderTagCheckboxes(selectedTagIds);

  el.drawerBackdrop.hidden = false;
  el.drawer.classList.add('is-open');
  el.drawer.setAttribute('aria-hidden', 'false');
  el.fieldTitle.focus();
}

function closeDrawer() {
  el.drawer.classList.remove('is-open');
  el.drawer.setAttribute('aria-hidden', 'true');
  el.drawerBackdrop.hidden = true;
  state.editingTaskId = null;
  el.taskForm.reset();
}

el.fab.addEventListener('click', () => openDrawer(null));
el.closeDrawerBtn.addEventListener('click', closeDrawer);
el.cancelDrawerBtn.addEventListener('click', closeDrawer);
el.drawerBackdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && el.drawer.classList.contains('is-open')) closeDrawer();
});

el.taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const title = el.fieldTitle.value.trim();
  const project = el.fieldProject.value;
  if (!title) { showToast('Title is required.', 'error'); return; }
  if (!project) { showToast('Select a project.', 'error'); return; }

  const payload = {
    title,
    description: el.fieldDesc.value.trim(),
    project,
    tags: Array.from(el.fieldTags.querySelectorAll('input[type="checkbox"]:checked')).map((i) => i.value),
    priority: el.fieldPriority.value,
    status: el.fieldStatus.value,
    dueDate: el.fieldDue.value || null,
  };

  try {
    if (state.editingTaskId) {
      await apiFetch(`/tasks/${state.editingTaskId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Task updated.', 'success');
    } else {
      await apiFetch('/tasks', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Task created.', 'success');
    }
    closeDrawer();
    await loadProjects();
    await loadDashboard();
    await loadTasks(state.pagination.page);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

el.deleteTaskBtn.addEventListener('click', async () => {
  if (!state.editingTaskId) return;
  const task = state.tasks.find((t) => t._id === state.editingTaskId);
  const id = state.editingTaskId;
  const title = task ? task.title : 'this task';
  closeDrawer();
  await deleteTask(id, title);
});

async function deleteTask(taskId, title) {
  if (!window.confirm(`Delete task "${title}"? This cannot be undone.`)) return;
  try {
    await apiFetch(`/tasks/${taskId}`, { method: 'DELETE' });
    await loadProjects();
    await loadDashboard();
    await loadTasks(state.pagination.page);
    showToast('Task deleted.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* =========================================================
   BOOT
   ========================================================= */

async function boot() {
  updateDocsLink();

  if (!state.token) {
    showAuthScreen();
    return;
  }

  try {
    const me = await apiFetch('/auth/me');
    state.currentUser = me;
    el.userGreeting.textContent = `Signed in as ${me.name}`;
    showAppScreen();
    await bootAppData();
  } catch (err) {
    // apiFetch already clears the token and shows the auth screen on 401
    if (state.token) {
      // network-type failure rather than auth failure — stay logged out safely
      showAuthScreen();
    }
  }
}

boot();
