#!/bin/bash

# Define API base URL - adjust as needed
API_URL="http://localhost:3005"

# Define a test Aptos address to query
TEST_ADDRESS="0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234"

# ANSI color codes for pretty output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Pixel Grid Redis Cache API Test ===${NC}\n"

# Test 1: Health Check
echo -e "${YELLOW}Testing Health Check Endpoint${NC}"
curl -s "${API_URL}/health" | jq .
echo -e "\n"

# Test 2: Get a single pixel
echo -e "${YELLOW}Testing Get Pixel (x=5, y=10)${NC}"
curl -s "${API_URL}/api/pixel/5/10" | jq .
echo -e "\n"

# Test 3: Get another pixel
echo -e "${YELLOW}Testing Get Pixel (x=6, y=10)${NC}"
curl -s "${API_URL}/api/pixel/6/10" | jq .
echo -e "\n"

# Test 4: Get multiple pixels to see current state
echo -e "${YELLOW}Testing Get Multiple Pixels (5-9,10) - Current state${NC}"
echo "Pixel (5,10):"
curl -s "${API_URL}/api/pixel/5/10" | jq .
echo "Pixel (6,10):"
curl -s "${API_URL}/api/pixel/6/10" | jq .
echo "Pixel (7,10):"
curl -s "${API_URL}/api/pixel/7/10" | jq .
echo "Pixel (8,10):"
curl -s "${API_URL}/api/pixel/8/10" | jq .
echo "Pixel (9,10):"
curl -s "${API_URL}/api/pixel/9/10" | jq .
echo -e "\n"

# Test 5: Get pixels by owner
echo -e "${YELLOW}Testing Get Pixels by Owner${NC}"
curl -s "${API_URL}/api/pixels/owner/${TEST_ADDRESS}" | jq .
echo -e "\n"

# Test 6: Test validation - Invalid coordinates
echo -e "${YELLOW}Testing Validation - Invalid Coordinates${NC}"
curl -s "${API_URL}/api/pixel/1001/1001" | jq .
echo -e "\n"

# Optional - this could be very large response!
# Uncomment if you need to test the full grid endpoint
# echo -e "${YELLOW}Testing Get Full Grid - (Warning: Large Response!)${NC}"
# curl -s "${API_URL}/api/grid" | head -n 20
# echo -e "...[truncated]...\n"

echo -e "${GREEN}All tests completed!${NC}"
echo -e "${BLUE}Note: The cache is now automatically updated by Aptos blockchain events.${NC}"
echo -e "${BLUE}You cannot directly update pixels via API calls anymore.${NC}" 