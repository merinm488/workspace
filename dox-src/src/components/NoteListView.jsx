/**
 * NoteListView Component
 *
 * Displays notes in a list/table view format
 */
import { NoteActions } from './NoteActions';

export function NoteListView({ notes, onClick, onPin, onDelete, onRename, onArchive, onShare, isArchivedView, tags, currentTagId, isSearchResult }) {
  const formatDate = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const getPreview = (content, contentType = 'plain-text') => {
    if (!content) return 'No content';

    if (contentType === 'markdown') {
      // Strip markdown syntax for preview (legacy support)
      let stripped = content
        .replace(/^#{1,6}\s+/gm, '') // Headers
        .replace(/\*\*\*([^*]+)\*\*\*/g, '$1') // Bold + Italic
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
        .replace(/\*([^*]+)\*/g, '$1') // Italic
        .replace(/~~([^~]+)~~/g, '$1') // Strikethrough
        .replace(/`([^`]+)`/g, '$1') // Inline code
        .replace(/```[\s\S]*?```/g, '[code]') // Code blocks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images
        .replace(/^>\s+/gm, '') // Blockquotes
        .replace(/^\s*[-*+]\s+/gm, '') // Bulleted lists
        .replace(/^\s*\d+\.\s+/gm, '') // Numbered lists
        .replace(/^\s*-\s*\[\s*\]\s+/gm, '') // Task lists
        .replace(/^---$/gm, '') // Horizontal rules
        .replace(/\|.*\|/g, '') // Tables
        .replace(/\n/g, ' ') // Newlines to spaces
        .trim();

      return stripped.length > 80 ? stripped.substring(0, 80) + '...' : stripped;
    }

    if (contentType === 'richtext') {
      // Strip HTML tags for rich text content
      let stripped = content
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
        .replace(/&amp;/g, '&') // Replace HTML entities
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();

      return stripped.length > 80 ? stripped.substring(0, 80) + '...' : stripped;
    }

    // Original plain text handling
    const stripped = content.replace(/[#*`\-\[\]]/g, '').trim();
    return stripped.length > 80 ? stripped.substring(0, 80) + '...' : stripped;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
        <div className="col-span-5 sm:col-span-4">Title</div>
        <div className="col-span-3 hidden sm:block">Preview</div>
        <div className="col-span-2 hidden sm:block">Tag</div>
        <div className="col-span-3 sm:col-span-2">Updated</div>
        <div className="col-span-4 sm:col-span-1 text-right">Actions</div>
      </div>

      {/* Table rows */}
      {notes.map(note => (
        <div
          key={note.id}
          onClick={() => onClick(note)}
          className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors items-center"
        >
          {/* Pin icon + Title */}
          <div className="col-span-5 sm:col-span-4 flex items-center gap-2 min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPin(note.id);
              }}
              className={`p-1 rounded flex-shrink-0 transition-colors ${
                note.pinned
                  ? 'text-yellow-500'
                  : 'text-gray-300 hover:text-gray-500 dark:hover:text-gray-400'
              }`}
              title={note.pinned ? 'Unpin note' : 'Pin note'}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z" />
              </svg>
            </button>
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
              {note.title || 'Untitled'}
            </span>
          </div>

          {/* Preview - hidden on mobile */}
          <div className="col-span-3 hidden sm:block">
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {getPreview(note.content, note.contentType)}
            </p>
          </div>

          {/* Tag badge */}
          <div className="col-span-2 hidden sm:block">
            {note.tagId ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{
                backgroundColor: tags.find(t => t.id === note.tagId)?.color + '20' || '#f3f4f6',
                color: tags.find(t => t.id === note.tagId)?.color || '#6b7280'
              }}>
                <div className="w-2 h-2 rounded-full" style={{
                  backgroundColor: tags.find(t => t.id === note.tagId)?.color || '#9ca3af'
                }} />
                {tags.find(t => t.id === note.tagId)?.name || 'Unknown'}
              </span>
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
            )}
          </div>

          {/* Date */}
          <div className="col-span-3 sm:col-span-2 text-xs text-gray-500 dark:text-gray-400">
            {formatDate(note.updatedAt)}
          </div>

          {/* Actions */}
          <div className="col-span-4 sm:col-span-1 text-right">
            <NoteActions
              note={note}
              onPin={onPin}
              onDelete={onDelete}
              onRename={onRename}
              onArchive={onArchive}
              onShare={onShare}
              isArchivedView={isArchivedView}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
