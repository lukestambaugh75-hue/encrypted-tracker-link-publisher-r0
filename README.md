# Encrypted Tracker Link Publisher r0

Ciphertext-only GitHub Pages host for the encrypted tracker dashboard viewer.
The repository is a dumb file server: it may hold only the generic viewer,
opaque identifiers, and authenticated ciphertext.

## Current state

- Public GitHub repository containing only generic viewer assets and ciphertext
- GitHub Pages enabled through the pinned deployment workflow
- Synthetic fixture plus one encrypted Kegerator pilot snapshot
- One Luke-only validation email was sent; the Kegerator pilot adapter remains
  default-off and no scheduled encrypted-link lane is active
- The shared viewer now uses a decision-first card layout and preserves a
  validated key only for same-tab refresh

The source of the encryption, secret handling, locking, and viewer generator
remains in Luke's private Tools repository and is not copied into this public
artifact repository.

## Production cutover gate

The synthetic public host, default-off Kegerator ciphertext pilot, and one
Luke-only magic-link email are validated. Do not activate a scheduled encrypted
link lane until the separate schedule and recipient gates pass.

1. Encryption and negative tests
2. Public-tree plaintext/key scan
3. Full Git history, branch, tag, release, and workflow audit
4. Generic locked-view verification
5. Browser proof that the fragment is not sent to the server
6. Desktop and mobile visual review

The complete URL is a bearer credential. Anyone with it can view that one
dashboard until the link is rotated. This project provides no identity login or
viewer audit.
