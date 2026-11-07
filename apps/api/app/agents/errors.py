class UserFacingError(RuntimeError):
    """An error whose message is safe to show to the user."""


GENERIC_ERROR = "Something went wrong while researching. Please try again."
