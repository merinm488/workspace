/**
 * ================================================
 * DOX (Notes) - API (workspace version)
 * ================================================
 *
 * Port of the original Notes app's api/notes.js with two changes:
 *  1. Storage goes through the shared store module so the SAME document works
 *     with local JSON files in development and textdb.dev in production.
 *  2. Saves are section-merged (saveOwnedSections), so writing notes/tags can
 *     never wipe the user's spreadsheets or workspace settings.
 *
 * Request/response shapes are identical to the original, so the existing Dox
 * frontend (src/lib/db.js) works unchanged.
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

/**
 * Persist only the sections this app owns (notes, tags) plus the settings it
 * changed, merging over the rest of the document.
 */
async function saveDoxSections(hash, userData) {
  return saveOwnedSections(hash, {
    notes: userData.notes,
    tags: userData.tags,
    settings: userData.settings
  });
}

// ==================== HANDLERS ====================

/**
 * GET /api/notes?hash={hash} | /api/notes?shared={shareId}
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');
    const shared = searchParams.get('shared');

    if (shared) {
      console.log(`[API GET] Fetching shared note: ${shared}`);
      const doc = await getSharedDoc(shared);

      if (!doc || !doc.note) {
        return Response.json({ error: 'Shared note not found' }, { status: 404 });
      }

      return Response.json({
        success: true,
        note: doc.note,
        sharedAt: doc.sharedAt
      });
    }

    if (!hash) {
      return Response.json({ error: 'Hash is required' }, { status: 400 });
    }

    const userData = await getUserDoc(hash);
    if (!userData) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({ success: true, data: userData });
  } catch (error) {
    console.error('[API GET] Error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/notes — login or account creation.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { key, action } = body;

    if (!key) {
      return Response.json({ error: 'Key is required' }, { status: 400 });
    }

    const normalizedKey = key.trim();
    if (normalizedKey.length === 0) {
      return Response.json({ error: 'Key cannot be empty' }, { status: 400 });
    }

    const hash = generateHash(normalizedKey);

    if (action === 'login') {
      const userData = await getUserDoc(hash);
      if (!userData) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }
      return Response.json({ success: true, hash, data: userData });
    }

    const result = await createUserDoc(hash, { theme: 'dark' });
    if (!result.ok) {
      if (result.code === 'USER_EXISTS') {
        return Response.json({ error: 'User already exists', code: 'USER_EXISTS' }, { status: 409 });
      }
      return Response.json({ error: 'Failed to create account' }, { status: 500 });
    }

    return Response.json({
      success: true,
      hash,
      message: 'Account created successfully',
      data: result.doc
    });
  } catch (error) {
    console.error('[API POST] Error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * PUT /api/notes — note/tag mutations (same actions as the original).
 */
