#!/usr/bin/env python3
"""
Run the Invoice Processing API Server
=====================================

Usage:
    python run_api.py

Server will start at http://localhost:8000

Created: Session 2026-01-26_CONNECT
"""

import uvicorn

if __name__ == "__main__":
    print()
    print("🚀 Starting Invoice Processing API...")
    print("   Server: http://localhost:8000")
    print("   WebSocket: ws://localhost:8000/ws/process")
    print()
    
    uvicorn.run(
        "api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )

