"""Generation routes for AI-powered content generation."""

from flask import Blueprint, request, jsonify
from services.ai_engine import (
    generate_summary,
    generate_key_points,
    generate_flashcards,
    generate_quiz,
    generate_mindmap,
    generate_qa
)
from routes.upload import get_document_text
from models import db, Document, Summary, Flashcard, QuizQuestion, ChatMessage, Mindmap, QAItem, KeyPoint

generate_bp = Blueprint("generate", __name__)


@generate_bp.route("/api/generate/summary", methods=["POST"])
def api_generate_summary():
    """Generate a summary for a document."""
    data = request.get_json()
    
    if not data or "document_id" not in data:
        return jsonify({"error": "document_id is required"}), 400
    
    doc_id = data["document_id"]
    length = data.get("length", "medium")
    force = data.get("force", False)
    
    if length not in ("short", "medium", "long"):
        length = "medium"
    
    # Check cache (skip if force is True)
    existing = Summary.query.filter_by(document_id=doc_id, length=length).first()
    if existing and not force:
        return jsonify({"title": existing.title, "summary": existing.content}), 200
    
    doc_text = get_document_text(doc_id)
    if doc_text is None:
        return jsonify({"error": "Document not found"}), 404
    
    try:
        result = generate_summary(doc_text, length=length, force=force)
        
        # Save to cache (update if existing and force)
        if existing and force:
            existing.title = result.get("title", "")
            existing.content = result.get("summary", "")
            existing.created_at = db.func.now()
        else:
            new_summary = Summary(
                document_id=doc_id,
                length=length,
                title=result.get("title", ""),
                content=result.get("summary", "")
            )
            db.session.add(new_summary)
            
        db.session.commit()
        
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": f"Failed to generate summary: {str(e)}"}), 500


