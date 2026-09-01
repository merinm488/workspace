/**
 * ================================================
 * WORKSPACE - Landing Page Application
 * ================================================
 * Drive-style home for the registered apps (Dox, Grids, ...):
 * - Recent files across all apps (sorted by lastOpened, then updatedAt)
 * - + New dropdowns (header + empty state) with redirect into the app
 * - App filter (All files / per-app) via the filter chooser
 * - Unified search (titles + note content)
 * - Grid / List view toggle (persisted server-side)
 * - Theme via wsThemeManager, settings via the unified account document
 */

// ================================================
// Configuration
// ================================================

const WS_APP = {
    apiEndpoint: '/api/workspace',
    // localStorage mirror of the view mode (server settings win on load)
    viewKey: 'workspace_view_mode'
};

const DOC_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>'
    + '<polyline points="14 2 14 8 20 8"></polyline>'
    + '<line x1="16" y1="13" x2="8" y2="13"></line>'
    + '<line x1="16" y1="17" x2="8" y2="17"></line>'
    + '</svg>';

const GRID_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M3 10h18M3 14h18m-9-4v8m-7-6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z" />'
    + '</svg>';

/**
 * App registry — the single source of truth for every workspace app.
 * Adding an app (Forms, Slides, ...) = one new entry here plus API support.
 */
const WS_APPS = [
    {
        id: 'dox',
        name: 'Dox',
        label: 'Doc',                       // badge text on file cards
        accent: 'doc',                      // suffix for CSS classes (-icon-doc, --doc-accent, ...)
        icon: DOC_ICON,
        route: '/dox/',
        editorParam: 'note',
        create: {
            action: 'createNote',
            payload: { title: 'Untitled' },
            // The API unshifts, so the newest note is first.
            pickNewest: function (data) { return data.notes && data.notes[0]; }
        },
        contentSearch: true                 // search matches file content
    },
    {
        id: 'grids',
        name: 'Grids',
        label: 'Grid',
        accent: 'grid',
        icon: GRID_ICON,
        route: '/grids/editor.html',
        editorParam: 'id',
        create: {
            action: 'createSpreadsheet',
            payload: {},
            // The API pushes, so the newest sheet is last.
            pickNewest: function (data) {
                const list = data.spreadsheets;
                return list && list[list.length - 1];
            }
        },
        contentSearch: false
    }
];

/** Look up a registry entry by app id (falls back to the first app). */
function getApp(appId) {
    return WS_APPS.find(function (app) { return app.id === appId; }) || WS_APPS[0];
}

// ================================================
// State
// ================================================

const state = {
    userHash: null,
    notes: [],
    spreadsheets: [],
    settings: {},
    searchQuery: '',
    filter: 'all',       // 'all' | app id from WS_APPS
    viewMode: 'grid',    // 'grid' | 'list'
    fileToRename: null,
    fileToDelete: null
};

// ================================================
// Helpers
// ================================================

