const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new Error('Server API tidak dapat dijangkau. Pastikan backend berjalan dan alamat API sudah benar.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    throw new Error('Server mengirim respons yang tidak valid. Periksa alamat API dan konfigurasi proxy.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Respons server tidak valid.');
  }

  if (!response.ok || data?.success === false) {
    const error = new Error(data.message || 'Permintaan gagal');
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

export function publicApi(path) {
  return request(`/api/public${path}`);
}

export function adminApi(path, options = {}) {
  const token = localStorage.getItem('lpk_admin_token');
  return request(`/api/admin${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
}

export const loginAdmin = (email, password) => adminApi('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});

export function registerParticipant(body) {
  return request('/api/public/register', { method: 'POST', body });
}
