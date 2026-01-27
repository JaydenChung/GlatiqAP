"""
Database Tools
==============
SQLite database operations for inventory management.

Provides:
- Database initialization with test data
- Inventory queries for validation agent
- Stock level checks

Test Data (from MISSION.md):
- WidgetA: 15 in stock
- WidgetB: 10 in stock
- GadgetX: 5 in stock
- FakeItem: 0 in stock (fraud test)
"""

import sqlite3
import os
from typing import Optional
from contextlib import contextmanager

# Database path relative to project root
DATABASE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "inventory.db"
)


# =============================================================================
# DATABASE CONNECTION
# =============================================================================

@contextmanager
def get_connection():
    """
    Context manager for database connections.
    
    Usage:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM inventory")
    """
    # Ensure data directory exists
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Enable dict-like access
    try:
        yield conn
    finally:
        conn.close()


# =============================================================================
# INITIALIZATION
# =============================================================================

def init_database(force_reset: bool = False) -> None:
    """
    Initialize the database with schema and test data.
    
    Args:
        force_reset: If True, drop and recreate tables
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        
        if force_reset:
            cursor.execute("DROP TABLE IF EXISTS inventory")
        
        # Create inventory table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                item TEXT PRIMARY KEY,
                stock INTEGER NOT NULL,
                unit_price REAL DEFAULT 100.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert test data (UPSERT pattern for idempotency)
        test_inventory = [
            ("WidgetA", 15, 100.0),   # Invoice 1 needs 10
            ("WidgetB", 10, 150.0),   # Invoice 1 needs 5
            ("GadgetX", 5, 500.0),    # Invoice 2 needs 20 (will fail!)
            ("FakeItem", 0, 999.0),   # Invoice 3 (fraud) - 0 stock
        ]
        
        for item, stock, price in test_inventory:
            cursor.execute("""
                INSERT OR REPLACE INTO inventory (item, stock, unit_price)
                VALUES (?, ?, ?)
            """, (item, stock, price))
        
        conn.commit()
        
    print(f"✅ Database initialized at: {DATABASE_PATH}")


# =============================================================================
# INVENTORY QUERIES
# =============================================================================

def check_stock(item_name: str) -> Optional[dict]:
    """
    Check stock level for a single item.
    
    Args:
        item_name: Name of the inventory item
        
    Returns:
        Dict with item details, or None if not found
        
    Example:
        >>> check_stock("WidgetA")
        {"item": "WidgetA", "stock": 15, "unit_price": 100.0}
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT item, stock, unit_price FROM inventory WHERE item = ?",
            (item_name,)
        )
        row = cursor.fetchone()
        
        if row:
            return {
                "item": row["item"],
                "stock": row["stock"],
                "unit_price": row["unit_price"],
            }
        return None


def check_multiple_items(item_names: list[str]) -> dict[str, dict]:
    """
    Check stock levels for multiple items.
    
    Args:
        item_names: List of item names to check
        
    Returns:
        Dict mapping item name to stock info
        Missing items have None value
        
    Example:
        >>> check_multiple_items(["WidgetA", "FakeItem", "Unknown"])
        {
            "WidgetA": {"item": "WidgetA", "stock": 15, ...},
            "FakeItem": {"item": "FakeItem", "stock": 0, ...},
            "Unknown": None
        }
    """
    results = {}
    for name in item_names:
        results[name] = check_stock(name)
    return results


def validate_inventory(items: list[dict]) -> dict:
    """
    Validate a list of invoice items against inventory.
    
    Args:
        items: List of dicts with 'name' and 'quantity' keys
        
    Returns:
        Dict with validation results per item:
        {
            "item_name": {
                "requested": int,
                "in_stock": int,
                "available": bool
            }
        }
        
    Example:
        >>> validate_inventory([{"name": "WidgetA", "quantity": 10}])
        {"WidgetA": {"requested": 10, "in_stock": 15, "available": True}}
    """
    results = {}
    
    for item in items:
        name = item.get("name", "")
        requested = item.get("quantity", 0)
        
        stock_info = check_stock(name)
        
        if stock_info:
            in_stock = stock_info["stock"]
            available = in_stock >= requested
        else:
            in_stock = 0
            available = False
        
        results[name] = {
            "requested": requested,
            "in_stock": in_stock,
            "available": available,
        }
    
    return results


def get_all_inventory() -> list[dict]:
    """
    Get all inventory items.
    
    Returns:
        List of all inventory items with stock levels
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT item, stock, unit_price FROM inventory ORDER BY item")
        
        return [
            {
                "item": row["item"],
                "stock": row["stock"],
                "unit_price": row["unit_price"],
            }
            for row in cursor.fetchall()
        ]


# =============================================================================
# MAIN (for testing)
# =============================================================================

if __name__ == "__main__":
    print()
    print("╔" + "═" * 58 + "╗")
    print("║" + "  DATABASE INITIALIZATION".center(58) + "║")
    print("╚" + "═" * 58 + "╝")
    print()
    
    # Initialize (or reinitialize) the database
    init_database(force_reset=True)
    
    # Show current inventory
    print()
    print("📦 Current Inventory:")
    print("─" * 40)
    for item in get_all_inventory():
        print(f"   {item['item']}: {item['stock']} units @ ${item['unit_price']:.2f}")
    
    # Test validation function
    print()
    print("🔍 Testing validation_inventory():")
    print("─" * 40)
    test_items = [
        {"name": "WidgetA", "quantity": 10},  # Should pass
        {"name": "GadgetX", "quantity": 20},  # Should fail (only 5 in stock)
        {"name": "FakeItem", "quantity": 1},  # Should fail (0 in stock)
        {"name": "Unknown", "quantity": 5},   # Should fail (not found)
    ]
    
    results = validate_inventory(test_items)
    for name, result in results.items():
        status = "✅" if result["available"] else "❌"
        print(f"   {status} {name}: need {result['requested']}, have {result['in_stock']}")
    
    print()
    print("✅ Database setup complete!")
