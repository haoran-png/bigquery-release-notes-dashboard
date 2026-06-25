import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache
_cache = {
    "data": None,
    "last_fetched": None
}

def clean_text(html_str):
    """Strips HTML tags and unescapes entities to return plain text."""
    if not html_str:
        return ""
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', '', html_str)
    # Unescape HTML entities (e.g. &lt; to <)
    text = html.unescape(text)
    # Normalize whitespaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_xml_feed(xml_content):
    """Parses Atom feed XML content into structured JSON-serializable list of updates."""
    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        print(f"XML Parsing Error: {e}")
        return []

    # Atom namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    updates = []
    
    # Process each entry (corresponds to a date group)
    for entry_idx, entry in enumerate(root.findall('atom:entry', ns)):
        date_str = entry.find('atom:title', ns).text or "Unknown Date"
        link_el = entry.find('atom:link', ns)
        link = link_el.attrib.get('href', '') if link_el is not None else ''
        
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ''
        
        # Split the HTML content by <h3> headers to separate individual updates
        parts = re.split(r'(?i)<h3>', content_html)
        
        for part_idx, part in enumerate(parts):
            part = part.strip()
            if not part:
                continue
            
            sub_parts = re.split(r'(?i)</h3>', part, maxsplit=1)
            if len(sub_parts) == 2:
                update_type = sub_parts[0].strip()
                update_html = sub_parts[1].strip()
            else:
                update_type = "Update"
                update_html = part
            
            # Clean text for previewing/tweeting
            raw_text = clean_text(update_html)
            
            # Generate a stable unique identifier
            unique_id = f"entry-{entry_idx}-part-{part_idx}"
            
            updates.append({
                "id": unique_id,
                "date": date_str,
                "type": update_type,
                "content_html": update_html,
                "raw_text": raw_text,
                "link": link
            })
            
    return updates

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/release-notes")
def get_release_notes():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    
    # Check cache (10 minutes TTL)
    now = datetime.now()
    if not force_refresh and _cache["data"] and _cache["last_fetched"]:
        elapsed = (now - _cache["last_fetched"]).total_seconds()
        if elapsed < 600:  # 10 minutes
            return jsonify({
                "status": "success",
                "source": "cache",
                "last_fetched": _cache["last_fetched"].isoformat(),
                "updates": _cache["data"]
            })
            
    try:
        headers = {
            "User-Agent": "BigQueryReleaseNotesReader/1.0 (Flask app)"
        }
        res = requests.get(FEED_URL, headers=headers, timeout=15)
        res.raise_for_status()
        
        updates = parse_xml_feed(res.content)
        
        # Save to cache
        _cache["data"] = updates
        _cache["last_fetched"] = now
        
        return jsonify({
            "status": "success",
            "source": "live",
            "last_fetched": now.isoformat(),
            "updates": updates
        })
    except Exception as e:
        # If live fetch fails but we have cached data, fall back to cache
        if _cache["data"]:
            return jsonify({
                "status": "warning",
                "message": f"Failed to fetch live feed: {str(e)}. Showing cached data.",
                "source": "cache_fallback",
                "last_fetched": _cache["last_fetched"].isoformat() if _cache["last_fetched"] else None,
                "updates": _cache["data"]
            })
            
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch release notes: {str(e)}"
        }), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
