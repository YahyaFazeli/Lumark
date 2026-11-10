# Security Policy

Lumark treats security as a core architectural invariant. Because Lumark renders Markdown documents that may come from untrusted local, network, or external sources, all document content is treated as potentially adversarial input.

Detailed architectural security guarantees, threat models, and mandatory invariants are documented in our [Security and Privacy Specification](docs/security.md).

## Supported Versions

Only the latest release receive security patches and updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

To report a vulnerability responsibly:

1. **Preferred Channel — GitHub Private Vulnerability Reporting:**
   Open a private advisory via [GitHub Security Advisories](https://github.com/yahya-mehrabani/Lumark/security/advisories/new).
   This creates a confidential space where we can discuss the issue, coordinate a patch, and publish a CVE if applicable.

2. **What to Include:**
   - A detailed description of the vulnerability.
   - Specific steps or an adversarial sample Markdown file reproducing the issue.
   - The affected Lumark version and operating system (Windows, macOS, or Linux).
   - Potential impact (e.g., script execution, sandbox escape, path traversal).

## Expected Response Times

As an independent open-source project, we commit to the following realistic response times:

- **Initial Acknowledgment:** Within **48 to 72 hours** of report receipt.
- **Triage & Severity Assessment:** Within **7 calendar days** confirming vulnerability reproduction and assigning a severity rating.
- **Remediation & Fix Release:** Depending on severity and complexity, typically within **14 to 30 days**. We will provide regular status updates every 7 days until resolution.
- **Public Disclosure:** Coordinated mutually after a patched release is published.

## Security Guarantees & Non-Vulnerabilities

Lumark enforces the following security boundaries:
- **Local-Only & Offline:** Lumark makes zero remote network calls and contains zero telemetry or analytics.
- **Sanitized DOM:** Arbitrary `<script>`, inline event handlers, and dangerous URL protocols (`javascript:`, `vbscript:`, `data:text/html`) are neutralized by design.
- **Scoped File Access:** Local file access is strictly restricted to user-initiated actions and active document directories.

Reports demonstrating attacks requiring administrative access, modified local binaries, or physical machine compromise are outside our threat model.
