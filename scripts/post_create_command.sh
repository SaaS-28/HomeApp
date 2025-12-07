#!/bin/bash
set -e

# The username ('user') is passed as the first argument
USERNAME=$1
USER_HOME="/home/$USERNAME"

# --- User Permissions ---
echo "Setting permissions for $USER_HOME/.ssh..."
# Change ownership of the mounted workspace folder to the new user
chown -R $USERNAME:$USERNAME /workspace
# Change ownership of the mounted .ssh folder to the new user
chown -R $USERNAME:$USERNAME $USER_HOME/.ssh

# Set correct, strict permissions for SSH
chmod 700 $USER_HOME/.ssh
chmod 600 $USER_HOME/.ssh/* 2>/dev/null || true
chmod 644 $USER_HOME/.ssh/*.pub 2>/dev/null || true

echo "Casa-App Container is up and running for user $USERNAME!"