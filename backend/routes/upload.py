"""Upload routes for handling file uploads and text input."""

import os
import uuid
import re
from functools import lru_cache
from flask import Blueprint, request, jsonify
from youtube_transcript_api import YouTubeTranscriptApi
from config import UPLOAD_FOLDER, ALLOWED_EXTENSIONS
from services.pdf_parser import extract_text_from_pdf, get_pdf_metadata
from services.text_processor import clean_text, get_text_stats
from models import db, Document

upload_bp = Blueprint("upload", __name__)


def _extract_video_id(url):
    """Extract YouTube video ID from various URL formats."""
    if not url:
        return None
    
    # Handle short URLs
    if "youtu.be/" in url:
        # Extract the ID part before any query params or fragments
        path = url.split("youtu.be/")[1]
        return re.split(r"[?#]", path)[0]
    
    # Handle standard URLs
    patterns = [
        r"v=([0-9A-Za-z_-]{11})",
        r"embed\/([0-9A-Za-z_-]{11})",
        r"\/v\/([0-9A-Za-z_-]{11})",
        r"\/vi\/([0-9A-Za-z_-]{11})",
        r"shorts\/([0-9A-Za-z_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
            
    # Final fallback for any 11-char string that looks like an ID
    id_match = re.search(r"([0-9A-Za-z_-]{11})", url)
    return id_match.group(1) if id_match else None


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@upload_bp.route("/api/upload", methods=["POST"])
def upload_file():
    """Handle PDF/TXT file upload, extract text, and return a document ID."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files["file"]
    
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed. Please upload a PDF or TXT file."}), 400
    
    # Save the file
    doc_id = str(uuid.uuid4())
    ext = file.filename.rsplit('.', 1)[1].lower()
    save_path = os.path.join(UPLOAD_FOLDER, f"{doc_id}.{ext}")
    file.save(save_path)
    
    try:
        # Extract text based on file type
        if ext == "pdf":
            text = extract_text_from_pdf(save_path)
            metadata = get_pdf_metadata(save_path)
        else:  # txt
            with open(save_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
            metadata = {"page_count": 0, "title": "", "author": "", "subject": ""}
        
        # Clean and process text
        text = clean_text(text)
        stats = get_text_stats(text)
        
        # Store in database
        new_doc = Document(
            id=doc_id,
            filename=file.filename,
            text=text,
            metadata_json=metadata,
            stats=stats
        )
        db.session.add(new_doc)
        db.session.commit()
        
        return jsonify({
            "document_id": doc_id,
            "filename": file.filename,
            "metadata": metadata,
            "stats": stats,
        }), 200
    
    except ValueError as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 500


@upload_bp.route("/api/text", methods=["POST"])
def upload_text():
    """Handle raw text paste input."""
    data = request.get_json()
    
    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data["text"].strip()
    
    if len(text) < 50:
        return jsonify({"error": "Text is too short. Please provide at least 50 characters."}), 400
    
    if len(text) > 500000:
        return jsonify({"error": "Text is too long. Maximum 500,000 characters allowed."}), 400
    
    # Clean and process text
    text = clean_text(text)
    stats = get_text_stats(text)
    
    doc_id = str(uuid.uuid4())
    title = data.get("title", "Pasted Text")
    
    # Store in database
    new_doc = Document(
        id=doc_id,
        filename=title,
        text=text,
        metadata_json={"page_count": 0, "title": title, "author": "", "subject": ""},
        stats=stats
    )
    db.session.add(new_doc)
    db.session.commit()
    
    return jsonify({
        "document_id": doc_id,
        "filename": title,
        "metadata": {"title": title},
        "stats": stats,
    }), 200


@upload_bp.route("/api/upload/youtube", methods=["POST"])
def upload_youtube():
    """Handle YouTube video transcript extraction."""
    data = request.get_json()

    if not data or "url" not in data:
        return jsonify({"error": "No YouTube URL provided"}), 400

    url = data["url"].strip()
    video_id = _extract_video_id(url)

    if not video_id:
        return jsonify({"error": "Invalid YouTube URL format."}), 400

    print(f"[YouTube] Processing URL: {url} (ID: {video_id})")

    # v1.x API requires instantiation
    ytt_api = YouTubeTranscriptApi()

    try:
        # Primary attempt: fetch English (or auto-detected) transcript
        try:
            print(f"[YouTube] Attempting primary fetch for {video_id}...")
            fetched = ytt_api.fetch(video_id, languages=["en", "en-US", "en-GB"])
            segments = list(fetched)
            print(f"[YouTube] Primary fetch succeeded for {video_id}")

        except Exception as primary_err:
            err_str = str(primary_err)
            print(f"[YouTube] Primary fetch failed: {err_str[:200]}")

            # Rate limiting
            if "Too Many Requests" in err_str or "429" in err_str:
                return jsonify({
                    "error": "YouTube is rate-limiting this server. Please wait 10–15 minutes and try again."
                }), 429

            # Explicit no-transcript errors
            if any(kw in err_str for kw in ["NoTranscriptFound", "TranscriptsDisabled", "No transcript found", "Transcripts are disabled"]):
                return jsonify({"error": "Transcripts are disabled or unavailable for this video."}), 404

            # Fallback: list all available transcripts and grab the first one
            print(f"[YouTube] Trying fallback: listing all transcripts for {video_id}...")
            try:
                transcript_list = ytt_api.list(video_id)
                first_transcript = next(iter(transcript_list))
                fetched = first_transcript.fetch()
                segments = list(fetched)
                print(f"[YouTube] Fallback succeeded using: {first_transcript.language}")
            except Exception as fallback_err:
                fb_str = str(fallback_err)
                if "Too Many Requests" in fb_str or "429" in fb_str:
                    return jsonify({"error": "YouTube rate limit exceeded. Please try again later."}), 429
                if "no element found" in fb_str or "ParseError" in fb_str:
                    return jsonify({"error": "YouTube blocked the transcript request. Please try a different video."}), 403
                return jsonify({"error": f"No transcript available: {fb_str}"}), 404

        # Build text from transcript segments (v1.x uses FetchedTranscript objects)
        text_parts = []
        for seg in segments:
            # Segment may be a dict or a FetchedTranscriptSnippet object
            if isinstance(seg, dict):
                text_parts.append(seg.get("text", ""))
            else:
                text_parts.append(getattr(seg, "text", ""))

        text = " ".join(text_parts).strip()

        if not text:
            return jsonify({"error": "The video transcript appears to be empty."}), 400

        # Process & store
        text = clean_text(text)
        stats = get_text_stats(text)
        doc_id = str(uuid.uuid4())
        title = f"YouTube Video ({video_id})"

        new_doc = Document(
            id=doc_id,
            filename=title,
            text=text,
            metadata_json={"page_count": 0, "title": title, "author": "YouTube", "subject": "Video Transcript"},
            stats=stats,
        )
        db.session.add(new_doc)
        db.session.commit()

        return jsonify({
            "document_id": doc_id,
            "filename": title,
            "metadata": {"title": title},
            "stats": stats,
        }), 200

    except Exception as e:
        error_str = str(e)
        print(f"[YouTube] Unhandled error: {error_str}")
        if "no element found" in error_str or "ParseError" in error_str:
            return jsonify({"error": "YouTube blocked the transcript request. Please try a different video."}), 403
        if "Too Many Requests" in error_str or "429" in error_str:
            return jsonify({"error": "YouTube rate limit exceeded. Please try again later."}), 429
        return jsonify({"error": f"Failed to fetch transcript: {error_str}"}), 500


@upload_bp.route("/api/documents", methods=["GET"])
def list_documents():
    """List all uploaded documents (without full text)."""
    docs = Document.query.all()
    results = []
    for doc in docs:
        results.append({
            "id": doc.id,
            "filename": doc.filename,
            "stats": doc.stats,
        })
    return jsonify(results), 200


@upload_bp.route("/api/documents/<doc_id>", methods=["GET"])
def get_document(doc_id):
    """Get a specific document's info."""
    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    
    return jsonify({
        "id": doc.id,
        "filename": doc.filename,
        "metadata": doc.metadata_json,
        "stats": doc.stats,
        "text_preview": doc.text[:500] + ("..." if len(doc.text) > 500 else ""),
    }), 200


@upload_bp.route("/api/documents/<doc_id>", methods=["DELETE"])
def delete_document(doc_id):
    """Delete a specific document and all its associated data."""
    try:
        doc = Document.query.get(doc_id)
        if not doc:
            return jsonify({"error": "Document not found"}), 404
            
        db.session.delete(doc)
        db.session.commit()
        return jsonify({"success": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete document: {str(e)}"}), 500


@lru_cache(maxsize=32)
def get_document_text(doc_id: str) -> str | None:
    """Helper to retrieve document text by ID (used by generate routes)."""
    # Using a local import to avoid circular dependency if needed, 
    # but here Document is already imported at top level.
    doc = Document.query.get(doc_id)
    return doc.text if doc else None
