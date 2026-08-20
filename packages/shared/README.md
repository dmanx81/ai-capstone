# Shared Account Brief Types

The Pydantic models in `apps/api/schemas.py` are the source of truth.

Generate the JSON Schema and TypeScript types with:

```sh
.venv/bin/python scripts/generate_shared_types.py
```

Verify that generated artifacts are current with:

```sh
.venv/bin/python scripts/generate_shared_types.py --check
```

The check command is intended for CI and fails when the generated files do not
match the current Pydantic schema.