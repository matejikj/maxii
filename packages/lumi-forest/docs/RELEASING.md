# Release gates and publishing

1. **Claim package namespace / license.** `@lumi/forest-design` has been used as a local package name; ownership is not verified. The package is `UNLICENSED`. Choose and review an appropriate license and package name before any public npm publication.
2. **Reproducible dependency graph.** On a machine with npm connectivity run `npm install --package-lock-only --ignore-scripts`, then `npm ci` and commit the resulting `package-lock.json`. Without it the release workflow is intentionally blocked. CI may temporarily run `npm install` for development but is not reproducible.
3. **Build and test.** `npm run build` uses pinned `react-native-builder-bob` to generate `lib/module` and `.d.ts`. Run full `npm run typecheck:all`, `npm run test:all`, `expo:doctor`, Android and iOS Metro exports, Storybook export, and run `npm run release:verify-package` and `npm run release:smoke-core` to ensure the actual Bob ESM and declarations exist, then inspect the resulting `.tgz` with `npm pack --dry-run --ignore-scripts`. A source-only tarball is NOT releasable.
4. **Native release evidence.** Add sanitized, peer-reviewed physical Android/iPhone captures and `release-evidence/manifest.json` for this exact git SHA. Run `npm run release:verify-device`. Synthetic data cannot be used.
5. **Manual candidate.** Create an annotated tag `v1.0.0` and invoke GitHub Actions `release.yml` with that tag. It requires an approving reviewer in the `lumi-release-approval` environment; it creates a **draft** GitHub Release with an npm tarball but does **not** publish to npm.
6. **Optional npm publication.** Configure an npm *trusted publisher* matching workflow `publish-npm.yml` and the owned package scope. Approve the `npm-publish-approval` GitHub environment; invoke the workflow manually with the audited tag. It uses ephemeral OIDC credentials, not a long-lived npm token. Never enable automatic publishing without reviewing the checks.

## What is not automated

Physical devices are not attached to cloud CI by default. The evidence schema can verify required fields, numerical thresholds and trace existence, but cannot prove device authenticity, GPU usage, thermals or verify screenshots. Mobile device labs and human performance review are release prerequisites.

## Rollback

Since the library is versioned using SemVer, roll consumers back to the previous tested npm version or vetted tarball. Never overwrite an existing npm version. Store v1 SceneRecipe v2 records alongside a prior backup before performing app-side data migration. Restore the backup on app rollback if a later schema isn't supported.
