export type RejectReason = 'empty' | 'invalid' | 'scheme' | 'private' | 'port' | 'credentials';

export class UrlRejected extends Error {
  constructor(
    public reason: RejectReason,
    message: string,
  ) {
    super(message);
    this.name = 'UrlRejected';
  }
}

const ALLOWED_PORTS = new Set(['', '80', '443']);
const BLOCKED_SUFFIXES = ['.internal', '.local', '.localdomain', '.home.arpa'];
const BLOCKED_HOSTS = new Set(['localhost', '0.0.0.0', '[::]', 'metadata.google.internal']);

/**
 * Decide whether a hostname points somewhere inside a private network.
 *
 * This service fetches whatever URL a stranger hands it, which is the classic
 * setup for a server side request forgery. Without this check someone could
 * point the scanner at a cloud metadata endpoint and read back credentials, or
 * walk an internal network through our responses.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;

  // IPv6 arrives wrapped in brackets.
  if (host.startsWith('[')) {
    const inner = host.slice(1, -1);
    if (inner === '::1' || inner === '::') return true;
    // Unique local (fc00::/7) and link local (fe80::/10).
    if (/^f[cd]/.test(inner) || /^fe[89ab]/.test(inner)) return true;
    // An IPv4 address tunnelled through IPv6 still needs the v4 checks.
    const mapped = inner.match(/(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIpv4(mapped[1]!);
    return false;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isPrivateIpv4(host);

  return false;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts as [number, number, number, number];

  if (a === 0 || a === 127) return true; // this host, loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link local, cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier grade NAT
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/**
 * Turn user input into a URL we are willing to fetch, or throw explaining why
 * we will not. Accepting a bare domain matters more than it sounds: almost
 * nobody types the scheme when pasting a URL into a tool.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input?.trim();
  if (!trimmed) throw new UrlRejected('empty', 'Enter a URL to scan.');

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new UrlRejected('invalid', 'That does not look like a valid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlRejected('scheme', 'Only http and https URLs can be scanned.');
  }

  if (url.username || url.password) {
    throw new UrlRejected('credentials', 'Remove the username and password from the URL before scanning it.');
  }

  if (isPrivateHost(url.hostname)) {
    throw new UrlRejected('private', 'That address is on a private network, so it cannot be scanned from here.');
  }

  if (!ALLOWED_PORTS.has(url.port)) {
    throw new UrlRejected('port', 'Only the standard web ports 80 and 443 can be scanned.');
  }

  url.hash = '';
  return url.toString();
}
