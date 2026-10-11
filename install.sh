#!/usr/bin/env bash
# Install AJ-NetUsage for the current user.
#
#   One line (no clone needed):
#     curl -fsSL https://raw.githubusercontent.com/abdallah-jasem/AJ-NetUsage/main/install.sh | bash
#
#   From a clone (links the folder, so `git pull` updates the extension):
#     ./install.sh
set -euo pipefail

UUID=aj-netusage@abdallah-jasem.github.io
REPO=https://github.com/abdallah-jasem/AJ-NetUsage.git
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]:-}")" && pwd)"

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

command -v gnome-shell >/dev/null || die "GNOME Shell not found. AJ-NetUsage is a GNOME extension."
shell_major=$(gnome-shell --version | grep -oE '[0-9]+' | head -1)
[ "$shell_major" = 50 ] || say "Warning: built for GNOME Shell 50, you have $shell_major. It may not load."

mkdir -p "$(dirname "$DEST")"
if [ -f "$SRC/metadata.json" ] && grep -q "$UUID" "$SRC/metadata.json"; then
    # Running from a clone.
    if [ "$SRC" != "$DEST" ]; then
        [ -e "$DEST" ] && [ ! -L "$DEST" ] && die "$DEST already exists. Remove it first."
        say "Linking $SRC -> $DEST"
        ln -sfn "$SRC" "$DEST"
    fi
elif [ -d "$DEST/.git" ]; then
    say "Updating existing install"
    git -C "$DEST" pull --ff-only
else
    command -v git >/dev/null || die "git is required: sudo apt install git"
    [ -e "$DEST" ] && die "$DEST already exists. Remove it first."
    say "Downloading AJ-NetUsage"
    git clone --depth 1 "$REPO" "$DEST"
fi

say "Compiling settings schema"
glib-compile-schemas "$DEST/schemas"

say "Enabling extension"
if ! gnome-extensions enable "$UUID" 2>/dev/null; then
    # The running shell has not seen the new folder yet (Wayland): mark it enabled for next login.
    enabled=$(gsettings get org.gnome.shell enabled-extensions)
    case "$enabled" in
        *"'$UUID'"*) ;;
        "@as []"|"[]") gsettings set org.gnome.shell enabled-extensions "['$UUID']" ;;
        *) gsettings set org.gnome.shell enabled-extensions "${enabled%]}, '$UUID']" ;;
    esac
fi

say "Done! Log out and log back in to see AJ-NetUsage in the top bar."
