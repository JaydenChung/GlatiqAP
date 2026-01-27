"""
Setup file for editable installs.
Required for older pip versions that don't support PEP 660.
"""
from setuptools import setup, find_packages

setup(
    name="invoice-processor",
    version="0.1.0",
    packages=find_packages(include=["src", "src.*"]),
    python_requires=">=3.9",
)
