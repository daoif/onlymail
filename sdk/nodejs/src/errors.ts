export class MailsSdkError extends Error {
  status?: number
  details?: unknown

  constructor(message: string, status?: number, details?: unknown) {
    super(message)
    this.name = 'MailsSdkError'
    this.status = status
    this.details = details
  }
}

export class TimeoutError extends MailsSdkError {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}
