#!/bin/bash

# A simple script to test the API endpoints of the AnchorMarks server.
# You can set the BASE_URL and API_TOKEN environment variables to customize 
# the API endpoint and authentication
# Example usage:
# BASE_URL="http://localhost:3000/api" API_TOKEN="your_token_here" ./test-api.sh

API_BASE_URL="${BASE_URL:-http://localhost:3000/api}"
API_TOKEN="${API_TOKEN:-${TOKEN:-}}"

# Do not print secrets if script uses xtrace
set +x 2>/dev/null || true

AUTH_HEADERS=()
if [[ -n "$API_TOKEN" ]]; then
  # Server supports API key in header and query param for API-key flows.
  AUTH_HEADERS+=(-H "X-API-Key: $API_TOKEN" -H "Authorization: Bearer $API_TOKEN")
fi

api_curl() {
  local method="$1"
  local path="$2"
  shift 2

  local url
  url="${BASE_URL}${path}"

  curl -sS -X "$method" \
    "${AUTH_HEADERS[@]}" \
    "$@" \
    "$url"
}

# Function to make a GET request
function get_request() {
  local endpoint=$1
  response=$(api_curl GET "/$endpoint")
  echo "GET $endpoint: $response"
}

# Function to make a POST request
function post_request() {
  local endpoint=$1
  local data=$2
  response=$(api_curl POST "/$endpoint" -H "Content-Type: application/json" -d "$data")
  echo "POST $endpoint: $response"
}

# Function to make a PUT request
function put_request() {
  local endpoint=$1
  local data=$2
  response=$(api_curl PUT "/$endpoint" -H "Content-Type: application/json" -d "$data")
  echo "PUT $endpoint: $response"
}

# Function to make a DELETE request
function delete_request() {
  local endpoint=$1
  response=$(api_curl DELETE "/$endpoint")
  echo "DELETE $endpoint: $response"
}

# Example usage
get_request "health"

# get_request "bookmarks"
# get_request "bookmarks/counts"
# post_request "bookmarks" '{"url": "https://www.help.com/", "title": "Help Bookmark", "tags": "test1,test2"}'
# get_request "bookmarks/1"
# put_request "bookmarks/1" '{"title": "Updated Bookmark"}'
# delete_request "bookmarks/1"

# get_request "quick-search?q=home"

# get_request "tags"
# get_request "tags/analytics"
get_request "tags/suggest-ai?url=https://www.help.com/"
