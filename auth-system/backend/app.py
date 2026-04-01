"""
Document Manager + Auth — Flask Backend
"""
import os
import uuid
import logging
from datetime import datetime, timezone

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from werkzeug.utils import secure_filename

from config import Config

# ═════════════════════════════════════════════════════════
# APP SETUP
# ═════════════════════════════════════════════════════════
app = Flask(__name__)
app.config.from_object(Config)

# JWT Secret
app.config['JWT_SECRET'] = os.environ.get(
    'JWT_SECRET',
    'dev-change-me-super-secret-jwt-key-min-32-characters-long-abc123'
)

# Optional override for local development
app.config['TESTING'] = True  # This helps with import clarity

CORS(app, origins=[
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
])

db     = SQLAlchemy(app)
bcrypt = Bcrypt(app)

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ═════════════════════════════════════════════════════════
# IMPORT MODEL INSIDE APP CONTEXT
# ══════════════════════════════════════════════════════════
with app.app_context():
    from models.user import create_user_model
    User = create_user_model(db)

    # Import Document model
    from .models.document import Document  # NOTE: This will be added below

    # Create database tables
    db.create_all()
    logger.info("✅ Database tables created (documents + users)")

# ══════════════════════════════════════════════════════════
# MODEL IMPORTS
# ══════════════════════════════════════════════════════════
from models.document import Document  # This should exist now

# ═════════════════════════════════════════════════════════
# doc_routes: Update this to point to the correct module
# ═════════════════════════════════════════════════════════
# from your_document_routes_module import document_routes
# app.register_blueprint(document_routes)
# ═════════════════════════════════════════════════════════

# ═════════════════════════════════════════════════════════
# REGISTER AUTH BLUEPRINT
# ══════════════════════════════════════════════════════════
from auth_routes import auth_bp
app.register_blueprint(auth_bp)

print("✅ Auth blueprint registered with routes:")
print("   - POST /api/auth/signup")
print("   - POST /api/auth/login")
print("   - GET /api/auth/test")
print()

# ══════════════════════════════════════════════════════════
# BASIC ROUTES
# ══════════════════════════════════════════════════════════
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'API running ✅', 'time': datetime.now().isoformat()})

if __name__ == '__main__':
    print("\n" + "═" * 80)
    print("  📄 Document Manager + 🔐 Authentication API")
    print(f"  🌐 http://localhost:5000")
    print(f"  🔗 Test auth: http://localhost:5000/api/auth/test")
    print("═" * 80 + "\n")

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
    )