export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text || `Error ${response.status}`;
    try {
      const data = JSON.parse(text);
      message = data.message || data.error || message;
    } catch { /* plain response */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function download(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(path);
  if (!response.ok) {
    const text = await response.text();
    let message = text || `Error ${response.status}`;
    try {
      const data = JSON.parse(text);
      message = data.message || data.error || message;
    } catch { /* plain response */ }
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const fileName = /filename\*?=(?:UTF-8''|\")?([^\";]+)/i.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = decodeURIComponent(fileName.replace(/\"/g, ''));
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
