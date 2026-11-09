export async function api(path, options = {}) {
  const token = localStorage.getItem(
    location.pathname.split('/')[1] === 'admin' ? 'athena-admin-token' : 'athena-token',
  );
  const response = await fetch('/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response
    .json()
    .catch(() => ({ message: 'Không kết nối được API. Kiểm tra máy chủ.' }));
  if (!response.ok) throw new Error(data.message || 'Yêu cầu thất bại.');
  return data;
}
