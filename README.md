# Michat88's Nuvio Providers

A collection of local scrapers for the Nuvio streaming application. These scrapers allow you to fetch streams from various sources directly within the app.

## Installation

1. Open Nuvio app
2. Go to Settings → Local Scrapers
3. Add this repository URL (**Copy exactly as shown below**):
   ```
   https://raw.githubusercontent.com/michat88/nuvio-providers/refs/heads/main/
   ```
   > **Note:** The `refs/heads/main/` part is required by the Nuvio app. Do not remove it.

4. Enable the scrapers you want to use (e.g., Kisskh, MovieBox)

## Scraper Development

**💡 Tip:** Check existing scrapers in the `providers/` directory for real working examples before starting your own.

### Core Function
**⚠️ IMPORTANT:** Your scraper must use Promise-based approach only. **async/await is NOT supported** in this sandboxed environment.

Your scraper must export a `getStreams` function that returns a Promise:

```javascript
function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return new Promise((resolve, reject) => {
    // Your scraping logic here - NO async/await allowed
    // Use .then() and .catch() for all async operations
    // Return array of stream objects or empty array on error
    resolve(streams);
  });
}

// Export for React Native compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
```

**Parameters:**
- `tmdbId` (string): TMDB ID
- `mediaType` (string): "movie" or "tv"
- `seasonNum` (number): Season number (TV only)
- `episodeNum` (number): Episode number (TV only)

### Stream Object Format
Each stream must return this exact format (see `providers/moviebox.js` for real examples):

```javascript
{
  name: "MovieBox - 1080p",          // Provider + server name
  title: "Movie Title (2024)",       // Media title with year
  url: "https://stream.url",         // Direct stream URL
  quality: "1080p",                  // Quality (720p, 1080p, 4K, etc.)
  size: "Unknown",                   // Optional file size
  headers: WORKING_HEADERS,          // Required headers for playback
  provider: "moviebox"               // Provider identifier
}
```

### React Native Compatibility
- **❌ async/await is NOT supported** in this sandboxed environment
- **✅ Promise-based approach is COMPULSORY** - use `.then()` and `.catch()`
- Use `fetch()` for HTTP requests (no axios)
- Use `cheerio-without-node-native` for HTML parsing
- Avoid Node.js modules (fs, path, crypto)

### Manifest Entry
Add your scraper to `manifest.json`. If you have set up the GitHub Action, this will happen automatically when you push a new `.js` file to the `providers` folder.

Manual entry example:
```json
{
  "id": "kisskh",
  "name": "Kisskh",
  "description": "Asian Drama & Anime streaming",
  "version": "1.0.0",
  "author": "Michat88",
  "supportedTypes": ["movie", "tv"],
  "filename": "providers/kisskh.js",
  "enabled": true,
  "formats": ["mp4"],
  "logo": "https://kisskh.ovh/favicon.ico",
  "contentLanguage": ["en", "id"]
}
```

## Contributing to this Repo

### Development Workflow

1. **Clone this repository**
   ```bash
   git clone https://github.com/michat88/nuvio-providers.git
   cd nuvio-providers
   ```

2. **Create a new scraper**
   - Create `providers/newscraper.js`
   - (Optional) The GitHub Action will update `manifest.json` automatically upon push.

3. **Commit and push**
   ```bash
   git add .
   git commit -m "Add NewScraper"
   git push origin main
   ```

### Code Review Checklist

Before submitting, ensure your scraper:

- [ ] **Follows naming conventions** (camelCase, descriptive names)
- [ ] **Has proper error handling** (try-catch blocks, graceful failures)
- [ ] **Is React Native compatible** (no Node.js modules, uses fetch())
- [ ] **Respects rate limits** (reasonable delays between requests)
- [ ] **Returns proper stream objects** (correct format and required fields)

---

## 🧰 Tools & Technologies

<p align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=javascript,nodejs,github,githubactions&theme=light&perline=4" />
  </a>
</p>

---

## 📄 License

[![GNU GPLv3 Image](https://www.gnu.org/graphics/gplv3-127x51.png)]([http://www.gnu.org/licenses/gpl-3.0.en.html](http://www.gnu.org/licenses/gpl-3.0.en.html))

These scrapers are **free software**: you can use, study, share, and modify them as you wish.

They are distributed under the terms of the [GNU General Public License](https://www.gnu.org/licenses/gpl.html) version 3 or later, published by the Free Software Foundation.

---

## ⚖️ DMCA Disclaimer

We hereby issue this notice to clarify that these scrapers function similarly to a standard web browser by fetching video files from the internet.

- **No content is hosted by this repository or the Nuvio application.**
- Any content accessed is hosted by third-party websites.
- Users are solely responsible for their usage and must comply with their local laws.

If you believe content is violating copyright laws, please contact the **actual file hosts**, **not** the developers of this repository or the Nuvio app.

---

**Thank You for using Michat88's Nuvio Providers!**
