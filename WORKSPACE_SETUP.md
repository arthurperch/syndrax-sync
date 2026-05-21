# Syndrax-Sync Workspace Setup

## Project Structure

This is the **MAIN BUILD** repository for the ecommerce sync browser extension.

### Repositories

| Project | Purpose | GitHub URL |
|---------|---------|------------|
| **syndrax-sync** | Main active build | https://github.com/arthurperch/syndrax-sync |
| EcomFlow-1 | Research/Reference (old version) | https://github.com/arthurperch/EcomFlow |

## VS Code Workspace

Open the workspace file for side-by-side research access:
```
c:\Users\olegp\OneDrive\Apps\ecomflow-workspace.code-workspace
```

This workspace includes:
- 📦 **syndrax-sync (MAIN BUILD)** - Active development here
- 📚 **EcomFlow-1 (RESEARCH REFERENCE)** - Review old code patterns

## Development Workflow

### Active Development
All new features and changes should be made in **syndrax-sync**.

### Research/Reverse Engineering
When you need to reference the old EcomFlow implementation:
1. Open files from EcomFlow-1 in read-only mode
2. Compare implementations side-by-side
3. Port useful patterns to syndrax-sync with improvements

### Git Commands (syndrax-sync)
```bash
# Check status
git status

# Stage and commit changes
git add -A
git commit -m "feat: description"

# Push to remote
git push origin master
```

## Quick Start

```bash
cd c:\Users\olegp\OneDrive\Apps\syndrax-sync

# Install dependencies
npm install

# Build extension
npm run build

# Development mode
npm run dev
```

---
*Last updated: May 2026*
