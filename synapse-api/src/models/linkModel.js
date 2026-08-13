const db = require('../config/database');

const LinkModel = {
  create({ userId, code, originalUrl, expiresAt }) {
    const stmt = db.prepare(
      `INSERT INTO links (user_id, code, original_url, expires_at) VALUES (?, ?, ?, ?)`
    );
    const info = stmt.run(userId, code, originalUrl, expiresAt || null);
    return LinkModel.findById(info.lastInsertRowid);
  },

  findById(id) {
    return db.prepare(`SELECT * FROM links WHERE id = ?`).get(id);
  },

  findByCode(code) {
    return db.prepare(`SELECT * FROM links WHERE code = ?`).get(code);
  },

  findByUser(userId, { limit = 20, offset = 0 } = {}) {
    return db
      .prepare(
        `SELECT * FROM links WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(userId, limit, offset);
  },

  countByUser(userId) {
    return db.prepare(`SELECT COUNT(*) AS count FROM links WHERE user_id = ?`).get(userId).count;
  },

  update(id, { originalUrl, isActive }) {
    const current = LinkModel.findById(id);
    const nextUrl = originalUrl !== undefined ? originalUrl : current.original_url;
    const nextActive = isActive !== undefined ? (isActive ? 1 : 0) : current.is_active;
    db.prepare(`UPDATE links SET original_url = ?, is_active = ? WHERE id = ?`).run(
      nextUrl,
      nextActive,
      id
    );
    return LinkModel.findById(id);
  },

  delete(id) {
    return db.prepare(`DELETE FROM links WHERE id = ?`).run(id);
  },

  registerClick(linkId, { referrer, userAgent, ipHash, country, device, browser }) {
    const insertClick = db.prepare(
      `INSERT INTO link_clicks (link_id, referrer, user_agent, ip_hash, country, device, browser)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const bumpCount = db.prepare(`UPDATE links SET click_count = click_count + 1 WHERE id = ?`);

    // Wrapped in a transaction: both writes succeed together or neither does —
    // avoids a click being logged without the counter updating (or vice versa).
    const tx = db.transaction(() => {
      insertClick.run(
        linkId,
        referrer || null,
        userAgent || null,
        ipHash || null,
        country || null,
        device || null,
        browser || null
      );
      bumpCount.run(linkId);
    });
    tx();
  },

  // Called after the redirect response has already been sent — geo-IP
  // lookup happens here, off the critical path, then this backfills the
  // click row that registerClick already inserted (matched by id).
  updateClickEnrichment(clickId, { country }) {
    db.prepare(`UPDATE link_clicks SET country = ? WHERE id = ?`).run(country || null, clickId);
  },

  getLastClickId(linkId) {
    const row = db
      .prepare(`SELECT id FROM link_clicks WHERE link_id = ? ORDER BY id DESC LIMIT 1`)
      .get(linkId);
    return row ? row.id : null;
  },

  getAnalytics(linkId) {
    const totals = db
      .prepare(`SELECT click_count AS totalClicks FROM links WHERE id = ?`)
      .get(linkId);

    const uniqueVisitors = db
      .prepare(
        `SELECT COUNT(DISTINCT ip_hash) AS count FROM link_clicks
         WHERE link_id = ? AND ip_hash IS NOT NULL`
      )
      .get(linkId).count;

    const topReferrers = db
      .prepare(
        `SELECT COALESCE(referrer, 'Direct / unknown') AS referrer, COUNT(*) AS clicks
         FROM link_clicks WHERE link_id = ?
         GROUP BY referrer ORDER BY clicks DESC LIMIT 5`
      )
      .all(linkId);

    const deviceBreakdown = db
      .prepare(
        `SELECT COALESCE(device, 'Unknown') AS device, COUNT(*) AS clicks
         FROM link_clicks WHERE link_id = ?
         GROUP BY device ORDER BY clicks DESC`
      )
      .all(linkId);

    const browserBreakdown = db
      .prepare(
        `SELECT COALESCE(browser, 'Unknown') AS browser, COUNT(*) AS clicks
         FROM link_clicks WHERE link_id = ?
         GROUP BY browser ORDER BY clicks DESC`
      )
      .all(linkId);

    const countryBreakdown = db
      .prepare(
        `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS clicks
         FROM link_clicks WHERE link_id = ?
         GROUP BY country ORDER BY clicks DESC`
      )
      .all(linkId);

    const recentClicks = db
      .prepare(
        `SELECT clicked_at AS clickedAt, referrer, user_agent AS userAgent, country, device, browser
         FROM link_clicks WHERE link_id = ? ORDER BY clicked_at DESC LIMIT 20`
      )
      .all(linkId);

    const dailyBreakdown = db
      .prepare(
        `SELECT date(clicked_at) AS date, COUNT(*) AS clicks
         FROM link_clicks WHERE link_id = ?
         GROUP BY date(clicked_at) ORDER BY date DESC LIMIT 30`
      )
      .all(linkId);

    return {
      totalClicks: totals ? totals.totalClicks : 0,
      uniqueVisitors,
      topReferrers,
      deviceBreakdown,
      browserBreakdown,
      countryBreakdown,
      recentClicks,
      dailyBreakdown,
    };
  },
};

module.exports = LinkModel;
