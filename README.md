# Encrypted Tracker Link Publisher r0

Ciphertext-only GitHub Pages host for the encrypted tracker dashboard viewer.
The repository is a dumb file server: it may hold only the generic viewer,
opaque identifiers, and authenticated ciphertext.

## Current state

- Public GitHub repository containing only generic viewer assets and ciphertext
- GitHub Pages enabled through the pinned deployment workflow
- Synthetic ciphertext only
- No production tracker adapter or email is active

The source of the encryption, secret handling, locking, and viewer generator
remains in Luke's private Tools repository and is not copied into this public
artifact repository.

## Production cutover gate

The synthetic public host is validated. Do not publish production tracker
ciphertext or send a magic link until the Kegerator pilot adapter, audience
guard, exact deployed-envelope check, and Luke-only email confirmation have
passed their separate gates.

1. Encryption and negative tests
2. Public-tree plaintext/key scan
3. Full Git history, branch, tag, release, and workflow audit
4. Generic locked-view verification
5. Browser proof that the fragment is not sent to the server
6. Desktop and mobile visual review

The complete URL is a bearer credential. Anyone with it can view that one
dashboard until the link is rotated. This project provides no identity login or
viewer audit.
