# Contributing to Lumark

Thank you for your interest in contributing to Lumark! Lumark is a dedicated, fast, cross-platform desktop application designed to render local Markdown documents richly, securely, and offline.

## Core Architectural Invariants

Before contributing code, please note our core project invariants:
- **Viewer-First:** Lumark is a dedicated document reader. It does not mutate or write back to user documents.
- **Strictly Offline & Local-First:** Rendering documents, syntax highlighting, LaTeX math, and Mermaid diagrams must never trigger remote network requests. Zero telemetry, crash pings, or analytics.
- **Safe by Default:** Documents are treated as untrusted input. All HTML/CSS and SVG content passes through strict sanitization filters (`rehype-sanitize`). Untrusted scripts, event handlers, and arbitrary URL protocols are neutralized before rendering.
- **First-Class Bidirectional Support:** Mixed Persian/Arabic RTL and English LTR text must render correctly with block-level auto-detection, while non-prose elements (code blocks, math formulas, diagrams) remain strictly LTR.

For detailed architecture and requirements, see [`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md) and [`docs/PRD.md`](docs/PRD.md).

---

## Development Environment Setup

### Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| **Go** | `1.26.0+` (toolchain `1.26.10`) | [go.dev/dl](https://go.dev/dl/) |
| **Node.js** | `v22.x LTS` | [nodejs.org](https://nodejs.org/) |
| **npm** | `v10.x+` | Bundled with Node.js |
| **Wails v3 CLI** | `v3.0.0-beta.34` | Pinned CLI: `go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-beta.34` |
| **Task (go-task)** | `v3.x` | [taskfile.dev](https://taskfile.dev/installation/) |

#### Platform-Specific Native Libraries

- **Linux (Ubuntu / Debian):**
  ```bash
  sudo apt-get update
  sudo apt-get install -y libgtk-4-dev libwebkitgtk-6.0-dev libgtk-3-dev libwebkit2gtk-4.1-dev build-essential pkg-config desktop-file-utils
  ```
- **macOS:**
  - Xcode Command Line Tools (`xcode-select --install`)
  - Optional for DMG packaging: `brew install create-dmg`
- **Windows:**
  - C++ Build Tools (via Visual Studio Installer or MinGW/MSYS2)
  - Optional for NSIS installer packaging: [NSIS](https://nsis.sourceforge.io/)

### Initializing the Workspace

```bash
# Clone the repository
git clone https://github.com/yahya-mehrabani/Lumark.git
cd Lumark

# Install frontend dependencies
cd frontend && npm ci && cd ..

# Verify Wails v3 CLI installation
wails3 version
```

---

## Development Workflow

### Running in Development Mode

Run the Wails live development server with hot-module reloading:
```bash
npm run dev
# or
wails3 dev -config ./build/config.yml
```

### Running Test Suites

Verify changes against our automated test suites:

```bash
# Frontend unit and component tests (Vitest)
npm test

# Backend Go unit tests
go test ./...

# Adversarial security & sanitizer test corpus
npm run test:security

# Golden Markdown and RTL fixture test suite
npm run test:fixtures

# Offline integrity verification (asserts zero external network calls)
npm run test:offline

# Rendering latency & memory benchmark suite
npm run benchmark
```

---

## Branching & Pull Request Process

1. **Fork the Repository:** Create a personal fork on GitHub.
2. **Branch Naming:** Create a focused feature branch from `main`:
   - `feat/feature-name`
   - `fix/bug-description`
   - `docs/documentation-update`
   - `refactor/clean-up-component`
3. **Keep Commits Focused:** Commit related changes together; do not mix unrelated refactorings or cosmetic adjustments into a feature PR.
4. **Run Verification:** Ensure all tests pass (`npm test`, `go test ./...`).
5. **Open a Pull Request:** Submit your PR against `main` using our pull request template. Ensure the checklist is completed.

---

## Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Allowed Types
- `feat`: A new feature or user-visible capability
- `fix`: A bug fix or defect correction
- `docs`: Documentation updates or additions
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `style`: Changes that do not affect code logic (formatting, CSS polishing)
- `perf`: Performance improvements
- `test`: Adding or correcting tests
- `build`: Changes to build systems or dependencies (Taskfile, package.json, go.mod)
- `ci`: Changes to CI configuration or workflow files (.github/workflows)
- `chore`: Routine maintenance or tooling updates

### Examples from History
- `feat(rendering): add syntax highlighting for shell scripts`
- `fix(bidi): resolve text alignment in nested lists`
- `docs: update packaging guide with macOS Gatekeeper steps`
- `ci(workflows): add universal macOS artifact build step`

---

## Code Style & Guidelines

### Go Backend
- Follow standard Go conventions (`gofmt`, `goimports`).
- Always use `filepath` utilities (`filepath.Join`, `filepath.Clean`) for cross-platform filesystem handling. Never hardcode `/` or `\`.
- Keep errors informative and wrapped with context using `fmt.Errorf("...: %w", err)`.
- Never execute external shell commands on user document paths.

### TypeScript / React Frontend
- Strict TypeScript: do not disable type checking or use `any` unless strictly necessary for third-party runtime boundary bridging.
- Accessible components: include standard ARIA attributes, semantic HTML elements, and keyboard navigability (`Escape`, `Enter`, arrows).
- Strict Sanitization: never use `dangerouslySetInnerHTML` directly on unsanitized document text. All rendering must pass through the `rehype-sanitize` pipeline.

---

## Code of Conduct

This project is governed by the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## License

By contributing to Lumark, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
