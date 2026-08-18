"""Gemini AI integration for generating summaries, flashcards, key points, and quizzes."""

import json
import re
import uuid
import time
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_API_KEYS

# Configure the Gemini API
genai.configure(api_key=GEMINI_API_KEY)

MODEL_PRIORITY = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-pro-latest"]

# Global cache for document text to avoid repeated DB hits
DOCUMENT_TEXT_CACHE = {}


def _generate_with_fallback(prompt: str):
    """Try generating content with model fallback and API key rotation on quota errors."""
    last_error = None
    
    # Iterate through each API key we have
    for key_index, api_key in enumerate(GEMINI_API_KEYS):
        try:
            # Re-configure for the current key
            genai.configure(api_key=api_key)
            
            # For this key, try each model in priority order
            for model_name in MODEL_PRIORITY:
                try:
                    model = genai.GenerativeModel(model_name)
                    response = model.generate_content(prompt)
                    return response.text
                except Exception as e:
                    error_msg = str(e).lower()
                    
                    # If it's a quota error (429), try the next model
                    if "429" in error_msg or "quota" in error_msg:
                        print(f"Key {key_index+1} hit quota for {model_name}, waiting 2s then trying next...")
                        time.sleep(2)
                        last_error = e
                        continue
                    
                    # If it's some other error, raise it immediately
                    raise e
            
            # If we reach here, this key is exhausted for all models
            print(f"API Key {key_index+1} is fully exhausted. Rotating to next key...")
            
        except Exception as e:
            # Catch errors from genai.configure or if all models failed for this key
            last_error = e
            if "429" in str(e) or "quota" in str(e).lower():
                continue
            raise e
            
    # If we tried ALL keys and ALL models and still have a quota error
    if "429" in str(last_error) or "quota" in str(last_error).lower():
        raise ValueError("AI Quota Exceeded: All available Gemini API keys have reached their limits. Please wait a few minutes and try again.")
    raise last_error


def _extract_json(text: str):
    """Extract JSON from a response that might contain markdown code fences."""
    # Try to find JSON in code fences first
    match = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', text)
    if match:
        text = match.group(1)
    
    # Try parsing directly
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find array or object
        for start_char, end_char in [('[', ']'), ('{', '}')]:
            start = text.find(start_char)
            end = text.rfind(end_char)
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start:end + 1])
                except json.JSONDecodeError:
                    continue
        raise ValueError("Could not parse JSON from AI response")


def generate_summary(text: str, length: str = "medium", force: bool = False) -> dict:
    """
    Generate a summary of the given text.
    
    Args:
        text: The source text to summarize.
        length: "short" (~100 words), "medium" (~300 words), or "long" (~600 words).
        force: If True, indicates a regeneration request for a fresh result.
    
    Returns:
        Dict with 'title' and 'summary' keys.
    """
    length_guide = {
        "short": "approximately 80-120 words. Be extremely concise.",
        "medium": "approximately 250-350 words. Cover all major themes.",
        "long": "approximately 500-700 words. Provide comprehensive coverage with examples.",
    }
    
    regen_instr = ""
    if force:
        regen_instr = "- This is a REGENERATION. Provide a fresh perspective or different structure than previous attempts.\n"

    prompt = f"""You are an expert academic summarizer. Analyze the following text and produce a clear, well-structured summary.

REQUIREMENTS:
{regen_instr}- Length: {length_guide.get(length, length_guide['medium'])}
- Use clear paragraph breaks
- Highlight the most important concepts
- Use markdown formatting (bold for key terms, bullet points where appropriate)
- Start with a one-line title that captures the essence of the content

Respond in this exact JSON format:
{{
  "title": "A descriptive title for this content",
  "summary": "The full summary text with markdown formatting"
}}

TEXT TO SUMMARIZE:
{text[:50000]}"""

    response_text = _generate_with_fallback(prompt)
    return _extract_json(response_text)


