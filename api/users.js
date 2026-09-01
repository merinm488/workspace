/**
 * ================================================
 * GRIDS - Unified User API (workspace version)
 * ================================================
 *
 * Port of the original Grids app's api/users.js with the same two changes as
 * api/notes.js: shared storage (local files in dev, textdb.dev in prod) and
 * section-merged saves so spreadsheet writes never wipe notes.
 *
 * Request/response shapes are identical to the original, so the existing
 * Grids frontend (js/storage.js, js/auth.js) works unchanged.
 */

import {
  generateHash,
  generateId,
  getUserDoc,
  saveOwnedSections,
  createUserDoc,
  deleteUserDoc,
  putSharedDoc,
  getSharedDoc,
  deleteSharedDoc,
  getBaseUrl,
  applyCorsHeaders
} from './_lib/store.js';

/** Persist only the sections Grids owns (spreadsheets) + settings changes. */
async function saveGridsSections(hash, userData) {
  return saveOwnedSections(hash, {
    spreadsheets: userData.spreadsheets,
    settings: userData.settings
  });
}

// ================================================
// API Handler
// ================================================

export default async function handler(req, res) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // ============================================================
    // GET - Retrieve user data or shared spreadsheet
    // ============================================================
    if (req.method === 'GET') {
      const { hash, shared } = req.query;

      if (shared) {
        console.log(`[API] GET fetching shared spreadsheet: ${shared}`);
        const doc = await getSharedDoc(shared);

        if (!doc || !doc.spreadsheet) {
          return res.status(404).json({
            success: false,
            error: 'Shared spreadsheet not found'
          });
        }

        return res.status(200).json({
          success: true,
          spreadsheet: doc.spreadsheet,
          sharedAt: doc.sharedAt
        });
      }

      if (!hash) {
        return res.status(400).json({
          success: false,
          error: 'Hash parameter is required'
        });
      }

      const userData = await getUserDoc(hash);
      if (!userData) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      return res.status(200).json({ success: true, data: userData });
    }

    // ============================================================
    // POST - Login or Create Account
    // ============================================================
    if (req.method === 'POST') {
      const { key, action } = req.body;

      if (!key || typeof key !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid key format'
        });
      }

      const normalizedKey = key.trim();
      if (normalizedKey === '') {
        return res.status(400).json({
          success: false,
          error: 'Key cannot be empty'
        });
      }

      const hash = generateHash(normalizedKey);

      if (action === 'login') {
        const userData = await getUserDoc(hash);
        if (!userData) {
          return res.status(404).json({
            success: false,
            error: 'User not found'
          });
        }
        return res.status(200).json({
          success: true,
          hash,
          data: userData,
          message: 'Login successful'
        });
      }

      if (action === 'create') {
        const result = await createUserDoc(hash, { theme: 'light' });
        if (!result.ok) {
          if (result.code === 'USER_EXISTS') {
            return res.status(409).json({
              success: false,
              error: 'User already exists'
            });
          }
          return res.status(500).json({
            success: false,
            error: 'Failed to create account'
          });
        }
        return res.status(201).json({
          success: true,
          hash,
          data: result.doc,
          message: 'Account created successfully'
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "login" or "create"'
      });
    }

    // ============================================================
    // PUT - Update user data
    // ============================================================
    if (req.method === 'PUT') {
      const { hash, action, data } = req.body;

      if (!hash) {
        return res.status(400).json({
          success: false,
          error: 'Hash is required'
        });
      }

      const userData = await getUserDoc(hash);
      if (!userData) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // UPDATE SPREADSHEET DATA
      if (action === 'updateSpreadsheet') {
        const { spreadsheetId, spreadsheetData } = data;

        if (!userData.spreadsheets) {
          userData.spreadsheets = [];
        }

        const existingIndex = userData.spreadsheets.findIndex(
          s => s.id === spreadsheetId
        );

        if (existingIndex >= 0) {
          userData.spreadsheets[existingIndex] = {
            ...userData.spreadsheets[existingIndex],
            ...spreadsheetData,
            id: spreadsheetId,
            updatedAt: new Date().toISOString()
          };
        } else {
          userData.spreadsheets.push({
            id: spreadsheetId,
            ...spreadsheetData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        const saved = await saveGridsSections(hash, userData);
        if (saved) {
          return res.status(200).json({ success: true, data: userData });
        }
        return res.status(500).json({
          success: false,
          error: 'Failed to update spreadsheet'
        });
      }

      // DELETE SPREADSHEET
      if (action === 'deleteSpreadsheet') {
        const { spreadsheetId } = data;

        const spreadsheetToDelete = userData.spreadsheets.find(
          s => s.id === spreadsheetId
        );

        if (spreadsheetToDelete?.sharedId) {
          try {
            await deleteSharedDoc(spreadsheetToDelete.sharedId);
          } catch (e) {
            console.error('[API] Failed to delete shared copy:', e);
          }
        }

        userData.spreadsheets = userData.spreadsheets.filter(
          s => s.id !== spreadsheetId
        );

        const saved = await saveGridsSections(hash, userData);
        if (saved) {
          return res.status(200).json({ success: true, data: userData });
        }
        return res.status(500).json({
          success: false,
          error: 'Failed to delete spreadsheet'
        });
      }

      // UPDATE SETTINGS
      if (action === 'updateSettings') {
        userData.settings = {
          ...userData.settings,
          ...data.settings,
          updatedAt: new Date().toISOString()
        };

        const saved = await saveGridsSections(hash, userData);
        if (saved) {
          return res.status(200).json({ success: true, data: userData });
        }
        return res.status(500).json({
          success: false,
          error: 'Failed to update settings'
        });
      }

      // SHARE SPREADSHEET
      if (action === 'shareSpreadsheet') {
        const { spreadsheetId } = data;

        const spreadsheetIndex = userData.spreadsheets.findIndex(
          s => s.id === spreadsheetId
        );

        if (spreadsheetIndex === -1) {
          return res.status(404).json({
            success: false,
            error: 'Spreadsheet not found'
          });
        }

        const baseUrl = getBaseUrl(req);

        if (userData.spreadsheets[spreadsheetIndex].sharedId) {
          const existingShareId = userData.spreadsheets[spreadsheetIndex].sharedId;
          return res.status(200).json({
            success: true,
            shareId: existingShareId,
            shareUrl: `${baseUrl}/grids/shared.html?shared=${existingShareId}`,
            alreadyShared: true
          });
        }

        const newShareId = generateId();
        const shareData = {
          spreadsheet: userData.spreadsheets[spreadsheetIndex],
          sharedAt: new Date().toISOString()
        };

        const stored = await putSharedDoc(newShareId, shareData);
        if (!stored) {
          return res.status(500).json({
            success: false,
            error: 'Failed to create share'
          });
        }

        userData.spreadsheets[spreadsheetIndex].sharedId = newShareId;
        const saved = await saveGridsSections(hash, userData);

        if (!saved) {
          return res.status(500).json({
            success: false,
            error: 'Failed to update spreadsheet'
          });
        }

        return res.status(200).json({
          success: true,
          shareId: newShareId,
          shareUrl: `${baseUrl}/grids/shared.html?shared=${newShareId}`,
          alreadyShared: false
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    }

    // ============================================================
    // DELETE - Delete user account
    // ============================================================
    if (req.method === 'DELETE') {
      const { hash } = req.query;

      if (!hash) {
        return res.status(400).json({
          success: false,
          error: 'Hash is required'
        });
      }

      const userData = await getUserDoc(hash);
      if (!userData) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const deleted = await deleteUserDoc(hash);
      if (deleted) {
        return res.status(200).json({
          success: true,
          message: 'Account deleted successfully'
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to delete account'
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
