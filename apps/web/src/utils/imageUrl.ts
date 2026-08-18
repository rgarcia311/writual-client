const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i;
/** Google Drive file URL: https://drive.google.com/file/d/{fileId}/view — rewritten for storage. */
const GOOGLE_DRIVE_FILE_URL = /^https:\/\/drive\.google\.com\/file\/d\/[^/]+\/view(?:\?.*)?$/i;
/**
 * Google Drive embed URL: https://drive.google.com/file/d/{fileId}/preview
 *
 * Kept separate from `GOOGLE_DRIVE_FILE_URL` on purpose: that pattern is what triggers the rewrite
 * in `getImageUrlForStorage`, so a preview link validates and is stored exactly as pasted.
 */
const GOOGLE_DRIVE_PREVIEW_URL =
  /^https:\/\/drive\.google\.com\/file\/d\/[^/]+\/preview(?:\?.*)?$/i;
/**
 * Inline image data URL: `data:image/{fileType};base64,{encodedString}` — e.g. a poster pasted
 * straight out of a file reader instead of hosted somewhere. Matched before anything URL-based
 * because `new URL()` accepts a `data:` URL but the protocol check then rejects it, and because a
 * base64 payload can incidentally contain substrings (`preview`) that the Drive handling keys on.
 */
const BASE64_IMAGE_DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/]+={0,2}$/i;

/** Gemini share URL: https://gemini.google.com/share/{id} */
const GEMINI_SHARE_URL = /^https:\/\/gemini\.google\.com\/share\/[a-zA-Z0-9]+(?:\?.*)?$/i;
/** Extract file ID from path segment d/FILE_ID/view */
const GOOGLE_DRIVE_FILE_ID = /\/d\/([^/]+)\/view/;

/** Hosts that serve a Drive file's bytes directly rather than a viewer page. */
const GOOGLE_DRIVE_DIRECT_HOSTS = new Set([
  'drive.usercontent.google.com',
  'drive.google.com',
]);

/**
 * Direct Drive links — `drive.usercontent.google.com/download?id=…&export=view` (what
 * `getImageUrlForStorage` writes) and the older `drive.google.com/uc?export=view&id=…`. Their paths
 * carry no file extension, so they can't pass the extension check; matched on host + path + `id`
 * instead of by pattern, since the query parameters arrive in any order.
 */
function isGoogleDriveDirectUrl(u: URL): boolean {
  if (!GOOGLE_DRIVE_DIRECT_HOSTS.has(u.hostname.toLowerCase())) return false;
  const path = u.pathname.replace(/\/+$/, '').toLowerCase();
  if (path !== '/download' && path !== '/uc') return false;
  return Boolean(u.searchParams.get('id')?.trim());
}

/** True for a `data:image/{fileType};base64,{encodedString}` value. */
export function isBase64ImageDataUrl(url: string): boolean {
  return BASE64_IMAGE_DATA_URL.test(url.trim());
}

export function isValidImageUrl(url: string): boolean {
  if (!url || !url.trim()) return true;
  try {
    const trimmed = url.trim();
    if (isBase64ImageDataUrl(trimmed)) return true;
    if (GOOGLE_DRIVE_FILE_URL.test(trimmed)) return true;
    if (GOOGLE_DRIVE_PREVIEW_URL.test(trimmed)) return true;
    if (GEMINI_SHARE_URL.test(trimmed)) return true;
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (isGoogleDriveDirectUrl(u)) return true;
    return IMAGE_EXTENSIONS.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * Returns the URL to persist for images. If the URL is a Google Drive file URL,
 * returns the direct view URL (drive.usercontent.google.com). Otherwise returns the trimmed URL.
 */
export function getImageUrlForStorage(url: string): string {
  const trimmed = url?.trim() ?? '';
  if (isBase64ImageDataUrl(trimmed)) return trimmed;
  if (url.includes('preview')) return url;
  if (!trimmed) return trimmed;
  if (!GOOGLE_DRIVE_FILE_URL.test(trimmed)) return trimmed;
  const match = trimmed.match(GOOGLE_DRIVE_FILE_ID);
  const fileId = match?.[1];
  if (!fileId) return trimmed;
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=view&authuser=0`;
}
