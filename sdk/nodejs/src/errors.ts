export class OnlyMailSdkError extends Error {
  status?: number
  details?: unknown

  constructor(message: string, status?: number, details?: unknown) {
    super(message)
    this.name = 'OnlyMailSdkError'
    this.status = status
    this.details = details
  }
}

export class TimeoutError extends OnlyMailSdkError {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}
