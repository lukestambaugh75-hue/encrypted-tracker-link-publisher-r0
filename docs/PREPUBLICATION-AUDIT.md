# Pre-publication audit

Status: CLEAN PRIVATE STAGING; NOT AUTHORIZED FOR PUBLICATION

This record begins before the repository has a remote or Pages configuration.
Complete it with live evidence immediately before requesting Luke's publication
confirmation.

## Required checks

- [x] Tools encryption tests pass: 22 current tests after removing the obsolete persistent-key module
- [x] Existing dashboard-mailer regression tests pass: 35 tests
- [x] Synthetic envelope decrypts with the private local link
- [x] Missing, wrong, truncated, and altered keys fail closed
- [x] Public tree contains no plaintext synthetic sentinel
- [x] Public tree contains no email address, local path, secret, or complete link
- [x] Viewer loads no third-party resource
- [x] Browser request contains no URL fragment
- [x] Desktop render inspected
- [x] Mobile portrait render inspected
- [x] Git diff reviewed
- [x] Complete new Git object database scanned after the history rebuild
- [x] Local branch and tag state checked: one `main` branch and no tags
- [x] Private GitHub remote checked: `main` only, no tags or releases, no Actions workflows, Pages disabled
- [x] Repository remains private until a separate explicit publication confirmation

## History rebuild evidence

The original unpublished Git metadata was moved to private recoverable
quarantine after its object audit found a forbidden absolute-path marker. The
working tree was scrubbed before a new repository was initialized. The rebuilt
history began with commit `0814ce4` and its complete blob database passed the
forbidden-marker scan with no dangling objects.

The quarantined metadata is not part of this repository and must never be
restored, copied, or pushed into the GitHub remote.

## Private remote evidence

GitHub reported the repository as private with `main` as its default and only
branch. It reported no tags, releases, Actions workflows, or Pages site. The
remote `main` commit matched the local audited commit before this record was
updated. Public visibility and Pages remain a separate approval gate.
