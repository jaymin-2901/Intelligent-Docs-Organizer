import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

    # JWT
    JWT_SECRET = os.environ.get(
        'JWT_SECRET',
        'dev-change-me-super-secret-jwt-key-min-32-characters-long-abc123'
    )

    # Database — SQLite (no setup needed)
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f'sqlite:///{os.path.join(BASE_DIR, "app.db")}'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # File uploads
    UPLOAD_FOLDER = os.environ.get(
        'UPLOAD_FOLDER',
        os.path.join(BASE_DIR, 'uploads')
    )
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB max

    # Allowed file types
    ALLOWED_EXTENSIONS = {
        'pdf', 'docx', 'doc', 'pptx', 'ppt',
        'txt', 'md', 'csv', 'rtf', 'json',
        'xml', 'html', 'htm', 'log',
    }