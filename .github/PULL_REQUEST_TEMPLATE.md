## Summary

Provide a concise summary of the purpose, changes, and motivations in this pull request.

## Related Issues / Requirements

- Fixes #(issue number)
- Related Specification / Epic / Story: (e.g., `docs/PRD.md §7`, `docs/stories/US-015-...`)

## Type of Change

- [ ] `feat`: New feature or capability
- [ ] `fix`: Bug fix
- [ ] `docs`: Documentation addition or update
- [ ] `refactor`: Code refactoring without behavior change
- [ ] `perf`: Performance improvement
- [ ] `test`: New or modified tests
- [ ] `build` / `ci`: Toolchain, packaging, or CI workflow changes

## Checklist

- [ ] My code follows the repository's architectural guidelines (local-first, offline, zero telemetry, DOM sanitization).
- [ ] All automated tests pass locally:
  - [ ] `npm test` (Frontend unit and component tests)
  - [ ] `go test ./...` (Go backend unit tests)
- [ ] Relevant specialized test suites pass (if applicable):
  - [ ] `npm run test:security` (Security & sanitizer corpus)
  - [ ] `npm run test:fixtures` (Golden markdown fixtures)
  - [ ] `npm run test:offline` (Network isolation verification)
- [ ] Code formatting and linting pass (`goimports`, `npm run lint` / `tsc`).
- [ ] Documentation has been added or updated (`README.md`, `docs/`).
- [ ] `CHANGELOG.md` has been updated under the `[Unreleased]` section.
- [ ] Commits follow the [Conventional Commits](https://www.conventionalcommits.org/) format.
