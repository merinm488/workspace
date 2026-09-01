import { useState, useEffect, useCallback, useMemo } from 'react';
import * as db from '../lib/db';

/**
 * Notes Data Hook
 *
 * Manages all notes and tag operations:
 * - Fetch notes and tags
 * - Create, update, delete notes
 * - Create, update, delete tags
 * - Search functionality
 */
export function useNotes(userHash) {
  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTag, setActiveTag] = useState(null); // null = All Notes view
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // True once the first fetch for the current user has completed. Unlike
  // isLoading (which is also false before the fetch starts), this lets
  // callers distinguish "loaded, note really isn't there" from "still
  // fetching" — e.g. when resolving a /dox/?note= deep link.
  const [hasLoaded, setHasLoaded] = useState(false);

  /**
   * Fetch all data for the user
   */
  const fetchData = useCallback(async () => {
    if (!userHash) {
      setHasLoaded(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch notes and tags in parallel for better performance
      const [userNotes, userTags] = await Promise.all([
        db.getNotes(userHash),
        db.getTags(userHash)
      ]);

      setNotes(userNotes || []);
      setTags(userTags || []);
      setHasLoaded(true);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setNotes([]);
      setTags([]);
      setHasLoaded(true);
    }

    setIsLoading(false);
  }, [userHash]);

  /**
   * Create a new note
   */
  const createNote = useCallback(async (noteData) => {
    if (!userHash) return null;

    const result = await db.createNote(userHash, noteData);
    // db.createNote should return the created note, not assume it's first
    const createdNote = result.notes?.[0] || result;

    if (createdNote) {
      setNotes(prev => [createdNote, ...prev]);
    }
    return createdNote;
  }, [userHash]);

  /**
   * Update an existing note
   */
  const updateNote = useCallback(async (noteId, updates) => {
    if (!userHash) return null;

    const updatedNote = await db.updateNote(userHash, noteId, updates);
    if (updatedNote) {
      setNotes(prev =>
        prev.map(note =>
          note.id === noteId ? updatedNote : note
        )
      );
    }
    return updatedNote;
  }, [userHash]);

  /**
   * Delete a note
   */
  const deleteNote = useCallback(async (noteId) => {
    if (!userHash) return false;

    const success = await db.deleteNote(userHash, noteId);
    if (success) {
      setNotes(prev => prev.filter(note => note.id !== noteId));
    }
    return success;
  }, [userHash]);

  /**
   * Toggle note pin status
   */
  const togglePin = useCallback(async (noteId) => {
    if (!userHash) return null;

    const updatedNote = await db.toggleNotePin(userHash, noteId);
    if (updatedNote) {
      setNotes(prev =>
        prev.map(note =>
          note.id === noteId ? updatedNote : note
        )
      );
    }
    return updatedNote;
  }, [userHash]);

  /**
   * Toggle note archive status
   */
  const toggleArchive = useCallback(async (noteId) => {
    if (!userHash) return null;

    const updatedNote = await db.toggleNoteArchive(userHash, noteId);
    if (updatedNote) {
      setNotes(prev =>
        prev.map(note =>
          note.id === noteId ? updatedNote : note
        )
      );
    }
    return updatedNote;
  }, [userHash]);

  /**
   * Create a new tag
   */
  const createTag = useCallback(async (tagData) => {
    if (!userHash) return null;

    const newTag = await db.createTag(userHash, tagData);
    setTags(prev => [...prev, newTag]);
    return newTag;
  }, [userHash]);

  /**
   * Update a tag
   */
  const updateTag = useCallback(async (tagId, updates) => {
    if (!userHash) return null;

    const updatedTag = await db.updateTag(userHash, tagId, updates);
    if (updatedTag) {
      setTags(prev =>
        prev.map(tag =>
          tag.id === tagId ? updatedTag : tag
        )
      );
    }
    return updatedTag;
  }, [userHash]);

  /**
   * Delete a tag
   */
  const deleteTag = useCallback(async (tagId) => {
    if (!userHash) return false;

    const success = await db.deleteTag(userHash, tagId);
    if (success) {
      setTags(prev => prev.filter(tag => tag.id !== tagId));

      // Clear active tag if it was deleted
      if (activeTag === tagId) {
        setActiveTag(null);
      }
    }
    return success;
  }, [userHash, activeTag]);

  /**
   * Get filtered notes based on active tag and search
   */
  const getFilteredNotes = useCallback(() => {
    // Make sure notes is an array
    if (!Array.isArray(notes)) {
      return [];
    }

    let filtered = notes;

    // Filter by archived status
    if (showArchived) {
      filtered = filtered.filter(note => note.archived === true);
    } else {
      filtered = filtered.filter(note => note.archived === false || note.archived === undefined);
    }

    // Apply search filter - searches across all tags when there's a search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    } else if (activeTag && !showArchived) {
      // Only filter by tag when not searching and not in archived view
      filtered = filtered.filter(note => note.tagId === activeTag);
    }
    // If activeTag is null (All Notes view), show all notes (already done above)

    // Sort: pinned first, then by date
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [notes, activeTag, searchQuery, showArchived]);

  // Fetch data when user hash changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoize filtered notes to avoid expensive filtering on every render
  const filteredNotes = useMemo(getFilteredNotes, [notes, activeTag, searchQuery, showArchived]);

  return {
    notes,
    tags,
    activeTag,
    searchQuery,
    showArchived,
    isLoading,
    hasLoaded,
    filteredNotes,
    setActiveTag,
    setSearchQuery,
    setShowArchived,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    toggleArchive,
    createTag,
    updateTag,
    deleteTag,
    refreshData: fetchData
  };
}
