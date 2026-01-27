"""
Sample PDF Invoice Generator
============================
Creates a sample PDF invoice for testing the PDF extraction feature.

Requires: pip install reportlab

Usage:
    python create_sample_pdf.py
    
Output:
    sample_invoice.pdf in the same directory

Session: 2026-01-27_INGEST
"""

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.lib.units import inch
except ImportError:
    print("❌ reportlab not installed. Installing...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab"])
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.lib.units import inch

from pathlib import Path
from datetime import datetime, timedelta


def create_sample_invoice(output_path: str = "sample_invoice.pdf"):
    """Create a professional-looking sample invoice PDF."""
    
    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter
    
    # Colors
    header_blue = colors.Color(0.1, 0.2, 0.4)
    accent_blue = colors.Color(0.2, 0.4, 0.7)
    
    # =========================================================================
    # HEADER
    # =========================================================================
    
    # Company name (vendor)
    c.setFillColor(header_blue)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, height - 60, "TechSupply Inc.")
    
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.gray)
    c.drawString(50, height - 75, "123 Technology Drive, Suite 400")
    c.drawString(50, height - 87, "San Francisco, CA 94105")
    c.drawString(50, height - 99, "Phone: (415) 555-1234 | Email: billing@techsupply.com")
    
    # INVOICE label
    c.setFillColor(header_blue)
    c.setFont("Helvetica-Bold", 36)
    c.drawRightString(width - 50, height - 60, "INVOICE")
    
    # Invoice details (right side)
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.black)
    
    invoice_date = datetime.now()
    due_date = invoice_date + timedelta(days=30)
    
    details = [
        ("Invoice Number:", "INV-2026-0147"),
        ("Invoice Date:", invoice_date.strftime("%B %d, %Y")),
        ("Due Date:", due_date.strftime("%B %d, %Y")),
        ("PO Number:", "PO-2026-0892"),
        ("Payment Terms:", "Net 30"),
    ]
    
    y_pos = height - 95
    for label, value in details:
        c.setFont("Helvetica", 9)
        c.drawRightString(width - 120, y_pos, label)
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(width - 50, y_pos, value)
        y_pos -= 14
    
    # =========================================================================
    # BILL TO
    # =========================================================================
    
    c.setFillColor(accent_blue)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, height - 180, "BILL TO:")
    
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    c.drawString(50, height - 195, "Acme Corporation")
    c.drawString(50, height - 207, "Attn: Accounts Payable")
    c.drawString(50, height - 219, "500 Innovation Way")
    c.drawString(50, height - 231, "Austin, TX 78701")
    c.drawString(50, height - 243, "ap@acmecorp.com")
    
    # =========================================================================
    # LINE ITEMS TABLE
    # =========================================================================
    
    # Table header
    table_top = height - 290
    c.setFillColor(header_blue)
    c.rect(50, table_top - 20, width - 100, 20, fill=True, stroke=False)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(55, table_top - 14, "Item/SKU")
    c.drawString(160, table_top - 14, "Description")
    c.drawRightString(380, table_top - 14, "Qty")
    c.drawRightString(450, table_top - 14, "Unit Price")
    c.drawRightString(width - 55, table_top - 14, "Amount")
    
    # Line items
    items = [
        ("WIDGET-A7", "Enterprise Widget Model A7", 10, 300.00),
        ("GADGET-X3", "Premium Gadget X3 Series", 5, 450.00),
        ("CABLE-USB", "USB-C Cable (6ft, Braided)", 25, 15.00),
        ("ADAPTER-PD", "65W Power Adapter w/ USB-C PD", 8, 75.00),
    ]
    
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 9)
    
    y_pos = table_top - 38
    subtotal = 0
    
    for sku, description, qty, unit_price in items:
        amount = qty * unit_price
        subtotal += amount
        
        c.drawString(55, y_pos, sku)
        c.drawString(160, y_pos, description)
        c.drawRightString(380, y_pos, str(qty))
        c.drawRightString(450, y_pos, f"${unit_price:,.2f}")
        c.drawRightString(width - 55, y_pos, f"${amount:,.2f}")
        
        # Light separator line
        c.setStrokeColor(colors.lightgrey)
        c.line(50, y_pos - 8, width - 50, y_pos - 8)
        
        y_pos -= 25
    
    # =========================================================================
    # TOTALS
    # =========================================================================
    
    totals_x = 380
    totals_y = y_pos - 30
    
    tax_rate = 0.0825  # 8.25% Texas sales tax
    tax_amount = subtotal * tax_rate
    total = subtotal + tax_amount
    
    c.setFont("Helvetica", 10)
    c.drawRightString(totals_x + 50, totals_y, "Subtotal:")
    c.drawRightString(width - 55, totals_y, f"${subtotal:,.2f}")
    
    totals_y -= 18
    c.drawRightString(totals_x + 50, totals_y, "Sales Tax (8.25%):")
    c.drawRightString(width - 55, totals_y, f"${tax_amount:,.2f}")
    
    totals_y -= 22
    c.setFillColor(header_blue)
    c.rect(totals_x, totals_y - 5, width - totals_x - 50, 22, fill=True, stroke=False)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(totals_x + 50, totals_y + 3, "TOTAL DUE:")
    c.drawRightString(width - 55, totals_y + 3, f"${total:,.2f}")
    
    # =========================================================================
    # FOOTER
    # =========================================================================
    
    c.setFillColor(colors.gray)
    c.setFont("Helvetica", 8)
    c.drawString(50, 80, "Payment Instructions:")
    c.setFont("Helvetica", 8)
    c.drawString(50, 68, "Please remit payment to TechSupply Inc. within 30 days.")
    c.drawString(50, 56, "For questions, contact billing@techsupply.com or call (415) 555-1234.")
    
    c.drawCentredString(width / 2, 30, "Thank you for your business!")
    
    # Save
    c.save()
    
    print(f"✅ Created: {output_path}")
    print(f"   Vendor: TechSupply Inc.")
    print(f"   Customer: Acme Corporation")
    print(f"   Invoice #: INV-2026-0147")
    print(f"   Total: ${total:,.2f}")
    print(f"   Items: {len(items)}")
    
    return output_path


