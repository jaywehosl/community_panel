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

# ============================================================================
#  Localization — language is chosen once at install time and written to
#  /etc/x-ui/lang (en|ru); both install.sh and this CLI read it. t <key> looks
#  up the active language and falls back to English. Strings filled batch by
#  batch; any key not yet translated renders its English value.
# ============================================================================
XUI_LANG_FILE="/etc/x-ui/lang"
XUI_LANG="en"
if [[ -f "$XUI_LANG_FILE" ]]; then
    XUI_LANG="$(tr -d '[:space:]' < "$XUI_LANG_FILE" 2>/dev/null)"
fi
[[ "$XUI_LANG" == "ru" ]] || XUI_LANG="en"

declare -A T_EN T_RU

t() {
    local k="$1" v=""
    [[ "$XUI_LANG" == "ru" ]] && v="${T_RU[$k]}"
    printf '%s' "${v:-${T_EN[$k]}}"
}

# ── Batch 1: main menu (header, groups, items, status, prompts) ──────────────
T_EN[s_select]="Select an option:";              T_RU[s_select]="Выберите пункт:"
T_EN[s_version]="Version";                       T_RU[s_version]="Версия"
T_EN[s_pause]="Press enter to continue…";        T_RU[s_pause]="Нажмите enter для продолжения…"
T_EN[st_panel]="Frontend";                       T_RU[st_panel]="Фронтенд"
T_EN[st_xray]="Backend";                         T_RU[st_xray]="Бэкенд"
T_EN[st_autostart]="Autostart";                  T_RU[st_autostart]="Автозапуск"
T_EN[st_running]="running";                      T_RU[st_running]="работает"
T_EN[st_stopped]="stopped";                      T_RU[st_stopped]="не работает"
T_EN[st_notinstalled]="not installed";           T_RU[st_notinstalled]="не установлено"
T_EN[st_enabled]="enabled";                      T_RU[st_enabled]="включен"
T_EN[st_disabled]="disabled";                    T_RU[st_disabled]="выключен"
T_EN[g1]="Install/update/delete";                T_RU[g1]="Установка/обновление/удаление"
T_EN[g2]="Frontend management";                  T_RU[g2]="Фронтенд менеджмент"
T_EN[g3]="Backend management";                   T_RU[g3]="Бэкенд менеджмент"
T_EN[g4]="Database management";                  T_RU[g4]="БД менеджмент"
T_EN[g5]="Reverse-proxy Nginx management";       T_RU[g5]="Реверс-прокси/Nginx менеджмент"
T_EN[m1]="Install panel";                        T_RU[m1]="Установка панели"
T_EN[m2]="Update panel";                         T_RU[m2]="Обновление панели"
T_EN[m3]="Update CLI";                           T_RU[m3]="Обновление CLI"
T_EN[m4]="Legacy build install";                 T_RU[m4]="Установить предыдущие версии"
T_EN[m5]="Uninstall panel";                      T_RU[m5]="Удалить панель"
T_EN[m6]="Reset login/password";                 T_RU[m6]="Сброс логина/пароля"
T_EN[m7]="Reset panel path";                     T_RU[m7]="Сбросить путь панели"
T_EN[m8]="Reset panel settings";                 T_RU[m8]="Сбросить настройки панели"
T_EN[m9]="Change panel port";                    T_RU[m9]="Изменить порт панели"
T_EN[m10]="View current access settings";        T_RU[m10]="Показать текущие данные доступа"
T_EN[m11]="Service start";                       T_RU[m11]="Запуск сервисов"
T_EN[m12]="Service stop";                        T_RU[m12]="Остановка сервисов"
T_EN[m13]="Service restart";                     T_RU[m13]="Перезапуск сервисов"
T_EN[m14]="Restart backend";                     T_RU[m14]="Перезапуск бэкенда"
T_EN[m15]="Service status";                      T_RU[m15]="Статус сервисов"
T_EN[m16]="Service logs";                        T_RU[m16]="Логи сервисов"
T_EN[m17]="Enable service autostart";            T_RU[m17]="Включить автозапуск сервисов"
T_EN[m18]="Disable service autostart";           T_RU[m18]="Отключить автозапуск сервисов"
T_EN[m19]="PostgreSQL Database";                 T_RU[m19]="PostgreSQL БД"
T_EN[m20]="Reverse-proxy Nginx settings";        T_RU[m20]="Настройки реверс-прокси/Nginx"
T_EN[m0]="Exit";                                 T_RU[m0]="Выход"

