'use client';

import ReactMarkdown from 'react-markdown';

function isSafeUrl(url: string): boolean {
  const v = url.trim().toLowerCase();
  return (
    v.startsWith('http://') ||
    v.startsWith('https://') ||
    v.startsWith('mailto:') ||
    v.startsWith('#') ||
    v.startsWith('/')
  );
}

/**
 * XSS-safe Markdown renderer for AI-generated content.
 * - skipHtml: raw <script>/<iframe> from model output renders as text, never elements.
 * - urlTransform: blocks javascript:/data:/vbscript: links.
 * (react-markdown v9+ doesn't execute raw HTML without rehype-raw, but links
 *  are still an injection vector — hence the transform.)
 */
export function SafeMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      skipHtml
      urlTransform={(url) => (isSafeUrl(url) ? url : '#')}
      components={{
        a: ({ href, children: linkChildren, ...props }) => (
          <a
            {...props}
            href={href && isSafeUrl(href) ? href : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {linkChildren}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
