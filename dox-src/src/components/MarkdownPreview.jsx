import { memo, useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';

/**
 * MarkdownPreview Component
 *
 * Renders markdown content with:
 * - GitHub Flavored Markdown (tables, task lists, strikethrough)
 * - Syntax highlighting for code blocks
 * - Dark/light theme support
 * - Responsive typography
 */
function MarkdownPreview({ content, readOnly = false }) {
  const [isDark, setIsDark] = useState(false);

  // Check for dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Use MDEditor.Markdown for preview-only mode (cleaner, no extra DOM elements)
  return (
    <div data-color-mode={isDark ? 'dark' : 'light'} className="prose prose-sm sm:prose dark:prose-invert max-w-none w-full">
      <MDEditor.Markdown
        source={content}
        style={{
          backgroundColor: 'transparent'
        }}
      />
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(MarkdownPreview);
