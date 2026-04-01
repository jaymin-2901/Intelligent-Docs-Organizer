from datetime import datetime, timezone, timedelta
from flask_bcrypt import generate_password_hash, check_password_hash


def create_user_model(db):
    """Create and return the User model using the shared db instance"""

    class User(db.Model):
        __tablename__ = 'users'

        id            = db.Column(db.Integer, primary_key=True)
        full_name     = db.Column(db.String(100), nullable=False)
        email         = db.Column(db.String(255), nullable=False, unique=True, index=True)
        mobile        = db.Column(db.String(20), nullable=False)
        password_hash = db.Column(db.String(255), nullable=False)
        role          = db.Column(db.String(20), default='user')
        is_active     = db.Column(db.Boolean, default=True)

        login_attempts = db.Column(db.Integer, default=0)
        lock_until     = db.Column(db.DateTime, nullable=True)
        last_login     = db.Column(db.DateTime, nullable=True)

        password_reset_token   = db.Column(db.String(255), nullable=True)
        password_reset_expires = db.Column(db.DateTime, nullable=True)

        created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
        updated_at = db.Column(
            db.DateTime,
            default=lambda: datetime.now(timezone.utc),
            onupdate=lambda: datetime.now(timezone.utc),
        )

        def set_password(self, password):
            self.password_hash = generate_password_hash(password).decode('utf-8')

        def check_password(self, password):
            return check_password_hash(self.password_hash, password)

        @property
        def is_locked(self):
            if self.lock_until and self.lock_until > datetime.now(timezone.utc):
                return True
            return False

        @property
        def lock_minutes_remaining(self):
            if not self.is_locked:
                return 0
            delta = self.lock_until - datetime.now(timezone.utc)
            return max(1, int(delta.total_seconds() / 60))

        def increment_login_attempts(self):
            self.login_attempts = (self.login_attempts or 0) + 1
            if self.login_attempts >= 5:
                self.lock_until = datetime.now(timezone.utc) + timedelta(minutes=30)

        def reset_login_attempts(self):
            self.login_attempts = 0
            self.lock_until = None

        def to_safe_dict(self):
            return {
                'id':        self.id,
                'fullName':  self.full_name,
                'email':     self.email,
                'mobile':    self.mobile,
                'role':      self.role,
                'isActive':  self.is_active,
                'lastLogin': self.last_login.isoformat() if self.last_login else None,
                'createdAt': self.created_at.isoformat() if self.created_at else None,
            }

        def __repr__(self):
            return f'<User {self.id}: {self.email}>'

    return User