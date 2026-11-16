const { pool } = require('../config/database');

function requestError(message, status) {
  return Object.assign(new Error(message), { status });
}

function imageUrl(file) {
  return `/uploads/${file.filename}`;
}

function parseBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function normalizeLink(value) {
  return value || null;
}

async function getSiteContent(includeInactive) {
  const [settings] = await pool.execute('SELECT logo_url FROM site_settings WHERE id = 1');
  const activeClause = includeInactive ? '' : 'WHERE is_active = TRUE';
  const [slides] = await pool.execute(
    `SELECT id, title, caption, image_url, link_url, sort_order, is_active
     FROM landing_slides ${activeClause} ORDER BY sort_order, id`
  );
  const [faqs] = await pool.execute(
    `SELECT id, question, answer, sort_order, is_active
     FROM landing_faqs ${activeClause} ORDER BY sort_order, id`
  );
  return {
    logo_url: settings[0]?.logo_url || null,
    slides,
    faqs
  };
}

exports.publicContent = async (req, res, next) => {
  try {
    res.json({ success: true, data: await getSiteContent(false) });
  } catch (error) { next(error); }
};

exports.adminContent = async (req, res, next) => {
  try {
    res.json({ success: true, data: await getSiteContent(true) });
  } catch (error) { next(error); }
};

exports.updateLogo = async (req, res, next) => {
  try {
    if (!req.file) throw requestError('Pilih file logo terlebih dahulu.', 422);
    const logoUrl = imageUrl(req.file);
    await pool.execute(
      `INSERT INTO site_settings (id, logo_url) VALUES (1, ?)
       ON DUPLICATE KEY UPDATE logo_url = VALUES(logo_url)`,
      [logoUrl]
    );
    res.json({ success: true, data: { logo_url: logoUrl } });
  } catch (error) { next(error); }
};

exports.resetLogo = async (req, res, next) => {
  try {
    await pool.execute('UPDATE site_settings SET logo_url = NULL WHERE id = 1');
    res.json({ success: true, message: 'Logo bawaan berhasil dipulihkan.' });
  } catch (error) { next(error); }
};

exports.createSlide = async (req, res, next) => {
  try {
    if (!req.file) throw requestError('Pilih gambar poster terlebih dahulu.', 422);
    const [result] = await pool.execute(
      `INSERT INTO landing_slides (title, caption, image_url, link_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.body.title || null,
        req.body.caption || null,
        imageUrl(req.file),
        normalizeLink(req.body.link_url),
        Number(req.body.sort_order || 0),
        req.body.is_active === undefined ? true : parseBoolean(req.body.is_active)
      ]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
};

exports.updateSlide = async (req, res, next) => {
  try {
    const [[slide]] = await pool.execute('SELECT id FROM landing_slides WHERE id = ?', [req.params.slideId]);
    if (!slide) return res.status(404).json({ success: false, message: 'Poster tidak ditemukan.' });

    const allowed = ['title', 'caption', 'link_url', 'sort_order', 'is_active'];
    const entries = Object.entries(req.body).filter(([key]) => allowed.includes(key));
    const updates = entries.map(([key, value]) => {
      if (key === 'title' || key === 'caption' || key === 'link_url') return [key, value || null];
      if (key === 'sort_order') return [key, Number(value)];
      if (key === 'is_active') return [key, parseBoolean(value)];
      return [key, value];
    });
    if (req.file) updates.push(['image_url', imageUrl(req.file)]);
    if (!updates.length) throw requestError('Tidak ada data poster yang diperbarui.', 422);

    await pool.execute(
      `UPDATE landing_slides SET ${updates.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`,
      [...updates.map(([, value]) => value), req.params.slideId]
    );
    res.json({ success: true, message: 'Poster berhasil diperbarui.' });
  } catch (error) { next(error); }
};

exports.deleteSlide = async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM landing_slides WHERE id = ?', [req.params.slideId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Poster tidak ditemukan.' });
    res.json({ success: true, message: 'Poster berhasil dihapus.' });
  } catch (error) { next(error); }
};

exports.createFaq = async (req, res, next) => {
  try {
    const [result] = await pool.execute(
      `INSERT INTO landing_faqs (question, answer, sort_order, is_active)
       VALUES (?, ?, ?, ?)`,
      [
        req.body.question,
        req.body.answer,
        Number(req.body.sort_order || 0),
        req.body.is_active === undefined ? true : parseBoolean(req.body.is_active)
      ]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
};

exports.updateFaq = async (req, res, next) => {
  try {
    const allowed = ['question', 'answer', 'sort_order', 'is_active'];
    const entries = Object.entries(req.body).filter(([key]) => allowed.includes(key));
    if (!entries.length) throw requestError('Tidak ada FAQ yang diperbarui.', 422);
    const [[faq]] = await pool.execute('SELECT id FROM landing_faqs WHERE id = ?', [req.params.faqId]);
    if (!faq) return res.status(404).json({ success: false, message: 'FAQ tidak ditemukan.' });

    const updates = entries.map(([key, value]) => [
      key,
      key === 'sort_order' ? Number(value) : key === 'is_active' ? parseBoolean(value) : value
    ]);
    await pool.execute(
      `UPDATE landing_faqs SET ${updates.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`,
      [...updates.map(([, value]) => value), req.params.faqId]
    );
    res.json({ success: true, message: 'FAQ berhasil diperbarui.' });
  } catch (error) { next(error); }
};

exports.deleteFaq = async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM landing_faqs WHERE id = ?', [req.params.faqId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'FAQ tidak ditemukan.' });
    res.json({ success: true, message: 'FAQ berhasil dihapus.' });
  } catch (error) { next(error); }
};
