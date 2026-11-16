const { validationResult } = require('express-validator');

module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  return res.status(422).json({
    success: false,
    message: 'Data tidak valid',
    errors: result.array().map(({ path, msg }) => ({ field: path, message: msg }))
  });
};
