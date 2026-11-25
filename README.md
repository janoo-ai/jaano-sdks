# Jaano SDKs

Official client libraries for the Jaano Enterprise Developer API (`/v1`) and the Jaano chat widget.

| Package | Registry | Path | Runs in |
|---|---|---|---|
| `@jaano-sdk/js` | npm | [`js/`](js/) | Node.js 18+ server code |
| `@jaano-sdk/widget` | npm | [`widget/`](widget/) | Browser (website embed) |
| `jaano` | PyPI | [`python/`](python/) | Python 3.9+ server code |

## Install

```bash
npm install @jaano-sdk/js
npm install @jaano-sdk/widget
pip install jaano
```

## Repository layout

- `openapi/openapi.v1.json`: the API contract snapshot. Generated SDK types are built from it. It is synced from the backend and must not be edited by hand.
- `scripts/generate-sdks.mjs`: generates typed definitions and checks them for drift (`--check`).
- `js/`, `widget/`, `python/`: the packages.
- `examples/`: runnable samples. They use placeholder values only.

## Development

```bash
node scripts/generate-sdks.mjs --check
(cd js && npm test)
(cd widget && npm test)
(cd python && python -m unittest discover -s tests -v)
```

## Releasing

Releases are automated. Push a tag `sdk-v<version>` that matches `openapi/openapi.v1.json` and the package versions. CI runs all checks, then publishes to npm (with provenance) and PyPI, and creates a GitHub Release.

## Security

See [SECURITY.md](SECURITY.md). Do not commit API keys, secrets, or personal data.

## License

MIT