# ── Batch 2: PostgreSQL + Reverse-proxy submenus ─────────────────────────────
T_EN[s_back]="Back to menu";                     T_RU[s_back]="Вернуться в меню"
T_EN[s_invalid]="Invalid option";                T_RU[s_invalid]="Неверный выбор"
T_EN[pg_title]="PostgreSQL";                     T_RU[pg_title]="PostgreSQL БД"
T_EN[pg1]="Install (system wise)";               T_RU[pg1]="Установка PostgreSQL в систему"
T_EN[pg2]="SQLite to PostgreSQL migration";      T_RU[pg2]="Перенос данных SQLite в PostgreSQL"
T_EN[pg3]="PostgreSQL status";                   T_RU[pg3]="Статус PostgreSQL"
T_EN[pg9]="Convert .db <-> .dump";               T_RU[pg9]="Конвертация формата дампа .db <-> .dump"
T_EN[pg4]="Start PostgreSQL";                    T_RU[pg4]="Запуск PostgreSQL"
T_EN[pg5]="Stop PostgreSQL";                     T_RU[pg5]="Остановка PostgreSQL"
T_EN[pg6]="Restart PostgreSQL";                  T_RU[pg6]="Перезапуск PostgreSQL"
T_EN[pg7]="Enable PostgreSQL autostart";         T_RU[pg7]="Включить автозапуск PostgreSQL"
T_EN[pg8]="PostgreSQL log";                      T_RU[pg8]="Лог PostgreSQL"
T_EN[rp_title]="Reverse-proxy Nginx";            T_RU[rp_title]="Реверс-прокси/Nginx"
T_EN[rp1]="Reverse-proxy status";                T_RU[rp1]="Статус реверс-прокси"
T_EN[rp2]="Force certificate renewal";           T_RU[rp2]="Принудительный выпуск сертификатов"
T_EN[rp3]="Remove reverse-proxy";                T_RU[rp3]="Удалить реверс-прокси"
T_EN[rp_notturnkey]="This is not a turnkey reverse-proxy install (marker %s not found)"; T_RU[rp_notturnkey]="Это не turnkey-установка реверс-прокси (маркер %s не найден)"
T_EN[rps_title]="Reverse-proxy status";          T_RU[rps_title]="Статус реверс-прокси"
T_EN[rps_panel]="Community panel domain:";       T_RU[rps_panel]="Домен для доступа в Community Panel:"
T_EN[rps_sub]="Subscription page domain:";       T_RU[rps_sub]="Домен для страницы подписок:"
T_EN[rps_selfsteal]="Selfsteal/Reality domain:"; T_RU[rps_selfsteal]="Домен для сайта-заглушки:"
T_EN[rps_cert_ok]="Certificate %s: valid until %s";  T_RU[rps_cert_ok]="Сертификат %s выпущен до %s"
T_EN[rps_cert_missing]="Certificate %s: .pem/.key files are missing"; T_RU[rps_cert_missing]="Сертификат %s: .pem/.key файлы сертификатов не найдены"
T_EN[rps_nginx_up]="Nginx: running";             T_RU[rps_nginx_up]="Nginx: запущен и работает"
T_EN[rps_nginx_down]="Nginx: not running";       T_RU[rps_nginx_down]="Nginx: не работает"
T_EN[rps_cron_ok]="Certificate renewal cron policy: present";   T_RU[rps_cron_ok]="Политика автоматического обновления сертификатов в cron: активна"
T_EN[rps_cron_missing]="Certificate renewal cron policy: missing"; T_RU[rps_cron_missing]="Политика автоматического обновления сертификатов в cron: отсутствует"
T_EN[rpn_renew]="Renewing certificate for %s";   T_RU[rpn_renew]="Обновление сертификата для %s"
T_EN[rpn_reload]="Restarting Nginx services";    T_RU[rpn_reload]="Перезапуск сервисов Nginx"
T_EN[rpn_done]="Certificates renewed";           T_RU[rpn_done]="Сертификаты обновлены"
T_EN[rpr_confirm]="Remove reverse-proxy? The panel will be accessible by direct ip address:port link"; T_RU[rpr_confirm]="Удалить реверс-прокси? Панель станет доступна по айпи адресу:порту"
T_EN[rpr_pins]="Domain pins removed";            T_RU[rpr_pins]="Привязка к доменам удалена"
T_EN[rpr_done]="Reverse-proxy removed, to get the correct ip:port link run 'x-ui settings' in your terminal session"; T_RU[rpr_done]="Реверс-прокси удален, чтобы получить актуальную ссылку доступа, выполните 'x-ui settings' в терминале"

