#!/bin/bash

red='\033[0;31m'
green='\033[0;32m'
blue='\033[0;34m'
yellow='\033[0;33m'
cyan='\033[0;36m'
gray='\033[0;90m'
orange='\033[38;5;208m'
bold='\033[1m'
plain='\033[0m'

#Add some basic function here
function LOGD() {
    echo -e "${yellow}[DEG] $* ${plain}"
}

function LOGE() {
    echo -e "${red}[ERR] $* ${plain}"
}

function LOGI() {
    echo -e "${green}[INF] $* ${plain}"
}

# Port helpers: detect listener and owning process (best effort)
is_port_in_use() {
    local port="$1"
    if command -v ss > /dev/null 2>&1; then
        ss -ltn 2> /dev/null | awk -v p=":${port}$" '$4 ~ p {exit 0} END {exit 1}'
        return
    fi
    if command -v netstat > /dev/null 2>&1; then
        netstat -lnt 2> /dev/null | awk -v p=":${port} " '$4 ~ p {exit 0} END {exit 1}'
        return
    fi
    if command -v lsof > /dev/null 2>&1; then
        lsof -nP -iTCP:${port} -sTCP:LISTEN > /dev/null 2>&1 && return 0
    fi
    return 1
}

# Simple helpers for domain/IP validation
is_ipv4() {
    [[ "$1" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] && return 0 || return 1
}
is_ipv6() {
    [[ "$1" =~ : ]] && return 0 || return 1
}
is_ip() {
    is_ipv4 "$1" || is_ipv6 "$1"
}
is_domain() {
    [[ "$1" =~ ^([A-Za-z0-9](-*[A-Za-z0-9])*\.)+(xn--[a-z0-9]{2,}|[A-Za-z]{2,})$ ]] && return 0 || return 1
}

# ============================================================================
#  UI framework (Phase A.1) — consistent prompts + a spinner that hides noisy
#  command output behind one animated line and tees it to a log file. Used by
#  run_step; the menus below render in airy grouped style instead of a box.
# ============================================================================
XUI_CLI_LOG="${XUI_LOG_FOLDER:-/var/log/x-ui}/x-ui-cli.log"

# message helpers — one visual language everywhere
msg_info()  { echo -e "${gray}$*${plain}"; }
msg_ok()    { echo -e "${green}✔${plain} $*"; }
msg_warn()  { echo -e "${yellow}!${plain} $*"; }
msg_err()   { echo -e "${red}✗${plain} $*"; }
hr()        { echo -e "${gray}────────────────────────────────────────────────${plain}"; }

# prompts — ask shows the question, read_input reads into a variable
ask()        { echo -e "${green}[?]${plain} ${yellow}$*${plain}"; }
read_input() { read -rp " $(ask "$1")" "$2"; }

# panel version straight from the installed binary (empty if not installed yet)
panel_version() {
    [[ -x "${xui_folder}/x-ui" ]] && "${xui_folder}/x-ui" -v 2>/dev/null | head -n1
}

# spinner: animate one line on the tty while $1 (a PID) is alive
spinner() {
    local pid=$1 text=$2
    local frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏' i=0
    [[ -t 1 ]] || { wait "$pid" 2>/dev/null; return; }
    printf "  ${cyan}%s${plain} %s" "${frames:0:1}" "$text" > /dev/tty
    while kill -0 "$pid" 2>/dev/null; do
        i=$(((i + 1) % ${#frames}))
        printf "\r  ${cyan}%s${plain} %s" "${frames:$i:1}" "$text" > /dev/tty
        sleep 0.1
    done
    printf "\r\033[K" > /dev/tty
}

# run_step "Doing the thing" cmd arg...  → quiet run, spinner, ✔/✗ + log on fail
run_step() {
    local text=$1; shift
    mkdir -p "$(dirname "$XUI_CLI_LOG")" 2>/dev/null
    echo "=== $(date '+%F %T') :: ${text} :: $*" >> "$XUI_CLI_LOG"
    ("$@") >> "$XUI_CLI_LOG" 2>&1 &
    local pid=$!
    spinner "$pid" "$text"
    if wait "$pid"; then
        msg_ok "$text"
        return 0
    fi
    msg_err "$text  ${gray}(подробности: ${XUI_CLI_LOG})${plain}"
    return 1
}

# check root
[[ $EUID -ne 0 ]] && LOGE "ERROR: You must be root to run this script! \n" && exit 1

# Check OS and set release variable
if [[ -f /etc/os-release ]]; then
    source /etc/os-release
    release=$ID
elif [[ -f /usr/lib/os-release ]]; then
    source /usr/lib/os-release
    release=$ID
else
    echo "Failed to check the system OS, please contact the author!" >&2
    exit 1
fi
echo "The OS release is: $release"

os_version=""
os_version=$(grep "^VERSION_ID" /etc/os-release | cut -d '=' -f2 | tr -d '"' | tr -d '.')

running_in_docker="false"
if [[ -f /.dockerenv ]] || [[ "${XUI_IN_DOCKER}" == "true" ]]; then
    running_in_docker="true"
fi

# Declare Variables
if [[ "${running_in_docker}" == "true" ]]; then
    xui_folder="${XUI_MAIN_FOLDER:=/app}"
else
    xui_folder="${XUI_MAIN_FOLDER:=/usr/local/x-ui}"
fi
xui_service="${XUI_SERVICE:=/etc/systemd/system}"
log_folder="${XUI_LOG_FOLDER:=/var/log/x-ui}"
mkdir -p "${log_folder}"
# Marker written by install.sh's turnkey setup_reverse_proxy (domains + ssl dir).
# Its presence means this box runs the turnkey reverse-proxy layer.
RP_MARKER="/etc/x-ui/reverse-proxy.conf"

confirm() {
    if [[ $# > 1 ]]; then
        echo && read -rp "$1 [Default $2]: " temp
        if [[ "${temp}" == "" ]]; then
            temp=$2
        fi
    else
        read -rp "$1 [y/n]: " temp
    fi
    if [[ "${temp}" == "y" || "${temp}" == "Y" ]]; then
        return 0
    else
        return 1
    fi
}

confirm_restart() {
    confirm "Restart the panel, Attention: Restarting the panel will also restart xray" "y"
    if [[ $? == 0 ]]; then
        restart
    else
        return
    fi
}

before_show_menu() {
    # Pause so the user can read an action's output, then return to the caller.
    # The menu is a redraw loop (show_menu), so returning is all that's needed —
    # NOT a recursive show_menu call (that stacked frames and ballooned output).
    echo && echo -n -e "${gray}Press enter to return to the menu…${plain}" && read -r _
}

install() {
    bash <(curl -Ls https://raw.githubusercontent.com/jaywehosl/ultrasuperheckedupthing/main/install.sh)
    if [[ $? == 0 ]]; then
        if [[ $# == 0 ]]; then
            start
        else
            start 0
        fi
    fi
}

update() {
    confirm "This function will update all x-ui components to the latest version, and the data will not be lost. Do you want to continue?" "y"
    if [[ $? != 0 ]]; then
        LOGE "Cancelled"
        if [[ $# == 0 ]]; then
            before_show_menu
        fi
        return 0
    fi
    bash <(curl -Ls https://raw.githubusercontent.com/jaywehosl/ultrasuperheckedupthing/main/update.sh)
    if [[ $? == 0 ]]; then
        LOGI "Update is complete, Panel has automatically restarted "
        before_show_menu
    fi
}

update_menu() {
    echo -e "${yellow}Updating Menu${plain}"
    confirm "This function will update the menu to the latest changes." "y"
    if [[ $? != 0 ]]; then
        LOGE "Cancelled"
        if [[ $# == 0 ]]; then
            before_show_menu
        fi
        return 0
    fi

    curl -fLRo /usr/bin/x-ui https://raw.githubusercontent.com/jaywehosl/ultrasuperheckedupthing/main/x-ui.sh
    chmod +x ${xui_folder}/x-ui.sh
    chmod +x /usr/bin/x-ui

    if [[ $? == 0 ]]; then
        echo -e "${green}Update successful. The panel has automatically restarted.${plain}"
        exit 0
    else
        echo -e "${red}Failed to update the menu.${plain}"
        return 1
    fi
}

legacy_version() {
    echo -n "Enter the panel version (like 2.4.0):"
    read -r tag_version

    if [ -z "$tag_version" ]; then
        echo "Panel version cannot be empty. Exiting."
        exit 1
    fi
    # Use the entered panel version in the download link
    install_command="bash <(curl -Ls "https://raw.githubusercontent.com/jaywehosl/ultrasuperheckedupthing/v$tag_version/install.sh") v$tag_version"

    echo "Downloading and installing panel version $tag_version..."
    eval $install_command
}

# Function to handle the deletion of the script file
delete_script() {
    rm "$0" # Remove the script file itself
    exit 1
}

xui_env_file_path() {
    case "${release}" in
        ubuntu | debian | armbian)
            echo "/etc/default/x-ui"
            ;;
        arch | manjaro | parch | alpine)
            echo "/etc/conf.d/x-ui"
            ;;
        *)
            echo "/etc/sysconfig/x-ui"
            ;;
    esac
}

uninstall() {
    confirm "Are you sure you want to uninstall the panel? xray will also uninstalled!" "n"
    if [[ $? != 0 ]]; then
        if [[ $# == 0 ]]; then
            return
        fi
        return 0
    fi

    if [[ $release == "alpine" ]]; then
        rc-service x-ui stop
        rc-update del x-ui
        rm /etc/init.d/x-ui -f
    else
        systemctl stop x-ui
        systemctl disable x-ui
        rm ${xui_service}/x-ui.service -f
        systemctl daemon-reload
        systemctl reset-failed
    fi

    rm /etc/x-ui/ -rf
    rm ${xui_folder}/ -rf
    rm -f "$(xui_env_file_path)"

    echo ""
    echo -e "Uninstalled Successfully.\n"
    echo "If you need to install this panel again, you can use below command:"
    echo -e "${green}bash <(curl -Ls https://raw.githubusercontent.com/jaywehosl/ultrasuperheckedupthing/main/install.sh)${plain}"
    echo ""
    # Trap the SIGTERM signal
    trap delete_script SIGTERM
    delete_script
}

reset_user() {
    confirm "Are you sure to reset the username and password of the panel?" "n"
    if [[ $? != 0 ]]; then
        if [[ $# == 0 ]]; then
            return
        fi
        return 0
    fi

    read -rp "Please set the login username [default is a random username]: " config_account
    [[ -z $config_account ]] && config_account=$(gen_random_string 10)
    read -rp "Please set the login password [default is a random password]: " config_password
    [[ -z $config_password ]] && config_password=$(gen_random_string 18)

    read -rp "Do you want to disable currently configured two-factor authentication? (y/n): " twoFactorConfirm
    if [[ $twoFactorConfirm != "y" && $twoFactorConfirm != "Y" ]]; then
        ${xui_folder}/x-ui setting -username "${config_account}" -password "${config_password}" > /dev/null 2>&1
    else
        ${xui_folder}/x-ui setting -username "${config_account}" -password "${config_password}" -resetTwoFactor=true > /dev/null 2>&1
        echo -e "Two factor authentication has been disabled."
    fi

    echo -e "Panel login username has been reset to: ${green} ${config_account} ${plain}"
    echo -e "Panel login password has been reset to: ${green} ${config_password} ${plain}"
    echo -e "${green} Please use the new login username and password to access the X-UI panel. Also remember them! ${plain}"
    confirm_restart
}

gen_random_string() {
    local length="$1"
    openssl rand -base64 $((length * 2)) \
        | tr -dc 'a-zA-Z0-9' \
        | head -c "$length"
}

reset_webbasepath() {
    echo -e "${yellow}Resetting Web Base Path${plain}"

    read -rp "Are you sure you want to reset the web base path? (y/n): " confirm
    if [[ $confirm != "y" && $confirm != "Y" ]]; then
        echo -e "${yellow}Operation canceled.${plain}"
        return
    fi

    config_webBasePath=$(gen_random_string 18)

    # Apply the new web base path setting
    ${xui_folder}/x-ui setting -webBasePath "${config_webBasePath}" > /dev/null 2>&1

    echo -e "Web base path has been reset to: ${green}${config_webBasePath}${plain}"
    echo -e "${green}Please use the new web base path to access the panel.${plain}"
    restart
}

reset_config() {
    confirm "Are you sure you want to reset all panel settings, Account data will not be lost, Username and password will not change" "n"
    if [[ $? != 0 ]]; then
        if [[ $# == 0 ]]; then
            return
        fi
        return 0
    fi
    ${xui_folder}/x-ui setting -reset
    echo -e "All panel settings have been reset to default."
    restart
}

check_config() {
    local info=$(${xui_folder}/x-ui setting -show true)
    if [[ $? != 0 ]]; then
        LOGE "get current settings error, please check logs"
        return
        return
    fi
    LOGI "${info}"

    local db_env_file
    db_env_file="$(xui_env_file_path)"
    if [[ -r "$db_env_file" ]] && grep -q '^XUI_DB_TYPE=postgres' "$db_env_file"; then
        local dsn
        dsn="$(grep -E '^XUI_DB_DSN=' "$db_env_file" | head -1 | cut -d= -f2-)"
        local dsn_safe
        dsn_safe="$(echo "$dsn" | sed -E 's|(://[^:/@]+:)[^@]+@|\1****@|')"
        echo -e "${green}Database: PostgreSQL — ${dsn_safe}${plain}"
    else
        echo -e "${green}Database: SQLite (/etc/x-ui/x-ui.db)${plain}"
    fi

    local existing_webBasePath=$(echo "$info" | grep -Eo 'webBasePath: .+' | awk '{print $2}')
    local existing_port=$(echo "$info" | grep -Eo 'port: .+' | awk '{print $2}')
    local existing_cert=$(${xui_folder}/x-ui setting -getCert true | grep 'cert:' | awk -F': ' '{print $2}' | tr -d '[:space:]')
    local URL_lists=(
        "https://api4.ipify.org"
        "https://ipv4.icanhazip.com"
        "https://v4.api.ipinfo.io/ip"
        "https://ipv4.myexternalip.com/raw"
        "https://4.ident.me"
        "https://check-host.net/ip"
    )
    local server_ip=""
    for ip_address in "${URL_lists[@]}"; do
        local response=$(curl -s -w "\n%{http_code}" --max-time 3 "${ip_address}" 2> /dev/null)
        local http_code=$(echo "$response" | tail -n1)
        local ip_result=$(echo "$response" | head -n-1 | tr -d '[:space:]"')
        if [[ "${http_code}" == "200" && "${ip_result}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            server_ip="${ip_result}"
            break
        fi
    done

    if [[ -z "$server_ip" ]]; then
        echo -e "${yellow}Could not auto-detect server IP from any provider.${plain}"
        while [[ -z "$server_ip" ]]; do
            read -rp "Please enter your server's public IPv4 address: " server_ip
            server_ip="${server_ip// /}"
            if [[ ! "$server_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo -e "${red}Invalid IPv4 address. Please try again.${plain}"
                server_ip=""
            fi
        done
    fi

    if [[ -n "$existing_cert" ]]; then
        local domain=$(basename "$(dirname "$existing_cert")")

        if [[ "$domain" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            echo -e "${green}Access URL: https://${domain}:${existing_port}${existing_webBasePath}${plain}"
        else
            echo -e "${green}Access URL: https://${server_ip}:${existing_port}${existing_webBasePath}${plain}"
        fi
    else
        echo -e "${red}⚠ WARNING: No SSL certificate configured!${plain}"
        echo -e "${yellow}You can get a Let's Encrypt certificate for your IP address (valid ~6 days, auto-renews).${plain}"
        read -rp "Generate SSL certificate for IP now? [y/N]: " gen_ssl
        if [[ "$gen_ssl" == "y" || "$gen_ssl" == "Y" ]]; then
            stop 0 > /dev/null 2>&1
            ssl_cert_issue_for_ip
            if [[ $? -eq 0 ]]; then
                echo -e "${green}Access URL: https://${server_ip}:${existing_port}${existing_webBasePath}${plain}"
                # ssl_cert_issue_for_ip already restarts the panel, but ensure it's running
                start 0 > /dev/null 2>&1
            else
                LOGE "IP certificate setup failed."
                echo -e "${yellow}You can try again via option 19 (SSL Certificate Management).${plain}"
                start 0 > /dev/null 2>&1
            fi
        else
            echo -e "${yellow}Access URL: http://${server_ip}:${existing_port}${existing_webBasePath}${plain}"
            echo -e "${yellow}For security, please configure SSL certificate using option 19 (SSL Certificate Management)${plain}"
        fi
    fi
}

set_port() {
    echo -n "Enter port number[1-65535]: "
    read -r port
    if [[ -z "${port}" ]]; then
        LOGD "Cancelled"
        before_show_menu
    else
        ${xui_folder}/x-ui setting -port ${port}
        echo -e "The port is set, Please restart the panel now, and use the new port ${green}${port}${plain} to access web panel"
        confirm_restart
    fi
}

start() {
    check_status
    if [[ $? == 0 ]]; then
        echo ""
        LOGI "Panel is running, No need to start again, If you need to restart, please select restart"
    else
        if [[ "${running_in_docker}" == "true" ]]; then
            LOGE "Panel process is not running inside this container."
            LOGI "In Docker the panel is the container's main process. Restart the container to bring it back up:"
            LOGI "  docker restart <container_name>"
            if [[ $# == 0 ]]; then
                before_show_menu
            fi
            return 0
        fi
        if [[ $release == "alpine" ]]; then
            rc-service x-ui start
        else
            systemctl start x-ui
        fi
        sleep 2
        check_status
        if [[ $? == 0 ]]; then
            LOGI "x-ui Started Successfully"
        else
            LOGE "panel Failed to start, Probably because it takes longer than two seconds to start, Please check the log information later"
        fi
    fi

    if [[ $# == 0 ]]; then
        before_show_menu
    fi
}

stop() {
    check_status
    if [[ $? == 1 ]]; then
        echo ""
        LOGI "Panel stopped, No need to stop again!"
    else
        if [[ "${running_in_docker}" == "true" ]]; then
            LOGI "In Docker the panel runs as the container's main process."
            LOGI "To stop it, stop the container from the host:"
            LOGI "  docker stop <container_name>"
            if [[ $# == 0 ]]; then
                before_show_menu
            fi
            return 0
        fi
        if [[ $release == "alpine" ]]; then
            rc-service x-ui stop
        else
            systemctl stop x-ui
        fi
        sleep 2
        check_status
        if [[ $? == 1 ]]; then
            LOGI "x-ui and xray stopped successfully"
        else
            LOGE "Panel stop failed, Probably because the stop time exceeds two seconds, Please check the log information later"
        fi
    fi

    if [[ $# == 0 ]]; then
        before_show_menu
    fi
}

restart() {
    if [[ "${running_in_docker}" == "true" ]]; then
        if signal_xui HUP; then
            sleep 1
            signal_xui USR1
            LOGI "Restart signal sent to the panel and xray-core."
        else
            LOGE "Could not find the running panel process to signal."
        fi
        sleep 2
        check_status
        if [[ $? == 0 ]]; then
            LOGI "x-ui and xray Restarted successfully"
        else
            LOGE "Panel restart failed, Please check the log information later"
        fi
        if [[ $# == 0 ]]; then
            before_show_menu
        fi
        return 0
    fi
    if [[ $release == "alpine" ]]; then
        rc-service x-ui restart
    else
        systemctl restart x-ui
    fi
    sleep 2
    check_status
    if [[ $? == 0 ]]; then
        LOGI "x-ui and xray Restarted successfully"
    else
        LOGE "Panel restart failed, Probably because it takes longer than two seconds to start, Please check the log information later"
    fi
    if [[ $# == 0 ]]; then
        before_show_menu
    fi
}

restart_xray() {
    if [[ "${running_in_docker}" == "true" ]]; then
        if signal_xui USR1; then
            LOGI "xray-core Restart signal sent successfully, Please check the log information to confirm whether xray restarted successfully"
        else
            LOGE "Could not find the running panel process to signal."
        fi
        sleep 2
        show_xray_status
        if [[ $# == 0 ]]; then
            before_show_menu
        fi
        return 0
    fi
    if [[ $release == "alpine" ]]; then
        rc-service x-ui reload
    else
        systemctl reload x-ui
    fi
    LOGI "xray-core Restart signal sent successfully, Please check the log information to confirm whether xray restarted successfully"
    sleep 2
    show_xray_status
    if [[ $# == 0 ]]; then
        before_show_menu
    fi
}

status() {
    if [[ "${running_in_docker}" == "true" ]]; then
        show_status
        if [[ $# == 0 ]]; then
            before_show_menu
        fi
        return 0
    fi
    if [[ $release == "alpine" ]]; then
        rc-service x-ui status
    else
        systemctl status x-ui -l
    fi
    if [[ $# == 0 ]]; then
        before_show_menu
    fi
}

enable() {
    if [[ "${running_in_docker}" == "true" ]]; then
        LOGI "Autostart is controlled by the Docker restart policy (e.g. 'restart: unless-stopped' in docker-compose.yml)."
        LOGI "There is no service to enable inside the container."
        if [[ $# == 0 ]]; then
            before_show_menu
        fi
        return 0
    fi
    if [[ $release == "alpine" ]]; then
        rc-update add x-ui default
    else
        systemctl enable x-ui
    fi
    if [[ $? == 0 ]]; then
        LOGI "x-ui Set to boot automatically on startup successfully"
    else
        LOGE "x-ui Failed to set Autostart"
    fi

    if [[ $# == 0 ]]; then
        before_show_menu
    fi
}

disable() {
    if [[ "${running_in_docker}" == "true" ]]; then
        LOGI "Autostart is controlled by the Docker restart policy (e.g. 'restart: unless-stopped' in docker-compose.yml)."
        LOGI "Set 'restart: no' for the container on the host to disable autostart."
        if [[ $# == 0 ]]; then
            before_show_menu
        fi
        return 0
    fi
    if [[ $release == "alpine" ]]; then
        rc-update del x-ui
    else
        systemctl disable x-ui
    fi
    if [[ $? == 0 ]]; then
        LOGI "x-ui Autostart Cancelled successfully"
    else
        LOGE "x-ui Failed to cancel autostart"
    fi

    if [[ $# == 0 ]]; then
        before_show_menu
    fi
}

show_log() {
    if [[ $release == "alpine" ]]; then
        echo -e "${green}\t1.${plain} Debug Log"
        echo -e "${green}\t0.${plain} Back to Main Menu"
        read -rp "Choose an option: " choice

        case "$choice" in
            0)
                return
                ;;
            1)
                grep -F 'x-ui[' /var/log/messages
                if [[ $# == 0 ]]; then
                    before_show_menu
                fi
                ;;
            *)
                echo -e "${red}Invalid option. Please select a valid number.${plain}\n"
                show_log
                ;;
        esac
    else
        echo -e "${green}\t1.${plain} Debug Log"
        echo -e "${green}\t2.${plain} Clear All logs"
        echo -e "${green}\t0.${plain} Back to Main Menu"
        read -rp "Choose an option: " choice

        case "$choice" in
            0)
                return
                ;;
            1)
                journalctl -u x-ui -e --no-pager -f -p debug
                if [[ $# == 0 ]]; then
                    before_show_menu
                fi
                ;;
            2)
                sudo journalctl --rotate
                sudo journalctl --vacuum-time=1s
                echo "All Logs cleared."
                restart
                ;;
            *)
                echo -e "${red}Invalid option. Please select a valid number.${plain}\n"
                show_log
                ;;
        esac
    fi
}

update_shell() {
    curl -fLRo /usr/bin/x-ui -z /usr/bin/x-ui https://github.com/jaywehosl/ultrasuperheckedupthing/raw/main/x-ui.sh
    if [[ $? != 0 ]]; then
        echo ""
        LOGE "Failed to download script, Please check whether the machine can connect Github"
        before_show_menu
    else
        chmod +x /usr/bin/x-ui
        LOGI "Upgrade script succeeded, Please rerun the script"
        before_show_menu
    fi
}

xui_pid() {
    ps -ef 2> /dev/null | grep -F "${xui_folder}/x-ui" | grep -v grep | awk 'NR==1 {print $1}'
}

signal_xui() {
    local sig="$1" pid
    pid="$(xui_pid)"
    if [[ -z "${pid}" ]]; then
        return 1
    fi
    kill -"${sig}" "${pid}" 2> /dev/null
}

# 0: running, 1: not running, 2: not installed
check_status() {
    if [[ "${running_in_docker}" == "true" ]]; then
        if [[ ! -x "${xui_folder}/x-ui" ]]; then
            return 2
        fi
        if [[ -n "$(xui_pid)" ]]; then
            return 0
        else
            return 1
        fi
    fi
    if [[ $release == "alpine" ]]; then
        if [[ ! -f /etc/init.d/x-ui ]]; then
            return 2
        fi
        if [[ $(rc-service x-ui status | grep -F 'status: started' -c) == 1 ]]; then
            return 0
        else
            return 1
        fi
    else
        if [[ ! -f ${xui_service}/x-ui.service ]]; then
            return 2
        fi
        temp=$(systemctl status x-ui | grep Active | awk '{print $3}' | cut -d "(" -f2 | cut -d ")" -f1)
        if [[ "${temp}" == "running" ]]; then
            return 0
        else
            return 1
        fi
    fi
}

check_enabled() {
    if [[ $release == "alpine" ]]; then
        if [[ $(rc-update show | grep -F 'x-ui' | grep default -c) == 1 ]]; then
            return 0
        else
            return 1
        fi
    else
        temp=$(systemctl is-enabled x-ui)
        if [[ "${temp}" == "enabled" ]]; then
            return 0
        else
            return 1
        fi
    fi
}

check_uninstall() {
    check_status
    if [[ $? != 2 ]]; then
        echo ""
        LOGE "Panel installed, Please do not reinstall"
        if [[ $# == 0 ]]; then
            before_show_menu
        fi
        return 1
    else
        return 0
    fi
}

check_install() {
    check_status
    if [[ $? == 2 ]]; then
        echo ""
        LOGE "Please install the panel first"
        if [[ $# == 0 ]]; then
            before_show_menu
        fi
        return 1
    else
        return 0
    fi
}

show_status() {
    # one airy status line: ● panel <state>   ● xray <state>   autostart <state>
    local pstate pcol
    check_status
    case $? in
        0) pstate="running";       pcol="$green"  ;;
        1) pstate="stopped";       pcol="$yellow" ;;
        2) pstate="not installed"; pcol="$red"    ;;
    esac

    local xstate xcol
    if check_xray_status; then xstate="running"; xcol="$green"; else xstate="stopped"; xcol="$red"; fi

    local astate
    if [[ "${running_in_docker}" == "true" ]]; then
        astate="docker"
    elif check_enabled; then
        astate="on"
    else
        astate="off"
    fi

    echo -e "  ${pcol}●${plain} ${gray}panel${plain} ${pcol}${pstate}${plain}    ${xcol}●${plain} ${gray}xray${plain} ${xcol}${xstate}${plain}    ${gray}autostart${plain} ${astate}"
}

check_xray_status() {
    count=$(ps -ef | grep "xray-linux" | grep -v "grep" | wc -l)
    if [[ count -ne 0 ]]; then
        return 0
    else
        return 1
    fi
}

show_xray_status() {
    check_xray_status
    if [[ $? == 0 ]]; then
        echo -e "xray state: ${green}Running${plain}"
    else
        echo -e "xray state: ${red}Not Running${plain}"
    fi
}

# PostgreSQL service management (for panels configured with XUI_DB_TYPE=postgres).

postgresql_installed() {
    command -v pg_lsclusters > /dev/null 2>&1 || command -v psql > /dev/null 2>&1 || command -v postgres > /dev/null 2>&1
}

# Prints "VER CLUSTER" of the first configured cluster on Debian-style installs (e.g. "16 main").
pg_cluster_info() {
    if command -v pg_lsclusters > /dev/null 2>&1; then
        pg_lsclusters 2> /dev/null | awk '$1 ~ /^[0-9]+$/ {print $1, $2; exit}'
    fi
}

# Resolves the systemd unit used to manage the PostgreSQL server.
pg_systemd_unit() {
    local info ver cluster
    info="$(pg_cluster_info)"
    if [[ -n "$info" ]]; then
        ver="${info%% *}"
        cluster="${info##* }"
        echo "postgresql@${ver}-${cluster}"
    else
        echo "postgresql"
    fi
}

postgresql_status() {
    if ! postgresql_installed; then
        LOGE "PostgreSQL does not appear to be installed on this system."
        return 1
    fi
    if command -v pg_lsclusters > /dev/null 2>&1; then
        pg_lsclusters
    else
        systemctl status "$(pg_systemd_unit)" --no-pager
    fi
    echo ""
    if command -v ss > /dev/null 2>&1; then
        local listening
        listening=$(ss -ltnp 2> /dev/null | grep ':5432')
        if [[ -n "$listening" ]]; then
            echo -e "${green}PostgreSQL is listening on port 5432:${plain}"
            echo "$listening"
        else
            echo -e "${red}Nothing is listening on port 5432 - the database is not running.${plain}"
        fi
    fi
}

postgresql_start() {
    pg_require_installed || return 1
    if [[ $release == "alpine" ]]; then
        rc-service postgresql start
    else
        systemctl start "$(pg_systemd_unit)"
    fi
    sleep 1
    postgresql_status
}

postgresql_stop() {
    pg_require_installed || return 1
    if [[ $release == "alpine" ]]; then
        rc-service postgresql stop
    else
        systemctl stop "$(pg_systemd_unit)"
    fi
    LOGI "PostgreSQL stop signal sent."
}

postgresql_restart() {
    pg_require_installed || return 1
    if [[ $release == "alpine" ]]; then
        rc-service postgresql restart
    else
        systemctl restart "$(pg_systemd_unit)"
    fi
    sleep 1
    postgresql_status
}

postgresql_enable() {
    pg_require_installed || return 1
    if [[ $release == "alpine" ]]; then
        rc-update add postgresql default
    else
        systemctl enable "$(pg_systemd_unit)"
    fi
    if [[ $? == 0 ]]; then
        LOGI "PostgreSQL set to start automatically on boot."
    else
        LOGE "Failed to enable PostgreSQL autostart."
    fi
}

postgresql_log() {
    pg_require_installed || return 1
    local info ver cluster logfile
    info="$(pg_cluster_info)"
    if [[ -n "$info" ]]; then
        ver="${info%% *}"
        cluster="${info##* }"
        logfile="/var/log/postgresql/postgresql-${ver}-${cluster}.log"
    fi
    if [[ -n "$logfile" && -f "$logfile" ]]; then
        tail -n 40 "$logfile"
    elif command -v journalctl > /dev/null 2>&1; then
        journalctl -u "$(pg_systemd_unit)" -n 40 --no-pager
    else
        LOGE "No PostgreSQL log found."
    fi
}

pg_require_installed() {
    if ! postgresql_installed; then
        LOGE "PostgreSQL is not installed. Use option 1 (Install PostgreSQL) in this menu first."
        return 1
    fi
}

# Installs a local PostgreSQL server and creates a dedicated xui user/database.
# Progress goes to stderr; on success the connection DSN is printed to stdout so
# callers can capture it. Mirrors install_postgres_local() from install.sh, so the
# panel can be set up without re-running the remote install script.
pg_install_local() {
    local pg_user pg_pass pg_db pg_host pg_port
    pg_pass=$(gen_random_string 24)
    pg_db="xui"
    pg_host="127.0.0.1"
    pg_port="5432"

    case "${release}" in
        ubuntu | debian | armbian)
            apt-get update >&2 && apt-get install -y -q postgresql >&2 || return 1
            ;;
        fedora | amzn | virtuozzo | rhel | almalinux | rocky | ol)
            dnf install -y -q postgresql-server postgresql-contrib >&2 || return 1
            [[ -d /var/lib/pgsql/data && -f /var/lib/pgsql/data/PG_VERSION ]] || postgresql-setup --initdb >&2 || return 1
            ;;
        centos)
            if [[ "${VERSION_ID}" =~ ^7 ]]; then
                yum install -y postgresql-server postgresql-contrib >&2 || return 1
            else
                dnf install -y -q postgresql-server postgresql-contrib >&2 || return 1
            fi
            [[ -d /var/lib/pgsql/data && -f /var/lib/pgsql/data/PG_VERSION ]] || postgresql-setup --initdb >&2 || return 1
            ;;
        arch | manjaro | parch)
            pacman -Syu --noconfirm postgresql >&2 || return 1
            if [[ ! -f /var/lib/postgres/data/PG_VERSION ]]; then
                sudo -u postgres initdb -D /var/lib/postgres/data >&2 || return 1
            fi
            ;;
        opensuse-tumbleweed | opensuse-leap)
            zypper -q install -y postgresql-server postgresql-contrib >&2 || return 1
            if [[ ! -f /var/lib/pgsql/data/PG_VERSION ]]; then
                install -d -o postgres -g postgres -m 700 /var/lib/pgsql/data >&2 || return 1
                su - postgres -c "initdb -D /var/lib/pgsql/data" >&2 || return 1
            fi
            ;;
        alpine)
            apk add --no-cache postgresql postgresql-contrib >&2 || return 1
            if [[ ! -f /var/lib/postgresql/data/PG_VERSION ]]; then
                /etc/init.d/postgresql setup >&2 || return 1
            fi
            rc-update add postgresql default >&2 2> /dev/null || true
            rc-service postgresql start >&2 || return 1
            ;;
        *)
            echo -e "${red}Unsupported distro for automatic PostgreSQL install: ${release}${plain}" >&2
            return 1
            ;;
    esac

    if [[ "${release}" != "alpine" ]]; then
        systemctl enable --now postgresql >&2 || return 1
    fi

    local i
    for i in 1 2 3 4 5; do
        sudo -u postgres psql -tAc 'SELECT 1' > /dev/null 2>&1 && break
        sleep 1
    done

    local existing_owner=""
    existing_owner=$(sudo -u postgres psql -tAc \
        "SELECT pg_catalog.pg_get_userbyid(datdba) FROM pg_database WHERE datname='${pg_db}'" 2> /dev/null \
        | tr -d '[:space:]')
    if [[ -n "${existing_owner}" && "${existing_owner}" != "postgres" ]]; then
        pg_user="${existing_owner}"
    else
        pg_user=$(gen_random_string 8)
    fi

    sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${pg_user}'" 2> /dev/null \
        | grep -q 1 \
        || sudo -u postgres psql -c "CREATE USER \"${pg_user}\" WITH PASSWORD '${pg_pass}';" >&2 || return 1

    sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${pg_db}'" 2> /dev/null \
        | grep -q 1 \
        || sudo -u postgres psql -c "CREATE DATABASE \"${pg_db}\" OWNER \"${pg_user}\";" >&2 || return 1

    sudo -u postgres psql -c "ALTER USER \"${pg_user}\" WITH PASSWORD '${pg_pass}';" >&2 || return 1

    local pg_pass_enc
    pg_pass_enc=$(printf '%s' "${pg_pass}" | sed -e 's/%/%25/g' -e 's/:/%3A/g' -e 's/@/%40/g' -e 's|/|%2F|g' -e 's/?/%3F/g' -e 's/#/%23/g')

    echo "postgres://${pg_user}:${pg_pass_enc}@${pg_host}:${pg_port}/${pg_db}?sslmode=disable"
    return 0
}

# Installs the PostgreSQL client tools (pg_dump/pg_restore) used by in-panel backup.
pg_ensure_client() {
    if command -v pg_dump > /dev/null 2>&1 && command -v pg_restore > /dev/null 2>&1; then
        return 0
    fi
    echo -e "${yellow}Installing PostgreSQL client tools (pg_dump/pg_restore)...${plain}" >&2
    case "${release}" in
        ubuntu | debian | armbian)
            apt-get update >&2 && apt-get install -y -q postgresql-client >&2 || return 1
            ;;
        fedora | amzn | virtuozzo | rhel | almalinux | rocky | ol)
            dnf install -y -q postgresql >&2 || return 1
            ;;
        centos)
            if [[ "${VERSION_ID}" =~ ^7 ]]; then
                yum install -y postgresql >&2 || return 1
            else
                dnf install -y -q postgresql >&2 || return 1
            fi
            ;;
        arch | manjaro | parch)
            pacman -Sy --noconfirm postgresql >&2 || return 1
            ;;
        opensuse-tumbleweed | opensuse-leap)
            zypper -q install -y postgresql >&2 || return 1
            ;;
        alpine)
            apk add --no-cache postgresql-client >&2 || return 1
            ;;
        *)
            return 1
            ;;
    esac
    command -v pg_dump > /dev/null 2>&1 && command -v pg_restore > /dev/null 2>&1
}

# Writes XUI_DB_TYPE/XUI_DB_DSN into the service env file, preserving other entries.
pg_write_env() {
    local dsn="$1" envfile
    envfile="$(xui_env_file_path)"
    install -d -m 755 "$(dirname "$envfile")"
    touch "$envfile"
    sed -i '/^XUI_DB_TYPE=/d; /^XUI_DB_DSN=/d' "$envfile"
    {
        echo "XUI_DB_TYPE=postgres"
        echo "XUI_DB_DSN=${dsn}"
    } >> "$envfile"
    chmod 600 "$envfile"
}

pg_install_server_action() {
    if postgresql_installed; then
        LOGI "PostgreSQL already appears to be installed on this system."
        confirm "Run setup anyway (ensures the xui database/user exist)?" "n" || return 0
    fi
    LOGI "Installing PostgreSQL server and creating a dedicated user/database..."
    local dsn
    dsn=$(pg_install_local)
    if [[ $? -ne 0 || -z "$dsn" ]]; then
        LOGE "PostgreSQL installation failed."
        return 1
    fi
    PG_LAST_DSN="$dsn"
    pg_ensure_client || LOGE "Could not install pg_dump/pg_restore (panel DB backup may be unavailable)."
    echo ""
    LOGI "PostgreSQL is installed and ready."
    echo -e "${green}Connection DSN:${plain} ${dsn}"
    echo -e "${yellow}Use option 2 to migrate your SQLite data and switch the panel to PostgreSQL.${plain}"
}

# Copies the current SQLite data into PostgreSQL, then switches the panel over.
migrate_to_postgres() {
    if [[ ! -x "${xui_folder}/x-ui" ]]; then
        LOGE "x-ui is not installed."
        return 1
    fi
    echo ""
    echo -e "${yellow}This copies your current SQLite data into a PostgreSQL database,${plain}"
    echo -e "${yellow}then switches the panel to PostgreSQL and restarts it.${plain}"
    echo -e "${red}Any existing panel tables in the destination will be cleared and overwritten.${plain}"
    confirm "Continue?" "n" || return 0

    local dsn="" pg_mode
    if [[ -n "$PG_LAST_DSN" ]]; then
        echo -e "A PostgreSQL database was created in this session:"
        echo -e "  ${green}${PG_LAST_DSN}${plain}"
        confirm "Migrate into this database?" "y" && dsn="$PG_LAST_DSN"
    fi

    if [[ -z "$dsn" ]]; then
        echo ""
        echo -e "${green}\t1.${plain} Install PostgreSQL locally and create a dedicated user/db (recommended)"
        echo -e "${green}\t2.${plain} Use an existing PostgreSQL server (enter DSN)"
        read -rp "Choose [1]: " pg_mode
        pg_mode="${pg_mode:-1}"
        if [[ "$pg_mode" == "2" ]]; then
            while [[ -z "$dsn" ]]; do
                read -rp "Enter PostgreSQL DSN (postgres://user:pass@host:port/dbname?sslmode=disable): " dsn
                dsn="${dsn// /}"
            done
        else
            LOGI "Installing PostgreSQL locally (this may take a moment)..."
            dsn=$(pg_install_local)
            if [[ $? -ne 0 || -z "$dsn" ]]; then
                LOGE "PostgreSQL installation failed. Aborting migration."
                return 1
            fi
            PG_LAST_DSN="$dsn"
        fi
    fi

    pg_ensure_client || LOGE "Could not install pg_dump/pg_restore (in-panel DB backup/restore may be unavailable)."

    LOGI "Stopping panel to take a consistent snapshot..."
    stop 0 > /dev/null 2>&1

    echo ""
    LOGI "Migrating data into PostgreSQL..."
    if ! ${xui_folder}/x-ui migrate-db --dsn "$dsn"; then
        LOGE "Migration failed. The panel was NOT switched to PostgreSQL."
        start 0 > /dev/null 2>&1
        return 1
    fi

    pg_write_env "$dsn"
    LOGI "Wrote database settings to $(xui_env_file_path) (XUI_DB_TYPE=postgres)."
    LOGI "Restarting panel on PostgreSQL..."
    restart 0
    sleep 1
    if check_status; then
        LOGI "Migration complete. The panel is now running on PostgreSQL."
    else
        LOGE "Panel did not come up. Check logs (option 16). Your SQLite data is left intact."
    fi
}

postgresql_menu() {
  while true; do
    clear
    echo
    echo -e "  ${bold}PostgreSQL${plain}"
    echo
    echo -e "    ${orange} 1${plain}  Install ${gray}(server + client + db)${plain}    ${orange} 2${plain}  Migrate SQLite ${gray}->${plain} PG"
    echo -e "    ${orange} 3${plain}  Status                          ${orange} 9${plain}  Convert ${gray}.db <-> .dump${plain}"
    echo
    echo -e "    ${orange} 4${plain}  Start     ${orange} 5${plain}  Stop     ${orange} 6${plain}  Restart     ${orange} 7${plain}  Enable on boot     ${orange} 8${plain}  Log"
    echo
    echo -e "    ${orange} 0${plain}  Back"
    echo
    read -rp " $(ask 'Select an option [0-9]:') " choice
    case "$choice" in
        0) return ;;
        1) pg_install_server_action ;;
        2) migrate_to_postgres ;;
        3) postgresql_status ;;
        4) postgresql_start ;;
        5) postgresql_stop ;;
        6) postgresql_restart ;;
        7) postgresql_enable ;;
        8) postgresql_log ;;
        9) migrate_db_prompt ;;
        *) msg_err "Invalid option."; sleep 1; continue ;;
    esac
    before_show_menu
  done
}

# Convert between the panel's SQLite database and a portable .dump (SQL text)
# file using the bundled x-ui binary. With no arguments it dumps the installed
# panel database; an optional second argument overrides the output path.
#   x-ui migrateDB [file.db|file.dump] [output]
migrate_db() {
    local input="$1" output="$2"
    local default_db="/etc/x-ui/x-ui.db"
    local bin="${xui_folder}/x-ui"

    [[ -z "$input" ]] && input="$default_db"

    if [[ ! -x "$bin" ]]; then
        LOGE "x-ui binary not found at ${bin}. Is the panel installed?"
        return 1
    fi

    if ! "$bin" migrate-db -h 2>&1 | grep -q -- '-dump'; then
        LOGE "This x-ui build does not support .db <-> .dump conversion yet."
        LOGE "Update the panel first (x-ui update) to a version with 'migrate-db --dump/--restore'."
        return 1
    fi

    if [[ ! -f "$input" ]]; then
        LOGE "Input file not found: ${input}"
        echo -e "Usage: ${green}x-ui migrateDB [file.db|file.dump] [output]${plain}"
        return 1
    fi

    local mode
    case "$input" in
        *.db | *.sqlite | *.sqlite3)
            mode="dump"
            ;;
        *.dump | *.sql)
            mode="restore"
            ;;
        *)
            if head -c 16 "$input" | grep -q "SQLite format 3"; then
                mode="dump"
            else
                mode="restore"
            fi
            ;;
    esac

    if [[ "$mode" == "dump" ]]; then
        [[ -z "$output" ]] && output="${input%.*}.dump"
        if [[ -f "$output" ]]; then
            confirm "Output ${output} already exists and will be overwritten. Continue?" "n" || return 0
        fi
        LOGI "Dumping SQLite database to SQL text:"
        echo -e "  ${green}${input}${plain} -> ${green}${output}${plain}"
        if "$bin" migrate-db --src "$input" --dump "$output"; then
            LOGI "Done. Wrote ${output}."
        else
            LOGE "Dump failed."
            return 1
        fi
    else
        [[ -z "$output" ]] && output="${input%.*}.db"
        if [[ "$output" == "$default_db" ]] && check_status > /dev/null 2>&1; then
            LOGE "Refusing to restore into the live database (${default_db}) while x-ui is running."
            LOGE "Stop the panel first (x-ui stop) or choose a different output path."
            return 1
        fi
        if [[ -f "$output" ]]; then
            confirm "Output ${output} already exists and will be overwritten. Continue?" "n" || return 0
            rm -f "$output"
        fi
        LOGI "Rebuilding SQLite database from SQL text:"
        echo -e "  ${green}${input}${plain} -> ${green}${output}${plain}"
        if "$bin" migrate-db --restore "$input" --out "$output"; then
            LOGI "Done. Created ${output}."
        else
            LOGE "Restore failed."
            rm -f "$output"
            return 1
        fi
    fi
}

# Interactive wrapper around migrate_db for the menu: prompts for the paths and
# lets migrate_db auto-detect the direction.
migrate_db_prompt() {
    local default_db="/etc/x-ui/x-ui.db"
    local input output
    echo -e "Convert between a SQLite ${green}.db${plain} and a portable ${green}.dump${plain} (direction auto-detected)."
    read -rp "Input file [${default_db}]: " input
    input="${input:-$default_db}"
    read -rp "Output file (leave empty to auto-name next to input): " output
    migrate_db "$input" "$output"
}

# ── Turnkey reverse-proxy management ─────────────────────────────────────────
# Light, self-contained ops over an already-deployed turnkey layer (the heavy
# "change domains" flow lives in install.sh and is intentionally not duplicated
# here). All three read the marker install.sh wrote (domains + ssl dir).
rp_status() {
    local PANEL_DOMAIN="" SUB_DOMAIN="" SELFSTEAL_DOMAIN="" SSLDIR="/etc/x-ui/ssl"
    source "$RP_MARKER" 2> /dev/null
    echo
    echo -e "  ${gray}Reverse-proxy status${plain}"
    msg_info "Panel domain:    ${PANEL_DOMAIN:-?}"
    msg_info "Sub domain:      ${SUB_DOMAIN:-?}"
    msg_info "Selfsteal/decoy: ${SELFSTEAL_DOMAIN:-?}"
    echo
    local d cert exp
    for d in "$PANEL_DOMAIN" "$SUB_DOMAIN" "$SELFSTEAL_DOMAIN"; do
        [[ -n "$d" ]] || continue
        cert="${SSLDIR}/${d}/fullchain.pem"
        if [[ -f "$cert" ]]; then
            exp=$(openssl x509 -enddate -noout -in "$cert" 2> /dev/null | cut -d= -f2)
            msg_ok "cert ${d}: valid until ${exp}"
        else
            msg_warn "cert ${d}: file missing (${cert})"
        fi
    done
    echo
    systemctl is-active --quiet nginx && msg_ok "nginx: running" || msg_err "nginx: not running"
    if crontab -l 2> /dev/null | grep -q 'acme.sh --cron'; then
        msg_ok "renewal cron: present"
    else
        msg_warn "renewal cron: MISSING (run the menu again to repair, or option 2)"
    fi
}

rp_renew_certs() {
    local PANEL_DOMAIN="" SUB_DOMAIN="" SELFSTEAL_DOMAIN="" SSLDIR="/etc/x-ui/ssl"
    source "$RP_MARKER" 2> /dev/null
    local acme="${HOME}/.acme.sh/acme.sh"
    [[ -f "$acme" ]] || { msg_err "acme.sh not found (${acme})."; return; }
    # nginx listens on the unix socket, so :80 is free for acme standalone.
    local d
    for d in "$PANEL_DOMAIN" "$SUB_DOMAIN" "$SELFSTEAL_DOMAIN"; do
        [[ -n "$d" ]] || continue
        run_step "Renewing ${d}" bash -c "$acme --renew -d '$d' --ecc --force"
    done
    run_step "Reloading nginx" systemctl reload nginx || true
    msg_ok "Сертификаты перевыпущены."
}

rp_remove() {
    confirm "Снять reverse-proxy? nginx-обвязка удалится, панель вернётся на прямой доступ по IP:порт" "n" || return
    rm -f /etc/nginx/conf.d/xui.conf
    systemctl reload nginx 2> /dev/null || systemctl restart nginx 2> /dev/null || true
    # Un-pin the panel so direct IP access works again. `x-ui setting` has no
    # webDomain flag and we hold no panel creds here, so clear the four network
    # keys straight in the DB (turnkey is always SQLite). webPort (2053) and the
    # basePath are left intact.
    local db=/etc/x-ui/x-ui.db
    if [[ -f "$db" ]]; then
        command -v sqlite3 > /dev/null 2>&1 || run_step "Installing sqlite3" bash -c "DEBIAN_FRONTEND=noninteractive apt-get install -y -q sqlite3"
        systemctl stop x-ui
        if sqlite3 "$db" "UPDATE settings SET value='' WHERE key IN ('webListen','webDomain','subListen','subDomain');" 2> /dev/null; then
            msg_ok "Доменные пины сняты (webDomain/webListen/subDomain/subListen)."
        else
            msg_warn "Не удалось очистить домены в БД — снимите их вручную в панели (Settings)."
        fi
        systemctl start x-ui
    fi
    rm -f "$RP_MARKER"
    msg_ok "Reverse proxy снят. Панель доступна напрямую — проверьте 'x-ui settings' (IP:порт/basePath)."
    msg_info "Сертификаты и acme-cron оставлены как есть; при желании удалите вручную."
}

reverse_proxy_menu() {
    if [[ ! -f "$RP_MARKER" ]]; then
        clear; echo
        msg_warn "This is not a turnkey reverse-proxy install (marker ${RP_MARKER} not found)."
        before_show_menu
        return
    fi
    while true; do
        clear
        echo
        echo -e "  ${bold}Reverse proxy${plain}"
        echo
        echo -e "    ${orange} 1${plain}  Status      ${orange} 2${plain}  Renew certs      ${orange} 3${plain}  Remove"
        echo
        echo -e "    ${orange} 0${plain}  Back"
        echo
        local c; read -rp " $(ask 'Select an option [0-3]:') " c
        case "$c" in
            0) return ;;
            1) rp_status ;;
            2) rp_renew_certs ;;
            3) rp_remove; before_show_menu; return ;;
            *) msg_err "Invalid option."; sleep 1; continue ;;
        esac
        before_show_menu
    done
}

show_usage() {
    echo
    echo -e "  ${bold}x-ui${plain} ${gray}— management CLI. Run with no arguments for the menu.${plain}"
    echo
    echo -e "  ${gray}Subcommands:${plain}"
    echo -e "    ${blue}x-ui${plain}                       admin management menu"
    echo -e "    ${blue}x-ui start|stop|restart${plain}    service control"
    echo -e "    ${blue}x-ui restart-xray${plain}          restart Xray only"
    echo -e "    ${blue}x-ui status|settings${plain}       current status / settings"
    echo -e "    ${blue}x-ui enable|disable${plain}        autostart on boot on/off"
    echo -e "    ${blue}x-ui log${plain}                   panel logs"
    echo -e "    ${blue}x-ui update${plain}                update to the latest release"
    echo -e "    ${blue}x-ui migrateDB [file]${plain}      convert SQLite .db <-> .dump"
    echo -e "    ${blue}x-ui legacy${plain}                install a legacy version"
    echo -e "    ${blue}x-ui install|uninstall${plain}     install / remove the panel"
    echo
}

show_menu() {
  while true; do
    clear
    local ver; ver=$(panel_version)
    echo
    echo -e "  ${bold}${orange}3X-UI${plain} ${bold}Community${plain}   ${gray}reverse-proxy panel manager${plain}"
    echo -e "  ${gray}version ${ver:-unknown}${plain}"
    echo

    echo -e "  ${bold}Lifecycle${plain}"
    echo -e "    ${orange} 1${plain}  Install         ${orange} 2${plain}  Update          ${orange} 3${plain}  Update menu"
    echo -e "    ${orange} 4${plain}  Legacy version  ${orange} 5${plain}  Uninstall"
    echo

    echo -e "  ${bold}Identity & access${plain}"
    echo -e "    ${orange} 6${plain}  Reset login     ${orange} 7${plain}  Reset base path  ${orange} 8${plain}  Reset settings"
    echo -e "    ${orange} 9${plain}  Change port     ${orange}10${plain}  View settings"
    echo

    echo -e "  ${bold}Service${plain}"
    echo -e "    ${orange}11${plain}  Start           ${orange}12${plain}  Stop            ${orange}13${plain}  Restart"
    echo -e "    ${orange}14${plain}  Restart Xray    ${orange}15${plain}  Status          ${orange}16${plain}  Logs"
    echo -e "    ${orange}17${plain}  Enable on boot  ${orange}18${plain}  Disable on boot"
    echo

    echo -e "  ${bold}Database${plain}"
    echo -e "    ${orange}19${plain}  PostgreSQL"
    echo

    echo -e "  ${bold}Reverse proxy${plain}"
    echo -e "    ${orange}20${plain}  Manage   ${gray}status / renew / remove${plain}"
    echo

    echo -e "    ${orange} 0${plain}  Exit"
    echo
    show_status
    echo
    read -rp " $(ask 'Select an option [0-20]:') " num

    case "${num}" in
        0)
            exit 0
            ;;
        1)
            check_uninstall && install
            ;;
        2)
            check_install && update
            ;;
        3)
            check_install && update_menu
            ;;
        4)
            check_install && legacy_version
            ;;
        5)
            check_install && uninstall
            ;;
        6)
            check_install && reset_user
            ;;
        7)
            check_install && reset_webbasepath
            ;;
        8)
            check_install && reset_config
            ;;
        9)
            check_install && set_port
            ;;
        10)
            check_install && check_config
            ;;
        11)
            check_install && start
            ;;
        12)
            check_install && stop
            ;;
        13)
            check_install && restart
            ;;
        14)
            check_install && restart_xray
            ;;
        15)
            check_install && status
            ;;
        16)
            check_install && show_log
            ;;
        17)
            check_install && enable
            ;;
        18)
            check_install && disable
            ;;
        19)
            postgresql_menu
            ;;
        20)
            check_install && reverse_proxy_menu
            ;;
        *)
            LOGE "Please enter the correct number [0-20]"
            sleep 1
            ;;
    esac
  done
}

