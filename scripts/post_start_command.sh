# scripts/post_start_command.sh

#!/bin/bash
set -e

# Cleanup is still good practice
rm -rf /workspace/_tmp_* 2>/dev/null || true

# Install frontend dependencies using sudo
# This runs the command as root, which has permission to write to the volume mount.
echo "Running pnpm install with root privileges..."
# Using 'sudo -E' preserves existing environment variables (like PNPM_HOME, if set)
sudo -E pnpm install

# Final message
echo "The post start script is now done!"