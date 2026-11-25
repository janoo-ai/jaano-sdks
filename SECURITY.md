# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Email **security@jaano.ai** with:
- the affected package and version (`@jaano-sdk/js`, `@jaano-sdk/widget`, or `jaano` on PyPI),
- steps to reproduce, and
- the impact you believe it has.

We acknowledge reports within 2 business days and will coordinate a fix and disclosure timeline with you.

## Scope

This repository contains the **client SDKs and widget loader only**. The API backend is not in this repository.

## Rules for contributors

- Never commit API keys, webhook secrets, tokens, `.env` files, or customer data. Use placeholder values such as `jaano_live_...` and `+1-555-01xx`.
- Never add a server-side API key to `@jaano-sdk/widget` (browser code). API keys belong only in server-side SDK usage.
- Secret scanning runs in CI on every pull request. If a secret is committed, rotate it immediately, then remove it from history.
