# BDS portfolio management

Open `portfolio-admin.html` on the deployed BDS site. The manager uses GitHub's authenticated Contents API and commits changes to `main`, which triggers the GitHub Pages workflow. Only repository collaborators with an appropriate token can write.

## Initial access
1. Sign in to the GitHub account authorized to edit `jofforka/BDS-CREATIVE-STUDIO`.
2. Create a **fine-grained personal access token** restricted to this repository with **Contents: Read and write**. Set a short expiration and do not grant other repositories.
3. Open the portfolio manager on a trusted device and enter the token. The application stores it in JavaScript memory only; it is not persisted across reloads.
4. Select department, type, title, category, description, media and visibility, then save. Editing, adding and removing listings updates `content/portfolio.json`.
5. Wait for the GitHub Pages deployment to complete and refresh the public page.

## Media
- Images: JPEG, PNG, WebP. Videos: MP4. Audio: MP3, OGG.
- Browser uploads are capped at 15 MB for reliability. Larger videos should use an approved HTTPS-hosted URL; the admin accepts HTTPS URLs.
- Removing a portfolio entry **does not delete its media file**. Review orphaned media under `assets/portfolio/` separately before deletion.
- Media changes are public after deployment; do not upload private or unapproved client material.
- Check third-party rights before using demonstration content.

## Security and limitations
This is a GitHub-backed content management interface, not a separate server with staff accounts. The editor page itself is publicly accessible, but GitHub enforces write authorization. Never embed a token in source files, links, screenshots or chat. Avoid entering tokens on shared devices. For delegated nontechnical staff access, implement a server-side OAuth gateway with role restrictions before inviting them. GitHub commits and deployments may take time to appear. The editor is not a live-upload service and should not be used for large raw video files.
