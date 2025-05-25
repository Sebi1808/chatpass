/**
 * WhatsApp-style Markdown Parser
 * Konvertiert einfache Markdown-Syntax zu HTML
 */

export interface MarkdownRule {
  pattern: RegExp;
  replacement: string;
  description: string;
  example: string;
}

export const MARKDOWN_RULES: MarkdownRule[] = [
  {
    pattern: /\*\*(.*?)\*\*/g,
    replacement: '<strong>$1</strong>',
    description: 'Fett',
    example: '**text**'
  },
  {
    pattern: /\*(.*?)\*/g,
    replacement: '<strong>$1</strong>',
    description: 'Fett',
    example: '*text*'
  },
  {
    pattern: /_(.*?)_/g,
    replacement: '<em>$1</em>',
    description: 'Kursiv',
    example: '_text_'
  },
  {
    pattern: /~(.*?)~/g,
    replacement: '<u>$1</u>',
    description: 'Unterstrichen',
    example: '~text~'
  },
  {
    pattern: /~~(.*?)~~/g,
    replacement: '<del>$1</del>',
    description: 'Durchgestrichen',
    example: '~~text~~'
  },
  {
    pattern: /`(.*?)`/g,
    replacement: '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>',
    description: 'Code',
    example: '`code`'
  }
];

/**
 * Konvertiert Markdown-Text zu HTML
 */
export function parseMarkdown(text: string): string {
  let result = text;
  
  // Escape HTML entities first to prevent XSS
  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // Apply markdown rules in order
  for (const rule of MARKDOWN_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  
  // Convert line breaks to <br>
  result = result.replace(/\n/g, '<br>');
  
  return result;
}

/**
 * Entfernt Markdown-Formatierung für reine Text-Ausgabe
 */
export function stripMarkdown(text: string): string {
  let result = text;
  
  // Remove markdown syntax
  result = result
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold **text**
    .replace(/\*(.*?)\*/g, '$1')      // Bold *text*
    .replace(/_(.*?)_/g, '$1')        // Italic _text_
    .replace(/~(.*?)~/g, '$1')        // Underline ~text~
    .replace(/~~(.*?)~~/g, '$1')      // Strikethrough ~~text~~
    .replace(/`(.*?)`/g, '$1');       // Code `text`
  
  return result;
}

/**
 * Prüft ob Text Markdown-Formatierung enthält
 */
export function hasMarkdown(text: string): boolean {
  return MARKDOWN_RULES.some(rule => rule.pattern.test(text));
}

/**
 * Vorschau-Text für Markdown (begrenzte Länge)
 */
export function getMarkdownPreview(text: string, maxLength: number = 100): string {
  const stripped = stripMarkdown(text);
  if (stripped.length <= maxLength) return stripped;
  return stripped.substring(0, maxLength) + '...';
} 