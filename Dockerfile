FROM node:20-bullseye

# Arguments for user creation
ARG USERNAME=user
ARG USER_UID=2000
ARG USER_GID=$USER_UID

# Set the working directory
WORKDIR /workspace

# Update packages and install system dependencies
RUN apt-get update && \
    apt-get install -y git curl ca-certificates sudo && \
    rm -rf /var/lib/apt/lists/*

# Install global tools with npm
RUN npm install -g pnpm expo-cli

# Create a non-root user with sudo access
RUN groupadd --gid $USER_GID $USERNAME && \
    useradd --uid $USER_UID --gid $USER_GID -s /bin/bash -m $USERNAME && \
    adduser $USERNAME sudo && \
    echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME && \
    chmod 0440 /etc/sudoers.d/$USERNAME

# Switch to the new user
USER $USERNAME

# Create a default .gitconfig file
RUN echo "[user]\n\tname = samuel.onidi\n\temail = samyoni.so@gmail.com" > ~/.gitconfig

# Command to keep the container running
CMD ["tail", "-f", "/dev/null"]