function $(id) {
    return document.getElementById(id);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

/**
 * Relative timestamp like the child apps show ("Just now", "5m ago", ...).
 */
function formatRelativeDate(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    const diff = Date.now() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return minutes + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + 'd ago';
    return date.toLocaleDateString();
}

/**
 * Unified file list: notes and spreadsheets tagged with their app,
 * sorted most-recently-used first (lastOpened wins over updatedAt so
 * re-opening an old file bumps it to the top, like Drive).
 */
function getAllFiles() {
    const lastOpened = (state.settings && state.settings.lastOpened) || {};

    const notes = state.notes
        .filter(function (n) { return !n.archived; })
        .map(function (n) {
            return {
                id: n.id,
                app: 'dox',
                name: n.title || 'Untitled',
                updatedAt: n.updatedAt,
                lastOpened: lastOpened[n.id] || null,
                content: n.content || ''
            };
        });

    const sheets = state.spreadsheets.map(function (s) {
        return {
            id: s.id,
            app: 'grids',
            name: s.name || 'Untitled Spreadsheet',
            updatedAt: s.updatedAt,
            lastOpened: lastOpened[s.id] || null,
            content: ''
        };
    });

    return notes.concat(sheets).sort(function (a, b) {
        const aTime = a.lastOpened || a.updatedAt || '';
        const bTime = b.lastOpened || b.updatedAt || '';
        return bTime.localeCompare(aTime);
    });
}

/**
 * Apply the active filter + search query.
 * Search matches titles always, and note content for docs.
 */
function getVisibleFiles() {
    const q = state.searchQuery.toLowerCase().trim();
    return getAllFiles().filter(function (file) {
        if (state.filter !== 'all' && file.app !== state.filter) return false;
        if (!q) return true;
        if (file.name.toLowerCase().includes(q)) return true;
        return getApp(file.app).contentSearch && file.content.toLowerCase().includes(q);
    });
}

// ================================================
// API
// ================================================

async function api(action, payload) {
    const response = await fetch(WS_APP.apiEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: state.userHash, action: action, data: payload })
    });
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'API request failed');
    }
    return result.data;
}

/**
 * Load the unified account document and refresh local state.
 * Returns false (and clears the session) when the account is gone.
 */
async function loadUserData() {
    const url = WS_APP.apiEndpoint + '?hash=' + encodeURIComponent(state.userHash) + '&_t=' + Date.now();
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        wsAuth.clearSession();
        showLogin();
        return false;
    }
    const result = await response.json();
    if (!result.success) {
        wsAuth.clearSession();
        showLogin();
        return false;
    }
    applyUserData(result.data);
    return true;
}

function applyUserData(data) {
    state.notes = data.notes || [];
    state.spreadsheets = data.spreadsheets || [];
    state.settings = data.settings || {};
    render();
}

// ================================================
// Dropdown placement (mobile sheets)
// ================================================
// On phones (≤480px) the dropdowns are position:fixed sheets pinned to the
// viewport (see workspace.css), so they can never clip at the screen edge.
// JS supplies top/bottom: anchored just below (or above) the trigger, with
// the height capped to the space that's actually visible.

const MOBILE_MQ = window.matchMedia('(max-width: 480px)');

function placeDropdownSheet(dd) {
    const trigger = dd._wsTrigger;
    if (!dd.classList.contains('active') || !trigger || !MOBILE_MQ.matches) {
        dd.style.top = '';
        dd.style.bottom = '';
        dd.style.maxHeight = '';
        return;
    }
    const rect = trigger.getBoundingClientRect();
    const opensUp = dd.classList.contains('ws-dropdown-up');
    const minGap = 12;
    if (opensUp) {
        // Anchor the sheet's bottom just above the trigger, clamped so the
        // sheet stays fully on-screen even if the trigger is scrolled
        // partly out of view.
        const bottom = Math.min(Math.max(minGap, window.innerHeight - rect.top + 8), window.innerHeight - minGap - 140);
        dd.style.top = 'auto';
        dd.style.bottom = bottom + 'px';
        dd.style.maxHeight = Math.max(140, window.innerHeight - bottom - minGap) + 'px';
    } else {
        const top = Math.min(Math.max(minGap, rect.bottom + 8), window.innerHeight - minGap - 140);
        dd.style.top = top + 'px';
        dd.style.bottom = 'auto';
        dd.style.maxHeight = Math.max(140, window.innerHeight - top - minGap) + 'px';
    }
}

function openDropdown(dd, trigger) {
    dd._wsTrigger = trigger;
    dd.classList.add('active');
    placeDropdownSheet(dd);
}

function closeDropdown(dd) {
    dd.classList.remove('active');
    dd._wsTrigger = null;
    dd.style.top = '';
    dd.style.bottom = '';
    dd.style.maxHeight = '';
}

function toggleDropdown(dd, trigger) {
    if (dd.classList.contains('active')) {
        closeDropdown(dd);
        return false;
    }
    openDropdown(dd, trigger);
    return true;
}

