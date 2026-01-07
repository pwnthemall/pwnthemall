#!/usr/bin/env bash

set -euo pipefail

echo ""

ansi_art_lines=(
    "          [38;2;255;153;255m█[0m[38;2;255;153;255m█[0m                               [38;2;255;153;255m█[0m[38;2;255;153;255m█[0m   [38;2;255;153;255m█[0m[38;2;255;153;255m█[0m"
    " [38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m    [38;2;215;155;246m▄[0m[38;2;215;155;246m█[0m[38;2;215;155;246m█[0m[38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m    [38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m             [38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m    [38;2;215;155;246m█[0m[38;2;215;155;246m█[0m   [38;2;215;155;246m▄[0m[38;2;215;155;246m▄[0m"
    " [38;2;175;158;238m█[0m[38;2;175;158;238m█[0m  [38;2;175;158;238m█[0m[38;2;175;158;238m█[0m    [38;2;175;158;238m█[0m[38;2;175;158;238m█[0m     [38;2;175;158;238m▀[0m[38;2;175;158;238m▄[0m[38;2;175;158;238m▄[0m[38;2;175;158;238m▄[0m[38;2;175;158;238m█[0m[38;2;175;158;238m█[0m   [38;2;175;158;238m▀[0m[38;2;175;158;238m▀[0m[38;2;175;158;238m▀[0m[38;2;175;158;238m▀[0m[38;2;175;158;238m▀[0m   [38;2;175;158;238m█[0m[38;2;175;158;238m█[0m  [38;2;175;158;238m▀[0m[38;2;175;158;238m▀[0m   [38;2;175;158;238m█[0m[38;2;175;158;238m█[0m   [38;2;175;158;238m█[0m[38;2;175;158;238m█[0m"
    " [38;2;136;160;230m█[0m[38;2;136;160;230m█[0m  [38;2;136;160;230m█[0m[38;2;136;160;230m█[0m    [38;2;136;160;230m█[0m[38;2;136;160;230m█[0m     [38;2;136;160;230m█[0m[38;2;136;160;230m█[0m  [38;2;136;160;230m█[0m[38;2;136;160;230m█[0m           [38;2;136;160;230m█[0m[38;2;136;160;230m█[0m       [38;2;136;160;230m█[0m[38;2;136;160;230m█[0m   [38;2;136;160;230m█[0m[38;2;136;160;230m█[0m"
    " [38;2;96;163;221m█[0m[38;2;96;163;221m█[0m[38;2;96;163;221m▄[0m[38;2;96;163;221m▄[0m[38;2;96;163;221m█[0m[38;2;96;163;221m▀[0m    [38;2;96;163;221m▀[0m[38;2;96;163;221m█[0m[38;2;96;163;221m▄[0m[38;2;96;163;221m▄[0m   [38;2;96;163;221m▀[0m[38;2;96;163;221m█[0m[38;2;96;163;221m▄[0m[38;2;96;163;221m▄[0m[38;2;96;163;221m█[0m[38;2;96;163;221m█[0m           [38;2;96;163;221m▀[0m[38;2;96;163;221m█[0m[38;2;96;163;221m▄[0m[38;2;96;163;221m▄[0m[38;2;96;163;221m█[0m[38;2;96;163;221m▀[0m   [38;2;96;163;221m█[0m[38;2;96;163;221m█[0m   [38;2;96;163;221m█[0m[38;2;96;163;221m█[0m"
    " [38;2;56;165;213m█[0m[38;2;56;165;213m█[0m                                                "
    " [38;2;17;168;205m▀[0m[38;2;17;168;205m▀[0m                                                "
)

display_ansi_art() {
    for line in "${ansi_art_lines[@]}"; do
        echo -e "$line"
    done
}



display_ansi_art

ENV_FILE="./.env"
if [[ -f "$ENV_FILE" ]]; then
    sed -i 's/\r$//' "$ENV_FILE"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo "Config file $ENV_FILE not found. MINIO_ROOT_USER/MINIO_ROOT_PASSWORD needed"
    exit 1
fi

