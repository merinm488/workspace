import TurndownService from 'turndown';

/**
 * HTML to Markdown Converter
 *
 * Converts TipTap-generated HTML content to Markdown format.
 * Used for migrating existing docs from HTML storage to Markdown.
 */

const turndownService = new TurndownService({
  headingStyle: 'atx',        // Use # headings instead of underlined
  codeBlockStyle: 'fenced',   // Use ``` code blocks instead of indented
  bulletListMarker: '-',      // Use - for bullet points
  emDelimiter: '_',           // Use _ for italic (TipTap default)
  strongDelimiter: '**',      // Use ** for bold
  linkStyle: 'inlined'        // Use [text](url) format
});

/**
 * Convert HTML content to Markdown
 * @param {string} html - HTML string (e.g., from TipTap)
 * @returns {string} - Markdown equivalent
 */
export function htmlToMarkdown(html) {
  if (!html || typeof html !== 'string') return '';

  // If already markdown (doesn't start with <), return as-is
  if (!html.trim().startsWith('<')) return html;

  try {
    return turndownService.turndown(html);
  } catch (error) {
    console.error('Failed to convert HTML to Markdown:', error);
    // Fallback: return original HTML if conversion fails
    return html;
  }
}

/**
 * Check if content is HTML format
 * @param {string} content - Content to check
 * @returns {boolean} - True if content appears to be HTML
 */
export function isHtml(content) {
  if (!content || typeof content !== 'string') return false;
  return content.trim().startsWith('<');
}

/**
 * Ensure content is in Markdown format
 * If content is HTML, convert it; otherwise return as-is
 * @param {string} content - Content to ensure is Markdown
 * @returns {string} - Markdown content
 */
export function ensureMarkdown(content) {
  if (isHtml(content)) {
    return htmlToMarkdown(content);
  }
  return content || '';
}
