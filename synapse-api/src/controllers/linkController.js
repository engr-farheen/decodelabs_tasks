const LinkService = require('../services/linkService');
const LinkModel = require('../models/linkModel');
const { asyncHandler } = require('../middleware/errorHandler');
const { hashIp, extractClientIp, parseUserAgent, lookupCountry } = require('../utils/clickMeta');

const createLink = asyncHandler(async (req, res) => {
  const { url, customAlias, expiresInDays } = req.body;
  const link = LinkService.create({
    userId: req.user.id,
    originalUrl: url,
    customAlias,
    expiresInDays,
  });
  res.status(201).json({ data: link });
});

const listLinks = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const { links, total } = LinkService.listForUser(req.user.id, {
    limit,
    offset: (page - 1) * limit,
  });
  res.status(200).json({
    data: links,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

const getLink = asyncHandler(async (req, res) => {
  const link = LinkService.getOne(Number(req.params.id), req.user.id);
  res.status(200).json({ data: link });
});

// PUT — full replacement. The client must send the complete desired
// state (here, that's just `url`); anything omitted resets to a
// default rather than being left untouched. This is the semantic
// difference from PATCH below: PUT means "this is now the whole
// resource," PATCH means "apply only these specific changes."
const replaceLink = asyncHandler(async (req, res) => {
  const { url } = req.body;
  const link = LinkService.update(Number(req.params.id), req.user.id, {
    originalUrl: url,
    isActive: true, // a PUT'd link is always reset to active — that's part of "replacing" it
  });
  res.status(200).json({ data: link });
});

// PATCH — partial update. Only the fields present in the body are
// changed; everything else on the resource is left exactly as-is.
const updateLink = asyncHandler(async (req, res) => {
  const { url, isActive } = req.body;
  const link = LinkService.update(Number(req.params.id), req.user.id, {
    originalUrl: url,
    isActive,
  });
  res.status(200).json({ data: link });
});

const deleteLink = asyncHandler(async (req, res) => {
  LinkService.remove(Number(req.params.id), req.user.id);
  res.status(204).send();
});

const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = LinkService.getAnalytics(Number(req.params.id), req.user.id);
  res.status(200).json({ data: analytics });
});

// Public redirect — this is the actual "short link" behavior. Deliberately
// a 302 (temporary redirect), not 301 (permanent): a 301 would let
// browsers cache the redirect forever, which would break analytics
// tracking and prevent a user from ever changing where the link points.
const redirect = asyncHandler(async (req, res) => {
  const ip = extractClientIp(req);
  const { device, browser } = parseUserAgent(req.get('user-agent'));

  const { url, clickId } = LinkService.resolve(req.params.code, {
    referrer: req.get('referer'),
    userAgent: req.get('user-agent'),
    ipHash: hashIp(ip),
    device,
    browser,
  });

  // Redirect the visitor immediately — nothing below this line should
  // ever be able to delay the response they're waiting on.
  res.redirect(302, url);

  // Best-effort enrichment, fully decoupled from the request/response
  // cycle. If ip-api.com is slow or down, this simply never resolves —
  // it can't fail the request because the request is already finished.
  if (clickId) {
    lookupCountry(ip)
      .then((country) => {
        if (country) LinkModel.updateClickEnrichment(clickId, { country });
      })
      .catch(() => {});
  }
});

module.exports = { createLink, listLinks, getLink, replaceLink, updateLink, deleteLink, getAnalytics, redirect };
