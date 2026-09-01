import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';

/**
 * MarkdownEditor Component
 *
 * All-in-one markdown editor using @uiw/react-md-editor:
 * - Built-in toolbar with all markdown formatting options
 * - Split-view: editor on left, live preview on right
 * - GitHub Flavored Markdown support
 * - Syntax highlighting for code blocks
 * - Dark mode support
 * - Responsive design
 * - Scrollable editor and preview panels
 */
export function MarkdownEditor({
  value = '',
  onChange,
  placeholder = 'Start writing your note...'
}) {
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

  return (
    <div data-color-mode={isDark ? 'dark' : 'light'} className="h-full flex flex-col overflow-hidden">
      <MDEditor
        value={value}
        onChange={onChange}
        preview="live"
        height="100%"
        textareaProps={{
          placeholder: placeholder
        }}
        hideToolbar={false}
        extra={[]}
      />
    </div>
  );
}
