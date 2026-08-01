# Pre-publication audit

Status: NOT READY FOR PUBLICATION

This record begins before the repository has a remote or Pages configuration.
Complete it with live evidence immediately before requesting Luke's publication
confirmation.

## Required checks

- [ ] Tools encryption tests pass
- [ ] Existing dashboard-mailer regression tests pass
- [ ] Synthetic envelope decrypts with the private local link
- [ ] Missing, wrong, truncated, and altered keys fail closed
- [ ] Public tree contains no plaintext synthetic sentinel
- [ ] Public tree contains no email address, local path, secret, or complete link
- [ ] Viewer loads no third-party resource
- [ ] Browser request contains no URL fragment
- [ ] Desktop render inspected
- [ ] Mobile portrait render inspected
- [ ] Git diff reviewed
- [ ] Complete Git history scanned
- [ ] Branches, tags, releases, and Actions state checked
- [ ] Repository remains local/private until explicit confirmation
