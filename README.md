# Encrypted Tracker Link Publisher r0

Private pre-publication staging repository for the encrypted tracker dashboard
viewer. The eventual GitHub Pages repository is a dumb file server: it may hold
only the generic viewer, opaque identifiers, and authenticated ciphertext.

## Current state

- Local Git repository only
- No GitHub remote
- No GitHub Pages configuration
- Synthetic ciphertext only
- No production tracker adapter or email is active

The source of the encryption, secret handling, locking, and viewer generator
remains in Luke's private Tools repository and is not copied into this public
artifact repository.

## Publication gate

Do not make this repository public, create a remote, enable Pages, or send a
magic link until all of the following have passed and Luke confirms the outward
action immediately before it occurs:

1. Encryption and negative tests
2. Public-tree plaintext/key scan
3. Full Git history, branch, tag, and release audit
4. Generic locked-view verification
5. Browser proof that the fragment is not sent to the server
6. Desktop and mobile visual review

The complete URL is a bearer credential. Anyone with it can view that one
dashboard until the link is rotated. This project provides no identity login or
viewer audit.