# ── TLS cert renewal policy self-check (turnkey reverse-proxy boxes) ──────────
# The turnkey install pins well-known values (port 2053, clean paths) and relies
# on acme.sh's cron to auto-renew the LE certs unattended. If that cron rule (or
# a domain's nginx reloadcmd) goes missing or is altered, certs silently expire.
# On every INTERACTIVE launch we verify the policy and offer a one-key repair.
# Skipped entirely on service calls (x-ui start/stop/…) and non-TTY sessions.
ensure_cert_cron() {
    [[ -f "$RP_MARKER" ]] || return 0        # not a turnkey reverse-proxy box
    [[ -t 0 && -t 1 ]] || return 0           # only nag a real terminal
    local acme="${HOME}/.acme.sh/acme.sh"
    [[ -f "$acme" ]] || return 0             # no acme.sh → nothing to schedule

    local PANEL_DOMAIN="" SUB_DOMAIN="" SELFSTEAL_DOMAIN="" SSLDIR="/etc/x-ui/ssl"
    source "$RP_MARKER" 2> /dev/null

    # 1) acme cron present?  2) every turnkey domain still has a reloadcmd?
    local cron_ok=1 reload_ok=1 d conf
    crontab -l 2> /dev/null | grep -q 'acme.sh --cron' || cron_ok=0
    for d in "$PANEL_DOMAIN" "$SUB_DOMAIN" "$SELFSTEAL_DOMAIN"; do
        [[ -n "$d" ]] || continue
        conf="${HOME}/.acme.sh/${d}_ecc/${d}.conf"
        [[ -f "$conf" ]] && grep -q "Le_ReloadCmd=" "$conf" || reload_ok=0
    done
    [[ "$cron_ok" == 1 && "$reload_ok" == 1 ]] && return 0   # policy intact

    echo
    if [[ "$cron_ok" == 0 ]]; then
        msg_warn "Политика автообновления TLS-сертификатов не найдена (cron acme.sh отсутствует)."
    else
        msg_warn "Политика автообновления TLS-сертификатов изменена (потерян reloadcmd для домена)."
    fi
    echo -e "  ${gray}Без неё сертификаты перестанут продлеваться и истекут (~90 дней).${plain}"
    local yn; read -rp " $(ask 'Исправить и восстановить правила обновления? [Y/n]:') " yn
    [[ "$yn" =~ ^[Nn]$ ]] && { msg_warn "Пропущено — сертификаты не будут автопродлеваться."; return 0; }

    "$acme" --install-cronjob > /dev/null 2>&1 || true
    for d in "$PANEL_DOMAIN" "$SUB_DOMAIN" "$SELFSTEAL_DOMAIN"; do
        [[ -n "$d" && -d "${SSLDIR}/${d}" ]] || continue
        "$acme" --install-cert -d "$d" --ecc \
            --key-file "${SSLDIR}/${d}/privkey.pem" \
            --fullchain-file "${SSLDIR}/${d}/fullchain.pem" \
            --reloadcmd "systemctl reload nginx 2>/dev/null || true" > /dev/null 2>&1 || true
    done

    if crontab -l 2> /dev/null | grep -q 'acme.sh --cron'; then
        msg_ok "Автообновление сертификатов восстановлено (cron acme.sh + reloadcmd nginx)."
    else
        msg_err "Не удалось установить cron acme.sh — проверьте, запущен ли cron-демон (systemctl status cron)."
    fi
}

if [[ $# > 0 ]]; then
    case $1 in
        "start")
            check_install 0 && start 0
            ;;
        "stop")
            check_install 0 && stop 0
            ;;
        "restart")
            check_install 0 && restart 0
            ;;
        "restart-xray")
            check_install 0 && restart_xray 0
            ;;
        "status")
            check_install 0 && status 0
            ;;
        "settings")
            check_install 0 && check_config 0
            ;;
        "enable")
            check_install 0 && enable 0
            ;;
        "disable")
            check_install 0 && disable 0
            ;;
        "log")
            check_install 0 && show_log 0
            ;;
        "update")
            check_install 0 && update 0
            ;;
        "legacy")
            check_install 0 && legacy_version 0
            ;;
        "install")
            check_uninstall 0 && install 0
            ;;
        "uninstall")
            check_install 0 && uninstall 0
            ;;
        "migrateDB")
            migrate_db "$2" "$3"
            ;;
        *) show_usage ;;
    esac
else
    ensure_cert_cron
    show_menu
fi
