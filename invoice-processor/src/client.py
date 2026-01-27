"""
Grok API Client
===============
Centralized client for xAI's Grok LLM.

Usage:
    from src.client import client, MODEL, test_connection
    
    # Test that Grok is working
    test_connection()
    
    # Make API calls
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "Hello"}]
    )
"""

import os
import sys
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Validate API key exists
api_key = os.environ.get("XAI_API_KEY")
if not api_key:
    print("❌ ERROR: XAI_API_KEY not found in environment")
    print("   Please create a .env file with: XAI_API_KEY=your-key-here")
    sys.exit(1)

# Initialize the OpenAI-compatible client for xAI
client = OpenAI(
    api_key=api_key,
    base_url="https://api.x.ai/v1"
)

# Model to use (can be overridden via environment)
# Note: grok-beta deprecated 2025-09-15
# Using grok-4-1-fast-reasoning: latest, fast, $0.20/M tokens
MODEL = os.environ.get("GROK_MODEL", "grok-4-1-fast-reasoning")

# Token usage tracking (updated after each call_grok)
# Access via get_last_usage() or reset_usage_tracking()
_usage_tracking = {
    "last_call": None,
    "total": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    "calls": []
}


def get_last_usage() -> dict | None:
    """Get token usage from the last Grok call."""
    return _usage_tracking["last_call"]


def get_total_usage() -> dict:
    """Get cumulative token usage across all calls since last reset."""
    return _usage_tracking["total"].copy()


def get_all_usage() -> list:
    """Get list of all usage records since last reset."""
    return _usage_tracking["calls"].copy()


def reset_usage_tracking():
    """Reset usage tracking (call at start of new workflow)."""
    _usage_tracking["last_call"] = None
    _usage_tracking["total"] = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    _usage_tracking["calls"] = []


def test_connection() -> bool:
    """
    Test that the Grok API connection works.
    
    Returns:
        True if connection successful, exits on failure.
    """
    print("🔌 Testing Grok API connection...")
    print(f"   Model: {MODEL}")
    print(f"   Base URL: https://api.x.ai/v1")
    print()
    
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "user", 
                    "content": "Respond with exactly: 'Grok is ready for invoice processing'"
                }
            ],
            max_tokens=50
        )
        
        reply = response.choices[0].message.content
        print(f"✅ Grok responded: {reply}")
        print()
        print("🚀 CHECKPOINT 1 PASSED: Grok connection verified!")
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print()
        print("Troubleshooting:")
        print("  1. Check your XAI_API_KEY is valid")
        print("  2. Ensure you have API access at https://x.ai")
        print("  3. Check your network connection")
        sys.exit(1)


def call_grok(
    messages: list,
    json_mode: bool = False,
    max_tokens: int = 1000,
    return_usage: bool = False
) -> str | tuple[str, dict]:
    """
    Convenience wrapper for Grok API calls.
    
    Args:
        messages: List of message dicts with 'role' and 'content'
        json_mode: If True, request JSON-formatted response
        max_tokens: Maximum tokens in response
        return_usage: If True, return (content, usage_dict) tuple
        
    Returns:
        If return_usage=False: The assistant's response content as a string
        If return_usage=True: Tuple of (content, usage_dict)
            where usage_dict has prompt_tokens, completion_tokens, total_tokens
    """
    kwargs = {
        "model": MODEL,
        "messages": messages,
        "max_tokens": max_tokens
    }
    
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    
    response = client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content
    
    # Track usage automatically
    usage = {
        "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
        "completion_tokens": response.usage.completion_tokens if response.usage else 0,
        "total_tokens": response.usage.total_tokens if response.usage else 0,
    }
    
    _usage_tracking["last_call"] = usage
    _usage_tracking["calls"].append(usage)
    _usage_tracking["total"]["prompt_tokens"] += usage["prompt_tokens"]
    _usage_tracking["total"]["completion_tokens"] += usage["completion_tokens"]
    _usage_tracking["total"]["total_tokens"] += usage["total_tokens"]
    
    if return_usage:
        return content, usage
    
    return content


# When run directly, test the connection
if __name__ == "__main__":
    print("=" * 60)
    print("  INVOICE PROCESSOR - GROK CONNECTION TEST")
    print("=" * 60)
    print()
    test_connection()
