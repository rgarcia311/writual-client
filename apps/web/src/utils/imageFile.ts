/**
 * Local-file image uploads for the project poster and the stat/character cards.
 *
 * Images picked off the user's disk are stored inline in Mongo as
 * `data:image/{fileType};base64,{encodedString}` values — the same shape `imageUrl.ts` already
 * validates — so there is no object store to talk to and nothing extra to install. That storage
 * choice is also the reason everything here downscales before encoding: a phone photo is several
 * megabytes, base64 adds another third on top, and the poster field rides along in every project
 * list query.
 */

/** Largest file we will read off disk at all. Bigger than the stored budget on purpose — a big source photo downscales fine. */
export const MAX_IMAGE_FILE_BYTES = 15 * 1024 * 1024;

/** Longest edge of the stored image, in pixels. A poster tile renders well under 500px wide. */
export const MAX_IMAGE_DIMENSION = 1200;

/** Ceiling for the stored data URL. Kept well clear of Mongo's 16MB document limit. */
export const MAX_STORED_IMAGE_BYTES = 2 * 1024 * 1024;

/** Encoder quality for the downscaled image. */
const IMAGE_QUALITY = 0.85;

/**
 * Formats that can't survive a canvas round-trip usefully: SVG is resolution independent, and a GIF
 * would lose its animation. These are stored as-is when they fit the budget.
 */
const PASSTHROUGH_TYPES = new Set(['image/svg+xml', 'image/gif']);

const IMAGE_TYPE = /^image\//i;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Byte size of a data URL's decoded payload — what actually lands in the database. */
export function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/** Returns an error message for a file that can't be used, or `null` when it's fine. */
export function validateImageFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  const looksLikeImage = IMAGE_TYPE.test(file.type ?? '');
  if (!looksLikeImage) return 'Please choose an image file (JPEG, PNG, WebP, GIF, or SVG).';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    return `Image is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_IMAGE_FILE_BYTES)}.`;
  }
  return null;
}

/** Reads a local file into a `data:` URL. Browser only — `FileReader` has no Node equivalent here. */
export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read that file.'));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image couldn't be decoded."));
    img.src = dataUrl;
  });
}

/** Scale factor that fits the longest edge inside `maxDimension`, never enlarging. */
function scaleToFit(width: number, height: number, maxDimension: number): number {
  const longest = Math.max(width, height);
  return longest > maxDimension ? maxDimension / longest : 1;
}

/**
 * Re-encodes to WebP when the browser supports it (it keeps transparency and compresses well) and
 * falls back to JPEG otherwise. `toDataURL` silently returns a PNG for a type it can't encode, so
 * the result is checked rather than trusted.
 */
function encodeCanvas(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', IMAGE_QUALITY);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
}

/**
 * Downscales a `data:` image URL so its longest edge is at most `maxDimension`, returning the
 * re-encoded data URL. The original is kept when it is already small and re-encoding wouldn't save
 * anything — re-encoding a crisp small PNG only costs quality.
 */
export async function downscaleImageDataUrl(
  dataUrl: string,
  maxDimension: number = MAX_IMAGE_DIMENSION,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) throw new Error("That image couldn't be decoded.");

  const scale = scaleToFit(width, height, maxDimension);
  if (scale === 1 && dataUrlByteSize(dataUrl) <= MAX_STORED_IMAGE_BYTES) return dataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const encoded = encodeCanvas(canvas);
  // A re-encode that came out bigger (small graphics, flat colour) isn't worth taking.
  return dataUrlByteSize(encoded) < dataUrlByteSize(dataUrl) ? encoded : dataUrl;
}

/**
 * Turns a file the user picked into the base64 data URL to persist: validate, read, downscale, then
 * check the result still fits the storage budget.
 */
export async function imageFileToStorableDataUrl(
  file: File,
  maxDimension: number = MAX_IMAGE_DIMENSION,
): Promise<string> {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);

  const dataUrl = await readFileAsDataUrl(file);

  const processed = PASSTHROUGH_TYPES.has(file.type.toLowerCase())
    ? dataUrl
    : await downscaleImageDataUrl(dataUrl, maxDimension);

  const storedBytes = dataUrlByteSize(processed);
  if (storedBytes > MAX_STORED_IMAGE_BYTES) {
    throw new Error(
      `Image is still ${formatBytes(storedBytes)} after resizing — the limit is ${formatBytes(MAX_STORED_IMAGE_BYTES)}.`,
    );
  }
  return processed;
}
