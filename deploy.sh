#!/bin/bash

# ----------------------
# KUDU Deployment Script
# Version: 1.0.17
# ----------------------

# Prerequisites
# -------------

# Verify node.js installed
if ! command -v node &> /dev/null; then
  echo "Missing node.js executable, please install node.js, if already installed make sure it can be reached from current environment."
  exit 1
fi

# Setup
# -----

ARTIFACTS=$DEPLOYMENT_SOURCE/../artifacts

if [ -z "$DEPLOYMENT_SOURCE" ]; then
  DEPLOYMENT_SOURCE=$PWD
fi

if [ -z "$DEPLOYMENT_TARGET" ]; then
  DEPLOYMENT_TARGET=$ARTIFACTS/wwwroot
fi

if [ -z "$NEXT_MANIFEST_PATH" ]; then
  NEXT_MANIFEST_PATH=$DEPLOYMENT_TARGET/next.config.js
fi

# Create deployment target
mkdir -p $DEPLOYMENT_TARGET

# Copy source to target
cp -r $DEPLOYMENT_SOURCE/* $DEPLOYMENT_TARGET/

# Change to deployment target
cd $DEPLOYMENT_TARGET

# Install npm packages
if [ -f "package.json" ]; then
  echo "Installing npm packages..."
  npm install --production
  if [ $? -ne 0 ]; then
    echo "npm install failed"
    exit 1
  fi
fi

# Build the application
if [ -f "package.json" ]; then
  echo "Building the application..."
  npm run build
  if [ $? -ne 0 ]; then
    echo "npm run build failed"
    exit 1
  fi
fi

echo "Deployment completed successfully"
