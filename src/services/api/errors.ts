/**
 * API error shape shared by every operation (docs/redesign/08-api-conventions.md).
 * Server functions raise `MESSAGE = <key>` and `HINT = <user copy>`; table calls
 * surface PostgREST errors, which map to `unknown` with their message.
 */
export class ApiError extends Error {
  constructor(
    public readonly key: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface PostgrestLikeError {
  message: string
  hint?: string | null
  code?: string
}

export function toApiError(error: PostgrestLikeError): ApiError {
  // RAISE … USING MESSAGE = 'key', HINT = 'copy' arrives as { code: 'P0001', message, hint }.
  if (error.code === 'P0001' && /^[a-z_]+$/.test(error.message)) {
    return new ApiError(error.message, error.hint ?? error.message)
  }
  return new ApiError('unknown', error.message)
}
