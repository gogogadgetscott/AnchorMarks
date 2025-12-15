# AnchorMarks Flow Launcher Plugin

Search and open bookmarks from your AnchorMarks bookmark manager directly from Flow Launcher.

## Installation

1. Copy this entire `flow-launcher-plugin` folder to your Flow Launcher plugins directory:
   - Usually: `%APPDATA%\FlowLauncher\Plugins\AnchorMarks-1.0.0`

2. Install the required Python dependency:

   ```
   pip install requests
   ```

3. Restart Flow Launcher

4. Configure the plugin:
   - Press `Alt+Space` to open Flow Launcher
   - Type: `lv config http://localhost:3000 your_api_key`
   - Press Enter to save

## Usage

| Command                 | Description                    |
| ----------------------- | ------------------------------ |
| `lv`                    | Show your top/recent bookmarks |
| `lv <query>`            | Search bookmarks               |
| `lv add <url>`          | Add a new bookmark             |
| `lv open`               | Open AnchorMarks in browser    |
| `lv config <url> <key>` | Configure server and API key   |

## Examples

- `lv github` - Search for bookmarks containing "github"
- `lv add https://example.com` - Add a new bookmark
- `lv config http://localhost:3000 lv_abc123` - Configure the plugin

## Getting Your API Key

1. Open AnchorMarks in your browser (http://localhost:3000)
2. Login to your account
3. Go to Settings (gear icon)
4. Click on "API Access" tab
5. Copy your API key

## Troubleshooting

- **"Cannot connect to AnchorMarks"**: Make sure the AnchorMarks server is running
- **"Missing 'requests' library"**: Run `pip install requests`
- **No results**: Check if you have bookmarks in AnchorMarks