# ── Batch 4: cert-cron self-check, confirms, reset/port, service happy-path ───
T_EN[cc_notfound]="Certificate renewal cron policy not found";  T_RU[cc_notfound]="Политика автоматического обновления сертификатов в cron не найдена"
T_EN[cc_changed]="Certificate renewal cron policy changed";     T_RU[cc_changed]="Политика автоматического обновления сертификатов в cron изменилась"
T_EN[cc_without]="Without it, certificates will stop renewing and expire in 90 days"; T_RU[cc_without]="Без этого сертификаты не будут автоматически обновляться и истекут через 90 дней"
T_EN[cc_repair]="Repair and restore the renewal rules? [Y/n]:"; T_RU[cc_repair]="Восстановить политики обновления? [Y/n]:"
T_EN[cc_skipped]="Skipped! — certificates will not auto-renew";  T_RU[cc_skipped]="Действие отменено! — сертификаты не будут автоматически обновляться"
T_EN[cc_restored]="Certificate auto-renewal policies restored"; T_RU[cc_restored]="Политики автоматического обновления сертификатов восстановлены"
T_EN[cc_failed]="Failed to install the acme.sh cron policy — check that the cron daemon is running"; T_RU[cc_failed]="Не удалось установить политики автоматического обновления сертификатов в cron — проверьте что сервис cron запущен и работает в системе"
T_EN[cf_default]="[Default %s]:";                T_RU[cf_default]="[По умолчанию %s]:"
T_EN[cf_yn]="[y/n]:";                            T_RU[cf_yn]="[y/n]:"
T_EN[cf_restart]="Restart Community Panel? Restarting the panel frontend also restarts backend core"; T_RU[cf_restart]="Перезапустить Community Panel? Перезапуск фронтенда также перезапустит и бэкенд ядро"
T_EN[s_cancelled]="Cancelled";                   T_RU[s_cancelled]="Прервано"
T_EN[rs_user]="Enter the login [or keep empty to generate a random username]:"; T_RU[rs_user]="Введите новый логин [или оставьте пустым для генерации случайным образом]:"
T_EN[rs_pass]="Enter the password [or keep empty to generate a random password]:"; T_RU[rs_pass]="Введите новый пароль [или оставьте пустым для генерации случайным образом]:"
T_EN[rs_2fa]="Disable the currently configured 2FA TOTP authorisation? [Y/n]:"; T_RU[rs_2fa]="Отключить активную авторизацию через 2FA TOTP? [Y/n]:"
T_EN[rs_2fa_done]="Two-factor authentication has been disabled"; T_RU[rs_2fa_done]="Двухфакторная авторизация отключена"
T_EN[rs_login_reset]="Community Panel login has been reset to: %s"; T_RU[rs_login_reset]="Логин для авторизации в Community Panel был сброшен на: %s"
T_EN[rs_pass_reset]="Community Panel password has been reset to: %s"; T_RU[rs_pass_reset]="Пароль для авторизации в Community Panel был сброшен на: %s"
T_EN[rs_save]="Be sure to save the new login/password for access to the Community Panel"; T_RU[rs_save]="Обязательно сохраните новые логин/пароль доступа в Community Panel"
T_EN[rs_path_confirm]="Are you sure you want to reset the web base path for access to the Community Panel? [y/N]:"; T_RU[rs_path_confirm]="Вы уверены что хотите сбросить webBasePath для доступа в Community Panel? [y/N]:"
T_EN[rs_path_reset]="Web base path has been reset to: %s"; T_RU[rs_path_reset]="WebBasePath был сброшен на: %s"
T_EN[rs_config_done]="All settings have been reset to default"; T_RU[rs_config_done]="Все настройки были сброшены по умолчанию"
T_EN[pt_enter]="Enter the new Community Panel access port [1-65535]:"; T_RU[pt_enter]="Введите новый порт для доступа в Community Panel [1-65535]:"
T_EN[pt_changed]="Community Panel port changed successfully to: %s"; T_RU[pt_changed]="Порт для доступа в Community Panel был сброшен на: %s"
T_EN[sv_started]="Community Panel is successfully started";      T_RU[sv_started]="Community Panel успешно запущена"
T_EN[sv_already]="Community Panel is already running";           T_RU[sv_already]="Community Panel уже запущена"
T_EN[sv_stopped]="Community Panel frontend and backend is successfully stopped"; T_RU[sv_stopped]="Фронтенд и бэкенд Community Panel успешно остановлен"
T_EN[sv_restarted]="Community Panel frontend and backend is successfully restarted"; T_RU[sv_restarted]="Фронтенд и бэкенд Community Panel успешно перезапущен"
T_EN[sv_xray_restart]="Backend restart signal is successfully sent"; T_RU[sv_xray_restart]="Команда на перезапуск бэкенда отправлена"
T_EN[sv_enabled]="Service autostart on system boot is successfully enabled"; T_RU[sv_enabled]="Автозапуск сервисов при перезагрузке системы успешно включен"
T_EN[sv_disabled]="Service autostart on system boot is successfully disabled"; T_RU[sv_disabled]="Автозапуск сервисов при перезагрузке системы успешно выключен"

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
        echo && read -rp "$1 $(printf "$(t cf_default)" "$2") " temp
        if [[ "${temp}" == "" ]]; then
            temp=$2
        fi
    else
        read -rp "$1 $(t cf_yn) " temp
    fi
    if [[ "${temp}" == "y" || "${temp}" == "Y" ]]; then
        return 0
    else
        return 1
    fi
}

