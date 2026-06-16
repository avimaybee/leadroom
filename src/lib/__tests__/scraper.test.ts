import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeUrl, fetchSiteContent } from '../scraper';

test('Web Scraper Utility', async (t) => {
  await t.test('normalizeUrl should prepend http protocols when missing', () => {
    assert.strictEqual(normalizeUrl('example.com'), 'https://example.com');
    assert.strictEqual(normalizeUrl('http://example.com'), 'http://example.com');
    assert.strictEqual(normalizeUrl('https://example.com'), 'https://example.com');
  });

  await t.test('fetchSiteContent should parse JSON response from Jina Reader', async () => {
    const originalFetch = globalThis.fetch;
    
    // Mock global fetch
    globalThis.fetch = async (url: any, init?: RequestInit) => {
      assert.strictEqual(url.toString(), 'https://r.jina.ai/https://example.com');
      assert.strictEqual(init?.headers && (init.headers as any)['Accept'], 'application/json');
      
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          code: 200,
          status: 20000,
          data: {
            title: 'Example Domain',
            url: 'https://example.com',
            content: 'This is the main markdown content of the scraped site.',
            description: 'A mock site description'
          }
        })
      } as any;
    };

    try {
      const result = await fetchSiteContent('example.com');
      assert.strictEqual(result.title, 'Example Domain');
      assert.strictEqual(result.url, 'https://example.com');
      assert.strictEqual(result.content, 'This is the main markdown content of the scraped site.');
      assert.strictEqual(result.description, 'A mock site description');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('fetchSiteContent should truncate content if it exceeds 15,000 characters', async () => {
    const originalFetch = globalThis.fetch;
    const longContent = 'A'.repeat(20000);

    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          data: {
            title: 'Long Site',
            content: longContent,
            description: ''
          }
        })
      } as any;
    };

    try {
      const result = await fetchSiteContent('example.com');
      assert.strictEqual(result.content.length, 15000 + '\n\n[Content truncated due to length limitations]'.length);
      assert.ok(result.content.endsWith('[Content truncated due to length limitations]'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('fetchSiteContent should throw error on request timeout', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url: any, init?: RequestInit) => {
      // Simulate timeout abort
      return new Promise((_, reject) => {
        const error = new Error('The user aborted a request.');
        error.name = 'AbortError';
        reject(error);
      });
    };

    try {
      await assert.rejects(
        fetchSiteContent('example.com', 10),
        /Scraping request timed out after/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('fetchSiteContent should fall back to Jina Reader if Browser Run fails', async () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = process.env;
    
    // Set BROWSER to a dummy object that will fail to launch
    (process as any).env = {
      ...originalEnv,
      BROWSER: { mock: true } as any,
    };

    globalThis.fetch = async () => {
      return {
        ok: true,
        json: async () => ({
          data: {
            title: 'Jina Fallback Site',
            content: 'Scraped content via Jina fallback',
            description: 'Fallback description'
          }
        })
      } as any;
    };

    try {
      const result = await fetchSiteContent('example.com');
      assert.strictEqual(result.title, 'Jina Fallback Site');
      assert.strictEqual(result.content, 'Scraped content via Jina fallback');
    } finally {
      globalThis.fetch = originalFetch;
      (process as any).env = originalEnv;
    }
  });

  await t.test('fetchSiteContent should succeed immediately via Fetch-First if the site returns static HTML', async () => {
    const originalFetch = globalThis.fetch;
    
    globalThis.fetch = async () => {
      // Mock direct fetch response
      return {
        ok: true,
        status: 200,
        url: 'https://example.com',
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'text/html' : null
        },
        text: async () => `
          <html>
            <head><title>My Static Site</title></head>
            <body>
              <meta name="description" content="This is my static site description">
              <h1>Welcome to my static site</h1>
              <p>This is a paragraph of text that contains enough content to pass the 600 characters limit. 
              Let's write some more content here. We want to make sure it has sufficient length to avoid triggering 
              the SPA fallback check. So we keep writing and writing until we have more than 600 characters of clean text.
              This paragraph is being constructed specifically for that purpose in our test suite. Let's make sure it is long enough. 
              The web scraping utility needs at least 600 characters of clean text to avoid falling back to Browser Run or Jina Reader.
              So we continue appending words to this static HTML string in our mock fetch response. 
              This is a nice, static HTML page that renders instantly and does not require JavaScript. 
              It is optimized for search engines and user accessibility. We are almost at the required length. 
              Thank you for reading this test text content.</p>
            </body>
          </html>
        `
      } as any;
    };

    try {
      const result = await fetchSiteContent('example.com');
      assert.strictEqual(result.title, 'My Static Site');
      assert.strictEqual(result.description, 'This is my static site description');
      assert.ok(result.content.includes('Welcome to my static site'));
      assert.ok(!result.content.includes('<title>')); // HTML tags stripped
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('fetchSiteContent should call browser.quickAction if Fetch-First returns SPA page', async () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = process.env;
    let quickActionCalled = false;

    // Set BROWSER with a mock quickAction
    (process as any).env = {
      ...originalEnv,
      BROWSER: {
        quickAction: async (action: string, params: any) => {
          assert.strictEqual(action, 'snapshot');
          assert.strictEqual(params.url, 'https://example.com');
          assert.deepStrictEqual(params.formats, ['markdown', 'screenshot', 'content']);
          quickActionCalled = true;
          return {
            markdown: 'Rendered markdown content from SPA',
            screenshot: 'data:image/png;base64,mock',
            content: '<html><title>SPA Rendered Title</title><body>Rendered markdown content from SPA</body></html>'
          };
        }
      } as any,
    };

    globalThis.fetch = async () => {
      // Return a basic empty SPA container (triggers fallback)
      return {
        ok: true,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'text/html' : null
        },
        text: async () => '<html><head><title>SPA App</title></head><body><div id="app"></div></body></html>'
      } as any;
    };

    try {
      const result = await fetchSiteContent('example.com');
      assert.ok(quickActionCalled);
      assert.strictEqual(result.title, 'SPA Rendered Title');
      assert.strictEqual(result.content, 'Rendered markdown content from SPA');
      assert.strictEqual(result.screenshot, 'data:image/png;base64,mock');
    } finally {
      globalThis.fetch = originalFetch;
      (process as any).env = originalEnv;
    }
  });

  await t.test('fetchSiteContent should propagate 429 errors from quickAction', async () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = process.env;

    // Set BROWSER to throw a 429 error
    (process as any).env = {
      ...originalEnv,
      BROWSER: {
        quickAction: async () => {
          const err = new Error('Browser time limit exceeded for today (free tier limit reached)');
          (err as any).status = 429;
          throw err;
        }
      } as any,
    };

    globalThis.fetch = async () => {
      // Return a basic empty SPA container
      return {
        ok: true,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'text/html' : null
        },
        text: async () => '<html><body><div id="root"></div></body></html>'
      } as any;
    };

    try {
      await assert.rejects(
        fetchSiteContent('example.com'),
        (err: any) => {
          return err.message.includes('429') && err.status === 429;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
      (process as any).env = originalEnv;
    }
  });
});
