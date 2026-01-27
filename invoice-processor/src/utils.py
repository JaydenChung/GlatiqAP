"""
Shared Utilities
================
Common utility functions used across multiple agents.

Created: Session 2026-01-26_PHOENIX
Purpose: DRY - Extract duplicated code from agents
"""


def clean_json_response(response: str) -> str:
    """
    Clean LLM response to extract pure JSON.
    
    Handles common LLM output issues:
    - Markdown code fences (```json...```)
    - Leading/trailing whitespace
    - Explanatory text before/after JSON
    
    Args:
        response: Raw response string from LLM
        
    Returns:
        Cleaned JSON string ready for parsing
    """
    text = response.strip()
    
    # Remove markdown code fences if present
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    
    # Find JSON object boundaries
    start = text.find("{")
    end = text.rfind("}") + 1
    
    if start != -1 and end > start:
        text = text[start:end]
    
    return text


def safe_get(data: dict, key: str, default):
    """
    Safely get a value from a dict with type-appropriate default.
    
    Args:
        data: Dictionary to get value from
        key: Key to look up
        default: Default value if key missing or value is None
        
    Returns:
        Value from dict or default
    """
    value = data.get(key)
    if value is None:
        return default
    return value
