# ═══ Find the section in your app.py where the Flask app is created ═══
# It will look something like this:

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
db = SQLAlchemy(app)

# ... your existing config and routes ...


# ═══ ADD THESE 2 LINES anywhere AFTER app = Flask(__name__) ═══

from routes.document_routes import doc_bp
app.register_blueprint(doc_bp)

# ═══ ADD to app.py (no new files needed) ═══

from services.document_converter import convert_to_preview

@app.route('/api/documents/<int:doc_id>/preview', methods=['GET'])
def preview_document(doc_id):
    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({'error': 'Document not found'}), 404

    upload_folder = os.environ.get('UPLOAD_FOLDER', 'uploads')
    file_path = os.path.join(upload_folder, doc.stored_filename)

    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found on disk'}), 404

    result = convert_to_preview(file_path, doc.file_type)
    return jsonify({
        'success': True,
        'preview': result,
        'document': {
            'id': doc.id,
            'name': doc.original_name,
            'file_type': doc.file_type,
            'file_size': doc.file_size,
        },
    })


@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({'error': 'Document not found'}), 404

    doc_name = doc.original_name

    # Delete file
    upload_folder = os.environ.get('UPLOAD_FOLDER', 'uploads')
    file_path = os.path.join(upload_folder, doc.stored_filename)
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except OSError:
        pass

    # Delete record
    db.session.delete(doc)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Document "{doc_name}" deleted',
        'deleted_id': doc_id,
    })


