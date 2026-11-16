# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Version follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
Update in `package.json` as well

## [Unreleased]

### Added

- OIDC clients may omit `OIDC_CLIENT_SECRET` and use PKCE alone
- Drafts on the Send page survive navigation and reloads, and list files to choose again after a reload
- Dismiss failed uploads from the upload indicator
- macOS packages such as `.app` bundles are shown as one file and downloaded as a zip; zipped packages are shown under their package name
- Light and dark accent colours can be chosen separately; setting one derives the other

### Changed

- New app logo and favicon

### Fixed

- Resume transfers containing completed or empty files
- Signing out returns to the login page
- Editing a limit override no longer leaves the old target behind

## [0.1.0]

### Added

- Send files and folders, with title, message, password and expiry
- Resumable uploads that carry on in the background while you use the app
- Password-protected links, per-file and zip downloads
- Limits: global, per role and per user, with quotas
- Admin: users, all transfers, limits, branding and update checks
- Instance branding: name, accent colour and logo
- Light, dark and system themes
