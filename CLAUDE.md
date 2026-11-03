# Plan India — notes for Claude Code

- Static site, no build step. Open `index.html` or run `python3 -m http.server`.
- Deploys: push to `main` → Cloudflare (https://plan-india.rohitranjan1087.workers.dev) and
  GitHub Pages mirror. `npx wrangler deploy` publishes manually.
- **Commits are authored by the repository owner**, not by Claude:
  `git -c user.name="Rohit Ranjan" -c user.email="rohitranjan1087@gmail.com" commit …`
  (keep the `Co-Authored-By: Claude …` trailer).
- GitHub MCP server is registered at user scope on the owner's machine (see README), not in this repo.
