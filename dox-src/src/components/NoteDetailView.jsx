import { useState, useEffect, useCallback } from 'react';
import { MarkdownEditor } from './MarkdownEditor';
import MarkdownPreview from './MarkdownPreview';
import { SettingsDropdown } from './SettingsDropdown';
import { useDebounce } from '../hooks/useDebounce';
import { htmlToMarkdown } from '../utils/htmlToMarkdown';

/**
 * NoteDetailView Component
 *
 * Full-screen note view with split-view/tabbed editing.
 * Features:
 * - View mode: Read-only preview with metadata
 * - Edit mode: Split-view on desktop (≥1024px), tabbed on mobile (<1024px)
 * - Auto-save with debouncing (1000ms)
 * - Keyboard shortcuts (Cmd/Ctrl+E for edit, Escape to go back)
 * - Tag selector integration
 * - Title editing (only in edit mode)
 * - Responsive design
 */
export function NoteDetailView({
  note,
  initialMode,
  tags,
  userHash,
  activeTag,
  onBack,
  onDelete,
  onUpdateNote,
  onShare,
  onCreateTag,
  theme,
  systemTheme,
  onSetTheme
}) {
  // 'view' | 'edit'. Deep links from the workspace pass the mode they want
  // (created notes open straight into the editor); otherwise existing notes
  // open in preview, new ones in the editor.
  const [mode, setMode] = useState(initialMode || (note?.id ? 'view' : 'edit')); // 'view' | 'edit'
  const [title, setTitle] = useState(note?.title || '');

  // Helper function to get content - only convert if it's legacy HTML format
  const getContent = (noteContent, contentType = 'markdown') => {
    if (!noteContent) return '';
    // Only convert legacy HTML notes, not current markdown notes
    if (contentType === 'richtext') {
      return htmlToMarkdown(noteContent);
    }
    return noteContent;
  };

  const [content, setContent] = useState(() => {
    return getContent(note?.content, note?.contentType);
  });
  const [tagId, setTagId] = useState(note?.tagId || activeTag || null);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [lastSavedValues, setLastSavedValues] = useState(() => {
    return {
      title: note?.title || '',
      content: getContent(note?.content, note?.contentType),
      tagId: note?.tagId || activeTag || null
    };
  });

  // Debounce content changes for auto-save (1000ms delay)
  const debouncedContent = useDebounce(content, 1000);
  const debouncedTitle = useDebounce(title, 1000);

  /**
   * Update lastSavedValues when note changes (e.g., switching notes)
   */
  useEffect(() => {
    if (note?.id) {
      setLastSavedValues({
        title: note.title || '',
        content: getContent(note.content, note.contentType),
        tagId: note.tagId || activeTag || null
      });
      setSaveStatus('saved');
    }
  }, [note?.id, note?.title, note?.content, note?.contentType, note?.tagId, activeTag]);

  /**
   * Auto-save effect: Trigger save when debounced values change
   * Only auto-save existing notes (has note.id)
   * Note: Auto-save happens silently without changing UI to 'saved'
   */
  useEffect(() => {
    if (!note?.id) return; // Don't auto-save new notes
    if (mode === 'view') return; // Don't auto-save in view mode

    const hasChanges =
      debouncedTitle !== lastSavedValues.title ||
      debouncedContent !== lastSavedValues.content ||
      tagId !== lastSavedValues.tagId;

    if (hasChanges) {
      // Don't change UI status for auto-save - keep it as 'unsaved'
      // Only update lastSavedValues in the background
      let isMounted = true;

      onUpdateNote(note.id, {
        title: debouncedTitle.trim() || 'Untitled',
        content: debouncedContent.trim(),
        tagId
      }).then(() => {
        if (isMounted) {
          // Update the reference point silently
          setLastSavedValues({
            title: debouncedTitle,
            content: debouncedContent,
            tagId
          });
        }
      }).catch((error) => {
        console.error('Auto-save failed:', error);
      });

      return () => {
        isMounted = false;
      };
    }
  }, [debouncedContent, debouncedTitle, tagId, mode, note?.id, lastSavedValues, onUpdateNote]);

  /**
   * Update save status when user makes changes
   */
  useEffect(() => {
    if (mode === 'view') return;

    const hasChanges =
      title !== lastSavedValues.title ||
      content !== lastSavedValues.content ||
      tagId !== lastSavedValues.tagId;

    if (hasChanges && saveStatus === 'saved') {
      setSaveStatus('unsaved');
    }
  }, [title, content, tagId, mode, lastSavedValues, saveStatus]);

  /**
   * Handle keyboard shortcuts
   * - Cmd/Ctrl + E: Toggle edit/view mode
   * - Escape: Go back
   * - Cmd/Ctrl + S: Explicit save (for new notes)
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + E: Toggle edit mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setMode(mode === 'view' ? 'edit' : 'view');
      }

      // Escape: Go back
      if (e.key === 'Escape') {
        // Don't go back if user is in the middle of editing
        if (saveStatus === 'unsaved') {
          const confirmed = confirm('You have unsaved changes. Are you sure you want to go back?');
          if (!confirmed) return;
        }
        onBack();
      }

      // Cmd/Ctrl + S: Explicit save (for new notes)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleExplicitSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, saveStatus, onBack]);

  /**
   * Handle content changes from editor
   */
  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
  }, []);

  /**
   * Handle explicit save (for both new and existing notes)
   */
  const handleExplicitSave = useCallback(() => {
    if (note?.id) {
      // Existing note - trigger immediate save
      setSaveStatus('saving');
      let isMounted = true;

      // Add a timeout fallback to ensure status doesn't get stuck
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('Explicit save timeout - resetting to unsaved');
          setSaveStatus('unsaved');
        }
      }, 5000); // 5 second timeout

      const saveData = {
        title: title.trim() || 'Untitled',
        content: content.trim(),
        tagId
      };

      onUpdateNote(note.id, saveData).then(() => {
        clearTimeout(timeoutId);
        if (isMounted) {
          setSaveStatus('saved');
          setLastSavedValues({
            title: title,
            content: content,
            tagId
          });
          // Show saved toast
          setShowSavedToast(true);
          setTimeout(() => setShowSavedToast(false), 1000);
        }
      }).catch((error) => {
        clearTimeout(timeoutId);
        console.error('Explicit save failed:', error);
        if (isMounted) {
          setSaveStatus('unsaved');
        }
      });

      return;
    }

    // New note - create it
    const newNoteData = {
      title: title.trim() || 'Untitled',
      content: content.trim(),
      contentType: 'markdown',
      tagId: tagId || activeTag || null
    };

    // This will be handled by parent component
    setSaveStatus('saving');
    onUpdateNote(null, newNoteData);
  }, [note?.id, title, content, tagId, activeTag, onUpdateNote]);

  /**
   * Handle delete with confirmation
   */
  const handleDelete = useCallback(() => {
    if (note?.id && confirm('Delete this note? This cannot be undone.')) {
      onDelete(note.id);
      onBack();
    }
  }, [note?.id, onDelete, onBack]);

  /**
   * Handle share action
   */
  const handleShare = useCallback(() => {
    if (note && onShare) {
      onShare(note);
    }
  }, [note, onShare]);

  // Get selected tag object
  const selectedTag = tags.find(t => t.id === tagId);

  /**
   * Render view mode header
   */
  const renderViewHeader = () => (
    <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        {/* Back button */}
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Go back"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Note icon */}
        <div className="w-8 h-8 rounded-lg bg-yellow-400/10 dark:bg-white/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-yellow-500 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
          {note?.title || 'Untitled'}
        </h1>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Edit button */}
        <button
          onClick={() => setMode('edit')}
          className="px-3 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-medium transition-colors flex items-center gap-2"
          title="Edit note (Cmd/Ctrl+E)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="hidden sm:inline">Edit</span>
        </button>

        {/* Settings dropdown */}
        <SettingsDropdown
          theme={theme}
          systemTheme={systemTheme}
          onSetTheme={onSetTheme}
          tags={tags}
          selectedTag={selectedTag?.id || null}
          onTagSelect={setTagId}
          onCreateTag={onCreateTag}
          onShare={handleShare}
          onDelete={handleDelete}
          hasNote={!!note?.id}
          note={note}
        />
      </div>
    </div>
  );

  /**
   * Render edit mode header
   */
  const renderEditHeader = () => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 relative">
      {/* Left section - back button and title */}
      <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
        {/* Back button */}
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          aria-label="Go back"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Title input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="flex-1 min-w-0 text-lg font-semibold bg-transparent border-0 focus:ring-0 p-0 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100"
        />

        {/* Settings dropdown - positioned absolutely on mobile, inline on desktop */}
        <div className="absolute right-4 top-4 sm:static sm:right-auto sm:top-auto">
          <SettingsDropdown
            theme={theme}
            systemTheme={systemTheme}
            onSetTheme={onSetTheme}
            tags={tags}
            selectedTag={selectedTag?.id || null}
            onTagSelect={setTagId}
            onCreateTag={onCreateTag}
            onShare={handleShare}
            onDelete={handleDelete}
            hasNote={!!note?.id}
            note={note}
          />
        </div>
      </div>
    </div>
  );

  /**
   * Render view mode content
   */
  const renderViewContent = () => (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {note?.title || 'Untitled'}
        </h1>

        {/* Metadata */}
        <div className="flex items-center gap-3 mb-6 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
          {/* Tag badge */}
          {selectedTag ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{
              backgroundColor: selectedTag.color + '20',
              color: selectedTag.color
            }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedTag.color }} />
              {selectedTag.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              All Notes
            </span>
          )}

          {/* Pin indicator */}
          {note?.pinned && (
            <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z" />
              </svg>
              Pinned
            </span>
          )}

          {/* Date */}
          <span>Updated {note?.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : 'Just now'}</span>
        </div>

        {/* Content */}
        <div className="prose prose-sm sm:prose dark:prose-invert max-w-none">
          <MarkdownPreview
            content={content}
            readOnly={true}
          />
        </div>
      </div>
    </div>
  );

  /**
   * Render edit mode content
   */
  const renderEditContent = () => (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {/* Editor with built-in preview toggle */}
      <MarkdownEditor
        value={content}
        onChange={handleContentChange}
        placeholder="Start writing your note..."
      />
    </div>
  );

  /**
   * Render save status footer (edit mode only)
   */
  const renderSaveStatus = () => {
    if (mode === 'view') return null;

    return (
      <div className="px-4 sm:px-6 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-end">
        {/* Save button */}
        <button
          type="button"
          onClick={handleExplicitSave}
          disabled={saveStatus === 'saving'}
          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {saveStatus === 'saving' ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Changes
            </>
          )}
        </button>
      </div>
    );
  };

  /**
   * Render saved toast notification
   */
  const renderSavedToast = () => {
    if (!showSavedToast) return null;

    return (
      <div className="fixed bottom-4 right-4 sm:right-6 z-50">
        <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Saved!</span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-white dark:bg-gray-900 flex flex-col"
    >
      {/* Header */}
      {mode === 'view' ? renderViewHeader() : renderEditHeader()}

      {/* Content */}
      {mode === 'view' ? renderViewContent() : renderEditContent()}

      {/* Save status footer (edit mode only) */}
      {renderSaveStatus()}

      {/* Saved toast notification */}
      {renderSavedToast()}
    </div>
  );
}
