# How to release a new version

## Step 1 — Bump the version
In `frontend/package.json`, change the version number:

```json
"version": "1.0.0"  →  "version": "1.0.1"
```

Rules:
- Bug fix only          → bump PATCH  (1.0.0 → 1.0.1)
- New feature added     → bump MINOR  (1.0.0 → 1.1.0)
- Breaking change       → bump MAJOR  (1.0.0 → 2.0.0)

## Step 2 — Commit the version bump
```bash
cd frontend
git add package.json
git commit -m "chore: bump version to 1.0.1"
```

## Step 3 — Create and push a version tag
```bash
git tag v1.0.1
git push origin main
git push origin v1.0.1
```

## Step 4 — GitHub Actions builds the exe automatically
The `release.yml` workflow triggers on the tag push.
It builds the .exe and uploads it to GitHub Releases.
Check progress at: https://github.com/YOUR_USERNAME/YOUR_REPO/actions

## Step 5 — Existing users get notified
When existing users open their app, it checks GitHub Releases automatically.
If v1.0.1 is available and they have v1.0.0, they see the update dialog.

## Manual build (without GitHub Actions)
```bash
cd frontend
npm run release
```
Requires `GH_TOKEN` environment variable set locally.
