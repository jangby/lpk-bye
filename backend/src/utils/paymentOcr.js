function parseAmount(value) {
  let normalized = value.replace(/\s/g, '');
  if (/[.,]\d{2}$/.test(normalized)) normalized = normalized.slice(0, -3);
  const amount = Number(normalized.replace(/[.,]/g, ''));
  return Number.isSafeInteger(amount) && amount >= 1000 ? amount : null;
}

function parseTransferAmount(text) {
  const lines = String(text || '').split(/\r?\n/);
  const prioritized = [];
  const fallback = [];

  for (const line of lines) {
    const cleanLine = line
      .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ')
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ');
    const currencyPattern = /(?:rp|idr)\s*\.?\s*([0-9][0-9.,]*)/gi;
    for (const match of cleanLine.matchAll(currencyPattern)) {
      const amount = parseAmount(match[1]);
      if (amount) prioritized.push(amount);
    }

    if (/nominal|jumlah|total|transfer|amount/i.test(cleanLine)) {
      for (const match of cleanLine.matchAll(/[0-9][0-9.,]{2,}/g)) {
        const amount = parseAmount(match[0]);
        if (amount) prioritized.push(amount);
      }
    } else {
      for (const match of cleanLine.matchAll(/[0-9][0-9.,]{3,}/g)) {
        const amount = parseAmount(match[0]);
        if (amount) fallback.push(amount);
      }
    }
  }

  return prioritized[0] || fallback.sort((left, right) => right - left)[0] || null;
}

async function recognizeTransfer(buffer) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(buffer);
    return { text: data.text || '', amount: parseTransferAmount(data.text) };
  } finally {
    await worker.terminate();
  }
}

module.exports = { parseTransferAmount, recognizeTransfer };