window.addEventListener('resize', function () {
    ['newDropdown', 'emptyNewDropdown', 'filterDropdown', 'settingsDropdown'].forEach(function (id) {
        const dd = $(id);
        if (dd && dd.classList.contains('active')) placeDropdownSheet(dd);
    });
});

// Debounced settings save (theme / viewMode flips)
let settingsSaveTimer = null;
function saveSettings(patch) {
    Object.assign(state.settings, patch);
    clearTimeout(settingsSaveTimer);
    settingsSaveTimer = setTimeout(async function () {
        try {
            await api('updateSettings', { settings: patch });
        } catch (error) {
            console.error('[WORKSPACE] Failed to save settings:', error);
        }
    }, 500);
}

// ================================================
// Views: login vs home
// ================================================

function showLogin() {
    $('loginView').classList.remove('hidden');
    $('homeView').classList.add('hidden');
}

function showHome() {
    $('loginView').classList.add('hidden');
    $('homeView').classList.remove('hidden');
}

// ================================================
// Rendering
// ================================================

function render() {
    renderFiles();
    renderViewToggle();
    renderFilterMenu();
}

function renderViewToggle() {
    document.querySelectorAll('.ws-view-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.view === state.viewMode);
    });
}

/**
 * Shared item markup for the app dropdowns ("+ New" menus and the filter
 * chooser): icon chip + app name.
 */
function buildAppMenuItem(app, extraAttrs) {
    return '<button class="ws-dropdown-item" data-app="' + app.id + '"' + (extraAttrs || '') + '>'
        + '<span class="ws-app-icon ws-app-icon-' + app.accent + '">' + app.icon + '</span>'
        + '<div class="ws-dropdown-item-text">'
        + '<span class="ws-dropdown-item-title">' + escapeHtml(app.name) + '</span>'
        + '</div>'
        + '</button>';
}

/**
 * Fill both "+ New" dropdowns (header + empty state) from WS_APPS.
 */
function renderNewMenus() {
    const items = WS_APPS.map(function (app) { return buildAppMenuItem(app); }).join('');
    $('newDropdown').innerHTML = items;
    $('emptyNewDropdown').innerHTML = items;
}

/**
 * Fill the filter chooser dropdown (one entry per app) and sync the
 * chooser button's label/icon/tint with the active filter.
 */
function renderFilterMenu() {
    const checkmark = '<svg class="ws-filter-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
        + '<polyline points="20 6 9 17 4 12"></polyline>'
        + '</svg>';

    $('filterDropdown').innerHTML = WS_APPS.map(function (app) {
        return buildAppMenuItem(app, state.filter === app.id ? ' data-selected="true"' : '');
    }).join('');

    document.querySelectorAll('#filterDropdown .ws-dropdown-item').forEach(function (item) {
        item.insertAdjacentHTML('beforeend', '<span class="ws-filter-check-slot">'
            + (item.dataset.selected ? checkmark : '') + '</span>');
    });

    // Chooser button face: app icon + name when filtered, generic otherwise.
    const btn = $('filterChooserBtn');
    const label = $('filterChooserLabel');
    const iconSlot = $('filterChooserIcon');
    const activeApp = state.filter === 'all' ? null : getApp(state.filter);

    document.querySelectorAll('.ws-filter[data-filter]').forEach(function (pill) {
        pill.classList.toggle('active', pill.dataset.filter === state.filter);
    });

    btn.classList.toggle('app-selected', Boolean(activeApp));
    if (activeApp) {
        btn.style.background = 'var(--' + activeApp.accent + '-accent-soft)';
        btn.style.color = 'var(--' + activeApp.accent + '-accent)';
    } else {
        btn.style.background = '';
        btn.style.color = '';
    }
    iconSlot.innerHTML = activeApp ? activeApp.icon : '';
    iconSlot.classList.toggle('hidden', !activeApp);
    label.textContent = activeApp ? activeApp.name : 'Apps';
}

