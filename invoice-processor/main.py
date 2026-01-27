#!/usr/bin/env python3
"""
Invoice Processing System
=========================
Multi-agent invoice processing using xAI Grok and LangGraph.

Usage:
    python main.py                    # Process all test invoices
    python main.py invoice1.txt       # Process specific invoice
"""

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent))


def main():
    """Main entry point for invoice processing."""
    print("=" * 60)
    print("  INVOICE PROCESSING SYSTEM")
    print("  Multi-Agent Pipeline with xAI Grok")
    print("=" * 60)
    print()
    
    # For now, just verify the client works
    from src.client import test_connection
    
    print("Phase 1A: Verifying Grok Connection")
    print("-" * 40)
    test_connection()
    
    print()
    print("✅ Setup complete! Ready for Phase 1B (LangGraph skeleton)")


if __name__ == "__main__":
    main()
