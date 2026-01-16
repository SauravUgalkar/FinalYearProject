#!/bin/bash

# CollabCode Quick Start Script
# This script sets up and runs the entire CollabCode platform

echo "🚀 CollabCode Quick Start"
echo "========================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 16+${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node --version) found${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker found${NC}"

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker Compose found${NC}"

# Step 1: Install dependencies
echo ""
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 2: Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo -e "${YELLOW}⚙️  Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created (update with your settings)${NC}"
fi

# Step 3: Start Docker services
echo ""
echo -e "${YELLOW}🐳 Starting Docker services...${NC}"
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start Docker services${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker services started${NC}"

# Wait for services to be ready
echo ""
echo -e "${YELLOW}⏳ Waiting for services to be ready (10 seconds)...${NC}"
sleep 10

# Step 4: Show startup instructions
echo ""
echo -e "${GREEN}✅ CollabCode is ready to start!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. ${YELLOW}Open Terminal 1:${NC}"
echo -e "   npm run dev --workspace=apps/server"
echo ""
echo -e "2. ${YELLOW}Open Terminal 2:${NC}"
echo -e "   npm start --workspace=apps/client"
echo ""
echo -e "3. ${YELLOW}Open your browser:${NC}"
echo -e "   http://localhost:3000"
echo ""
echo -e "${YELLOW}To stop all services:${NC}"
echo -e "   npm run docker:down"
echo ""
echo -e "${GREEN}Happy coding! 🎉${NC}"