const RENAME_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />'
    + '</svg>';

const DELETE_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />'
    + '</svg>';

function renderFiles() {
    const files = getVisibleFiles();
    const gridView = $('filesGrid');
    const listView = $('filesList');
    const emptyState = $('emptyState');
    const viewTitle = $('viewTitle');
    const viewCount = $('viewCount');
    const searchHint = $('searchHint');

    gridView.innerHTML = '';
    listView.innerHTML = '';

    // Title + count
    const isSearching = Boolean(state.searchQuery.trim());
    const filterNames = { all: 'Recent files' };
    WS_APPS.forEach(function (app) { filterNames[app.id] = app.name; });
    viewTitle.textContent = isSearching ? 'Search results' : filterNames[state.filter];
    viewCount.textContent = files.length ? String(files.length) : '';
    searchHint.classList.toggle('hidden', !isSearching);

    if (files.length === 0) {
        gridView.classList.add('hidden');
        listView.classList.add('hidden');
        emptyState.classList.remove('hidden');

        const title = emptyState.querySelector('.ws-empty-title');
        const desc = emptyState.querySelector('.ws-empty-description');
        const actions = emptyState.querySelector('.ws-empty-actions');

        if (isSearching) {
            title.textContent = 'No matches found';
            desc.textContent = 'Try a different search term or filter';
            actions.classList.add('hidden');
        } else {
            actions.classList.remove('hidden');
            title.textContent = 'Nothing here yet';
            desc.textContent = 'Create your first file to get started';
        }
        return;
    }

    emptyState.classList.add('hidden');

    if (state.viewMode === 'list') {
        listView.classList.remove('hidden');
        files.forEach(function (file) { listView.appendChild(buildListRow(file)); });
    } else {
        gridView.classList.remove('hidden');
        files.forEach(function (file) { gridView.appendChild(buildCard(file)); });
    }
}

function buildCard(file) {
    const card = document.createElement('div');
    card.className = 'ws-file-card';
    card.dataset.id = file.id;
    card.dataset.app = file.app;

    const app = getApp(file.app);
    const when = file.lastOpened || file.updatedAt;

    card.innerHTML = '<div class="ws-file-card-top">'
        + '<div class="ws-file-icon ws-file-icon-' + app.accent + '">' + app.icon + '</div>'
        + '<div class="ws-file-actions">'
        + '<button class="ws-file-action-btn rename" title="Rename">' + RENAME_ICON + '</button>'
        + '<button class="ws-file-action-btn danger delete" title="Delete">' + DELETE_ICON + '</button>'
        + '</div>'
        + '</div>'
        + '<div class="ws-file-title">' + escapeHtml(file.name) + '</div>'
        + '<div class="ws-file-meta">'
        + '<span class="ws-file-app-badge ' + app.accent + '">' + app.label + '</span>'
        + '<span>' + formatRelativeDate(when) + '</span>'
        + '</div>';

    card.addEventListener('click', function (e) {
        if (!e.target.closest('.ws-file-action-btn')) openFile(file);
    });
    card.querySelector('.rename').addEventListener('click', function (e) {
        e.stopPropagation();
        showRenameModal(file);
    });
    card.querySelector('.delete').addEventListener('click', function (e) {
        e.stopPropagation();
        showDeleteModal(file);
    });

    return card;
}

