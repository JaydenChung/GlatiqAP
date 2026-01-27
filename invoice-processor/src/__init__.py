# Invoice Processing System
# Multi-agent workflow using xAI Grok and LangGraph

import sys
from pathlib import Path

# Ensure the project root is in Python path for clean imports
# This centralizes the path setup that was previously duplicated across files
_project_root = Path(__file__).parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))
