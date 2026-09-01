/**
 * ================================================
 * WORKSPACE - Unified API
 * ================================================
 *
 * Serves the Workspace landing page. Same authentication strategy as the
 * Dox (Notes) app:
 *
 *   POST { key, action: 'login'  } -> hash + user data, 404 when unknown
 *   POST { key, action: 'create' } -> creates the unified account
 *
 * The hash is sha256(key.trim() + PEPPER_SECRET) — identical to Dox and
 * Grids — so one key resolves to the same account/document in all three apps.
 *
 * Data actions (PUT) operate on the unified document:
 *   { notes, tags, spreadsheets, settings }
 * and only touch their own sections (see api/_lib/store.js).
 */

import {
  IS_DEVELOPMENT,
  generateHash,
  generateId,
  getUserDoc,
  saveOwnedSections,
  createUserDoc,
  deleteUserDoc,
  deleteSharedDoc,
  getBaseUrl,
  applyCorsHeaders
} from './_lib/store.js';

const DEFAULT_SPREADSHEET_NAME = 'Untitled Spreadsheet';
const DEFAULT_NOTE_TITLE = 'Untitled';

/**
 * Build a fresh Univer workbook snapshot (matches what grids/js/home.js
 * creates client-side, so the editor loads it without any migration).
 */
