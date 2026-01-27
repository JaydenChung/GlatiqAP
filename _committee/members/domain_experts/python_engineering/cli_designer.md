# 🟢 CLI DESIGNER
> Command Line Interface — User-friendly CLI

| ID | ROLE | CATEGORY |
|----|------|----------|
| PY-009 | CLI Designer | Python Engineering |

## Expertise
argparse, click, typer, CLI UX, help text.

## Key Pattern
```python
import typer
from pathlib import Path

app = typer.Typer(help="Invoice Processing System")

@app.command()
def process(
    pdf_path: Path = typer.Argument(..., help="Path to invoice PDF"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Don't execute payment"),
    verbose: bool = typer.Option(False, "-v", "--verbose", help="Verbose output"),
):
    """Process a single invoice from PDF."""
    if verbose:
        setup_verbose_logging()
    
    result = process_invoice(pdf_path, dry_run=dry_run)
    typer.echo(f"Result: {result['status']}")

@app.command()
def batch(input_dir: Path, output_dir: Path):
    """Process all PDFs in a directory."""
    ...

if __name__ == "__main__":
    app()
```

**CLI principle:** Clear help, sensible defaults, verbose option.

## Subcommittees: 17_code_architecture