function buildListRow(file) {
    const row = document.createElement('div');
    row.className = 'ws-file-row';
    row.dataset.id = file.id;
    row.dataset.app = file.app;

    const app = getApp(file.app);
    const when = file.lastOpened || file.updatedAt;

    row.innerHTML = '<div class="ws-file-icon ws-file-icon-' + app.accent + '">' + app.icon + '</div>'
        + '<div class="ws-file-row-main">'
        + '<div class="ws-file-row-title">' + escapeHtml(file.name) + '</div>'
        + '</div>'
        + '<span class="ws-file-app-badge ' + app.accent + '">' + app.label + '</span>'
        + '<div class="ws-file-row-meta">' + formatRelativeDate(when) + '</div>'
        + '<div class="ws-file-actions">'
        + '<button class="ws-file-action-btn rename" title="Rename">' + RENAME_ICON + '</button>'
        + '<button class="ws-file-action-btn danger delete" title="Delete">' + DELETE_ICON + '</button>'
        + '</div>';

    row.addEventListener('click', function (e) {
        if (!e.target.closest('.ws-file-action-btn')) openFile(file);
    });
    row.querySelector('.rename').addEventListener('click', function (e) {
        e.stopPropagation();
        showRenameModal(file);
    });
    row.querySelector('.delete').addEventListener('click', function (e) {
        e.stopPropagation();
        showDeleteModal(file);
    });

    return row;
}

// ================================================
// File operations
// ================================================

/**
 * Open an app URL in a new tab so the workspace stays available. Falls
 * back to navigating this tab when the browser blocks the popup (this
 * can happen after an async wait), matching the old behavior.
 */
function openInNewTab(url) {
    const tab = window.open(url, '_blank');
    if (tab) {
        tab.opener = null;  // don't expose the workspace window to the app tab
        return true;
    }
    window.location.href = url;
    return false;
}

/**
 * Open a file in its app (new tab) and record lastOpened fire-and-forget —
 * the workspace tab stays open and refreshes on visibilitychange, so the
 * recents ordering picks it up then.
 */
function openFile(file) {
    const app = getApp(file.app);
    openInNewTab(app.route + '?' + app.editorParam + '=' + encodeURIComponent(file.id));
    api('recordOpen', { fileId: file.id, app: file.app })
        .catch(function (err) { console.error('[WORKSPACE] recordOpen failed:', err); });
}

/**
 * Create a new file server-side, then open it in the app's editor (new tab).
 * Newly created files get &edit=1 so Dox skips the preview and opens the
 * editor directly — a fresh file is opened to be written in.
 */
async function createFile(appId) {
    const app = getApp(appId);
    showLoading('Creating ' + app.label.toLowerCase() + '...');
    try {
        const data = await api(app.create.action, app.create.payload);
        const file = app.create.pickNewest(data);
        if (!file) throw new Error('File creation failed');
        openInNewTab(app.route + '?' + app.editorParam + '=' + encodeURIComponent(file.id) + '&edit=1');
        hideLoading();
        loadUserData();  // show the new file in the list right away
    } catch (error) {
        console.error('[WORKSPACE] Create failed:', error);
        hideLoading();
        showNotification(error.message || 'Failed to create file', 'error');
    }
}

// ================================================
// Modals
// ================================================

function showRenameModal(file) {
    state.fileToRename = file;
    $('renameInput').value = file.name;
    $('renameModal').classList.add('active');
    setTimeout(function () {
        $('renameInput').focus();
        $('renameInput').select();
    }, 100);
}

function hideRenameModal() {
    state.fileToRename = null;
    $('renameModal').classList.remove('active');
}

async function confirmRename() {
    if (!state.fileToRename) return;
    const name = $('renameInput').value.trim();
    if (!name) {
        showNotification('Name cannot be empty', 'error');
        return;
    }

    const file = state.fileToRename;
    const originalName = file.name;

    // Optimistic update
    file.name = name;
    render();
    hideRenameModal();

    try {
        await api('renameFile', { fileId: file.id, app: file.app, name: name });
        await loadUserData();
        showNotification('Renamed successfully', 'success');
    } catch (error) {
        file.name = originalName;
        render();
        showNotification(error.message || 'Failed to rename', 'error');
    }
}

function showDeleteModal(file) {
    state.fileToDelete = file;
    $('deleteFileName').textContent = file.name;
    $('deleteModal').classList.add('active');
}

function hideDeleteModal() {
    state.fileToDelete = null;
    $('deleteModal').classList.remove('active');
}

