const db = require('../config/database');

const UserModel = {
  create({ name, email, passwordHash }) {
    const stmt = db.prepare(
      `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`
    );
    const info = stmt.run(name, email, passwordHash);
    return UserModel.findById(info.lastInsertRowid);
  },

  findById(id) {
    return db.prepare(`SELECT id, name, email, created_at FROM users WHERE id = ?`).get(id);
  },

  findByEmail(email) {
    return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
  },
};

module.exports = UserModel;
