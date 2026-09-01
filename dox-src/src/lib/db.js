/**
 * TextDB Client
 *
 * This module communicates with the TextDB backend via REST API
 * All data is stored as JSON files on the server
 */

const API_BASE = '/api/notes';

// ===== API HELPERS =====

/**
 * Make API request
 */
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// ===== USER OPERATIONS =====

/**
 * Get user data by hash
 * @param {string} hash - The hashed key
 * @returns {Promise<Object|null>} - User data or null if not found
 */
export async function getUserData(hash) {
  try {
    const response = await apiRequest(`?hash=${encodeURIComponent(hash)}`);
    return response.data;
  } catch (error) {
    if (error.message === 'User not found') {
      return null;
    }
    throw error;
  }
}

// ===== NOTE OPERATIONS =====

/**
 * Create a new note
 * @param {string} hash - User's hash
 * @param {Object} noteData - Note content { title, content, folderId }
 * @returns {Promise<Object>} - The created note
 */
export async function createNote(hash, noteData) {
  const response = await apiRequest('', {
    method: 'PUT',
    body: JSON.stringify({
      hash,
      action: 'createNote',
      data: noteData
    })
  });

  return response.data.notes[0]; // First note is the newly created one
}

/**
 * Get all notes for a user
 * @param {string} hash - User's hash
 * @returns {Promise<Array>} - Array of notes
 */
export async function getNotes(hash) {
  const userData = await getUserData(hash);
  return userData ? userData.notes : [];
}


/**
 * Update an existing note
 * @param {string} hash - User's hash
 * @param {string} noteId - Note ID to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} - Updated note or null
 */
export async function updateNote(hash, noteId, updates) {
  const response = await apiRequest('', {
    method: 'PUT',
    body: JSON.stringify({
      hash,
      action: 'updateNote',
      data: { noteId, updates }
    })
  });

  return response.data.notes.find(n => n.id === noteId) || null;
}

/**
 * Delete a note
 * @param {string} hash - User's hash
 * @param {string} noteId - Note ID to delete
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteNote(hash, noteId) {
  await apiRequest('', {
    method: 'PUT',
    body: JSON.stringify({
      hash,
      action: 'deleteNote',
      data: { noteId }
    })
  });

  return true;
}

/**
 * Toggle note pin status
 * @param {string} hash - User's hash
 * @param {string} noteId - Note ID
 * @returns {Promise<Object|null>} - Updated note or null
 */
export async function toggleNotePin(hash, noteId) {
  const response = await apiRequest('', {
    method: 'PUT',
    body: JSON.stringify({
      hash,
      action: 'togglePin',
      data: { noteId }
    })
  });

  return response.data.notes.find(n => n.id === noteId) || null;
}

/**
 * Toggle note archive status
 * @param {string} hash - User's hash
 * @param {string} noteId - Note ID
 * @returns {Promise<Object|null>} - Updated note or null
 */
export async function toggleNoteArchive(hash, noteId) {
  const response = await apiRequest('', {
    method: 'PUT',
    body: JSON.stringify({
      hash,
      action: 'toggleArchive',
      data: { noteId }
    })
  });

  return response.data.notes.find(n => n.id === noteId) || null;
}

// ===== TAG OPERATIONS =====

/**
 * Get all tags for a user
 * @param {string} hash - User's hash
 * @returns {Promise<Array>} - Array of tags
 */
export async function getTags(hash) {
  const userData = await getUserData(hash);
  return userData ? userData.tags || [] : [];
}

/**
 * Create a new tag
 * @param {string} hash - User's hash
 * @param {Object} tagData - { name, color }
 * @returns {Promise<Object>} - Created tag
 */
export async function createTag(hash, tagData) {
  const response = await apiRequest('', {
    method: 'PUT',
    body: JSON.stringify({
      hash,
      action: 'createTag',
      data: tagData
    })
  });

  const tags = response.data.tags || [];
  return tags[tags.length - 1]; // Last tag is the new one
}

/**
 * Update a tag
 * @param {string} hash - User's hash
 * @param {string} tagId - Tag ID
 * @param {Object} updates - { name, color }
 * @returns {Promise<Object|null>} - Updated tag or null
 */
export async function updateTag(hash, tagId, updates) {
  const response = await apiRequest('', {
    method: 'PUT',
    body: JSON.stringify({
      hash,
      action: 'updateTag',
      data: { tagId, updates }
    })
  });

  const tags = response.data.tags || [];
  return tags.find(t => t.id === tagId) || null;
}

/**
 * Delete a tag
 * @param {string} hash - User's hash
 * @param {string} tagId - Tag ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteTag(hash, tagId) {
  try {
    await apiRequest('', {
      method: 'PUT',
      body: JSON.stringify({
        hash,
        action: 'deleteTag',
        data: { tagId }
      })
    });
    return true;
  } catch (error) {
    if (error.message === 'Tag not found') {
      return false;
    }
    throw error;
  }
}

// ===== SEARCH OPERATIONS =====


// ===== SHARE OPERATIONS =====

/**
 * Share a note and get public URL
 * @param {string} hash - User's hash
 * @param {string} noteId - Note ID to share
 * @returns {Promise<Object>} - { shareId, shareUrl, alreadyShared }
 */
export async function shareNote(hash, noteId) {
  const response = await apiRequest('', {
    method: 'PUT',
    body: JSON.stringify({
      hash,
      action: 'shareNote',
      data: { noteId }
    })
  });

  return response; // { shareId, shareUrl, alreadyShared }
}

/**
 * Get a shared note by share ID
 * @param {string} shareId - Share ID
 * @returns {Promise<Object|null>} - Shared note data or null
 */
export async function getSharedNote(shareId) {
  try {
    const response = await apiRequest(`?shared=${encodeURIComponent(shareId)}`);
    return response;
  } catch (error) {
    if (error.message === 'Shared note not found') {
      return null;
    }
    throw error;
  }
}

// ===== UTILITY FUNCTIONS =====

