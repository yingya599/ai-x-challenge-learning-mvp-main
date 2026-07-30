# Pytest test suite

All automated tests live in this directory.

Run the complete suite from the project root:

```powershell
python -m pip install -r requirements-test.txt
python -m pytest
```

The integration tests start an isolated Next.js development server on a free local port. External Feishu, Redis, GitHub, and AI services are not required for the baseline suite.

Run only fast data and contract tests:

```powershell
python -m pytest -m "not integration"
```
