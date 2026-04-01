"""
Authentication Routes for Flask
"""
import re
import jwt
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from functools import wraps
from flask import Blueprint, request, jsonify, current_app

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


# ════════════════════════════════════════════════════════
# TEST ROUTE (Most Important - test this first)
# ════════════════════════════════════════════════════════
@auth_bp.route('/test', methods=['GET'])
def test_auth():
    """Test if auth routes are working"""
    return jsonify({
        'success': True,
        'message': 'Auth routes working! ✅',
        'timestamp': datetime.now().isoformat()
    }), 200


# ════════════════════════════════════════════════════════
# JWT HELPERS
# ════════════════════════════════════════════════════════
def generate_token(user_id, remember_me=False):
    """Generate JWT token"""
    expires = timedelta(days=30) if remember_me else timedelta(days=7)
    payload = {
        'id': user_id,
        'exp': datetime.now(timezone.utc) + expires,
        'iat': datetime.now(timezone.utc),
    }
    secret = current_app.config.get('JWT_SECRET', 'dev-secret-change-me-in-production')
    return jwt.encode(payload, secret, algorithm='HS256')


def decode_token(token):
    """Decode JWT token"""
    secret = current_app.config.get('JWT_SECRET', 'dev-secret-change-me-in-production')
    return jwt.decode(token, secret, algorithms=['HS256'])


# ════════════════════════════════════════════════════════
# VALIDATION HELPERS
# ════════════════════════════════════════════════════════
def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_password(password):
    """Validate password strength. Returns (is_valid, error_message)"""
    if len(password) < 8:
        return False, 'Password must be at least 8 characters'
    if not re.search(r'[A-Z]', password):
        return False, 'Password must include an uppercase letter'
    if not re.search(r'[a-z]', password):
        return False, 'Password must include a lowercase letter'
    if not re.search(r'\d', password):
        return False, 'Password must include a number'
    if not re.search(r'[@$!%*?&#^()_+\-=]', password):
        return False, 'Password must include a special character (@$!%*?&#)'
    return True, ''


def validate_mobile(mobile):
    """Validate mobile number"""
    pattern = r'^[+]?[\d\s\-()]{7,15}$'
    return bool(re.match(pattern, mobile))


# ════════════════════════════════════════════════════════
# AUTH MIDDLEWARE
# ════════════════════════════════════════════════════════
def login_required(f):
    """Decorator to require login"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization', '')

        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'success': False, 'message': 'Not authorized. Please login.'}), 401

        try:
            payload = decode_token(token)
            from app import User
            
            user = User.query.get(payload['id'])
            if not user or not user.is_active:
                return jsonify({'success': False, 'message': 'User not found or deactivated.'}), 401

            request.current_user = user

        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Session expired. Please login again.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'Invalid token. Please login.'}), 401

        return f(*args, **kwargs)
    return decorated


# ════════════════════════════════════════════════════════
# SIGNUP ROUTE
# ════════════════════════════════════════════════════════
@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Create new user account"""
    try:
        from app import db, User
        
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        # Get form data
        full_name        = (data.get('fullName') or '').strip()
        email            = (data.get('email') or '').strip().lower()
        mobile           = (data.get('mobile') or '').strip()
        password         = data.get('password') or ''
        confirm_password = data.get('confirmPassword') or ''

        # ── Validation ─────────────────────────────────
        if not full_name or len(full_name) < 2:
            return jsonify({'success': False, 'message': 'Full name is required (min 2 characters)'}), 400

        if not email or not validate_email(email):
            return jsonify({'success': False, 'message': 'Enter a valid email address'}), 400

        if not mobile or not validate_mobile(mobile):
            return jsonify({'success': False, 'message': 'Enter a valid mobile number'}), 400

        pwd_valid, pwd_error = validate_password(password)
        if not pwd_valid:
            return jsonify({'success': False, 'message': pwd_error}), 400

        if password != confirm_password:
            return jsonify({'success': False, 'message': 'Passwords do not match'}), 400

        # ── Check duplicate ────────────────────────────
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({
                'success': False,
                'message': 'This email is already registered. Please login instead.'
            }), 409

        # ── Create user ───────────────────────────────
        user = User(
            full_name=full_name,
            email=email,
            mobile=mobile,
        )
        user.set_password(password)

        db.session.add(user)
        db.session.commit()

        token = generate_token(user.id)
        first_name = full_name.split(' ')[0]

        return jsonify({
            'success': True,
            'message': f'Welcome, {first_name}! Account created 🎉',
            'token': token,
            'user': user.to_safe_dict(),
        }), 201

    except Exception as e:
        print(f'❌ Signup error: {str(e)}')
        from app import db
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500