def generate_key_points(text: str, force: bool = False) -> list[dict]:
    """
    Extract key points from the text.
    
    Returns:
        List of dicts with 'point' and 'detail' keys.
    """
    regen_instr = ""
    if force:
        regen_instr = "- This is a REGENERATION. Focus on different key details or structure the takeaways differently than before.\n"

    prompt = f"""You are an expert at distilling complex content into key takeaways.

Analyze the following text and extract the 8-12 most important key points.

REQUIREMENTS:
{regen_instr}- Order by importance (most important first)
- Each point should be a clear, concise statement (1-2 sentences)
- Include a brief supporting detail or example for each point
- Cover different aspects of the content

Respond in this exact JSON format:
[
  {{
    "point": "Clear, concise key point statement",
    "detail": "A brief supporting explanation or example (1-2 sentences)"
  }}
]

TEXT TO ANALYZE:
{text[:50000]}"""

    response_text = _generate_with_fallback(prompt)
    return _extract_json(response_text)


def generate_flashcards(text: str, force: bool = False) -> list[dict]:
    """
    Generate study flashcards from the text.
    
    Returns:
        List of dicts with 'front' (term/question) and 'back' (definition/answer).
    """
    regen_instr = ""
    if force:
        seed = str(uuid.uuid4())[:8]
        regen_instr = f"- REGENERATION SEED: {seed}\n- CRITICAL: Provide a completely fresh set of cards. Focus on different terminology or deeper concepts than a standard overview would.\n"

    prompt = f"""You are an expert educator creating study flashcards.

Analyze the following text and create 12-18 high-quality flashcards for studying.

REQUIREMENTS:
{regen_instr}- Mix of term-definition pairs and concept-explanation pairs
- Front should be a clear question or term
- Back should be a concise, memorable answer (2-4 sentences max)
- Cover all major topics and concepts
- Progress from foundational to advanced concepts
- Make them useful for active recall practice

Respond in this exact JSON format:
[
  {{
    "front": "Term or question on the front of the card",
    "back": "Definition or answer on the back of the card"
  }}
]

TEXT TO CREATE FLASHCARDS FROM:
{text[:50000]}"""

    response_text = _generate_with_fallback(prompt)
    return _extract_json(response_text)


def generate_quiz(text: str, force: bool = False) -> list[dict]:
    """
    Generate a multiple-choice quiz from the text.
    
    Returns:
        List of dicts with question, options, correctAnswer index, and explanation.
    """
    regen_instr = ""
    if force:
        seed = str(uuid.uuid4())[:8]
        regen_instr = f"- REGENERATION SEED: {seed}\n- CRITICAL: Generate an entirely DIFFERENT set of questions. Avoid the most obvious questions and instead focus on specific facts, supporting arguments, or nuanced details that weren't covered in previous versions.\n"

    prompt = f"""You are an expert test creator designing a multiple-choice quiz.

Analyze the following text and create 10-15 quiz questions.

REQUIREMENTS:
{regen_instr}- Mix of difficulty levels (easy, medium, hard)
- 4 options per question (A, B, C, D)
- Only one correct answer per question
- Include a brief explanation for why the correct answer is right
- Questions should test comprehension, not just memorization
- Cover different sections/topics from the text

Respond in this exact JSON format:
[
  {{
    "question": "The quiz question text?",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "correctAnswer": 0,
    "explanation": "Brief explanation of why this answer is correct",
    "difficulty": "easy"
  }}
]

NOTE: correctAnswer is the zero-based index (0=A, 1=B, 2=C, 3=D).

TEXT TO CREATE QUIZ FROM:
{text[:50000]}"""

    response_text = _generate_with_fallback(prompt)
    return _extract_json(response_text)


