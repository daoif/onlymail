class MailsSdkError(Exception):
    def __init__(self, message: str, status: int | None = None, details=None):
        super().__init__(message)
        self.status = status
        self.details = details


class TimeoutError(MailsSdkError):
    pass
