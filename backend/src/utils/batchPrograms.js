const PROGRAM_NAMES = [
  'SERTIFIKASI BNSP DIGITAL MARKETING',
  'PELATIHAN BAHASA JEPANG'
];

function isBatchOpen(batch) {
  return batch?.is_active === true || Number(batch?.is_active) === 1;
}

module.exports = { PROGRAM_NAMES, isBatchOpen };