def chat_with_document(text: str, query: str, history: list = None) -> str:
    """
    Have a conversation about the document content using System Instructions.
    """
    system_instruction = f"""You are a helpful academic assistant specialized in analyzing the provided document.
    
GUIDELINES:
- Base your answers ONLY on the provided document text.
- If the answer isn't in the text, politely say you don't know based on the document.
- Use clear, professional Markdown formatting.
- Use headers (###) for sections, bold for emphasis, and bullet points for lists.
- Be concise but thorough.

DOCUMENT CONTEXT:
{text[:50000]}"""

    # Format history for Gemini SDK (Full history for maximum accuracy)
    gemini_history = []
    if history:
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg["content"]]})

    try:
        # Try to use the first model with system instructions
        model_name = MODEL_PRIORITY[0]
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_instruction
        )
        
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(query)
        return response.text
    except Exception as e:
        # Fallback to standard prompt method if system instructions or start_chat fails
        print(f"Chat optimization failed, falling back: {str(e)}")
        
        history_str = ""
        if history:
            for msg in history:
                role = "User" if msg["role"] == "user" else "Assistant"
                history_str += f"{role}: {msg['content']}\n"
        
        prompt = f"""{system_instruction}

CONVERSATION HISTORY:
{history_str}

USER QUESTION:
{query}

ASSISTANT RESPONSE:"""
        return _generate_with_fallback(prompt)


def generate_mindmap(text: str, force: bool = False) -> str:
    """
    Generate a mind map from the text using Mermaid.js syntax.
    
    Returns:
        String containing raw Mermaid code.
    """
    regen_instr = ""
    if force:
        regen_instr = "- This is a REGENERATION. Try a different layout or highlight different connections than a standard map.\n"

    prompt = f"""You are an expert at visually structuring information. Analyze the following text and create a mind map representing the core concepts and their relationships.

REQUIREMENTS:
{regen_instr}- Output ONLY valid Mermaid.js code.
- Use either 'mindmap' syntax (e.g., `mindmap \n root \n   child1 \n   child2`) or 'graph TD' (flowchart) syntax.
- Keep node labels concise (1-4 words).
- Capture the hierarchical structure of the document (Main topic -> Subtopics -> Key details).
- Do not include any explanation, just the raw markdown code block containing the mermaid code.

Respond in this exact format:
```mermaid
mindmap
  root((Main Topic))
    Subtopic 1
      Detail A
      Detail B
    Subtopic 2
```

TEXT TO MAP:
{text[:30000]}"""

    response_text = _generate_with_fallback(prompt)
    
    # Extract the mermaid code from the response
    match = re.search(r'```mermaid\s*\n?([\s\S]*?)\n?```', response_text)
    if match:
        return match.group(1).strip()
    
    # Fallback: if they just returned the code without the block, or with a different block
    match = re.search(r'```(?:\w*)?\s*\n?([\s\S]*?)\n?```', response_text)
    if match:
        return match.group(1).strip()
        
    return response_text.strip()


def generate_qa(text: str, force: bool = False) -> list[dict]:
    """
    Generate a set of Q&A pairs (study questions with full answers) from the text.

    Returns:
        List of dicts with 'question', 'answer', and 'category' keys.
    """
    regen_instr = ""
    if force:
        seed = str(uuid.uuid4())[:8]
        regen_instr = f"- REGENERATION SEED: {seed}\n- Generate a FRESH set of questions. Explore different angles, sub-topics, or deeper details not covered before.\n"

    prompt = f"""You are an expert educator creating comprehensive study Q&A pairs.

Analyze the following text and generate 12-18 insightful question-and-answer pairs.

REQUIREMENTS:
{regen_instr}- Group questions into 2-4 thematic categories (e.g., "Core Concepts", "Applications", "Key Figures", "Critical Analysis")
- Each question should be clear, specific, and thought-provoking
- Each answer should be comprehensive (3-6 sentences), accurate, and written in plain prose
- Mix of factual recall, conceptual understanding, and analytical questions
- Cover different sections/topics from the document
- Answers should be self-contained (reader doesn't need to re-read the doc)

Respond in this exact JSON format:
[
  {{
    "category": "Core Concepts",
    "question": "Clear, specific study question?",
    "answer": "Comprehensive answer in plain prose, 3-6 sentences."
  }}
]

TEXT TO CREATE Q&A FROM:
{text[:50000]}"""

    response_text = _generate_with_fallback(prompt)
    return _extract_json(response_text)

