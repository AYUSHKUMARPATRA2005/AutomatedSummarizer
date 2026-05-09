"""Text preprocessing and chunking utilities."""

import re


def clean_text(text: str) -> str:
    """
    Clean and normalize extracted text.
    
    - Removes excessive whitespace
    - Removes page numbers / headers / footers patterns
    - Normalizes line breaks
    """
    # Remove common header/footer patterns (page numbers, etc.)
    text = re.sub(r'\n\s*\d+\s*\n', '\n', text)
    
    # Collapse multiple blank lines into two
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Collapse multiple spaces into one
    text = re.sub(r'[ \t]+', ' ', text)
    
    # Strip leading/trailing whitespace from each line
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)
    
    return text.strip()


def chunk_text(text: str, max_chars: int = 30000) -> list[str]:
    """
    Split text into chunks that fit within token limits.
    
    Tries to split at paragraph boundaries for coherence.
    ~30,000 chars ≈ ~7,500 tokens (safe for Gemini's context window).
    
    Args:
        text: The full text to chunk.
        max_chars: Maximum characters per chunk.
    
    Returns:
        List of text chunks.
    """
    if len(text) <= max_chars:
        return [text]
    
    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = []
    current_length = 0
    
    for para in paragraphs:
        para_len = len(para)
        
        if current_length + para_len + 2 > max_chars:
            if current_chunk:
                chunks.append('\n\n'.join(current_chunk))
            current_chunk = [para]
            current_length = para_len
        else:
            current_chunk.append(para)
            current_length += para_len + 2
    
    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))
    
    return chunks


def get_text_stats(text: str) -> dict:
    """Get basic statistics about the text."""
    words = text.split()
    sentences = re.split(r'[.!?]+', text)
    paragraphs = [p for p in text.split('\n\n') if p.strip()]
    
    return {
        "character_count": len(text),
        "word_count": len(words),
        "sentence_count": len([s for s in sentences if s.strip()]),
        "paragraph_count": len(paragraphs),
        "estimated_read_time_minutes": max(1, len(words) // 250),
    }