confirm_restart() {
    confirm "$(t cf_restart)" "y"
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
    echo && echo -n -e "${gray}$(t s_pause)${plain}" && read -r _
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
        LOGE "$(t s_cancelled)"
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
        LOGE "$(t s_cancelled)"
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
    before_show_menu
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

    read -rp " $(ask "$(t rs_user)") " config_account
    [[ -z $config_account ]] && config_account=$(gen_random_string 10)
    read -rp " $(ask "$(t rs_pass)") " config_password
    [[ -z $config_password ]] && config_password=$(gen_random_string 18)

    read -rp " $(ask "$(t rs_2fa)") " twoFactorConfirm
    if [[ $twoFactorConfirm != "y" && $twoFactorConfirm != "Y" ]]; then
        ${xui_folder}/x-ui setting -username "${config_account}" -password "${config_password}" > /dev/null 2>&1
    else
        ${xui_folder}/x-ui setting -username "${config_account}" -password "${config_password}" -resetTwoFactor=true > /dev/null 2>&1
        echo -e "${green}$(t rs_2fa_done)${plain}"
    fi

    echo -e "$(printf "$(t rs_login_reset)" "${green}${config_account}${plain}")"
    echo -e "$(printf "$(t rs_pass_reset)" "${green}${config_password}${plain}")"
    echo -e "${green}$(t rs_save)${plain}"
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

    read -rp " $(ask "$(t rs_path_confirm)") " confirm
    if [[ $confirm != "y" && $confirm != "Y" ]]; then
        echo -e "${yellow}Operation canceled.${plain}"
        return
    fi

    config_webBasePath=$(gen_random_string 18)

    # Apply the new web base path setting
    ${xui_folder}/x-ui setting -webBasePath "${config_webBasePath}" > /dev/null 2>&1

    echo -e "$(printf "$(t rs_path_reset)" "${green}${config_webBasePath}${plain}")"
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
    echo -e "$(t rs_config_done)"
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
            echo -e "${yellow}For security, put the panel behind a reverse proxy with TLS (option 20).${plain}"
        fi
    fi
    [[ $# == 0 ]] && before_show_menu
}

set_port() {
    read -rp " $(ask "$(t pt_enter)") " port
    if [[ -z "${port}" ]]; then
        LOGD "$(t s_cancelled)"
        before_show_menu
    else
        ${xui_folder}/x-ui setting -port ${port}
        echo -e "$(printf "$(t pt_changed)" "${green}${port}${plain}")"
        confirm_restart
    fi
}

start() {
    check_status
    if [[ $? == 0 ]]; then
        echo ""
        LOGI "$(t sv_already)"
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
            LOGI "$(t sv_started)"
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
            LOGI "$(t sv_stopped)"
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
            LOGI "$(t sv_restarted)"
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
        LOGI "$(t sv_restarted)"
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
            LOGI "$(t sv_xray_restart)"
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
    LOGI "$(t sv_xray_restart)"
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
        LOGI "$(t sv_enabled)"
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
        LOGI "$(t sv_disabled)"
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
        0) pstate="$(t st_running)";      pcol="$green"  ;;
        1) pstate="$(t st_stopped)";      pcol="$yellow" ;;
        2) pstate="$(t st_notinstalled)"; pcol="$red"    ;;
    esac

    local xstate xcol
    if check_xray_status; then xstate="$(t st_running)"; xcol="$green"; else xstate="$(t st_stopped)"; xcol="$red"; fi

    local astate acol
    if [[ "${running_in_docker}" == "true" ]]; then
        astate="docker"; acol="$gray"
    elif check_enabled; then
        astate="$(t st_enabled)"; acol="$green"
    else
        astate="$(t st_disabled)"; acol="$red"
    fi

    echo -e "  ${pcol}●${plain} ${gray}$(t st_panel)${plain} ${pcol}${pstate}${plain}    ${xcol}●${plain} ${gray}$(t st_xray)${plain} ${xcol}${xstate}${plain}    ${gray}$(t st_autostart)${plain} ${acol}${astate}${plain}"
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
    echo -e "  ${bold}$(t pg_title)${plain}"
    echo
    echo -e "     ${orange} 1${plain}  $(t pg1)"
    echo -e "     ${orange} 2${plain}  $(t pg2)"
    echo -e "     ${orange} 3${plain}  $(t pg3)"
    echo -e "     ${orange} 9${plain}  $(t pg9)"
    echo
    echo -e "     ${orange} 4${plain}  $(t pg4)"
    echo -e "     ${orange} 5${plain}  $(t pg5)"
    echo -e "     ${orange} 6${plain}  $(t pg6)"
    echo -e "     ${orange} 7${plain}  $(t pg7)"
    echo -e "     ${orange} 8${plain}  $(t pg8)"
    echo
    echo -e "     ${orange} 0${plain}  $(t s_back)"
    echo
    read -rp " $(ask "$(t s_select)") " choice
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
        *) msg_err "$(t s_invalid)"; sleep 1; continue ;;
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
    echo -e "  ${bold}$(t rps_title)${plain}"
    msg_info "$(t rps_panel) ${PANEL_DOMAIN:-?}"
    msg_info "$(t rps_sub) ${SUB_DOMAIN:-?}"
    msg_info "$(t rps_selfsteal) ${SELFSTEAL_DOMAIN:-?}"
    echo
    local d cert exp
    for d in "$PANEL_DOMAIN" "$SUB_DOMAIN" "$SELFSTEAL_DOMAIN"; do
        [[ -n "$d" ]] || continue
        cert="${SSLDIR}/${d}/fullchain.pem"
        if [[ -f "$cert" ]]; then
            exp=$(openssl x509 -enddate -noout -in "$cert" 2> /dev/null | cut -d= -f2)
            msg_ok "$(printf "$(t rps_cert_ok)" "$d" "$exp")"
        else
            msg_warn "$(printf "$(t rps_cert_missing)" "$d")"
        fi
    done
    echo
    systemctl is-active --quiet nginx && msg_ok "$(t rps_nginx_up)" || msg_err "$(t rps_nginx_down)"
    if crontab -l 2> /dev/null | grep -q 'acme.sh --cron'; then
        msg_ok "$(t rps_cron_ok)"
    else
        msg_warn "$(t rps_cron_missing)"
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
        run_step "$(printf "$(t rpn_renew)" "$d")" bash -c "$acme --renew -d '$d' --ecc --force"
    done
    run_step "$(t rpn_reload)" systemctl reload nginx || true
    msg_ok "$(t rpn_done)"
}

