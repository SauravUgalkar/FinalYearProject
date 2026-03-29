const normalizeBaseUrl = (url) => {
	const raw = String(url || '').trim();
	if (!raw) return 'http://localhost:5000';

	// Prevent common deployment misconfiguration where /api is appended.
	const withoutTrailingSlash = raw.replace(/\/+$/, '');
	return withoutTrailingSlash.replace(/\/api$/i, '');
};

export const API_BASE_URL = normalizeBaseUrl(process.env.REACT_APP_API_URL);
export const SOCKET_BASE_URL = API_BASE_URL;
export const API_URL = `${API_BASE_URL}/api`;
