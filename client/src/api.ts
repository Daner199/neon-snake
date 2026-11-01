// Llamadas a la API (/api pasa por el proxy de Vite en desarrollo y por nginx en Docker)
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  token?: string | null
}

export async function api<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('No hay conexión con el servidor', 0)
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = data && typeof data.error === 'string' ? data.error : 'Algo salió mal, inténtalo de nuevo'
    throw new ApiError(message, res.status)
  }
  return data as T
}
