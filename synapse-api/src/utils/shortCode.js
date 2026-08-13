const { customAlphabet } = require('nanoid');

// URL-safe alphabet, no ambiguous look-alike characters (0/O, 1/l/I removed)
// to avoid users mis-typing or mis-reading a short code out loud.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
const generate = customAlphabet(ALPHABET, 7);

function generateShortCode() {
  return generate();
}

// Custom aliases are user-supplied, so they need their own stricter rule:
// letters, numbers, hyphens and underscores only, 3–30 characters.
const ALIAS_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;

function isValidAlias(alias) {
  return ALIAS_PATTERN.test(alias);
}

module.exports = { generateShortCode, isValidAlias };