rp_remove() {
    confirm "$(t rpr_confirm)" "n" || return
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
            msg_ok "$(t rpr_pins)"
        else
            msg_warn "Could not clear domain pins in the DB — remove them manually in the panel."
        fi
        systemctl start x-ui
    fi
    rm -f "$RP_MARKER"
    msg_ok "$(t rpr_done)"
    msg_info "Certificates and the acme cron were left untouched."
}

reverse_proxy_menu() {
    if [[ ! -f "$RP_MARKER" ]]; then
        clear; echo
        msg_warn "$(printf "$(t rp_notturnkey)" "$RP_MARKER")"
        before_show_menu
        return
    fi
    while true; do
        clear
        echo
        echo -e "  ${bold}$(t rp_title)${plain}"
        echo
        echo -e "     ${orange} 1${plain}  $(t rp1)"
        echo -e "     ${orange} 2${plain}  $(t rp2)"
        echo -e "     ${orange} 3${plain}  $(t rp3)"
        echo
        echo -e "     ${orange} 0${plain}  $(t s_back)"
        echo
        local c; read -rp " $(ask "$(t s_select)") " c
        case "$c" in
            0) return ;;
            1) rp_status ;;
            2) rp_renew_certs ;;
            3) rp_remove; before_show_menu; return ;;
            *) msg_err "$(t s_invalid)"; sleep 1; continue ;;
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
    echo -e "  ${bold}${orange}Community Panel${plain} ${gray}· CLI${plain}"
    echo -e "  ${gray}$(t s_version) ${ver:-unknown}${plain}"
    echo

    echo -e "  ${bold}$(t g1)${plain}"
    echo -e "     ${orange} 1${plain}  $(t m1)"
    echo -e "     ${orange} 2${plain}  $(t m2)"
    echo -e "     ${orange} 3${plain}  $(t m3)"
    echo -e "     ${orange} 4${plain}  $(t m4)"
    echo -e "     ${orange} 5${plain}  $(t m5)"
    echo

    echo -e "  ${bold}$(t g2)${plain}"
    echo -e "     ${orange} 6${plain}  $(t m6)"
    echo -e "     ${orange} 7${plain}  $(t m7)"
    echo -e "     ${orange} 8${plain}  $(t m8)"
    echo -e "     ${orange} 9${plain}  $(t m9)"
    echo -e "     ${orange}10${plain}  $(t m10)"
    echo

    echo -e "  ${bold}$(t g3)${plain}"
    echo -e "     ${orange}11${plain}  $(t m11)"
    echo -e "     ${orange}12${plain}  $(t m12)"
    echo -e "     ${orange}13${plain}  $(t m13)"
    echo -e "     ${orange}14${plain}  $(t m14)"
    echo -e "     ${orange}15${plain}  $(t m15)"
    echo -e "     ${orange}16${plain}  $(t m16)"
    echo -e "     ${orange}17${plain}  $(t m17)"
    echo -e "     ${orange}18${plain}  $(t m18)"
    echo

    echo -e "  ${bold}$(t g4)${plain}"
    echo -e "     ${orange}19${plain}  $(t m19)"
    echo

    echo -e "  ${bold}$(t g5)${plain}"
    echo -e "     ${orange}20${plain}  $(t m20)"
    echo

    echo -e "     ${orange} 0${plain}  $(t m0)"
    echo
    show_status
    echo
    read -rp " $(ask "$(t s_select)") " num

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
        msg_warn "$(t cc_notfound)"
    else
        msg_warn "$(t cc_changed)"
    fi
    echo -e "  ${gray}$(t cc_without)${plain}"
    local yn; read -rp " $(ask "$(t cc_repair)") " yn
    [[ "$yn" =~ ^[Nn]$ ]] && { msg_warn "$(t cc_skipped)"; return 0; }

    "$acme" --install-cronjob > /dev/null 2>&1 || true
    for d in "$PANEL_DOMAIN" "$SUB_DOMAIN" "$SELFSTEAL_DOMAIN"; do
        [[ -n "$d" && -d "${SSLDIR}/${d}" ]] || continue
        "$acme" --install-cert -d "$d" --ecc \
            --key-file "${SSLDIR}/${d}/privkey.pem" \
            --fullchain-file "${SSLDIR}/${d}/fullchain.pem" \
            --reloadcmd "systemctl reload nginx 2>/dev/null || true" > /dev/null 2>&1 || true
    done

    if crontab -l 2> /dev/null | grep -q 'acme.sh --cron'; then
        msg_ok "$(t cc_restored)"
    else
        msg_err "$(t cc_failed)"
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