function createDefaultSpreadsheet(id) {
  const sheetId = `sheet-${Date.now().toString(36)}`;
  return {
    id,
    name: DEFAULT_SPREADSHEET_NAME,
    formatVersion: 2,
    data: {
      id: `wb_${id}`,
      name: DEFAULT_SPREADSHEET_NAME,
      appVersion: '0.25.1',
      locale: 'enUS',
      styles: {},
      sheetOrder: [sheetId],
      sheets: {
        [sheetId]: {
          id: sheetId,
          name: 'Sheet1',
          tabColor: '',
          hidden: 0,
          freeze: { xOffset: 0, yOffset: 0, startRow: -1, startColumn: -1, xSplit: 0, ySplit: 0 },
          rowCount: 84,
          columnCount: 60,
          zoomRatio: 1,
          scrollTop: 0,
          scrollLeft: 0,
          defaultColumnWidth: 73,
          defaultRowHeight: 19,
          mergeData: [],
          cellData: {},
          rowData: {},
          columnData: {}
        }
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Merge settings and stamp defaults so clients can rely on the shape.
 */
function withSettingsDefaults(userData) {
  userData.settings = {
    theme: 'dark',
    viewMode: 'grid',
    lastOpened: {},
    ...(userData.settings || {})
  };
  return userData;
}

// ================================================
// Handler
// ================================================

export default async function handler(req, res) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // ============================================================
    // GET - user data (session check / initial load)
    // ============================================================
    if (req.method === 'GET') {
      const { hash } = req.query;

      if (!hash) {
        return res.status(400).json({ success: false, error: 'Hash is required' });
      }

      const userData = await getUserDoc(hash);
      if (!userData) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      return res.status(200).json({ success: true, data: withSettingsDefaults(userData) });
    }

    // ============================================================
    // POST - login / create account
    // ============================================================
    if (req.method === 'POST') {
      const { key, action } = req.body || {};

      if (!key || typeof key !== 'string') {
        return res.status(400).json({ success: false, error: 'Key is required' });
      }

      const normalizedKey = key.trim();
      if (normalizedKey.length === 0) {
        return res.status(400).json({ success: false, error: 'Key cannot be empty' });
      }

      const hash = generateHash(normalizedKey);

      // LOGIN — mirrors Dox: 404 lets the client fall back to auto-create.
      if (action === 'login') {
        const userData = await getUserDoc(hash);
        if (!userData) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.status(200).json({ success: true, hash, data: withSettingsDefaults(userData) });
      }

      // CREATE — fails with 409 when the key already has an account.
      if (action === 'create' || action === undefined) {
        const result = await createUserDoc(hash);
        if (!result.ok) {
          if (result.code === 'USER_EXISTS') {
            return res.status(409).json({ success: false, error: 'User already exists', code: 'USER_EXISTS' });
          }
          return res.status(500).json({ success: false, error: 'Failed to create account' });
        }
        return res.status(201).json({ success: true, hash, data: withSettingsDefaults(result.doc) });
      }

      return res.status(400).json({ success: false, error: 'Invalid action. Use "login" or "create"' });
    }

    // ============================================================
    // PUT - file operations on the unified document
    // ============================================================
    if (req.method === 'PUT') {
      const { hash, action, data } = req.body || {};

      if (!hash || !action) {
        return res.status(400).json({ success: false, error: 'Hash and action are required' });
      }

      const userData = await getUserDoc(hash);
      if (!userData) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      switch (action) {
        // ---- Create a note (same shape Dox creates) ----
        case 'createNote': {
          const now = new Date().toISOString();
          userData.notes.unshift({
            id: generateId(),
            title: data?.title || DEFAULT_NOTE_TITLE,
            content: data?.content || '',
            contentType: data?.contentType || 'plain-text',
            tagId: data?.tagId || null,
            createdAt: now,
            updatedAt: now,
            pinned: false,
            archived: false
          });
          break;
        }

        // ---- Create a spreadsheet (same shape Grids creates) ----
        case 'createSpreadsheet': {
          const id = data?.id || generateId();
          const spreadsheet = createDefaultSpreadsheet(id);
          if (data?.name) spreadsheet.name = data.name;
          userData.spreadsheets.push(spreadsheet);
          break;
        }

        // ---- Record that a file was just opened (recents ordering) ----
        case 'recordOpen': {
          const { fileId, app } = data || {};
          if (!fileId) {
            return res.status(400).json({ success: false, error: 'fileId is required' });
          }
          const target = app === 'grids'
            ? userData.spreadsheets.find(s => s.id === fileId)
            : userData.notes.find(n => n.id === fileId);

          if (!target) {
            return res.status(404).json({ success: false, error: 'File not found' });
          }

          userData.settings = userData.settings || {};
          userData.settings.lastOpened = userData.settings.lastOpened || {};
          userData.settings.lastOpened[fileId] = new Date().toISOString();
          break;
        }

        // ---- Rename a file from the landing page ----
        case 'renameFile': {
          const { fileId, app, name } = data || {};
          if (!fileId || !name || !String(name).trim()) {
            return res.status(400).json({ success: false, error: 'fileId and name are required' });
          }
          // Notes keep their name in `title`, spreadsheets in `name`
          const isGrid = app === 'grids';
          const collection = isGrid ? userData.spreadsheets : userData.notes;
          const target = collection.find(f => f.id === fileId);
          if (!target) {
            return res.status(404).json({ success: false, error: 'File not found' });
          }
          const cleanName = String(name).trim();
          if (isGrid) {
            target.name = cleanName;
            if (target.data) target.data.name = cleanName;
          } else {
            target.title = cleanName;
          }
          target.updatedAt = new Date().toISOString();
          break;
        }

        // ---- Delete a file (and its shared copy, like the apps do) ----
        case 'deleteFile': {
          const { fileId, app } = data || {};
          if (!fileId) {
            return res.status(400).json({ success: false, error: 'fileId is required' });
          }

          if (app === 'grids') {
            const sheet = userData.spreadsheets.find(s => s.id === fileId);
            if (sheet?.sharedId) {
              await deleteSharedDoc(sheet.sharedId);
            }
            userData.spreadsheets = userData.spreadsheets.filter(s => s.id !== fileId);
          } else {
            const note = userData.notes.find(n => n.id === fileId);
            if (note?.sharedId) {
              await deleteSharedDoc(note.sharedId);
            }
            userData.notes = userData.notes.filter(n => n.id !== fileId);
          }

          if (userData.settings?.lastOpened) {
            delete userData.settings.lastOpened[fileId];
          }
          break;
        }

        // ---- Theme / viewMode / misc settings ----
        case 'updateSettings': {
          if (!data?.settings || typeof data.settings !== 'object') {
            return res.status(400).json({ success: false, error: 'settings object is required' });
          }
          userData.settings = { ...(userData.settings || {}), ...data.settings };
          break;
        }

        default:
          return res.status(400).json({ success: false, error: 'Invalid action' });
      }

      const saved = await saveOwnedSections(hash, {
        notes: userData.notes,
        tags: userData.tags,
        spreadsheets: userData.spreadsheets,
        settings: userData.settings
      });

      if (!saved) {
        return res.status(500).json({ success: false, error: 'Failed to save data' });
      }

      return res.status(200).json({ success: true, data: withSettingsDefaults(userData) });
    }

    // ============================================================
    // DELETE - delete account (clears the unified document)
    // ============================================================
    if (req.method === 'DELETE') {
      const { hash } = req.query;

      if (!hash) {
        return res.status(400).json({ success: false, error: 'Hash is required' });
      }

      const userData = await getUserDoc(hash);
      if (!userData) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const deleted = await deleteUserDoc(hash);
      if (!deleted) {
        return res.status(500).json({ success: false, error: 'Failed to delete account' });
      }

      return res.status(200).json({ success: true, message: 'Account deleted' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[WORKSPACE API] Error:', error);
    return res.status(500).json({ success: false, error: 'Server error', message: error.message });
  }
}

// Exposed for the dev server logging only.
export { IS_DEVELOPMENT, getBaseUrl };
