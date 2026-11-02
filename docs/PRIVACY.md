# Public bundle privacy

The public collection contains UI code and synthetic/demo visual references. It excludes credentials, browser profiles, live telemetry, personal files, usernames in local source paths, machine names and personal contact details.

Before publication, owner-specific non-legal links and local source roots are replaced by example values or source aliases. Required original copyright and asset-attribution notices remain. GitHub also exposes the repository's hosting account; the repository's commit author is the neutral **UI Collection** identity.

Published extraction manifests use `sha256` for the actual published file. If privacy redaction changes a copied original, `original_sha256` retains the original digest and `privacy_redacted` marks the change. Historical object directory names identify the pre-redaction source revision, while the manifest's SHA verifies its published bytes. This preserves traceability without publishing removed identifiers.

Sanitized upstream repository, updater and homepage fields are placeholders. Set those to your new application's own repository before using those integrations. Legal notices are the source of required attribution; example URLs in sanitized source are not provenance assertions.

Screenshots were selected from explicitly synthetic public fixture captures or recorded in isolated UI-only showcases. New captures do not capture the user's desktop. See the per-project media provenance and [validation notes](VALIDATION.md). `privacy-report.json` lists changed files without reproducing the removed values.