if ! jq --help &>/dev/null; then
    echo "The jq package is required to run the script. Please install it before running again the script."
    exit 1
fi

MINIO_CONTAINER="minio"
MINIO_ALIAS="localminio"
MINIO_ENDPOINT="http://localhost:9000"
MOUNT_PATH="/data"

# Plugins configuration
PLUGINS_DIR="backend/plugins"
PLUGINS_OUTPUT_DIR="${PLUGINS_DIR}/bin"
PLUGINS_IMAGE="pwnthemall-plugins:latest"

# Worker system needs: automatically retrieve docker gid
DOCKER_GID=$(getent group docker | cut -d: -f3)
export DOCKER_GID

function load_compose_profiles() {
    local profiles=()

    if [[ "${PTA_DIND:-false}" == "true" ]]; then
        profiles+=("dind")
    else
        profiles+=("no-dind")
    fi

    if [[ "${PTA_DOCKER_ISOLATION:-false}" == "true" ]]; then
        profiles+=("isolation")
    fi

    if [[ "${PTA_PLUGINS_ENABLED:-false}" == "true" ]]; then
        profiles+=("plugins")
    fi

    export COMPOSE_PROFILES
    COMPOSE_PROFILES="$(IFS=','; echo "${profiles[*]}")"

    echo "[+] Enabled profiles: ${COMPOSE_PROFILES}"
}

function minio_alias() {
    local env="${1:-prod}" # default to prod
    local compose_file="docker-compose.${env}.yml"

    if [[ ! -f "$compose_file" ]]; then
        echo "[✗] Compose file not found: $compose_file"
        exit 1
    fi

    echo "[+] Setting MinIO alias using $compose_file"

    docker compose -f "$compose_file" exec -T "$MINIO_CONTAINER" \
        mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" 2>/dev/null || true
}

function minio_sync() {
    local env="${1:-prod}"
    shift
    local folder="${1:-}"

    if [[ -z "$folder" ]]; then
        echo "[✗] Missing folder argument"
        usage
    fi

    local compose_file="docker-compose.${env}.yml"
    if [[ ! -f "$compose_file" ]]; then
        echo "[✗] Compose file not found: $compose_file"
        exit 1
    fi

    local fullpath
    fullpath="$(realpath "$folder")"
    local bucket
    bucket="$(basename "$folder")"
    local container_path="$MOUNT_PATH/$bucket"

    echo "[+] Sync $folder → MinIO (bucket: $bucket) using $compose_file"

    docker compose -f "$compose_file" exec -T "$MINIO_CONTAINER" mc mb --ignore-existing "$MINIO_ALIAS/$bucket"
    docker compose -f "$compose_file" exec -T "$MINIO_CONTAINER" mc mirror --overwrite "$container_path" "$MINIO_ALIAS/$bucket"

    echo "[✓] Sync successful"
}

function env_randomize() {
    local env_file="$ENV_FILE"
    if [[ ! -f "$env_file" ]]; then
        echo "[✗] .env file not found: $env_file"
        exit 1
    fi

    echo "[+] Randomizing sensitive values in $env_file"

    rand_str() {
        local length="$1"
        tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$length"
    }

    sed -i \
        -e "s|^\(POSTGRES_PASSWORD=\).*|\1$(rand_str 20)|" \
        -e "s|^\(JWT_SECRET=\).*|\1$(rand_str 30)|" \
        -e "s|^\(REFRESH_SECRET=\).*|\1$(rand_str 30)|" \
        -e "s|^\(MINIO_ROOT_PASSWORD=\).*|\1$(rand_str 40)|" \
        -e "s|^\(MINIO_NOTIFY_WEBHOOK_AUTH_TOKEN_DBSYNC=\).*|\1$(rand_str 40)|" \
        -e "s|^\(DOCKER_WORKER_PASSWORD=\).*|\1$(rand_str 25)|" \
        -e "s|^\(LIBVIRT_WORKER_PASSWORD=\).*|\1$(rand_str 25)|" \
        -e "s|^\(PTA_PLUGIN_MAGIC_VALUE=\).*|\1$(rand_str 20)|" \
        -e "s|^\(PTA_ENCRYPTION_KEY=\).*|\1$(rand_str 44)|" \
        "$env_file"

    echo "[✓] Randomization complete"
}

