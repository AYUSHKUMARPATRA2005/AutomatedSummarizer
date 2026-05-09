from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid

db = SQLAlchemy()

class Document(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = db.Column(db.String(255), nullable=False)
    text = db.Column(db.Text, nullable=False)
    metadata_json = db.Column(db.JSON) # page_count, title, author, etc.
    stats = db.Column(db.JSON)        # word_count, read_time, etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    summaries = db.relationship('Summary', backref='document', lazy=True, cascade="all, delete-orphan")
    flashcards = db.relationship('Flashcard', backref='document', lazy=True, cascade="all, delete-orphan")
    quizzes = db.relationship('QuizQuestion', backref='document', lazy=True, cascade="all, delete-orphan")
    chat_history = db.relationship('ChatMessage', backref='document', lazy=True, cascade="all, delete-orphan")
    mindmaps = db.relationship('Mindmap', backref='document', lazy=True, cascade="all, delete-orphan")
    qa_items = db.relationship('QAItem', backref='document', lazy=True, cascade="all, delete-orphan")
    keypoints = db.relationship('KeyPoint', backref='document', lazy=True, cascade="all, delete-orphan")

class Mindmap(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.String(36), db.ForeignKey('document.id'), nullable=False)
    mermaid_code = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Summary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.String(36), db.ForeignKey('document.id'), nullable=False)
    length = db.Column(db.String(20), nullable=False) # short, medium, long
    title = db.Column(db.String(255))
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Flashcard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.String(36), db.ForeignKey('document.id'), nullable=False)
    front = db.Column(db.Text, nullable=False)
    back = db.Column(db.Text, nullable=False)

class QuizQuestion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.String(36), db.ForeignKey('document.id'), nullable=False)
    question = db.Column(db.Text, nullable=False)
    options = db.Column(db.JSON, nullable=False) # List of 4 strings
    correct_answer = db.Column(db.Integer, nullable=False) # Index 0-3
    explanation = db.Column(db.Text)
    difficulty = db.Column(db.String(20))

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.String(36), db.ForeignKey('document.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False) # user, assistant
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class QAItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.String(36), db.ForeignKey('document.id'), nullable=False)
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100))
    order_index = db.Column(db.Integer, default=0)

class KeyPoint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.String(36), db.ForeignKey('document.id'), nullable=False)
    point = db.Column(db.Text, nullable=False)
    detail = db.Column(db.Text, nullable=False)
    order_index = db.Column(db.Integer, default=0)