export async function PUT(request) {
  try {
    const baseUrl = getBaseUrl(request);
    const body = await request.json();
    const { hash, action, data } = body;

    if (!hash || !action) {
      return Response.json({ error: 'Hash and action are required' }, { status: 400 });
    }

    const userData = await getUserDoc(hash);
    if (!userData) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    switch (action) {
      case 'createNote': {
        const newNote = {
          id: generateId(),
          title: data.title || 'Untitled',
          content: data.content || '',
          contentType: data.contentType || 'plain-text',
          tagId: data.tagId || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pinned: false,
          archived: false
        };
        userData.notes.unshift(newNote);
        break;
      }

      case 'updateNote': {
        const noteIndex = userData.notes.findIndex(n => n.id === data.noteId);
        if (noteIndex === -1) {
          return Response.json({ error: 'Note not found' }, { status: 404 });
        }
        userData.notes[noteIndex] = {
          ...userData.notes[noteIndex],
          ...data.updates,
          id: data.noteId,
          createdAt: userData.notes[noteIndex].createdAt,
          updatedAt: new Date().toISOString()
        };

        if (userData.notes[noteIndex].sharedId) {
          try {
            await putSharedDoc(userData.notes[noteIndex].sharedId, {
              note: userData.notes[noteIndex],
              sharedAt: new Date().toISOString()
            });
          } catch (e) {
            console.error('[API PUT] Failed to update shared copy:', e);
          }
        }
        break;
      }

      case 'deleteNote': {
        const noteToDelete = userData.notes.find(n => n.id === data.noteId);
        if (noteToDelete?.sharedId) {
          try {
            await deleteSharedDoc(noteToDelete.sharedId);
          } catch (e) {
            console.error('[API PUT] Failed to delete shared copy:', e);
          }
        }
        userData.notes = userData.notes.filter(n => n.id !== data.noteId);
        break;
      }

      case 'shareNote': {
        const shareNoteIndex = userData.notes.findIndex(n => n.id === data.noteId);
        if (shareNoteIndex === -1) {
          return Response.json({ error: 'Note not found' }, { status: 404 });
        }

        if (userData.notes[shareNoteIndex].sharedId) {
          const existingShareId = userData.notes[shareNoteIndex].sharedId;
          return Response.json({
            success: true,
            shareId: existingShareId,
            shareUrl: `${baseUrl}/dox/?shared=${existingShareId}`,
            alreadyShared: true
          });
        }

        const newShareId = generateId();
        const shareData = {
          note: userData.notes[shareNoteIndex],
          sharedAt: new Date().toISOString()
        };

        try {
          await putSharedDoc(newShareId, shareData);
        } catch (e) {
          console.error('[API PUT] Failed to save shared note:', e);
          return Response.json({ error: 'Failed to create share' }, { status: 500 });
        }

        userData.notes[shareNoteIndex].sharedId = newShareId;
        await saveDoxSections(hash, userData);

        return Response.json({
          success: true,
          shareId: newShareId,
          shareUrl: `${baseUrl}/dox/?shared=${newShareId}`,
          alreadyShared: false
        });
      }

      case 'togglePin': {
        const note = userData.notes.find(n => n.id === data.noteId);
        if (note) {
          note.pinned = !note.pinned;
          note.updatedAt = new Date().toISOString();

          if (note.sharedId) {
            try {
              await putSharedDoc(note.sharedId, {
                note,
                sharedAt: new Date().toISOString()
              });
            } catch (e) {
              console.error('[API PUT] Failed to update shared copy:', e);
            }
          }
        }
        break;
      }

      case 'toggleArchive': {
        const noteToArchive = userData.notes.find(n => n.id === data.noteId);
        if (noteToArchive) {
          noteToArchive.archived = !noteToArchive.archived;
          if (noteToArchive.archived) {
            noteToArchive.pinned = false;
          }
          noteToArchive.updatedAt = new Date().toISOString();

          if (noteToArchive.sharedId) {
            try {
              await putSharedDoc(noteToArchive.sharedId, {
                note: noteToArchive,
                sharedAt: new Date().toISOString()
              });
            } catch (e) {
              console.error('[API PUT] Failed to update shared copy:', e);
            }
          }
        }
        break;
      }

      case 'createTag': {
        const newTag = {
          id: generateId(),
          name: data.name || 'New Tag',
          color: data.color || '#FACC15'
        };
        if (!userData.tags) userData.tags = [];
        userData.tags.push(newTag);
        break;
      }

      case 'updateTag': {
        const tagIndex = (userData.tags || []).findIndex(t => t.id === data.tagId);
        if (tagIndex === -1) {
          return Response.json({ error: 'Tag not found' }, { status: 404 });
        }
        userData.tags[tagIndex] = {
          ...userData.tags[tagIndex],
          ...data.updates,
          id: data.tagId
        };
        break;
      }

      case 'deleteTag': {
        const deleteTagIndex = (userData.tags || []).findIndex(t => t.id === data.tagId);
        if (deleteTagIndex === -1) {
          return Response.json({ error: 'Tag not found' }, { status: 404 });
        }
        userData.notes.forEach(n => {
          if (n.tagId === data.tagId) {
            n.tagId = null;
          }
        });
        userData.tags = userData.tags.filter(t => t.id !== data.tagId);
        break;
      }

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    const saved = await saveDoxSections(hash, userData);
    if (saved) {
      return Response.json({ success: true, data: userData });
    }
    return Response.json({ error: 'Failed to save data' }, { status: 500 });
  } catch (error) {
    console.error('[API PUT] Error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/notes — delete account.
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');

    if (!hash) {
      return Response.json({ error: 'Hash is required' }, { status: 400 });
    }

    const userData = await getUserDoc(hash);
    if (!userData) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    await deleteUserDoc(hash);
    return Response.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('[API DELETE] Error:', error);
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

// applyCorsHeaders is used by the dev server when adapting these handlers.
export { applyCorsHeaders };