async function confirmDelete() {
    if (!state.fileToDelete) return;
    const file = state.fileToDelete;

    // Optimistic removal
    if (file.app === 'grids') {
        state.spreadsheets = state.spreadsheets.filter(function (s) { return s.id !== file.id; });
    } else {
        state.notes = state.notes.filter(function (n) { return n.id !== file.id; });
    }
    render();
    hideDeleteModal();

    try {
        await api('deleteFile', { fileId: file.id, app: file.app });
        showNotification('Deleted successfully', 'success');
    } catch (error) {
        showNotification(error.message || 'Failed to delete', 'error');
        await loadUserData();
    }
}

// ================================================
// Key / account modals
// ================================================

function showKeyModal() {
    $('keyText').textContent = wsAuth.getUserKey() || 'Not available';
    $('keyModal').classList.add('active');
    closeDropdown($('settingsDropdown'));
}

function hideKeyModal() {
    $('keyModal').classList.remove('active');
}

function showDeleteAccountModal() {
    $('deleteAccountModal').classList.add('active');
    closeDropdown($('settingsDropdown'));
}

function hideDeleteAccountModal() {
    $('deleteAccountModal').classList.remove('active');
}

async function confirmDeleteAccount() {
    try {
        const result = await wsAuth.deleteAccount();
        if (result.success) {
            hideDeleteAccountModal();
            showLogin();
            showNotification('Account deleted', 'success');
        } else {
            showNotification(result.error || 'Failed to delete account', 'error');
        }
    } catch (error) {
        showNotification('Failed to delete account', 'error');
    }
}

// ================================================
// Loading / notifications
// ================================================

