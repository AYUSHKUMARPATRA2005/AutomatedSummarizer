"""
Book Summarizer — Flask Backend
Provides API endpoints for uploading text/PDFs and generating AI-powered study aids.
Also serves the frontend static files.
"""

import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from config import FLASK_PORT, MAX_CONTENT_LENGTH, DATA_DIR
from routes.upload import upload_bp
from routes.generate import generate_bp
from models import db

# Frontend directory (one level up from backend)
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
# Database Configuration
# Priority: DATABASE_URL (for Render/Production) > Local SQLite
database_url = os.getenv("DATABASE_URL")
if database_url and database_url.startswith("postgres://"):
    # SQLAlchemy requires "postgresql://" instead of "postgres://"
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url or ("sqlite:///" + os.path.join(DATA_DIR, "app.db"))
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize DB
db.init_app(app)

# Create tables
with app.app_context():
    db.create_all()

# Enable CORS for all origins during development
CORS(app)

# Register route blueprints
app.register_blueprint(upload_bp)
app.register_blueprint(generate_bp)


@app.route("/api/health", methods=["GET"])
def health_check():
    return {"status": "ok", "service": "BookSummarizer API"}, 200


@app.route("/")
def serve_frontend():
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "False").lower() in ("true", "1", "t")
    print(f"Book Summarizer running on http://localhost:{FLASK_PORT}")
    print(f"Serving frontend from {FRONTEND_DIR}")
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=debug_mode)
