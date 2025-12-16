class JWTMismatchError(Exception):
    """Exception raised for JWT mismatch errors."""
    pass

class NotFoundError(Exception):
    """Exception raised when a resource is not found."""
    pass

class LlmServiceError(Exception):
    """Exception raised for errors in the LLM service."""
    pass