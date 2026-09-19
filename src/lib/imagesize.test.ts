import { describe, it, expect } from 'vitest';
import { readImageSize } from './imagesize';

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0x00, 0x00, 0x00, 0x0d], 8);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function gif(width: number, height: number): Uint8Array {
  const b = new Uint8Array(10);
  b.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // GIF89a
  const view = new DataView(b.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return b;
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, a JFIF APP0 segment to skip over, then the SOF0 frame header.
  const b = new Uint8Array(22);
  const view = new DataView(b.buffer);
  b.set([0xff, 0xd8], 0);
  b.set([0xff, 0xe0], 2);
  view.setUint16(4, 8); // APP0 length, skips to offset 12
  b.set([0x4a, 0x46, 0x49, 0x46, 0x00, 0x00], 6);
  b.set([0xff, 0xc0], 12);
  view.setUint16(14, 11); // SOF0 length
  b[16] = 8; // precision
  view.setUint16(17, height);
  view.setUint16(19, width);
  return b;
}

function webp(): Uint8Array {
  const b = new Uint8Array(16);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return b;
}

describe('readImageSize', () => {
  it('reads PNG dimensions', () => {
    expect(readImageSize(png(1200, 630))).toEqual({ width: 1200, height: 630, type: 'png' });
  });

  it('reads GIF dimensions, which are little endian', () => {
    expect(readImageSize(gif(800, 418))).toEqual({ width: 800, height: 418, type: 'gif' });
  });

  it('reads JPEG dimensions, skipping over earlier segments', () => {
    expect(readImageSize(jpeg(1920, 1080))).toEqual({ width: 1920, height: 1080, type: 'jpeg' });
  });

  it('identifies WEBP as a type even when it cannot read the dimensions', () => {
    const result = readImageSize(webp());
    expect(result?.type).toBe('webp');
  });

  it('returns null for data that is not an image', () => {
    expect(readImageSize(new TextEncoder().encode('<html></html>'))).toBeNull();
  });

  it('returns null for a truncated file rather than guessing', () => {
    expect(readImageSize(png(1200, 630).slice(0, 12))).toBeNull();
  });

  it('handles an empty buffer', () => {
    expect(readImageSize(new Uint8Array(0))).toBeNull();
  });
});
