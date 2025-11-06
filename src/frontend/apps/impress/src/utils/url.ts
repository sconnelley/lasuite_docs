/**
 * Gets the base path for the application.
 *
 * Priority:
 * 1. Uses NEXT_PUBLIC_BASE_PATH from environment variables if defined.
 * 2. Falls back to reading from Next.js router if available (for runtime).
 * 3. Defaults to empty string (root path).
 *
 * @returns The base path (e.g., "/docs" or "")
 */
export function getBasePath(): string {
  // Check environment variable first (set at build time)
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) {
    return process.env.NEXT_PUBLIC_BASE_PATH;
  }

  // Fallback: try to read from Next.js router if available (runtime)
  if (typeof window !== 'undefined') {
    // Next.js sets __NEXT_DATA__.basePath at runtime
    const nextData = (window as Window).__NEXT_DATA__;
    if (nextData && 'basePath' in nextData) {
      return nextData.basePath as string;
    }
  }

  return '';
}

/**
 * Constructs a document URL path.
 *
 * When Next.js basePath is set (e.g., "/docs"), this function returns a path
 * relative to the basePath. Next.js will automatically prepend basePath when
 * using router.push() or Link components.
 *
 * Example:
 * - basePath = "/docs"
 * - getDocUrl("abc123") returns "/abc123"
 * - Next.js router.push(getDocUrl("abc123")) navigates to "/docs/abc123"
 *
 * @param docId - The document ID
 * @returns The document URL path (relative to basePath)
 */
export function getDocUrl(docId: string): string {
  return `/${docId}`;
}

/**
 * Constructs an absolute document URL (including basePath).
 *
 * Use this for:
 * - Copying links to clipboard
 * - External links
 * - Any case where you need the full URL including basePath
 *
 * @param docId - The document ID
 * @returns The absolute document URL (e.g., "https://example.com/docs/abc123/")
 */
export function getDocUrlAbsolute(docId: string): string {
  const basePath = getBasePath();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${basePath}/${docId}/`;
}

export function isSafeUrl(url: string): boolean {
  try {
    // Parse the URL with a base to support relative URLs
    const parsed = new URL(url, window.location.origin);

    // List of allowed protocols
    const allowedProtocols = ['http:', 'https:'];

    // Check protocol
    if (!allowedProtocols.includes(parsed.protocol)) {
      return false;
    }

    // Check for dangerous characters in the pathname
    const dangerousChars = ['<', '>', '"', "'", '(', ')', ';', '=', '{', '}'];
    if (dangerousChars.some((char) => parsed.pathname.includes(char))) {
      return false;
    }

    // Check URL length (protection against buffer overflow attacks)
    if (url.length > 2000) {
      return false;
    }

    // Check for malicious encodings
    if (url.includes('%00') || url.includes('\\0')) {
      return false;
    }

    // Check for XSS injection attempts
    const xssPatterns = [
      '<script',
      'javascript:',
      'data:',
      'vbscript:',
      'expression(',
    ];
    if (xssPatterns.some((pattern) => url.toLowerCase().includes(pattern))) {
      return false;
    }

    // Check for directory traversal attempts
    return !(url.includes('..') || url.includes('../') || url.includes('..\\'));
  } catch {
    return false;
  }
}
