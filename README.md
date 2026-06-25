# BigQuery Release Notes Dashboard & Social Composer

An interactive dashboard built with Python Flask and vanilla HTML, CSS, and JavaScript that fetches Google Cloud's BigQuery Release Notes RSS/Atom feed and provides a social workspace to compose and share updates on X (Twitter).

## Features

- **Dynamic Sync**: Fetches the official Google Cloud BigQuery RSS/Atom release notes feed, with local caching for performance.
- **Visual Categorization**: Auto-categorizes release notes with sleek visual badges (Feature, Change, Breaking, Issue, Announcement).
- **Keyword Search**: Quick filtering of release notes via live search.
- **X/Twitter Web Intent Integration**: Select an update, edit the pre-populated draft (which automatically respects character limits), and tweet about it with a single click.
- **Polished Dark Theme**: Sleek glassmorphic card elements, custom scrollbars, and micro-animations.

## How to Run

1. **Clone the repository**:
   ```bash
   git clone <your-repository-url>
   cd bq-release-notes
   ```

2. **Set up the virtual environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install flask requests
   ```

4. **Start the server**:
   ```bash
   python app.py
   ```
   Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.