function plugins_check() {
    if [[ ! -d "$PLUGINS_DIR" ]] || [[ ! "$(ls -A $PLUGINS_DIR 2>/dev/null)" ]]; then
        echo "[⚠] No plugins directory found or empty"
        echo "    Path: $PLUGINS_DIR"
        if git submodule status 2>/dev/null | grep -q "^-.*plugins"; then
            echo "    Hint: Initialize the submodule with:"
            echo "    git submodule update --init --recursive"
        fi
        return 1
    fi
    return 0
}

function plugins_build() {
    if ! plugins_check; then
        echo ""
        echo "[✗] Cannot build plugins - directory not found"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        echo "[✗] Docker is required to build plugins"
        exit 1
    fi

    mkdir -p "$PLUGINS_OUTPUT_DIR"

    echo "[+] Building plugins Docker image..."
    if docker build \
        -f "$PLUGINS_DIR/Dockerfile" \
        -t "$PLUGINS_IMAGE" \
        ./; then
        echo "[✓] Docker image built successfully"
    else
        echo "[✗] Failed to build Docker image"
        exit 1
    fi

    echo ""
    echo "[+] Extracting plugin binaries..."
    
    local output_path
    output_path=$(realpath "$PLUGINS_OUTPUT_DIR")
    
    if docker run --rm \
        -v "${output_path}:/output" \
        "$PLUGINS_IMAGE" \
        sh -c "cp -r /plugins/* /output/ 2>/dev/null || echo 'No plugins to copy'"; then
        echo "[✓] Binaries extracted to $PLUGINS_OUTPUT_DIR"
    else
        echo "[✗] Failed to extract binaries"
        exit 1
    fi

    echo ""
    echo "[+] Compiled plugins"
    if [[ -d "$PLUGINS_OUTPUT_DIR" ]] && [[ "$(ls -A $PLUGINS_OUTPUT_DIR 2>/dev/null)" ]]; then
        ls -lah "$PLUGINS_OUTPUT_DIR" | grep "^-" || echo "No plugins found"
    else
        echo "No plugins found"
    fi
    
    echo ""
    echo "[+] Verifying binaries are static..."
    local any_plugin=false
    for plugin in "$PLUGINS_OUTPUT_DIR"/bin-*; do
        if [[ -f "$plugin" ]]; then
            any_plugin=true
            local plugin_name
            plugin_name=$(basename "$plugin")
            echo "  • $plugin_name"
            if file "$plugin" | grep -q 'statically linked'; then
                echo "    ✓ Static binary"
            else
                echo "    ⚠ Not a static binary (may have issues)"
            fi
        fi
    done

    if [[ "$any_plugin" == "false" ]]; then
        echo "[⚠] No plugins were built"
        echo "    Check that plugins have valid go.mod files"
    fi

    echo ""
    echo "[✓] Plugins build complete!"
}


