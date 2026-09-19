import { describe, it, expect } from 'vitest';
import { normalizeUrl, UrlRejected } from './safeurl';

function reject(input: string): string {
  try {
    normalizeUrl(input);
  } catch (err) {
    if (err instanceof UrlRejected) return err.reason;
    throw err;
  }
  throw new Error(`expected ${input} to be rejected`);
}

describe('normalizeUrl', () => {
  it('accepts a plain https URL', () => {
    expect(normalizeUrl('https://example.com/page')).toBe('https://example.com/page');
  });

  it('assumes https when no scheme is given, which is how people paste URLs', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
  });

  it('keeps query strings intact', () => {
    expect(normalizeUrl('https://example.com/a?b=c')).toBe('https://example.com/a?b=c');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  https://example.com/  ')).toBe('https://example.com/');
  });

  it('rejects an empty string', () => {
    expect(reject('')).toBe('empty');
  });

  it('rejects a scheme that is not http or https', () => {
    expect(reject('ftp://example.com')).toBe('scheme');
    expect(reject('file:///etc/passwd')).toBe('scheme');
    expect(reject('javascript:alert(1)')).toBe('scheme');
  });
});

describe('normalizeUrl blocks requests to internal targets', () => {
  it('rejects localhost', () => {
    expect(reject('http://localhost/')).toBe('private');
    expect(reject('http://localhost:3000/')).toBe('private');
  });

  it('rejects loopback addresses', () => {
    expect(reject('http://127.0.0.1/')).toBe('private');
    expect(reject('http://[::1]/')).toBe('private');
  });

  it('rejects the cloud metadata endpoint', () => {
    expect(reject('http://169.254.169.254/latest/meta-data/')).toBe('private');
  });

  it('rejects RFC1918 private ranges', () => {
    expect(reject('http://10.0.0.5/')).toBe('private');
    expect(reject('http://192.168.1.1/')).toBe('private');
    expect(reject('http://172.16.0.1/')).toBe('private');
    expect(reject('http://172.31.255.255/')).toBe('private');
  });

  it('allows a public address that merely looks similar to a private one', () => {
    expect(normalizeUrl('http://172.32.0.1/')).toBe('http://172.32.0.1/');
    expect(normalizeUrl('http://11.0.0.1/')).toBe('http://11.0.0.1/');
  });

  it('rejects internal hostname suffixes', () => {
    expect(reject('http://db.internal/')).toBe('private');
    expect(reject('http://printer.local/')).toBe('private');
  });

  it('rejects ports other than the web ports, so it cannot be used to scan a network', () => {
    expect(reject('http://example.com:22/')).toBe('port');
    expect(reject('http://example.com:6379/')).toBe('port');
  });

  it('allows the explicit web ports', () => {
    expect(normalizeUrl('http://example.com:80/')).toBe('http://example.com/');
    expect(normalizeUrl('https://example.com:443/')).toBe('https://example.com/');
  });

  it('rejects credentials embedded in the URL', () => {
    expect(reject('https://user:pass@example.com/')).toBe('credentials');
  });
});
