const DEFAULT_ORIGINS = [
  'https://bacninh-hospital.com',
  'https://www.bacninh-hospital.com',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

function parseCorsOrigins() {
  const raw = String(process.env.CORS_ORIGINS || '').trim();
  if (!raw) {
    return DEFAULT_ORIGINS;
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, origins) {
  if (!origin) {
    return true;
  }

  if (origins.includes(origin)) {
    return true;
  }

  if (process.env.ALLOW_VERCEL_PREVIEW === 'true' && /\.vercel\.app$/i.test(origin)) {
    return true;
  }

  return false;
}

function getCorsOptions() {
  const origins = parseCorsOrigins();

  return {
    origin(origin, callback) {
      callback(null, isOriginAllowed(origin, origins));
    },
    credentials: true,
  };
}

module.exports = {
  DEFAULT_ORIGINS,
  getCorsOptions,
  parseCorsOrigins,
};
