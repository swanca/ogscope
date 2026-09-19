export interface ImageSize {
  width: number;
  height: number;
  type: 'png' | 'jpeg' | 'gif' | 'webp';
}

/**
 * Read image dimensions straight out of the file header.
 *
 * We only ever need the first few dozen bytes, so the scanner can range request
 * a small slice instead of downloading a multi megabyte image just to find out
 * it is the wrong shape. Returns null rather than guessing when the data is
 * truncated or unrecognised.
 */
export function readImageSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 10) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (isPng(bytes)) {
    if (bytes.length < 24) return null;
    return { width: view.getUint32(16), height: view.getUint32(20), type: 'png' };
  }

  if (isGif(bytes)) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true), type: 'gif' };
  }

  if (isRiffWebp(bytes)) {
    const size = readWebpSize(bytes, view);
    // The format is worth reporting even when the variant is one we cannot
    // measure, because the audit flags WEBP regardless of its dimensions.
    return { width: size?.width ?? 0, height: size?.height ?? 0, type: 'webp' };
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) return readJpegSize(bytes, view);

  return null;
}

function isPng(b: Uint8Array): boolean {
  return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

function isGif(b: Uint8Array): boolean {
  return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
}

function isRiffWebp(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const riff = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
  const webp = b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return riff && webp;
}

function readWebpSize(b: Uint8Array, view: DataView): { width: number; height: number } | null {
  if (b.length < 30) return null;
  const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);

  if (chunk === 'VP8X') {
    // Canvas size is stored as three byte little endian values, minus one.
    const width = 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16));
    const height = 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16));
    return { width, height };
  }

  if (chunk === 'VP8 ') {
    // Simple lossy format: dimensions sit just past the start code.
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }

  if (chunk === 'VP8L') {
    const bits = view.getUint32(21, true);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }

  return null;
}

/**
 * JPEG stores dimensions in a start of frame marker that can sit anywhere after
 * a run of other segments, so we walk the segment chain to find it.
 */
function readJpegSize(b: Uint8Array, view: DataView): ImageSize | null {
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = b[offset + 1]!;

    // Every start of frame marker carries the dimensions in the same layout.
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7), type: 'jpeg' };
    }

    // Padding and standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}
