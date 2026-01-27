"""
PDF Extractor Tool
==================
Extract text from PDF invoices for ingestion processing.

MVP Implementation (Session: 2026-01-27_INGEST):
- Text extraction from digital PDFs ✅
- Multi-page support ✅
- File size limit (10MB) ✅
- Scanned PDF detection → clear error ✅

Future (Deferred):
- OCR for scanned PDFs
- Fillable form field extraction (requires PyMuPDF)
- Rotation correction
- Table extraction as structured data

Library: pdfplumber (chosen over PyMuPDF for better table/layout handling)

Committee Decision: PRAG-003 MVP scope approved by Human Director
"""

import pdfplumber
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================

MAX_FILE_SIZE_MB = 10  # Reject files larger than this
MIN_TEXT_THRESHOLD = 100  # Characters below this = likely scanned
MAX_PAGES = 50  # Truncate after this many pages


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class PDFExtractionResult:
    """
    Result of PDF text extraction.
    
    Attributes:
        success: Whether extraction succeeded
        text: Extracted text content (empty string on failure)
        page_count: Number of pages in PDF
        error: Error message if failed (None on success)
        is_likely_scanned: True if PDF appears to be scanned/image-based
        warnings: Non-fatal issues encountered
        source_path: Original file path for provenance tracking
    """
    success: bool
    text: str
    page_count: int
    error: Optional[str]
    is_likely_scanned: bool
    warnings: list[str] = field(default_factory=list)
    source_path: Optional[str] = None


# =============================================================================
# MAIN EXTRACTION FUNCTION
# =============================================================================