function showLoading(text) {
    $('loadingText').textContent = text || 'Loading...';
    $('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    $('loadingOverlay').classList.add('hidden');
}

function showNotification(message, type) {
    const el = $('notification');
    el.textContent = message;
    el.className = 'ws-notification ' + (type || 'info');
    // Force reflow so consecutive notifications re-trigger the transition
    void el.offsetWidth;
    el.classList.remove('hidden');
    setTimeout(function () {
        el.classList.add('hidden');
    }, 3000);
}

// ================================================
// Event listeners
// ================================================

function setupEventListeners() {
    // ----- Login form -----
    $('loginForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const key = $('keyInput').value;
        const errorEl = $('loginError');
        const submitBtn = $('loginSubmit');

        errorEl.classList.add('hidden');

        if (!key.trim()) {
            errorEl.textContent = 'Key cannot be empty';
            errorEl.classList.remove('hidden');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.querySelector('.ws-btn-text').textContent = 'Entering...';
        submitBtn.querySelector('.ws-btn-spinner').classList.remove('hidden');

        const result = await wsAuth.authenticate(key);

        submitBtn.disabled = false;
        submitBtn.querySelector('.ws-btn-text').textContent = 'Sign in';
        submitBtn.querySelector('.ws-btn-spinner').classList.add('hidden');

        if (result.success) {
            state.userHash = wsAuth.getUserHash();
            applyUserData(result.data);
            showHome();
            wsThemeManager.applyFromServer(state.settings.theme);
            if (state.settings.viewMode) {
                state.viewMode = state.settings.viewMode;
                renderViewToggle();
            }
            $('keyInput').value = '';
            showNotification(result.isNewUser ? 'Account created — welcome!' : 'Welcome back!', 'success');
        } else {
            errorEl.textContent = result.error || 'Login failed';
            errorEl.classList.remove('hidden');
        }
    });

    // ----- Search -----
    const searchInput = $('searchInput');
    searchInput.addEventListener('input', function (e) {
        state.searchQuery = e.target.value;
        $('clearSearch').classList.toggle('hidden', !state.searchQuery);
        renderFiles();
    });

    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            searchInput.value = '';
            state.searchQuery = '';
            $('clearSearch').classList.add('hidden');
            renderFiles();
            searchInput.blur();
        }
    });

    $('clearSearch').addEventListener('click', function () {
        searchInput.value = '';
        state.searchQuery = '';
        $('clearSearch').classList.add('hidden');
        renderFiles();
    });

    // ----- + New dropdowns (header + empty state) -----
    $('newBtn').addEventListener('click', function (e) {
        e.stopPropagation();
        toggleDropdown($('newDropdown'), $('newBtn'));
        $('newBtn').closest('.ws-new-container').classList.toggle('active');
    });

    $('emptyNewBtn').addEventListener('click', function (e) {
        e.stopPropagation();
        toggleDropdown($('emptyNewDropdown'), $('emptyNewBtn'));
        $('emptyNewBtn').closest('.ws-new-container').classList.toggle('active');
    });

    // App items in both "+ New" menus (delegated — items come from WS_APPS).
    ['newDropdown', 'emptyNewDropdown'].forEach(function (menuId) {
        $(menuId).addEventListener('click', function (e) {
            const item = e.target.closest('.ws-dropdown-item[data-app]');
            if (!item) return;
            e.stopPropagation();
            createFile(item.dataset.app);
        });
    });

    // ----- Filter chooser -----
    document.querySelectorAll('.ws-filter[data-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            state.filter = btn.dataset.filter;
            closeFilterDropdown();
            render();
        });
    });

    $('filterChooserBtn').addEventListener('click', function (e) {
        e.stopPropagation();
        const open = toggleDropdown($('filterDropdown'), this);
        $('filterChooser').classList.toggle('active', open);
        this.setAttribute('aria-expanded', String(open));
    });

    $('filterDropdown').addEventListener('click', function (e) {
        const item = e.target.closest('.ws-dropdown-item[data-app]');
        if (!item) return;
        e.stopPropagation();
        state.filter = item.dataset.app;
        closeFilterDropdown();
        render();
    });

    function closeFilterDropdown() {
        closeDropdown($('filterDropdown'));
        $('filterChooser').classList.remove('active');
        $('filterChooserBtn').setAttribute('aria-expanded', 'false');
    }

    // ----- View toggle -----
    document.querySelectorAll('.ws-view-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            state.viewMode = btn.dataset.view;
            localStorage.setItem(WS_APP.viewKey, state.viewMode);
            saveSettings({ viewMode: state.viewMode });
            render();
        });
    });

    // ----- Settings dropdown -----
    $('settingsBtn').addEventListener('click', function (e) {
        e.stopPropagation();
        toggleDropdown($('settingsDropdown'), $('settingsBtn'));
    });

    $('themeToggleBtn').addEventListener('click', function (e) {
        e.stopPropagation();
        $('themeSubmenu').classList.toggle('active');
        const container = $('themeToggleBtn').closest('.ws-theme-container');
        if (container) container.classList.toggle('active');
    });

    document.querySelectorAll('.ws-theme-option').forEach(function (option) {
        option.addEventListener('click', function (e) {
            e.stopPropagation();
            wsThemeManager.setTheme(option.dataset.theme);
            updateThemeLabel();
            $('themeSubmenu').classList.remove('active');
            const container = $('themeToggleBtn').closest('.ws-theme-container');
            if (container) container.classList.remove('active');
        });
    });

    $('viewKeyBtn').addEventListener('click', showKeyModal);
    $('logoutBtn').addEventListener('click', function () {
        wsAuth.logout();
        state.userHash = null;
        showLogin();
        showNotification('Logged out', 'success');
    });
    $('deleteAccountBtn').addEventListener('click', showDeleteAccountModal);

    // ----- Rename modal -----
    $('renameModalClose').addEventListener('click', hideRenameModal);
    $('cancelRename').addEventListener('click', hideRenameModal);
    $('confirmRename').addEventListener('click', confirmRename);
    $('renameInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') confirmRename();
        if (e.key === 'Escape') hideRenameModal();
    });

    // ----- Delete file modal -----
    $('deleteModalClose').addEventListener('click', hideDeleteModal);
    $('cancelDelete').addEventListener('click', hideDeleteModal);
    $('confirmDelete').addEventListener('click', confirmDelete);

    // ----- Key modal -----
    $('keyModalClose').addEventListener('click', hideKeyModal);
    $('keyModalCloseBtn').addEventListener('click', hideKeyModal);
    $('keyCopyBtn').addEventListener('click', async function () {
        const key = wsAuth.getUserKey();
        if (!key) return;
        try {
            await navigator.clipboard.writeText(key);
            $('keyCopyFeedback').classList.add('visible');
            setTimeout(function () {
                $('keyCopyFeedback').classList.remove('visible');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy key:', err);
        }
    });

    // ----- Delete account modal -----
    $('deleteAccountModalClose').addEventListener('click', hideDeleteAccountModal);
    $('cancelDeleteAccount').addEventListener('click', hideDeleteAccountModal);
    $('confirmDeleteAccount').addEventListener('click', confirmDeleteAccount);

    // ----- Login theme toggle -----
    $('loginThemeToggle').addEventListener('click', function () {
        wsThemeManager.toggleTheme();
    });

    // ----- Global click closes dropdowns & backdrops -----
    document.addEventListener('click', function (e) {
        // Header and empty-state "+ New" each close independently, so a click
        // inside one doesn't hold the other open.
        ['newBtn', 'emptyNewBtn'].forEach(function (btnId) {
            const btn = $(btnId);
            if (e.target.closest('.ws-new-container') === btn.closest('.ws-new-container')) return;
            closeDropdown($(btnId.replace('Btn', 'Dropdown')));
            const container = btn.closest('.ws-new-container');
            if (container) container.classList.remove('active');
        });
        if (!e.target.closest('#filterChooser')) {
            closeDropdown($('filterDropdown'));
            $('filterChooser').classList.remove('active');
            $('filterChooserBtn').setAttribute('aria-expanded', 'false');
        }
        if (!e.target.closest('.ws-settings-container')) {
            closeDropdown($('settingsDropdown'));
            $('themeSubmenu').classList.remove('active');
            const themeContainer = $('themeToggleBtn').closest('.ws-theme-container');
            if (themeContainer) themeContainer.classList.remove('active');
        }
        document.querySelectorAll('.ws-modal.active').forEach(function (modal) {
            if (e.target === modal) {
                modal.classList.remove('active');
                state.fileToRename = null;
                state.fileToDelete = null;
            }
        });
    });

    // ----- Refresh when tab becomes visible again -----
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && state.userHash) {
            loadUserData();
        }
    });
}

