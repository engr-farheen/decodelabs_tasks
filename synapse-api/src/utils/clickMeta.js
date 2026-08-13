const crypto = require('crypto');
// ua-parser-js changed its export shape across major versions (named
// export in v1, default-style in some v2 builds) — this works with either
// so an npm-installed minor/patch bump can't silently break parsing.
const uaParserModule = require('ua-parser-js');
const UAParser = uaParserModule.UAParser || uaParserModule;

// We never store a visitor's raw IP address — only a one-way hash of it.
// This still lets us count *unique* visitors (two clicks from the same
// IP hash to the same value) without retaining anything that identifies
// a real person or device.
function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// Render (and most hosts) sit behind a proxy, so the real client IP
// arrives via X-Forwarded-For, not the raw socket address. We take the
// first entry, which is the original client.
function extractClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || null;
}

function parseUserAgent(userAgentString) {
  if (!userAgentString) return { device: 'Unknown', browser: 'Unknown' };
  const parser = new UAParser(userAgentString);
  const result = parser.getResult();
  const device = result.device.type
    ? result.device.type[0].toUpperCase() + result.device.type.slice(1) // "mobile" -> "Mobile"
    : 'Desktop'; // ua-parser-js leaves device.type undefined for desktop UAs
  const browser = result.browser.name || 'Unknown';
  return { device, browser };
}

// Free, keyless geo-IP lookup. Deliberately fire-and-forget from the
// caller's perspective (see linkController.redirect) — a slow or failed
// lookup should never delay the actual redirect the visitor is waiting on.
// Local/private IPs (localhost, LAN testing) are skipped since they have
// no meaningful country.
async function lookupCountry(ip) {
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === 'success' ? data.countryCode : null;
  } catch {
    return null; // Analytics are best-effort — never throw for a failed lookup
  }
}

module.exports = { hashIp, extractClientIp, parseUserAgent, lookupCountry };
