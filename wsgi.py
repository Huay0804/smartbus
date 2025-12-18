"""
WSGI entrypoint cho môi trường production.

Ví dụ (Linux):
  gunicorn wsgi:app
"""

from app import app  # noqa: F401

