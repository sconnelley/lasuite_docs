/**
 * Returns the base URL for the backend API.
 *
 * Priority:
 * 1. Uses NEXT_PUBLIC_API_ORIGIN from environment variables if defined.
 * 2. Falls back to the browser's window.location.origin if in a browser environment.
 * 3. Defaults to an empty string if executed in a non-browser environment without the env variable.
 *
 * @returns The backend base URL as a string.
 */
export const backendUrl = () =>
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  (typeof window !== 'undefined' ? window.location.origin : '');

/**
 * Constructs the full base API URL, including the versioned path (e.g., `/api/v1.0/` or `/api/docs/v1.0/`).
 *
 * @param apiVersion - The version of the API (defaults to '1.0'). Overridden by NEXT_PUBLIC_API_VERSION if set.
 * @returns The full versioned API base URL as a string.
 */
export const baseApiUrl = (apiVersion = '1.0') => {
  const origin = backendUrl();
  // Use NEXT_PUBLIC_API_VERSION if set (e.g., "docs/v1.0"), otherwise fall back to apiVersion param
  const fullVersion = process.env.NEXT_PUBLIC_API_VERSION || apiVersion || "v1.0";
  // If API_VERSION contains a prefix (e.g., "docs/v1.0"), use it; otherwise use default pattern
  if (fullVersion.includes("/")) {
    // Full format: "docs/v1.0" -> "/api/docs/v1.0/"
    const [prefix, version] = fullVersion.split("/");
    // Ensure version has "v" prefix (remove if present, then add to avoid duplication)
    const versionPart = version.startsWith("v") ? version : `v${version}`;
    return `${origin}/api/${prefix}/${versionPart}/`;
  } else {
    // Legacy format: "v1.0" or "1.0" -> "/api/v1.0/"
    const versionPath = fullVersion.startsWith("v") ? fullVersion : `v${fullVersion}`;
    return `${origin}/api/${versionPath}/`;
  }
};
