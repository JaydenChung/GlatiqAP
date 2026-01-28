"""
Database Tools
==============
SQLite database operations for inventory and vendor management.

Provides:
- Database initialization with test data
- Inventory queries for validation agent
- Stock level checks
- Vendor master data for enrichment and validation
- Purchase order tracking (future)

Test Data (from MISSION.md):
- WidgetA: 15 in stock
- WidgetB: 10 in stock
- GadgetX: 5 in stock
- FakeItem: 0 in stock (fraud test)

Vendor Master (Session 2026-01-27_PERSIST):
- Widgets Inc. (VND-001) - Test Invoice 1 vendor
- Gadgets Co. (VND-002) - Test Invoice 2 vendor
- Fraudster LLC (VND-003) - Suspicious/suspended vendor
"""

import sqlite3
import os
import json
from typing import Optional, List
from contextlib import contextmanager
from datetime import datetime

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
            cursor.execute("DROP TABLE IF EXISTS vendors")
            cursor.execute("DROP TABLE IF EXISTS purchase_orders")
        
        # Create inventory table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                item TEXT PRIMARY KEY,
                stock INTEGER NOT NULL,
                unit_price REAL DEFAULT 100.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # =============================================================================
        # VENDOR MASTER TABLE (Session 2026-01-27_PERSIST)
        # =============================================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vendors (
                vendor_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                aliases TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                city TEXT,
                state TEXT,
                zip_code TEXT,
                country TEXT DEFAULT 'USA',
                currency TEXT DEFAULT 'USD',
                payment_method TEXT DEFAULT 'ACH Transfer',
                payment_terms TEXT DEFAULT 'Net 30',
                tax_id TEXT,
                bank_account TEXT,
                bank_routing TEXT,
                compliance_status TEXT DEFAULT 'complete',
                contract_status TEXT DEFAULT 'active',
                contract_renewal TEXT,
                risk_level TEXT DEFAULT 'low',
                erp_sync_status TEXT DEFAULT 'synced',
                notes TEXT,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # =============================================================================
        # PURCHASE ORDERS TABLE (for future 3-way matching)
        # =============================================================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS purchase_orders (
                po_number TEXT PRIMARY KEY,
                vendor_id TEXT,
                order_date TEXT,
                expected_delivery TEXT,
                total_amount REAL,
                status TEXT DEFAULT 'open',
                line_items TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id)
            )
        """)
        
        # Insert test inventory data (UPSERT pattern for idempotency)
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
        
        # =============================================================================
        # VENDOR TEST DATA - Realistic profiles for test invoices
        # =============================================================================
        test_vendors = [
            {
                "vendor_id": "VND-001",
                "name": "Widgets Inc.",
                "aliases": json.dumps(["Widgets", "Widgets Incorporated", "Widgets Inc"]),
                "phone": "(555) 123-4567",
                "email": "ap@widgets-inc.com",
                "address": "1234 Innovation Drive, Suite 500",
                "city": "San Francisco",
                "state": "CA",
                "zip_code": "94105",
                "country": "USA",
                "currency": "USD",
                "payment_method": "ACH Transfer",
                "payment_terms": "Net 30",
                "tax_id": "12-3456789",
                "bank_account": "****4567",
                "bank_routing": "****0001",
                "compliance_status": "complete",
                "contract_status": "active",
                "contract_renewal": "2026-12-31",
                "risk_level": "low",
                "erp_sync_status": "synced",
                "notes": "Preferred vendor for widget products. Established 2015.",
                "status": "active",
            },
            {
                "vendor_id": "VND-002",
                "name": "Gadgets Co.",
                "aliases": json.dumps(["Gadgets", "Gadgets Company", "Gadgets Co", "GadgetsCo"]),
                "phone": "(555) 987-6543",
                "email": "billing@gadgets.co",
                "address": "456 Tech Boulevard",
                "city": "Austin",
                "state": "TX",
                "zip_code": "78701",
                "country": "USA",
                "currency": "USD",
                "payment_method": "Wire Transfer",
                "payment_terms": "Net 60",
                "tax_id": "98-7654321",
                "bank_account": "****8901",
                "bank_routing": "****0002",
                "compliance_status": "incomplete",
                "contract_status": "active",
                "contract_renewal": "2026-06-30",
                "risk_level": "medium",
                "erp_sync_status": "pending",
                "notes": "Large orders require VP approval. Review compliance docs.",
                "status": "active",
            },
            {
                "vendor_id": "VND-003",
                "name": "Fraudster LLC",
                "aliases": json.dumps(["Fraudster", "Fraud LLC"]),
                "phone": None,
                "email": "unknown@suspicious.biz",
                "address": "Unknown",
                "city": "Unknown",
                "state": "XX",
                "zip_code": "00000",
                "country": "Unknown",
                "currency": "USD",
                "payment_method": "Due on receipt",
                "payment_terms": "Due on receipt",
                "tax_id": None,
                "bank_account": None,
                "bank_routing": None,
                "compliance_status": "incomplete",
                "contract_status": "suspended",
                "contract_renewal": None,
                "risk_level": "high",
                "erp_sync_status": "failed",
                "notes": "⚠️ SUSPENDED: Flagged for suspicious activity. Do not process invoices.",
                "status": "suspended",
            },
        ]
        
        for vendor in test_vendors:
            cursor.execute("""
                INSERT OR REPLACE INTO vendors (
                    vendor_id, name, aliases, phone, email, address, city, state,
                    zip_code, country, currency, payment_method, payment_terms,
                    tax_id, bank_account, bank_routing, compliance_status,
                    contract_status, contract_renewal, risk_level, erp_sync_status,
                    notes, status, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                vendor["vendor_id"], vendor["name"], vendor["aliases"],
                vendor["phone"], vendor["email"], vendor["address"],
                vendor["city"], vendor["state"], vendor["zip_code"],
                vendor["country"], vendor["currency"], vendor["payment_method"],
                vendor["payment_terms"], vendor["tax_id"], vendor["bank_account"],
                vendor["bank_routing"], vendor["compliance_status"],
                vendor["contract_status"], vendor["contract_renewal"],
                vendor["risk_level"], vendor["erp_sync_status"],
                vendor["notes"], vendor["status"],
            ))
        
        # =============================================================================
        # PURCHASE ORDER TEST DATA (for 3-way matching demo)
        # =============================================================================
        test_pos = [
            {
                "po_number": "PO-2026-001",
                "vendor_id": "VND-001",
                "order_date": "2026-01-15",
                "expected_delivery": "2026-01-25",
                "total_amount": 5000.00,
                "status": "open",
                "line_items": json.dumps([
                    {"item": "WidgetA", "quantity": 10, "unit_price": 100.0},
                    {"item": "WidgetB", "quantity": 5, "unit_price": 150.0}
                ]),
            },
            {
                "po_number": "PO-2026-002",
                "vendor_id": "VND-002",
                "order_date": "2026-01-20",
                "expected_delivery": "2026-01-30",
                "total_amount": 15000.00,
                "status": "open",
                "line_items": json.dumps([
                    {"item": "GadgetX", "quantity": 20, "unit_price": 500.0}
                ]),
            },
        ]
        
        for po in test_pos:
            cursor.execute("""
                INSERT OR REPLACE INTO purchase_orders (
                    po_number, vendor_id, order_date, expected_delivery,
                    total_amount, status, line_items
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                po["po_number"], po["vendor_id"], po["order_date"],
                po["expected_delivery"], po["total_amount"],
                po["status"], po["line_items"],
            ))
        
        conn.commit()
        
    print(f"✅ Database initialized at: {DATABASE_PATH}")
    print(f"   📦 Inventory: 4 items")
    print(f"   🏢 Vendors: 3 profiles")
    print(f"   📋 Purchase Orders: 2 POs")


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
# VENDOR QUERIES (Session 2026-01-27_PERSIST)
# =============================================================================

def get_vendor_by_id(vendor_id: str) -> Optional[dict]:
    """
    Get vendor by ID.
    
    Args:
        vendor_id: The vendor ID (e.g., 'VND-001')
        
    Returns:
        Vendor dict or None if not found
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vendors WHERE vendor_id = ?", (vendor_id,))
        row = cursor.fetchone()
        
        if row:
            return _row_to_vendor_dict(row)
        return None


def lookup_vendor_by_name(name: str) -> Optional[dict]:
    """
    Look up a vendor by name or alias.
    
    This is the key function for vendor enrichment - it finds a vendor
    by matching against the name or any of their aliases.
    
    Args:
        name: Vendor name from invoice (may be partial/abbreviated)
        
    Returns:
        Vendor dict or None if no match found
        
    Example:
        >>> lookup_vendor_by_name("Widgets Inc")
        {"vendor_id": "VND-001", "name": "Widgets Inc.", ...}
        
        >>> lookup_vendor_by_name("Gadgets")  # Matches alias
        {"vendor_id": "VND-002", "name": "Gadgets Co.", ...}
    """
    if not name:
        return None
    
    name_lower = name.lower().strip()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # First try exact name match (case-insensitive)
        cursor.execute(
            "SELECT * FROM vendors WHERE LOWER(name) = ? AND status != 'inactive'",
            (name_lower,)
        )
        row = cursor.fetchone()
        if row:
            return _row_to_vendor_dict(row)
        
        # Then try LIKE match on name
        cursor.execute(
            "SELECT * FROM vendors WHERE LOWER(name) LIKE ? AND status != 'inactive'",
            (f"%{name_lower}%",)
        )
        row = cursor.fetchone()
        if row:
            return _row_to_vendor_dict(row)
        
        # Finally, search aliases
        cursor.execute("SELECT * FROM vendors WHERE status != 'inactive'")
        for row in cursor.fetchall():
            aliases_json = row["aliases"]
            if aliases_json:
                try:
                    aliases = json.loads(aliases_json)
                    for alias in aliases:
                        if alias.lower() == name_lower or name_lower in alias.lower():
                            return _row_to_vendor_dict(row)
                except json.JSONDecodeError:
                    pass
        
        return None


def get_all_vendors() -> List[dict]:
    """
    Get all vendors.
    
    Returns:
        List of all vendor dicts
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM vendors ORDER BY name")
        
        return [_row_to_vendor_dict(row) for row in cursor.fetchall()]


def get_vendor_stats() -> dict:
    """
    Get vendor statistics for the dashboard.
    
    Returns:
        Dict with vendor counts and status breakdown
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM vendors")
        total = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM vendors WHERE compliance_status = 'complete'")
        compliant = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM vendors WHERE compliance_status != 'complete'")
        needs_attention = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM vendors WHERE risk_level = 'high'")
        high_risk = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM vendors WHERE compliance_status = 'incomplete' OR erp_sync_status = 'pending'")
        pending_compliance = cursor.fetchone()[0]
        
        return {
            "total_vendors": total,
            "compliant": compliant,
            "needs_attention": needs_attention,
            "high_risk": high_risk,
            "pending_compliance": pending_compliance,
        }


def _row_to_vendor_dict(row) -> dict:
    """Convert a database row to a vendor dict."""
    aliases = []
    if row["aliases"]:
        try:
            aliases = json.loads(row["aliases"])
        except json.JSONDecodeError:
            aliases = []
    
    return {
        "vendor_id": row["vendor_id"],
        "name": row["name"],
        "aliases": aliases,
        "phone": row["phone"],
        "email": row["email"],
        "address": row["address"],
        "city": row["city"],
        "state": row["state"],
        "zip_code": row["zip_code"],
        "country": row["country"],
        "currency": row["currency"],
        "payment_method": row["payment_method"],
        "payment_terms": row["payment_terms"],
        "tax_id": row["tax_id"],
        "bank_account": row["bank_account"],
        "bank_routing": row["bank_routing"],
        "compliance_status": row["compliance_status"],
        "contract_status": row["contract_status"],
        "contract_renewal": row["contract_renewal"],
        "risk_level": row["risk_level"],
        "erp_sync_status": row["erp_sync_status"],
        "notes": row["notes"],
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# =============================================================================
# PURCHASE ORDER QUERIES (for future 3-way matching)
# =============================================================================

def get_purchase_order(po_number: str) -> Optional[dict]:
    """Get a purchase order by PO number."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM purchase_orders WHERE po_number = ?", (po_number,))
        row = cursor.fetchone()
        
        if row:
            line_items = []
            if row["line_items"]:
                try:
                    line_items = json.loads(row["line_items"])
                except json.JSONDecodeError:
                    pass
            
            return {
                "po_number": row["po_number"],
                "vendor_id": row["vendor_id"],
                "order_date": row["order_date"],
                "expected_delivery": row["expected_delivery"],
                "total_amount": row["total_amount"],
                "status": row["status"],
                "line_items": line_items,
                "created_at": row["created_at"],
            }
        return None


def find_matching_po(vendor_id: str, amount: float, tolerance: float = 0.05) -> Optional[dict]:
    """
    Find a matching PO for invoice validation.
    
    Args:
        vendor_id: The vendor ID
        amount: Invoice amount to match
        tolerance: Percentage tolerance for amount matching (default 5%)
        
    Returns:
        Matching PO or None
    """
    min_amount = amount * (1 - tolerance)
    max_amount = amount * (1 + tolerance)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM purchase_orders 
            WHERE vendor_id = ? 
            AND status = 'open'
            AND total_amount BETWEEN ? AND ?
            ORDER BY order_date DESC
            LIMIT 1
        """, (vendor_id, min_amount, max_amount))
        
        row = cursor.fetchone()
        if row:
            return get_purchase_order(row["po_number"])
        return None


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
    print("🔍 Testing validate_inventory():")
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
    
    # Show vendors
    print()
    print("🏢 Vendor Master:")
    print("─" * 40)
    for vendor in get_all_vendors():
        status_icon = "✅" if vendor["status"] == "active" else "⚠️"
        risk_icon = "🔴" if vendor["risk_level"] == "high" else "🟡" if vendor["risk_level"] == "medium" else "🟢"
        print(f"   {status_icon} {vendor['vendor_id']}: {vendor['name']}")
        print(f"      📞 {vendor['phone'] or 'N/A'} | 📧 {vendor['email'] or 'N/A'}")
        print(f"      💳 {vendor['payment_method']} ({vendor['payment_terms']})")
        print(f"      {risk_icon} Risk: {vendor['risk_level']} | Compliance: {vendor['compliance_status']}")
        print()
    
    # Test vendor lookup
    print()
    print("🔍 Testing lookup_vendor_by_name():")
    print("─" * 40)
    test_lookups = ["Widgets Inc.", "Gadgets", "Fraudster", "Unknown Vendor"]
    for name in test_lookups:
        result = lookup_vendor_by_name(name)
        if result:
            print(f"   ✅ '{name}' → {result['vendor_id']} ({result['name']})")
            print(f"      Phone: {result['phone']} | Email: {result['email']}")
        else:
            print(f"   ❌ '{name}' → Not found")
    
    # Show vendor stats
    print()
    print("📊 Vendor Statistics:")
    print("─" * 40)
    stats = get_vendor_stats()
    print(f"   Total Vendors: {stats['total_vendors']}")
    print(f"   Compliant: {stats['compliant']}")
    print(f"   Needs Attention: {stats['needs_attention']}")
    print(f"   High Risk: {stats['high_risk']}")
    
    print()
    print("✅ Database setup complete!")
