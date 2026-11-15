# BDS Portfolio Publishing Guide

The three showcase pages read `content/portfolio.json`. **No client projects are prepopulated**; publish only work BDS owns or is authorized to show.

## Social media links
Replace each `null` in `social` with the verified full HTTPS URL for the official BDS account (e.g., Instagram, YouTube, TikTok, Facebook, SoundCloud, Spotify). Leave unknown links as `null`. The links will then appear on all department pages.

## Add a project
Add an object to the `projects` array, for example:

```json
{
  "id": "approved-project-slug",
  "department": "photography",
  "category": "Portraits",
  "type": "image",
  "title": "Approved project title",
  "description": "Client-approved project description",
  "alt": "Accessible description of the photograph",
  "media": "assets/portfolio/approved-project.webp",
  "sourceUrl": "https://www.instagram.com/p/actual-approved-post/",
  "published": true
}
```

The example above is **a template, not a real BDS project**. Don't publish it as-is.

- `department`: `photography`, `film`, or `sound`.
- `type`: `image` for photography; `image` or `video` for film; `image`, `video`, or `audio` for sound.
- `media`: approved file stored under `assets/portfolio/` or a trusted HTTPS media URL. Supported file extensions: `.jpg`, `.jpeg`, `.png`, `.webp`, `.mp4`, `.mp3`, `.ogg`.
- `poster`: optional poster image for video previews.
- `sourceUrl`: optional original publication URL; never guess.
- `published`: only `true` makes a project visible.
- If using an external media URL, verify content permissions, CORS where relevant, availability and performance.

## Workflow
1. Obtain client permission and confirm credits, media rights, and privacy.
2. Optimize images and videos for mobile; provide useful alternative text.
3. Upload media to `assets/portfolio/`.
4. Add project metadata with `published: false` and review on a feature branch.
5. Set `published: true` after approval and merge through CI.
6. Verify published content and external social links in a browser.

The current site is a **file-managed portfolio**. It is not yet an authenticated CMS/admin dashboard. Do not place private media or API secrets in this public repository.

## Demo content currently enabled

The sample portfolio includes **three photography samples, three film samples (including a playable sample video), and three sound samples (including playable sample audio)**. Every sample has `demo: true`, and the public interface labels them **SAMPLE — NOT BDS WORK**. These are third-party demonstration media links; their availability and licensing should be rechecked before commercial use.

To replace a sample: upload approved media to `assets/portfolio/`, change its `media` path and project metadata, remove `demo: true`, and retain `published: true` only after permission and QA. When all samples are replaced, set `demoMode: false`. Social media links are still null and must be filled with official verified URLs.

**No admin upload interface exists yet**. The current replacement process is GitHub file editing, not a browser-based client upload form. For a true client CMS, add authenticated storage, upload validation, moderation and a protected admin dashboard in a later release.
