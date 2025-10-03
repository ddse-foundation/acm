# Publishing Guide

This guide explains how to publish the ACM packages to npm for public use.

## Prerequisites

- npm account with publishing permissions
- 2FA enabled (recommended)
- Access to @acm scope on npm (or use a different scope)

## Preparation

### 1. Update Version Numbers

Edit version in all package.json files (or use a tool):

```bash
# Update all packages to version 0.1.0
for pkg in packages/*/package.json; do
  sed -i 's/"version": ".*"/"version": "0.1.0"/' "$pkg"
done
```

### 2. Update Package Names (If Needed)

If you need to use a different npm scope, update all package.json files:

```bash
# Replace @acm with your scope (e.g., @yourorg)
find packages -name package.json -exec sed -i 's/@acm/@yourorg/g' {} \;
```

Also update references in:
- Import statements in source files
- README examples
- tsconfig.json references

### 3. Add npm-specific Fields

Update root package.json:

```json
{
  "publishConfig": {
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/ddse-foundation/acm.git"
  },
  "bugs": {
    "url": "https://github.com/ddse-foundation/acm/issues"
  },
  "homepage": "https://github.com/ddse-foundation/acm/tree/main/framework/node"
}
```

Add to each package's package.json:

```json
{
  "publishConfig": {
    "access": "public"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "author": "DDSE Foundation",
  "repository": {
    "type": "git",
    "url": "https://github.com/ddse-foundation/acm.git",
    "directory": "framework/node/packages/<package-name>"
  }
}
```

### 4. Add LICENSE Files

Create LICENSE in root and each package (if using Apache-2.0):

```
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

[Full Apache 2.0 license text]
```

### 5. Clean and Rebuild

```bash
pnpm clean
pnpm install
pnpm build
```

## Publishing

### Option 1: Manual Publishing

Publish packages in dependency order:

```bash
# 1. SDK (no dependencies)
cd packages/acm-sdk
npm publish --access public

# 2. Runtime, LLM (depend on SDK)
cd ../acm-runtime
npm publish --access public

cd ../acm-llm
npm publish --access public

# 3. Planner (depends on SDK, LLM)
cd ../acm-planner
npm publish --access public

# 4. Examples (depends on all)
cd ../acm-examples
npm publish --access public
```

### Option 2: Using pnpm

From the root:

```bash
pnpm publish -r --access public
```

### Option 3: Using changesets (Recommended)

Install changesets:

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

Create a changeset:

```bash
pnpm changeset
# Select packages to publish
# Choose version bump (patch/minor/major)
# Write changelog
```

Version packages:

```bash
pnpm changeset version
```

Publish:

```bash
pnpm changeset publish
```

## Verification

After publishing, verify:

```bash
# Check package is available
npm info @acm/sdk

# Test installation
mkdir /tmp/test-acm
cd /tmp/test-acm
npm init -y
npm install @acm/sdk @acm/runtime @acm/llm @acm/planner

# Try importing
node -e "import('@acm/sdk').then(m => console.log(Object.keys(m)))"
```

## Post-Publishing

### 1. Tag the Release

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

### 2. Create GitHub Release

1. Go to https://github.com/ddse-foundation/acm/releases
2. Click "Draft a new release"
3. Select tag v0.1.0
4. Title: "ACM Node.js Framework v0.1.0"
5. Description: Paste from IMPLEMENTATION_SUMMARY.md
6. Attach any binaries if needed
7. Publish release

### 3. Update Documentation

Update README.md installation instructions:

```bash
npm install @acm/sdk @acm/runtime @acm/llm @acm/planner
```

### 4. Announce

- Post to GitHub Discussions
- Update project README
- Social media announcements
- Community forums

## Version Strategy

Use semantic versioning (semver):

- **Major (1.0.0)**: Breaking API changes
- **Minor (0.1.0)**: New features, backward compatible
- **Patch (0.1.1)**: Bug fixes, backward compatible

### Suggested Roadmap

- **v0.1.0**: Initial release (current implementation)
- **v0.2.0**: MCP integration, more examples
- **v0.3.0**: LangGraph/MS AF adapters
- **v0.4.0**: Replay bundle export, OPA integration
- **v0.5.0**: Performance optimizations, edge cases
- **v1.0.0**: Production-ready, stable API

## Maintenance

### Regular Updates

1. Update dependencies monthly:
   ```bash
   pnpm update -r
   ```

2. Rebuild and test:
   ```bash
   pnpm clean && pnpm build
   ```

3. Publish patch version if needed

### Security Updates

1. Check for vulnerabilities:
   ```bash
   pnpm audit
   ```

2. Fix critical issues immediately:
   ```bash
   pnpm audit fix
   ```

3. Publish patch version

### Breaking Changes

1. Increment major version
2. Document migration guide
3. Keep old version maintained for 6 months
4. Deprecate after 1 year

## Troubleshooting

### "403 Forbidden"
- Check npm authentication: `npm whoami`
- Login: `npm login`
- Check organization access

### "Version already exists"
- Increment version in package.json
- Cannot republish same version

### "Package name taken"
- Use scoped package (@yourorg/acm-sdk)
- Or choose different name

### "Build artifacts missing"
- Run `pnpm build` before publishing
- Check `files` field in package.json
- Verify dist/ directory exists

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm publish -r --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Add NPM_TOKEN to repository secrets.

## Support

After publishing:

1. Monitor npm downloads: https://npm-stat.com
2. Watch GitHub issues
3. Respond to questions
4. Update documentation based on feedback
5. Release patches for bugs

## Checklist

Before publishing v0.1.0:

- [ ] All packages build successfully
- [ ] Version numbers updated
- [ ] LICENSE files added
- [ ] publishConfig set to public
- [ ] Repository URLs added
- [ ] README examples updated
- [ ] CHANGELOG.md created
- [ ] Git tag ready
- [ ] npm credentials configured
- [ ] 2FA enabled
- [ ] Dry run tested (`npm publish --dry-run`)

After publishing:

- [ ] Packages visible on npm
- [ ] Installation tested
- [ ] GitHub release created
- [ ] Documentation updated
- [ ] Community announced

---

Good luck with your first release! 🚀