function updateThemeLabel() {
    const label = $('themeText');
    const saved = wsThemeManager.getPreference();
    const current = wsThemeManager.getCurrentTheme();
    const display = saved === 'system'
        ? 'System'
        : current.charAt(0).toUpperCase() + current.slice(1);

    if (window.innerWidth <= 640) {
        label.textContent = 'Theme';
    } else {
        label.textContent = 'Theme: ' + display;
    }
}

// ================================================
// Init
// ================================================

async function init() {
    wsThemeManager.init();
    renderNewMenus();
    setupEventListeners();
    updateThemeLabel();

    const session = wsAuth.getSession();
    if (!session) {
        showLogin();
        return;
    }

    state.userHash = session.hash;
    state.viewMode = localStorage.getItem(WS_APP.viewKey) || 'grid';

    const ok = await loadUserData();
    if (!ok) return;

    showHome();
    wsThemeManager.applyFromServer(state.settings.theme);
    if (state.settings.viewMode && state.settings.viewMode !== state.viewMode) {
        state.viewMode = state.settings.viewMode;
    }
    render();
}

// ================================================
// Boot
// ================================================

document.addEventListener('DOMContentLoaded', init);

if (typeof window !== 'undefined') {
    window.workspaceApp = {
        get state() { return state; },
        saveSettings: saveSettings,
        loadUserData: loadUserData,
        themes: wsThemeManager
    };
}