function plugins_clean() {
    echo "[+] Cleaning plugin binaries..."
    
    if [[ -d "$PLUGINS_OUTPUT_DIR" ]]; then
        rm -rf "${PLUGINS_OUTPUT_DIR:?}"/*
        echo "[✓] Plugin binaries removed"
    else
        echo "[✓] No binaries to clean"
    fi

    echo "[+] Removing Docker image..."
    if docker rmi "$PLUGINS_IMAGE" 2>/dev/null; then
        echo "[✓] Docker image removed"
    else
        echo "[✓] No Docker image to remove"
    fi
}

function plugins_list() {
    echo ""

    if ! plugins_check; then
        return 1
    fi

    # List source plugins
    echo "Source plugins (in $PLUGINS_DIR):"
    local found_source=false
    for plugin_dir in "$PLUGINS_DIR"/*; do
        if [[ -d "$plugin_dir" ]] && [[ -f "$plugin_dir/go.mod" ]]; then
            found_source=true
            local plugin_name
            plugin_name=$(basename "$plugin_dir")
            echo "  • $plugin_name"
            
            # Try to extract version from main.go if exists
            if [[ -f "$plugin_dir/main.go" ]]; then
                local version
                version=$(grep -oP 'Version:\s*"\K[^"]+' "$plugin_dir/main.go" 2>/dev/null || echo "unknown")
                echo "    Version: $version"
            fi
        fi
    done
    
    if [[ "$found_source" == "false" ]]; then
        echo "  (none)"
    fi

    echo ""
    
    # List compiled plugins
    echo "Compiled plugins (in $PLUGINS_OUTPUT_DIR):"
    if [[ -d "$PLUGINS_OUTPUT_DIR" ]] && [[ "$(ls -A $PLUGINS_OUTPUT_DIR 2>/dev/null)" ]]; then
        for plugin in "$PLUGINS_OUTPUT_DIR"/bin-*; do
            if [[ -f "$plugin" ]]; then
                local plugin_name
                plugin_name=$(basename "$plugin")
                local size
                size=$(du -h "$plugin" | cut -f1)
                echo "  • $plugin_name ($size)"
            fi
        done
    else
        echo "  (none - run './pta-cli.sh plugins build' to compile)"
    fi
}

function plugins_status() {
    echo ""
    
    if plugins_check; then
        echo "✓ Plugins directory: $PLUGINS_DIR"
        
        # Count source plugins
        local source_count=0
        for plugin_dir in "$PLUGINS_DIR"/*; do
            if [[ -d "$plugin_dir" ]] && [[ -f "$plugin_dir/go.mod" ]]; then
                ((source_count++))
            fi
        done
        echo "  Source plugins: $source_count"
    else
        echo "✗ Plugins directory not found"
        return 1
    fi

    # Check compiled plugins
    if [[ -d "$PLUGINS_OUTPUT_DIR" ]]; then
        local compiled_count=0
        for plugin in "$PLUGINS_OUTPUT_DIR"/bin-*; do
            if [[ -f "$plugin" ]]; then
                ((compiled_count++))
            fi
        done
        echo "  Compiled plugins: $compiled_count"
        
        if [[ $compiled_count -eq 0 ]] && [[ $source_count -gt 0 ]]; then
            echo ""
            echo "⚠ You have source plugins but no compiled binaries"
            echo "  Run: ./pta-cli.sh plugins build"
        fi
    else
        echo "  Compiled plugins: 0"
    fi

    # Check if plugins are enabled in env
    echo ""
    echo "Configuration:"
    local plugins_enabled
    plugins_enabled=$(grep "^PTA_PLUGINS_ENABLED=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "not set")
    echo "  PTA_PLUGINS_ENABLED: $plugins_enabled"
    
    if [[ "$plugins_enabled" == "false" ]] || [[ "$plugins_enabled" == "not set" ]]; then
        echo "  ⚠ Plugins are disabled - set PTA_PLUGINS_ENABLED=true in .env to enable"
    fi
}

function compose_up() {
    local env="prod"
    local build="false"

    if [ ! -f ./shared/docker-worker ]; then
        echo "WARN: Private key file shared/docker-worker not found, generating new one..."
        generate_key "docker-worker"
    fi

    if [ ! -f ./shared/libvirt-worker ]; then
        echo "WARN: Private key file shared/libvirt-worker not found, generating new one..."
        generate_key "libvirt-worker"
    fi
    LIBVIRT_UID=$(stat -c %u shared/libvirt-worker.pub)
    export LIBVIRT_UID

    while [[ $# -gt 0 ]]; do
        case "$1" in
            up|-u)
                shift
                ;;
            -e|--env)
                env="$2"
                shift 2
                ;;
            -b|--build)
                build="true"
                shift
                ;;
            *)
                echo "[✗] Unknown option: $1"
                usage
                ;;
        esac
    done

    local compose_file="docker-compose.${env}.yml"

    if [[ ! -f "$compose_file" ]]; then
        echo "[✗] Compose file not found: $compose_file"
        exit 1
    fi

    # Check if plugins should be built
    local plugins_enabled
    plugins_enabled=$(grep "^PTA_PLUGINS_ENABLED=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "false")
    
    if [[ "$plugins_enabled" == "true" ]]; then
        echo "[+] Plugins are enabled, checking if they need to be built..."
        if [[ ! -d "$PLUGINS_OUTPUT_DIR" ]] || [[ ! "$(ls -A $PLUGINS_OUTPUT_DIR 2>/dev/null)" ]]; then
            echo "[⚠] No compiled plugins found"
            read -p "    Build plugins now? (Y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
                plugins_build
            else
                echo "[⚠] Continuing without building plugins"
            fi
        else
            echo "[✓] Compiled plugins found"
        fi
    fi

    if [[ "$build" == "true" ]]; then
        docker compose -f "$compose_file" up -d --build
    else
        docker compose -f "$compose_file" up -d
    fi
}

function compose_down() {
    local env="prod"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            down)
                shift
                ;;
            -e|--env)
                env="$2"
                shift 2
                ;;
            *)
                echo "[✗] Unknown option: $1"
                usage
                ;;
        esac
    done

    local compose_file="docker-compose.${env}.yml"

    if [[ ! -f "$compose_file" ]]; then
        echo "[✗] Compose file not found: $compose_file"
        exit 1
    fi

    echo "[+] Cleaning up challenge instances..."
    
    # Get all containers with pta- prefix (challenge containers)
    local challenge_containers
    challenge_containers=$(docker ps -aq --filter "name=pta-" 2>/dev/null || true)
    
    if [[ -n "$challenge_containers" ]]; then
        echo "[+] Found challenge containers, stopping and removing them..."
        # Force remove all challenge containers (stop + remove in one command)
        echo "$challenge_containers" | xargs docker rm -f 2>/dev/null || true
        echo "[✓] Challenge containers cleaned up"
    else
        echo "[✓] No challenge containers to clean up"
    fi

    echo "[+] Stopping and removing containers using $compose_file"
    if [[ $env == "prod" ]]; then
        docker compose -f "$compose_file" down
    else 
        docker compose -f "$compose_file" down -v
    fi
    echo "[✓] Compose down completed"
}

function generate_key() {
    mkdir -p ./shared
    ssh-keygen -C '' -t ed25519 -N '' -f "./shared/$1"
    chmod 400 "./shared/$1"
}

function remove_key() {
    rm -rf ./shared/*worker*
}

# Database seeding functions
function db_seed_demo() {
    local env="dev"
    local teams=30
    local time_range=20

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -e|--env)
                env="$2"
                shift 2
                ;;
            -t|--teams)
                teams="$2"
                shift 2
                ;;
            -r|--time-range)
                time_range="$2"
                shift 2
                ;;
            *)
                echo "[✗] Unknown option: $1"
                usage
                ;;
        esac
    done

    local compose_file="docker-compose.${env}.yml"
    if [[ ! -f "$compose_file" ]]; then
        echo "[✗] Compose file not found: $compose_file"
        exit 1
    fi

    echo "[+] Seeding demo data with $teams teams over ${time_range}h using $compose_file"
    echo ""

    # In dev mode, air builds to ./tmp/main; in prod mode, binary is /app/pwnthemall
    local binary_path="/app/pwnthemall"
    if [[ "$env" == "dev" ]]; then
        # Build the binary with seed flags directly using go run
        docker compose -f "$compose_file" exec -T backend \
            go run . --seed-demo --teams="$teams" --time-range="$time_range"
    else
        docker compose -f "$compose_file" exec -T backend \
            "$binary_path" --seed-demo --teams="$teams" --time-range="$time_range"
    fi

    echo ""
    echo "[✓] Demo data seeding complete"
}

function db_clean_demo() {
    local env="dev"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -e|--env)
                env="$2"
                shift 2
                ;;
            *)
                echo "[✗] Unknown option: $1"
                usage
                ;;
        esac
    done

    local compose_file="docker-compose.${env}.yml"
    if [[ ! -f "$compose_file" ]]; then
        echo "[✗] Compose file not found: $compose_file"
        exit 1
    fi

    echo "[+] Cleaning demo data using $compose_file"
    echo ""

    # In dev mode, use go run; in prod mode, use binary
    if [[ "$env" == "dev" ]]; then
        docker compose -f "$compose_file" exec -T backend \
            go run . --clean-demo
    else
        docker compose -f "$compose_file" exec -T backend \
            /app/pwnthemall --clean-demo
    fi

    echo ""
    echo "[✓] Demo data cleanup complete"
}

function usage() {
    cat <<EOF

Usage:
  $0 minio sync [--env dev|prod|demo] <folder>
  $0 compose up [--build] [--env dev|prod|demo]
  $0 compose down [--env dev|prod|demo]
  $0 db seed-demo [--env dev|prod|demo] [--teams N] [--time-range H]
  $0 db clean-demo [--env dev|prod|demo]
  $0 plugins build
  $0 plugins clean
  $0 plugins list
  $0 plugins status
  $0 keys -g|gen
  $0 keys -r|remove
  $0 env randomize

Commands:
  minio sync       Synchronize a folder to MinIO bucket
  compose up       Start the application stack
  compose down     Stop the application stack
  db seed-demo     Seed database with demo teams, users, and solves
  db clean-demo    Remove all demo data from the database
  plugins build    Compile all plugins to binaries
  plugins clean    Remove compiled plugins and Docker image
  plugins list     List available plugins
  plugins status   Show plugins status and configuration
  keys gen         Generate SSH keys for worker
  keys remove      Remove SSH keys
  env randomize    Randomize sensitive values in .env

Options (db seed-demo):
  --teams N        Number of demo teams to create (default: 30)
  --time-range H   Time range in hours for solve timestamps (default: 20)

Examples:
  $0 plugins build
  $0 plugins status
  $0 compose up --build --env dev
  $0 minio sync --env prod ./minio/challenges
  $0 db seed-demo --env dev --teams 30 --time-range 20
  $0 db clean-demo --env dev

EOF
    exit 1
}

# === DISPATCHER ===

case "${1:-}" in
    minio)
        shift
        case "${1:-}" in
            sync)
                shift
                env="prod"
                if [[ "$1" == "-e" || "$1" == "--env" ]]; then
                    env="$2"
                    shift 2
                fi
                folder="${1:-}"
                [ -z "$folder" ] && usage

                minio_alias "$env"
                minio_sync "$env" "$folder"
                ;;
            *)
                usage
                ;;
        esac
        ;;
    compose)
        load_compose_profiles
        shift
        case "${1:-}" in
            -u|up)
                compose_up "$@"
                ;;
            -d|down)
                compose_down "$@"
                ;;
            *)
                usage
                ;;
        esac
        ;;
    plugins)
        shift
        case "${1:-}" in
            build|-b)
                plugins_build
                ;;
            clean|-c)
                plugins_clean
                ;;
            list|-l)
                plugins_list
                ;;
            status|-s)
                plugins_status
                ;;
            *)
                echo "[✗] Unknown plugins command: ${1:-}"
                echo ""
                echo "Available commands:"
                echo "  build   - Compile plugins"
                echo "  clean   - Remove compiled plugins"
                echo "  list    - List available plugins"
                echo "  status  - Show plugins status"
                exit 1
                ;;
        esac
        ;;
    keys)
        shift
        case "${1:-}" in
            -g|gen)
                generate_key
                ;;
            -r|remove)
                remove_key
                ;;
            *)
                usage
                ;;
        esac
        ;;
    env)
        shift
        case "${1:-}" in
            randomize)
                env_randomize
                ;;
            *)
                usage
                ;;
        esac
        ;;
    db)
        shift
        case "${1:-}" in
            seed-demo)
                shift
                db_seed_demo "$@"
                ;;
            clean-demo)
                shift
                db_clean_demo "$@"
                ;;
            *)
                echo "[✗] Unknown db command: ${1:-}"
                echo ""
                echo "Available commands:"
                echo "  seed-demo   - Seed demo teams, users, and solves"
                echo "  clean-demo  - Remove all demo data"
                exit 1
                ;;
        esac
        ;;
    help|-h|--help)
        usage
        ;;
    *)
        usage
        ;;
esac