def create_messy_invoice(output_path: str = "messy_invoice.pdf"):
    """Create a messier invoice with less structure (tests extraction resilience)."""
    
    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter
    
    c.setFont("Helvetica", 12)
    
    # Very basic/messy format
    y = height - 50
    lines = [
        "Gadgets Co. - INVOICE",
        "",
        "Invoice: #2026-0223",
        "Date: Jan 27, 2026",
        "",
        "To: SomeCorp LLC",
        "    789 Business Rd",
        "    Chicago IL 60601",
        "",
        "From: Gadgets Co.",
        "      456 Gadget Ave",
        "      Denver CO 80202",
        "",
        "-" * 50,
        "ITEMS:",
        "  GadgetX       20 units @ $750.00 ea   $15,000.00",
        "  GadgetY       10 units @ $250.00 ea    $2,500.00", 
        "-" * 50,
        "",
        "                        Subtotal:   $17,500.00",
        "                        Tax (0%):       $0.00",
        "                        ========================",
        "                        TOTAL DUE:  $17,500.00",
        "",
        "Due: February 26, 2026",
        "Terms: Net 30",
        "",
        "Please pay by check or wire transfer."
    ]
    
    for line in lines:
        c.drawString(50, y, line)
        y -= 18
    
    c.save()
    
    print(f"✅ Created: {output_path}")
    print(f"   Style: Messy/basic format")
    print(f"   Total: $17,500.00")
    
    return output_path


if __name__ == "__main__":
    import sys
    
    script_dir = Path(__file__).parent
    
    print()
    print("=" * 60)
    print("📄 SAMPLE PDF INVOICE GENERATOR")
    print("   Session: 2026-01-27_INGEST")
    print("=" * 60)
    print()
    
    # Create both sample invoices
    create_sample_invoice(str(script_dir / "sample_invoice.pdf"))
    print()
    create_messy_invoice(str(script_dir / "messy_invoice.pdf"))
    
    print()
    print("-" * 60)
    print("🧪 To test PDF extraction:")
    print(f"   cd {script_dir.parent}")
    print(f"   python -m src.agents.ingestion data/invoices/sample_invoice.pdf")
    print("-" * 60)