# ════════════════════════════════════════════════════════
# LOGIN ROUTE
# ════════════════════════════════════════════════════════
@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user"""
    try:
        from app import db, User
        
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        email       = (data.get('email') or '').strip().lower()
        password    = data.get('password') or ''
        remember_me = data.get('rememberMe', False)

        if not email or not validate_email(email):
            return jsonify({'success': False, 'message': 'Enter a valid email address'}), 400

        if not password:
            return jsonify({'success': False, 'message': 'Password is required'}), 400

        # ── Find user ─────────────────────────────────
        user = User.query.filter_by(email=email).first()

        if not user:
            return jsonify({'success': False, 'message': 'Invalid email or password.'}), 401

        # ── Check lock ────────────────────────────────
        if user.is_locked:
            mins = user.lock_minutes_remaining
            return jsonify({
                'success': False,
                'message': f'Account locked. Try again in {mins} minute(s).'
            }), 423

        # ── Check password ────────────────────────────
        if not user.check_password(password):
            user.increment_login_attempts()
            db.session.commit()
            return jsonify({'success': False, 'message': 'Invalid email or password.'}), 401

        # ── Success ───────────────────────────────────
        user.reset_login_attempts()
        user.last_login = datetime.now(timezone.utc)
        db.session.commit()

        token = generate_token(user.id, remember_me)
        first_name = user.full_name.split(' ')[0]

        return jsonify({
            'success': True,
            'message': f'Welcome back, {first_name}! 👋',
            'token': token,
            'user': user.to_safe_dict(),
        }), 200

    except Exception as e:
        print(f'❌ Login error: {str(e)}')
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500


# ════════════════════════════════════════════════════════
# GET CURRENT USER
# ════════════════════════════════════════════════════════
@auth_bp.route('/me', methods=['GET'])
@login_required
def get_me():
    """Get current user profile"""
    return jsonify({
        'success': True,
        'user': request.current_user.to_safe_dict(),
    }), 200


# ════════════════════════════════════════════════════════
# UPDATE PROFILE
# ════════════════════════════════════════════════════════
@auth_bp.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update user profile"""
    try:
        from app import db
        
        data = request.get_json()
        user = request.current_user

        full_name = (data.get('fullName') or '').strip()
        mobile    = (data.get('mobile') or '').strip()

        if full_name and len(full_name) >= 2:
            user.full_name = full_name

        if mobile and validate_mobile(mobile):
            user.mobile = mobile

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Profile updated!',
            'user': user.to_safe_dict(),
        }), 200

    except Exception as e:
        print(f'❌ Update profile error: {str(e)}')
        return jsonify({'success': False, 'message': 'Server error.'}), 500


# ════════════════════════════════════════════════════════
# CHANGE PASSWORD
# ════════════════════════════════════════════════════════
@auth_bp.route('/change-password', methods=['PUT'])
@login_required
def change_password():
    """Change user password"""
    try:
        from app import db
        
        data = request.get_json()
        user = request.current_user

        current_password = data.get('currentPassword') or ''
        new_password     = data.get('newPassword') or ''

        if not user.check_password(current_password):
            return jsonify({'success': False, 'message': 'Current password is incorrect.'}), 400

        pwd_valid, pwd_error = validate_password(new_password)
        if not pwd_valid:
            return jsonify({'success': False, 'message': pwd_error}), 400

        user.set_password(new_password)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Password changed successfully!',
        }), 200

    except Exception as e:
        print(f'❌ Change password error: {str(e)}')
        return jsonify({'success': False, 'message': 'Server error.'}), 500


# ════════════════════════════════════════════════════════
# FORGOT PASSWORD
# ════════════════════════════════════════════════════════
@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset"""
    try:
        from app import db, User
        
        data  = request.get_json()
        email = (data.get('email') or '').strip().lower()

        # Always return same message to prevent email enumeration
        generic_msg = 'If that email exists, a reset link has been sent.'

        if not email:
            return jsonify({'success': True, 'message': generic_msg}), 200

        user = User.query.filter_by(email=email).first()

        if not user:
            return jsonify({'success': True, 'message': generic_msg}), 200

        # Generate reset token
        raw_token = secrets.token_hex(32)
        hashed    = hashlib.sha256(raw_token.encode()).hexdigest()

        user.password_reset_token   = hashed
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
        db.session.commit()

        reset_url = f"http://localhost:5173/reset-password/{raw_token}"
        print(f'\n🔗 Password Reset URL (dev): {reset_url}\n')

        # In production: send email with reset_url

        return jsonify({'success': True, 'message': generic_msg}), 200

    except Exception as e:
        print(f'❌ Forgot password error: {str(e)}')
        generic_msg = 'If that email exists, a reset link has been sent.'
        return jsonify({'success': True, 'message': generic_msg}), 200