@generate_bp.route("/api/generate/keypoints", methods=["POST"])
def api_generate_keypoints():
    """Generate key points for a document."""
    data = request.get_json()
    
    if not data or "document_id" not in data:
        return jsonify({"error": "document_id is required"}), 400
    
    doc_id = data["document_id"]
    force = data.get("force", False)
    
    # Check cache
    existing = KeyPoint.query.filter_by(document_id=doc_id).order_by(KeyPoint.order_index).all()
    if existing and not force:
        return jsonify({"keypoints": [
            {"point": k.point, "detail": k.detail} for k in existing
        ]}), 200
        
    doc_text = get_document_text(doc_id)
    if doc_text is None:
        return jsonify({"error": "Document not found"}), 404
    
    try:
        result = generate_key_points(doc_text, force=force)
        
        # Save to DB
        if existing and force:
            for k in existing:
                db.session.delete(k)
                
        for idx, item in enumerate(result):
            kp = KeyPoint(
                document_id=doc_id,
                point=item["point"],
                detail=item.get("detail", ""),
                order_index=idx
            )
            db.session.add(kp)
        db.session.commit()
        
        return jsonify({"keypoints": result}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to generate key points: {str(e)}"}), 500


@generate_bp.route("/api/generate/flashcards", methods=["POST"])
def api_generate_flashcards():
    """Generate flashcards for a document."""
    data = request.get_json()
    
    if not data or "document_id" not in data:
        return jsonify({"error": "document_id is required"}), 400
    
    doc_id = data["document_id"]
    force = data.get("force", False)
    
    # Check cache
    existing = Flashcard.query.filter_by(document_id=doc_id).all()
    if existing and not force:
        return jsonify({"flashcards": [{"front": f.front, "back": f.back} for f in existing]}), 200
    
    doc_text = get_document_text(doc_id)
    if doc_text is None:
        return jsonify({"error": "Document not found"}), 404
    
    try:
        result = generate_flashcards(doc_text, force=force)
        
        # Save to cache (clear old ones if force)
        if existing and force:
            for f in existing:
                db.session.delete(f)
        
        for card in result:
            new_card = Flashcard(
                document_id=doc_id,
                front=card["front"],
                back=card["back"]
            )
            db.session.add(new_card)
        db.session.commit()
        
        return jsonify({"flashcards": result}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to generate flashcards: {str(e)}"}), 500


@generate_bp.route("/api/generate/quiz", methods=["POST"])
def api_generate_quiz():
    """Generate a quiz for a document."""
    data = request.get_json()
    
    if not data or "document_id" not in data:
        return jsonify({"error": "document_id is required"}), 400
    
    doc_id = data["document_id"]
    force = data.get("force", False)
    
    # Check cache
    existing = QuizQuestion.query.filter_by(document_id=doc_id).all()
    if existing and not force:
        return jsonify({"quiz": [{
            "question": q.question,
            "options": q.options,
            "correctAnswer": q.correct_answer,
            "explanation": q.explanation,
            "difficulty": q.difficulty
        } for q in existing]}), 200
    
    doc_text = get_document_text(doc_id)
    if doc_text is None:
        return jsonify({"error": "Document not found"}), 404
    
    try:
        result = generate_quiz(doc_text, force=force)
        
        # Save to cache (clear old ones if force)
        if existing and force:
            for q in existing:
                db.session.delete(q)
                
        for q in result:
            new_q = QuizQuestion(
                document_id=doc_id,
                question=q["question"],
                options=q["options"],
                correct_answer=q["correctAnswer"],
                explanation=q.get("explanation", ""),
                difficulty=q.get("difficulty", "medium")
            )
            db.session.add(new_q)
        db.session.commit()
        
        return jsonify({"quiz": result}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to generate quiz: {str(e)}"}), 500


@generate_bp.route("/api/generate/chat", methods=["POST"])
def api_generate_chat():
    """Chat with a document."""
    data = request.get_json()
    
    if not data or "document_id" not in data or "message" not in data:
        return jsonify({"error": "document_id and message are required"}), 400
    
    doc_id = data["document_id"]
    doc_text = get_document_text(doc_id)
    if doc_text is None:
        return jsonify({"error": "Document not found"}), 404
    
    # Load history from DB if not provided
    history = data.get("history", [])
    if not history:
        past_msgs = ChatMessage.query.filter_by(document_id=doc_id).order_by(ChatMessage.created_at).all()
        history = [{"role": m.role, "content": m.content} for m in past_msgs]
    
    try:
        from services.ai_engine import chat_with_document
        response = chat_with_document(doc_text, data["message"], history)
        
        # Save both messages to DB
        user_msg = ChatMessage(document_id=doc_id, role="user", content=data["message"])
        ai_msg = ChatMessage(document_id=doc_id, role="assistant", content=response)
        db.session.add(user_msg)
        db.session.add(ai_msg)
        db.session.commit()
        
        return jsonify({"response": response}), 200
    except Exception as e:
        return jsonify({"error": f"Chat failed: {str(e)}"}), 500


@generate_bp.route("/api/generate/mindmap", methods=["POST"])
def api_generate_mindmap():
    """Generate a mind map for a document."""
    data = request.get_json()
    
    if not data or "document_id" not in data:
        return jsonify({"error": "document_id is required"}), 400
    
    doc_id = data["document_id"]
    force = data.get("force", False)
    
    # Check cache
    existing = Mindmap.query.filter_by(document_id=doc_id).first()
    if existing and not force:
        return jsonify({"mermaid_code": existing.mermaid_code}), 200
    
    doc_text = get_document_text(doc_id)
    if doc_text is None:
        return jsonify({"error": "Document not found"}), 404
    
    try:
        mermaid_code = generate_mindmap(doc_text, force=force)
        
        # Save to cache (update if existing and force)
        if existing and force:
            existing.mermaid_code = mermaid_code
            existing.created_at = db.func.now()
        else:
            new_mindmap = Mindmap(
                document_id=doc_id,
                mermaid_code=mermaid_code
            )
            db.session.add(new_mindmap)
            
        db.session.commit()
        
        return jsonify({"mermaid_code": mermaid_code}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to generate mind map: {str(e)}"}), 500


@generate_bp.route("/api/documents/<doc_id>/export", methods=["GET"])
def export_document_data(doc_id):
    """Retrieve all cached generation data for exporting (0 API cost)."""
    # Fetch Document
    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    # Fetch Summary (prefer long, then medium, then short)
    summary = None
    for length in ["long", "medium", "short"]:
        summary_record = Summary.query.filter_by(document_id=doc_id, length=length).first()
        if summary_record:
            summary = {
                "title": summary_record.title,
                "content": summary_record.content,
                "length": length
            }
            break

    # Fetch Keypoints
    keypoints = []
    kp_records = KeyPoint.query.filter_by(document_id=doc_id).order_by(KeyPoint.order_index).all()
    for kp in kp_records:
        keypoints.append({
            "point": kp.point,
            "detail": kp.detail
        })

    # Fetch Flashcards
    flashcards = []
    flashcards_records = Flashcard.query.filter_by(document_id=doc_id).all()
    for fc in flashcards_records:
        flashcards.append({
            "front": fc.front,
            "back": fc.back
        })

    # Fetch Q&A
    qa_items = []
    qa_records = QAItem.query.filter_by(document_id=doc_id).order_by(QAItem.order_index).all()
    for q in qa_records:
        qa_items.append({
            "question": q.question,
            "answer": q.answer,
            "category": q.category
        })

    # Fetch Quiz
    quiz_items = []
    quiz_records = QuizQuestion.query.filter_by(document_id=doc_id).all()
    for q in quiz_records:
        quiz_items.append({
            "question": q.question,
            "options": q.options,
            "correctAnswer": q.correct_answer,
            "explanation": q.explanation
        })

    return jsonify({
        "document_id": doc_id,
        "filename": doc.filename,
        "summary": summary,
        "keypoints": keypoints,
        "flashcards": flashcards,
        "qa": qa_items,
        "quiz": quiz_items
    }), 200


@generate_bp.route("/api/generate/qa", methods=["POST"])
def api_generate_qa():
    """Generate Q&A pairs for a document."""
    data = request.get_json()

    if not data or "document_id" not in data:
        return jsonify({"error": "document_id is required"}), 400

    doc_id = data["document_id"]
    force = data.get("force", False)

    # Check cache
    existing = QAItem.query.filter_by(document_id=doc_id).order_by(QAItem.order_index).all()
    if existing and not force:
        return jsonify({"qa": [
            {"question": q.question, "answer": q.answer, "category": q.category}
            for q in existing
        ]}), 200

    doc_text = get_document_text(doc_id)
    if doc_text is None:
        return jsonify({"error": "Document not found"}), 404

    try:
        result = generate_qa(doc_text, force=force)

        # Clear old items if regenerating
        if existing and force:
            for item in existing:
                db.session.delete(item)

        for idx, item in enumerate(result):
            new_qa = QAItem(
                document_id=doc_id,
                question=item["question"],
                answer=item["answer"],
                category=item.get("category", "General"),
                order_index=idx
            )
            db.session.add(new_qa)
        db.session.commit()

        return jsonify({"qa": result}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to generate Q&A: {str(e)}"}), 500
