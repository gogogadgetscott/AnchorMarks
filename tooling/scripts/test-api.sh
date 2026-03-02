#!/bin/bash

API_BASE_URL="http://localhost:3000/api"

# Function to make a GET request
function get_request() {
  local endpoint=$1
  response=$(curl -s -w "%{http_code}" -o /dev/null "$API_BASE_URL/$endpoint")
  echo "GET $endpoint: $response"
}

# Function to make a POST request
function post_request() {
  local endpoint=$1
  local data=$2
  response=$(curl -s -w "%{http_code}" -o /dev/null -X POST -H "Content-Type: application/json" -d "$data" "$API_BASE_URL/$endpoint")
  echo "POST $endpoint: $response"
}

# Function to make a PUT request
function put_request() {
  local endpoint=$1
  local data=$2
  response=$(curl -s -w "%{http_code}" -o /dev/null -X PUT -H "Content-Type: application/json" -d "$data" "$API_BASE_URL/$endpoint")
  echo "PUT $endpoint: $response"
}

# Function to make a DELETE request
function delete_request() {
  local endpoint=$1
  response=$(curl -s -w "%{http_code}" -o /dev/null -X DELETE "$API_BASE_URL/$endpoint")
  echo "DELETE $endpoint: $response"
}

# Example usage
get_request "bookmarks"
post_request "bookmarks" '{"url": "http://example.com", "title": "Example Bookmark", "tags": []}'
put_request "bookmarks/1" '{"title": "Updated Bookmark"}'
delete_request "bookmarks/1"