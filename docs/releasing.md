# Release Policy & Packaging Guide

This document establishes the official release process, versioning rules, and operational guidelines for Lumark.

---

## 1. Cardinal Rule: Published Tags Are Immutable

> [!CAUTION]
> **NEVER MOVE OR RE-CREATE A PUBLISHED TAG.**
> Once a release tag (e.g., `v0.1.0`) is published and pushed to the remote repository, it is **strictly immutable**.
> 
> - **Do NOT** run `git tag -d <tag>` followed by re-tagging and force-pushing.
> - **Do NOT** delete a published GitHub Release to "re-run" the same tag.
> - **Do NOT** force-push tags (`git push --force origin <tag>`).

### Why Tag Immutability Is Mandatory
1. **Supply-Chain Integrity:** Downstream users, package managers (e.g., Homebrew, AUR, winget), and security scanners cache archive tarballs and expect SHA-256 hashes to remain permanent. Moving a tag alters commit SHAs and invalidates release checksums.
2. **Deterministic Builds & Git History:** Re-tagging creates diverged histories between local clones and the upstream repository, corrupting developer workspaces and CI runners.
3. **Auditability:** Every published artifact must correspond to a permanent, immutable Git commit.

### Fix Forward with a New Patch Version
If a bug, regression, CI failure, or packaging defect is discovered after a tag is published:
- **Always fix forward** by creating a new commit on `main`.
- Bump the patch version according to [Semantic Versioning](https://semver.org/) (e.g., `v0.1.0` -> `v0.1.1`).
- Tag and publish the new patch version.

### Metadata-Only Corrections (Release Notes)
If only the markdown text of the GitHub Release notes needs updating (without modifying any binaries or code):
- **Do NOT** re-tag or delete the release.
- Update the release description in-place using the GitHub CLI:
  ```bash
  gh release edit <tag> --notes-file <path-to-notes.md>
  ```
  or edit the release description directly via the GitHub web interface.

---

## 2. Versioning Specification

Lumark adheres strictly to **Semantic Versioning 2.0.0** (`vMAJOR.MINOR.PATCH`):

- **MAJOR (`X.0.0`):** Incompatible API changes, major architectural redesigns, or breaking format migrations.
- **MINOR (`0.Y.0`):** New features and functionality added in a backwards-compatible manner.
- **PATCH (`0.0.Z`):** Backwards-compatible bug fixes, security patches, and packaging adjustments.

Release tags must always include the `v` prefix (e.g., `v0.1.0`, `v0.1.1`).
Package filenames and internal metadata strip the `v` prefix (e.g., `0.1.0`).

---

## 3. Supported Platforms & Release Assets

Every production release builds and publishes the following standardized assets:

| Platform | Architecture | Package Format | Release Asset Name | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Windows** | x64 (AMD64) | NSIS Installer | `lumark_<version>_windows_amd64_setup.exe` | Standard Windows installer with file associations |
| **macOS** | Universal (arm64 + x64) | Apple Disk Image | `lumark_<version>_macos_universal.dmg` | Branded drag-and-drop DMG installer |
| **macOS** | Universal (arm64 + x64) | Zip Archive | `lumark_<version>_macos_universal.zip` | Portable zipped application bundle |
| **Linux** | x86_64 / amd64 | AppImage | `lumark_<version>_linux_amd64.AppImage` | Standalone executable (`chmod +x` & run) |
| **Linux** | x86_64 / amd64 | Debian Package | `lumark_<version>_linux_amd64.deb` | Debian / Ubuntu installer (`apt install`) |
| **Linux** | x86_64 / amd64 | RPM Package | `lumark_<version>_linux_amd64.rpm` | Fedora / RHEL installer (`dnf install`) |
| **Linux** | x86_64 / amd64 | Tarball | `lumark_<version>_linux_amd64.tar.gz` | Portable standalone binary archive |
| **All** | All | Checksums | `SHA256SUMS.txt` | SHA-256 checksums for all release assets |

> **Deferred Architectures:** Windows ARM64 and Linux ARM64 packages are not yet available and are planned for future releases.

---

## 4. Release Preparation & Pre-Flight Checklist

Before tagging any new release, complete the following verification steps on `main`:

1. **Verify All Automated Tests:**
   ```bash
   npm test                  # Frontend unit & component tests
   go test ./...             # Backend Go tests
   npm run test:security     # Security & sanitization corpus
   npm run test:fixtures     # Golden markdown fixtures
   npm run test:offline      # Offline network isolation verification
   npm run benchmark         # Cold start & streaming benchmarks
   npm run test:package:linux# Debian, AppImage, and association checks
   ```

2. **Update Documentation:**
   - Update `CHANGELOG.md` under `## [X.Y.Z] - YYYY-MM-DD`. Ensure all user-visible additions, fixes, and changes are documented.
   - Verify `README.md` and `docs/release-checklist.md`.

3. **Confirm Working Tree Cleanliness:**
   ```bash
   git status --short
   git diff --check
   ```

---

## 5. Standard Release Protocol

Follow these exact steps to publish a new release:

### Step 1: Commit Release Preparations
```bash
git checkout main
git pull origin main
git add CHANGELOG.md README.md docs/
git commit -m "chore(release): prepare vX.Y.Z"
git push origin main
```

### Step 2: Create and Push the Signed Tag
```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

### Step 3: Automated CI Release Pipeline
Pushing the `v*` tag triggers `.github/workflows/release.yml`, which executes:
1. `prepare`: Computes canonical version numbers and asset filenames.
2. `build-linux`: Builds `.deb`, AppImage, RPM, and tarball on `ubuntu-24.04`.
3. `build-windows`: Builds the NSIS installer executable on `windows-latest`.
4. `build-macos`: Packages the Universal binary (`arm64` + `x86_64`) into DMG and zip on `macos-latest`.
5. `publish-release`: Gathers all platform artifacts, computes `SHA256SUMS.txt`, verifies checksums, and publishes the GitHub Release.

### Step 4: Post-Release Verification
After CI completes:
1. Navigate to the GitHub Releases page: `https://github.com/yahya-mehrabani/Lumark/releases/tag/vX.Y.Z`.
2. Confirm all 7 platform assets and `SHA256SUMS.txt` are attached.
3. Download `SHA256SUMS.txt` and verify hashes against downloaded packages.
4. If release notes markdown needs minor wording adjustments, update in-place with `gh release edit`:
   ```bash
   gh release edit vX.Y.Z --notes-file docs/release-notes/vX.Y.Z.md
   ```

