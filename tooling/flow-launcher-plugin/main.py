# -*- coding: utf-8 -*-
"""
AnchorMarks Flow Launcher Plugin
Search and open bookmarks from your AnchorMarks bookmark manager
"""

import json
import os
import webbrowser
from pathlib import Path

try:
    import requests
except ImportError:
    requests = None

from flowlauncher import FlowLauncher


class AnchorMarks(FlowLauncher):
    """AnchorMarks Flow Launcher Plugin"""
    
    def __init__(self):
        super().__init__()
        self.config_file = Path(__file__).parent / "config.json"
        self.load_config()
    
    def load_config(self):
        """Load configuration from config.json"""
        # Default to localhost:3000
        port = "3000"
        
        # Load config file
        config = {}
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
            except Exception:
                pass
        
        # Allow port override from config
        if "port" in config:
            port = str(config["port"])
            
        self.server_url = f"http://localhost:{port}"
        self.api_key = config.get("api_key", "")
        
        # Override server_url if explicitly set in config
        if "server_url" in config:
            self.server_url = config["server_url"]
    
    def save_config(self, server_url: str, api_key: str):
        """Save configuration to config.json"""
        try:
            # Read existing config
            config = {}
            if self.config_file.exists():
                try:
                    with open(self.config_file, 'r') as f:
                        config = json.load(f)
                except Exception:
                    pass
            
            # Update values
            config["server_url"] = server_url
            config["api_key"] = api_key
            
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
                
            self.server_url = server_url
            self.api_key = api_key
            return True
        except Exception:
            return False
    
    def api_request(self, endpoint: str, params: dict = None):
        """Make API request to AnchorMarks server"""
        if not requests:
            return None
        
        if not self.api_key:
            return None
        
        try:
            url = f"{self.server_url.rstrip('/')}/api{endpoint}"
            headers = {"X-API-Key": self.api_key}
            response = requests.get(url, headers=headers, params=params, timeout=5)
            
            if response.status_code == 200:
                return response.json()
        except Exception:
            pass
        
        return None
    
    def query(self, query: str):
        """Handle search query"""
        results = []
        
        # Check if requests library is available
        if not requests:
            return [{
                "Title": "Missing 'requests' library",
                "SubTitle": "Run: pip install requests",
                "IcoPath": "icon.png",
                "JsonRPCAction": {
                    "method": "open_url",
                    "parameters": ["https://pypi.org/project/requests/"]
                }
            }]
        
        # Handle configuration commands
        if query.startswith("config "):
            parts = query[7:].strip().split(" ", 1)
            if len(parts) == 2:
                return [{
                    "Title": f"Set API Key and connect to {parts[0]}",
                    "SubTitle": "Press Enter to save configuration",
                    "IcoPath": "icon.png",
                    "JsonRPCAction": {
                        "method": "configure",
                        "parameters": [parts[0], parts[1]]
                    }
                }]
            return [{
                "Title": "Configure AnchorMarks",
                "SubTitle": "Usage: lv config <server_url> <api_key>",
                "IcoPath": "icon.png"
            }]
        
        # Check if configured
        if not self.api_key:
            return [{
                "Title": "AnchorMarks not configured",
                "SubTitle": "Type: lv config http://localhost:3000 your_api_key",
                "IcoPath": "icon.png"
            }]
        
        # Handle special commands
        if query.strip() == "":
            # Show recent/popular bookmarks
            bookmarks = self.api_request("/quick-search", {"limit": 10})
            if bookmarks is None:
                return [{
                    "Title": "Cannot connect to AnchorMarks",
                    "SubTitle": f"Check if server is running at {self.server_url}",
                    "IcoPath": "icon.png"
                }]
            
            if not bookmarks:
                return [{
                    "Title": "No bookmarks found",
                    "SubTitle": "Add some bookmarks in AnchorMarks",
                    "IcoPath": "icon.png",
                    "JsonRPCAction": {
                        "method": "open_url",
                        "parameters": [self.server_url]
                    }
                }]
            
            results.append({
                "Title": "Your Top Bookmarks",
                "SubTitle": "Type to search or select a bookmark below",
                "IcoPath": "icon.png"
            })
            
            for bm in bookmarks:
                results.append(self._bookmark_to_result(bm))
            
            return results
        
        # Handle add command
        if query.startswith("add "):
            url = query[4:].strip()
            if url:
                return [{
                    "Title": f"Add bookmark: {url}",
                    "SubTitle": "Press Enter to add this URL to AnchorMarks",
                    "IcoPath": "icon.png",
                    "JsonRPCAction": {
                        "method": "add_bookmark",
                        "parameters": [url]
                    }
                }]
        
        # Handle open command
        if query.strip() == "open":
            return [{
                "Title": "Open AnchorMarks",
                "SubTitle": f"Open {self.server_url} in browser",
                "IcoPath": "icon.png",
                "JsonRPCAction": {
                    "method": "open_url",
                    "parameters": [self.server_url]
                }
            }]
        
        # Search bookmarks
        bookmarks = self.api_request("/quick-search", {"q": query, "limit": 15})
        
        if bookmarks is None:
            return [{
                "Title": "Cannot connect to AnchorMarks",
                "SubTitle": f"Check if server is running at {self.server_url}",
                "IcoPath": "icon.png"
            }]
        
        if not bookmarks:
            return [{
                "Title": f"No bookmarks found for '{query}'",
                "SubTitle": "Try a different search term",
                "IcoPath": "icon.png"
            }]
        
        for bm in bookmarks:
            results.append(self._bookmark_to_result(bm))
        
        return results
    
    def _bookmark_to_result(self, bookmark: dict):
        """Convert bookmark to Flow Launcher result"""
        title = bookmark.get("title", bookmark.get("url", "Untitled"))
        url = bookmark.get("url", "")
        favicon = bookmark.get("favicon", "")
        click_count = bookmark.get("click_count", 0)
        
        # Extract domain for subtitle
        try:
            from urllib.parse import urlparse
            domain = urlparse(url).netloc
        except Exception:
            domain = url
        
        subtitle = domain
        if click_count > 0:
            subtitle += f" • {click_count} clicks"
        
        result = {
            "Title": title,
            "SubTitle": subtitle,
            "IcoPath": "icon.png",  # Could use favicon if downloaded
            "JsonRPCAction": {
                "method": "open_bookmark",
                "parameters": [bookmark.get("id", ""), url]
            }
        }
        
        return result
    
    def open_url(self, url: str):
        """Open URL in default browser"""
        webbrowser.open(url)
    
    def open_bookmark(self, bookmark_id: str, url: str):
        """Open bookmark and track click"""
        # Track click
        if bookmark_id and requests:
            try:
                requests.post(
                    f"{self.server_url}/api/bookmarks/{bookmark_id}/click",
                    headers={"X-API-Key": self.api_key},
                    timeout=2
                )
            except Exception:
                pass
        
        # Open URL
        webbrowser.open(url)
    
    def add_bookmark(self, url: str):
        """Add a new bookmark"""
        if not requests:
            return
        
        try:
            response = requests.post(
                f"{self.server_url}/api/bookmarks",
                headers={
                    "X-API-Key": self.api_key,
                    "Content-Type": "application/json"
                },
                json={"url": url},
                timeout=5
            )
            
            if response.status_code == 200:
                # Show success notification (Flow Launcher will handle this)
                pass
        except Exception:
            pass
    
    def configure(self, server_url: str, api_key: str):
        """Save configuration"""
        self.save_config(server_url, api_key)


if __name__ == "__main__":
    AnchorMarks()
