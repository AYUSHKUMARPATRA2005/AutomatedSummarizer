"""PDF text extraction using PyMuPDF (fitz)."""

import fitz  # PyMuPDF


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract all text content from a PDF file.
    
    Args:
        file_path: Path to the PDF file.
    
    Returns:
        Extracted text as a single string.
    """
    text_parts = []
    
    try:
        doc = fitz.open(file_path)
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            page_text = page.get_text("text")
            
            if page_text.strip():
                text_parts.append(page_text.strip())
        
        doc.close()
    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {str(e)}")
    
    if not text_parts:
        raise ValueError("No text content found in the PDF. The file may be image-based or empty.")
    
    return "\n\n".join(text_parts)


def get_pdf_metadata(file_path: str) -> dict:
    """Extract basic metadata from a PDF file."""
    try:
        doc = fitz.open(file_path)
        metadata = {
            "page_count": len(doc),
            "title": doc.metadata.get("title", ""),
            "author": doc.metadata.get("author", ""),
            "subject": doc.metadata.get("subject", ""),
        }
        doc.close()
        return metadata
    except Exception:
        return {"page_count": 0, "title": "", "author": "", "subject": ""}
