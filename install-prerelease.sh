#!/bin/bash
# Prerelease/nightly channel installer.
#
#   bash <(curl -Ls https://raw.githubusercontent.com/jaywehosl/community_panel/main/install-prerelease.sh)
#
# Resolves the NEWEST published release INCLUDING prereleases (the stable
# installer deliberately sees only full releases) and hands that exact tag to
# the regular install.sh. Uses the releases.atom feed — unauthenticated and
# not subject to the GitHub REST API rate limit.

red='\033[0;31m'
yellow='\033[0;33m'
plain='\033[0m'

REPO="jaywehosl/community_panel"

resolve_newest_tag() {
    # Atom feed lists all releases (prereleases included), newest first.
    curl ${1:-} -fsSL "https://github.com/${REPO}/releases.atom" 2> /dev/null \
        | grep -oE 'releases/tag/[^"<]+' | head -n 1 | sed 's|releases/tag/||'
}

tag=$(resolve_newest_tag)
if [[ -z "$tag" ]]; then
    echo -e "${yellow}Retrying with IPv4...${plain}"
    tag=$(resolve_newest_tag -4)
fi
if [[ -z "$tag" ]]; then
    echo -e "${red}Failed to resolve the newest (pre)release tag — no releases published, or GitHub is unreachable.${plain}"
    exit 1
fi

echo -e "${yellow}Prerelease channel: installing ${tag}${plain}"
bash <(curl -Ls "https://raw.githubusercontent.com/${REPO}/main/install.sh") "$tag"
