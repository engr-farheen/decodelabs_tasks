const LinkModel = require('../models/linkModel');
const ApiError = require('../utils/ApiError');
const { generateShortCode, isValidAlias } = require('../utils/shortCode');

// Semantic check: reject a URL that points back at this service's own
// short-link domain — otherwise a link could redirect to itself (or to
// another short link on this service) and create an infinite redirect
// chain for the end user's browser.
function assertNotSelfReferential(originalUrl) {
  const base = process.env.BASE_URL || '';
  if (base && originalUrl.startsWith(base)) {
    throw ApiError.badRequest('You cannot shorten a link that points back to this service.');
  }
}

// Confirms the resource exists AND belongs to the requesting user.
// This is the Authorization (AuthZ) check: authentication alone only
// proves *who* you are — this proves you're allowed to touch *this*
// specific resource.
function getOwnedLinkOrThrow(id, userId) {
  const link = LinkModel.findById(id);
  if (!link) throw ApiError.notFound('Link not found.');
  if (link.user_id !== userId) throw ApiError.forbidden('This link does not belong to you.');
  return link;
}

const LinkService = {
  create({ userId, originalUrl, customAlias, expiresInDays }) {
    assertNotSelfReferential(originalUrl);

    let code;
    if (customAlias) {
      if (!isValidAlias(customAlias)) {
        throw ApiError.badRequest(
          'Custom alias must be 3-30 characters: letters, numbers, hyphens, or underscores only.'
        );
      }
      if (LinkModel.findByCode(customAlias)) {
        throw ApiError.conflict('That alias is already taken.');
      }
      code = customAlias;
    } else {
      // Collision probability with a 7-character alphabet of 55 symbols
      // is astronomically small, but we still guard against it rather
      // than assume — a handful of retries is effectively free.
      do {
        code = generateShortCode();
      } while (LinkModel.findByCode(code));
    }

    let expiresAt = null;
    if (expiresInDays) {
      const date = new Date();
      date.setDate(date.getDate() + expiresInDays);
      expiresAt = date.toISOString();
    }

    const link = LinkModel.create({ userId, code, originalUrl, expiresAt });
    return LinkService.toPublicShape(link);
  },

  listForUser(userId, pagination) {
    const links = LinkModel.findByUser(userId, pagination);
    const total = LinkModel.countByUser(userId);
    return { links: links.map(LinkService.toPublicShape), total };
  },

  getOne(id, userId) {
    const link = getOwnedLinkOrThrow(id, userId);
    return LinkService.toPublicShape(link);
  },

  update(id, userId, { originalUrl, isActive }) {
    getOwnedLinkOrThrow(id, userId); // throws if not found/not owned
    if (originalUrl) assertNotSelfReferential(originalUrl);
    const updated = LinkModel.update(id, { originalUrl, isActive });
    return LinkService.toPublicShape(updated);
  },

  remove(id, userId) {
    getOwnedLinkOrThrow(id, userId);
    LinkModel.delete(id);
  },

  getAnalytics(id, userId) {
    getOwnedLinkOrThrow(id, userId);
    return LinkModel.getAnalytics(id);
  },

  // Public — no ownership check. Anyone with the short code can be
  // redirected; that's the entire point of a link shortener.
  //
  // Returns { url, clickId } rather than just the URL — the controller
  // sends the redirect immediately using `url`, then uses `clickId` to
  // backfill the (potentially slow) geo-IP country lookup afterwards,
  // so a flaky geo-IP provider can never delay a visitor's redirect.
  resolve(code, clickMeta) {
    const link = LinkModel.findByCode(code);
    if (!link || !link.is_active) throw ApiError.notFound('This short link does not exist.');

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      throw ApiError.notFound('This short link has expired.');
    }

    LinkModel.registerClick(link.id, clickMeta);
    const clickId = LinkModel.getLastClickId(link.id);
    return { url: link.original_url, clickId };
  },

  toPublicShape(link) {
    const base = process.env.BASE_URL || '';
    return {
      id: link.id,
      code: link.code,
      shortUrl: `${base}/${link.code}`,
      originalUrl: link.original_url,
      isActive: !!link.is_active,
      clickCount: link.click_count,
      expiresAt: link.expires_at || null,
      createdAt: link.created_at,
    };
  },
};

module.exports = LinkService;