def extract_pdf(pdf_path: str, max_size_mb: int = MAX_FILE_SIZE_MB) -> PDFExtractionResult:
    """
    Extract text from a PDF file.
    
    MVP implementation handles:
    - Text-based digital PDFs ✅
    - Multi-page documents ✅
    - Basic error cases ✅
    
    Does NOT handle (future scope):
    - Scanned/image PDFs (detected, returns error)
    - Fillable form fields
    - Password-protected files
    - Rotated pages
    
    Args:
        pdf_path: Path to the PDF file
        max_size_mb: Maximum file size in MB (default 10MB)
        
    Returns:
        PDFExtractionResult with extracted text or error details
        
    Example:
        >>> result = extract_pdf("/path/to/invoice.pdf")
        >>> if result.success:
        ...     print(f"Extracted {len(result.text)} chars from {result.page_count} pages")
        ... else:
        ...     print(f"Failed: {result.error}")
    """
    path = Path(pdf_path)
    warnings = []
    
    logger.info(f"PDF extraction started: {pdf_path}")
    
    # -------------------------------------------------------------------------
    # Pre-flight checks
    # -------------------------------------------------------------------------
    
    # Check file exists
    if not path.exists():
        logger.warning(f"PDF not found: {pdf_path}")
        return PDFExtractionResult(
            success=False,
            text="",
            page_count=0,
            error=f"File not found: {pdf_path}",
            is_likely_scanned=False,
            source_path=pdf_path
        )
    
    # Check it's actually a file
    if not path.is_file():
        return PDFExtractionResult(
            success=False,
            text="",
            page_count=0,
            error=f"Not a file: {pdf_path}",
            is_likely_scanned=False,
            source_path=pdf_path
        )
    
    # Check file size
    size_bytes = path.stat().st_size
    size_mb = size_bytes / (1024 * 1024)
    
    if size_mb > max_size_mb:
        logger.warning(f"PDF too large: {size_mb:.1f}MB > {max_size_mb}MB")
        return PDFExtractionResult(
            success=False,
            text="",
            page_count=0,
            error=f"File too large: {size_mb:.1f}MB (maximum {max_size_mb}MB). Please reduce file size or enter invoice data manually.",
            is_likely_scanned=False,
            source_path=pdf_path
        )
    
    # Check file extension (warning only, still try to process)
    if path.suffix.lower() != '.pdf':
        warnings.append(f"File does not have .pdf extension: {path.suffix}")
    
    # -------------------------------------------------------------------------
    # PDF Extraction
    # -------------------------------------------------------------------------
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            
            # Check for empty PDF
            if total_pages == 0:
                return PDFExtractionResult(
                    success=False,
                    text="",
                    page_count=0,
                    error="PDF has no pages",
                    is_likely_scanned=False,
                    source_path=pdf_path
                )
            
            # Warn if truncating
            pages_to_process = min(total_pages, MAX_PAGES)
            if total_pages > MAX_PAGES:
                warnings.append(f"PDF has {total_pages} pages; only processing first {MAX_PAGES}")
            
            # Extract text from each page
            text_parts = []
            pages_with_text = 0
            
            for i, page in enumerate(pdf.pages[:pages_to_process]):
                try:
                    page_text = page.extract_text()
                    if page_text and page_text.strip():
                        text_parts.append(f"--- Page {i + 1} ---\n{page_text}")
                        pages_with_text += 1
                except Exception as page_error:
                    warnings.append(f"Page {i + 1} extraction failed: {str(page_error)}")
                    continue
            
            # Combine all text
            full_text = "\n\n".join(text_parts)
            
            # -------------------------------------------------------------------------
            # Scanned PDF Detection
            # -------------------------------------------------------------------------
            
            # Heuristic: If we have pages but very little text, it's likely scanned
            text_length = len(full_text.strip())
            is_likely_scanned = text_length < MIN_TEXT_THRESHOLD and total_pages > 0
            
            if is_likely_scanned:
                logger.warning(f"PDF appears to be scanned: {text_length} chars from {total_pages} pages")
                return PDFExtractionResult(
                    success=False,
                    text=full_text,  # Return what we got (might be some text)
                    page_count=total_pages,
                    error=(
                        "This PDF appears to be scanned or image-based. "
                        f"Only {text_length} characters of text were found in {total_pages} page(s). "
                        "Please upload a digital/text-based PDF, or enter the invoice data manually."
                    ),
                    is_likely_scanned=True,
                    warnings=warnings,
                    source_path=pdf_path
                )
            
            # -------------------------------------------------------------------------
            # Success!
            # -------------------------------------------------------------------------
            
            logger.info(f"PDF extraction successful: {text_length} chars from {pages_with_text}/{total_pages} pages")
            
            return PDFExtractionResult(
                success=True,
                text=full_text,
                page_count=total_pages,
                error=None,
                is_likely_scanned=False,
                warnings=warnings,
                source_path=pdf_path
            )
            
    except pdfplumber.pdfminer.pdfparser.PDFSyntaxError as e:
        logger.error(f"PDF syntax error: {e}")
        return PDFExtractionResult(
            success=False,
            text="",
            page_count=0,
            error=f"Invalid or corrupted PDF file: {str(e)}",
            is_likely_scanned=False,
            source_path=pdf_path
        )
    
    except Exception as e:
        error_type = type(e).__name__
        logger.error(f"PDF extraction failed ({error_type}): {e}")
        
        # Check for password-protected PDF
        error_str = str(e).lower()
        if 'password' in error_str or 'encrypted' in error_str:
            return PDFExtractionResult(
                success=False,
                text="",
                page_count=0,
                error="This PDF is password-protected. Please remove the password and re-upload, or enter invoice data manually.",
                is_likely_scanned=False,
                source_path=pdf_path
            )
        
        return PDFExtractionResult(
            success=False,
            text="",
            page_count=0,
            error=f"PDF extraction failed: {str(e)}",
            is_likely_scanned=False,
            source_path=pdf_path
        )


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def extract_text_simple(pdf_path: str) -> str:
    """
    Simple extraction: returns text or raises exception.
    
    Use extract_pdf() for production code that needs error details.
    This is for quick scripts and testing.
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Extracted text
        
    Raises:
        ValueError: If extraction fails
    """
    result = extract_pdf(pdf_path)
    if not result.success:
        raise ValueError(result.error)
    return result.text


def is_valid_pdf(pdf_path: str) -> bool:
    """
    Quick check if a file is a valid, extractable PDF.
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        True if PDF can be processed, False otherwise
    """
    result = extract_pdf(pdf_path)
    return result.success


# =============================================================================
# CLI TEST
# =============================================================================

if __name__ == "__main__":
    import sys
    
    print()
    print("╔" + "═" * 58 + "╗")
    print("║" + "  PDF EXTRACTOR - TEST".center(58) + "║")
    print("╚" + "═" * 58 + "╝")
    print()
    
    if len(sys.argv) > 1:
        pdf_file = sys.argv[1]
        print(f"Testing: {pdf_file}")
        print("-" * 60)
        
        result = extract_pdf(pdf_file)
        
        print(f"Success: {result.success}")
        print(f"Pages: {result.page_count}")
        print(f"Scanned: {result.is_likely_scanned}")
        
        if result.warnings:
            print(f"Warnings: {result.warnings}")
        
        if result.error:
            print(f"Error: {result.error}")
        else:
            print(f"Text length: {len(result.text)} characters")
            print("-" * 60)
            print("EXTRACTED TEXT (first 500 chars):")
            print("-" * 60)
            print(result.text[:500])
            if len(result.text) > 500:
                print(f"\n... [{len(result.text) - 500} more characters]")
    else:
        print("Usage: python pdf_extractor.py <path_to_pdf>")
        print()
        print("Example:")
        print("  python pdf_extractor.py ../data/invoices/sample.pdf")

