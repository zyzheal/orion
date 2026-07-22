from setuptools import setup, find_packages

with open("orion/__init__.py", "r") as f:
    for line in f:
        if line.startswith("__version__"):
            version = line.split("=")[1].strip().strip('"').strip("'")
            break
    else:
        version = "1.0.0"

setup(
    name="orion-sdk-py",
    version=version,
    description="Orion Platform SDK for Python",
    author="Orion Team",
    python_requires=">=3.8",
    packages=find_packages(),
    install_requires=[
        "requests>=2.28.0",
        "httpx>=0.24.0",
    ],
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)