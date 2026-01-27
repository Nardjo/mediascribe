#!/usr/bin/env python3
"""
Extract clean article content from a URL using stdlib only.

Usage: extract-article.py <url>
Outputs JSON with title and content.
"""

import sys
import json
import re
import urllib.request
import urllib.error
import html.parser
import ssl


def clean_url(url):
    """Remove tracking parameters from URL."""
    url = re.sub(r'[?&]utm_[^&]*', '', url)
    url = re.sub(r'[?&]ref=[^&]*', '', url)
    url = re.sub(r'[?&]source=[^&]*', '', url)
    url = re.sub(r'\?$', '', url)
    return url


def decode_html_entities(text):
    """Decode HTML entities."""
    h = html.parser.HTMLParser()
    # Common entities
    entities = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&#39;': "'",
        '&mdash;': '—',
        '&ndash;': '–',
        '&hellip;': '…',
        '&rsquo;': "'",
        '&lsquo;': "'",
        '&rdquo;': '"',
        '&ldquo;': '"',
        '&copy;': '©',
        '&reg;': '®',
        '&trade;': '™',
    }
    for entity, char in entities.items():
        text = text.replace(entity, char)
    # Numeric entities
    text = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), text)
    text = re.sub(r'&#x([0-9a-fA-F]+);', lambda m: chr(int(m.group(1), 16)), text)
    return text


def extract_article_content(html_content):
    """Extract main article content from HTML."""

    # Extract title
    title = None
    # Try og:title first
    og_title = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', html_content, re.IGNORECASE)
    if not og_title:
        og_title = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']', html_content, re.IGNORECASE)
    if og_title:
        title = og_title.group(1)
    else:
        # Fallback to <title>
        title_match = re.search(r'<title>([^<]+)</title>', html_content, re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()
            # Clean up common suffixes
            title = re.sub(r'\s*[-|»]\s*[^-|»]+$', '', title)

    # Remove unwanted sections first
    content = html_content

    # Remove script, style, nav, header, footer, aside, comments
    patterns_to_remove = [
        (r'<script[^>]*>.*?</script>', re.DOTALL | re.IGNORECASE),
        (r'<style[^>]*>.*?</style>', re.DOTALL | re.IGNORECASE),
        (r'<nav[^>]*>.*?</nav>', re.DOTALL | re.IGNORECASE),
        (r'<header[^>]*>.*?</header>', re.DOTALL | re.IGNORECASE),
        (r'<footer[^>]*>.*?</footer>', re.DOTALL | re.IGNORECASE),
        (r'<aside[^>]*>.*?</aside>', re.DOTALL | re.IGNORECASE),
        (r'<form[^>]*>.*?</form>', re.DOTALL | re.IGNORECASE),
        (r'<!--.*?-->', re.DOTALL),
        (r'<noscript[^>]*>.*?</noscript>', re.DOTALL | re.IGNORECASE),
        (r'<iframe[^>]*>.*?</iframe>', re.DOTALL | re.IGNORECASE),
    ]

    for pattern, flags in patterns_to_remove:
        content = re.sub(pattern, '', content, flags=flags)

    # Try to find main content area
    main_content = None

    # Priority order: article > main > div with article-like class
    article_match = re.search(r'<article[^>]*>(.*?)</article>', content, flags=re.DOTALL | re.IGNORECASE)
    if article_match:
        main_content = article_match.group(1)
    else:
        main_match = re.search(r'<main[^>]*>(.*?)</main>', content, flags=re.DOTALL | re.IGNORECASE)
        if main_match:
            main_content = main_match.group(1)
        else:
            # Try common content div patterns
            for class_pattern in ['post-content', 'article-content', 'entry-content', 'content-body', 'article-body', 'post-body']:
                div_match = re.search(rf'<div[^>]*class=["\'][^"\']*{class_pattern}[^"\']*["\'][^>]*>(.*?)</div>', content, flags=re.DOTALL | re.IGNORECASE)
                if div_match:
                    main_content = div_match.group(1)
                    break

    if main_content:
        content = main_content

    # Convert headings to markdown-style
    content = re.sub(r'<h1[^>]*>(.*?)</h1>', r'\n# \1\n', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<h2[^>]*>(.*?)</h2>', r'\n## \1\n', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<h3[^>]*>(.*?)</h3>', r'\n### \1\n', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<h4[^>]*>(.*?)</h4>', r'\n#### \1\n', content, flags=re.DOTALL | re.IGNORECASE)

    # Convert paragraphs and line breaks
    content = re.sub(r'<p[^>]*>', '\n\n', content, flags=re.IGNORECASE)
    content = re.sub(r'</p>', '', content, flags=re.IGNORECASE)
    content = re.sub(r'<br\s*/?>', '\n', content, flags=re.IGNORECASE)

    # Convert lists
    content = re.sub(r'<li[^>]*>', '\n• ', content, flags=re.IGNORECASE)
    content = re.sub(r'</li>', '', content, flags=re.IGNORECASE)
    content = re.sub(r'</?[ou]l[^>]*>', '\n', content, flags=re.IGNORECASE)

    # Convert blockquotes
    content = re.sub(r'<blockquote[^>]*>(.*?)</blockquote>', r'\n> \1\n', content, flags=re.DOTALL | re.IGNORECASE)

    # Convert bold/italic
    content = re.sub(r'<(b|strong)[^>]*>(.*?)</\1>', r'**\2**', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<(i|em)[^>]*>(.*?)</\1>', r'*\2*', content, flags=re.DOTALL | re.IGNORECASE)

    # Extract link text (remove href)
    content = re.sub(r'<a[^>]*>(.*?)</a>', r'\1', content, flags=re.DOTALL | re.IGNORECASE)

    # Remove remaining HTML tags
    content = re.sub(r'<[^>]+>', ' ', content)

    # Decode HTML entities
    content = decode_html_entities(content)

    # Clean up whitespace
    content = re.sub(r'[ \t]+', ' ', content)  # Multiple spaces to single
    content = re.sub(r'\n[ \t]+', '\n', content)  # Leading whitespace on lines
    content = re.sub(r'[ \t]+\n', '\n', content)  # Trailing whitespace on lines
    content = re.sub(r'\n{3,}', '\n\n', content)  # Multiple blank lines to double
    content = content.strip()

    # Clean title too
    if title:
        title = decode_html_entities(title)
        title = re.sub(r'\s+', ' ', title).strip()

    return title, content


def fetch_url(url):
    """Fetch URL content with proper headers."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
    }

    # Create SSL context that doesn't verify (some sites have issues)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30, context=ctx) as response:
            # Try to detect encoding
            charset = response.headers.get_content_charset() or 'utf-8'
            html_bytes = response.read()
            try:
                return html_bytes.decode(charset)
            except UnicodeDecodeError:
                return html_bytes.decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error fetching URL: {e}", file=sys.stderr)
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: extract-article.py <url>", file=sys.stderr)
        sys.exit(1)

    url = clean_url(sys.argv[1])

    html_content = fetch_url(url)
    if not html_content:
        print(json.dumps({"error": "Failed to fetch URL"}))
        sys.exit(1)

    title, content = extract_article_content(html_content)

    if not content or len(content) < 100:
        print(json.dumps({"error": "Could not extract meaningful content"}))
        sys.exit(1)

    if not title or len(title) < 3:
        title = "Article sans titre"

    result = {
        "title": title,
        "content": content
    }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
