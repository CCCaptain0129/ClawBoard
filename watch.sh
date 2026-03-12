#!/bin/bash

# OpenClaw Visualization 服务监控脚本 (macOS/Linux)
# 监控后端和前端服务，在崩溃时自动重启

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 配置文件
WATCH_CONFIG="$PROJECT_ROOT/tmp/watch.conf"
WATCH_PID_FILE="$PROJECT_ROOT/tmp/watch.pid"
WATCH_LOG="$PROJECT_ROOT/tmp/watch.log"
RESTART_HISTORY="$PROJECT_ROOT/tmp/restart-history.log"

# PID 文件
BACKEND_PID_FILE="$PROJECT_ROOT/tmp/backend.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/tmp/frontend.pid"
FRONTEND_PORT_FILE="$PROJECT_ROOT/tmp/frontend.port"

# 默认配置
CHECK_INTERVAL=30  # 检查间隔（秒）
MAX_RESTART_COUNT=10  # 最大重启次数（0表示无限制）
RESTART_WINDOW=3600  # 重启计数窗口（秒，1小时）
HEALTH_CHECK_TIMEOUT=5  # 健康检查超时（秒）

# 加载配置
function load_config() {
    if [ -f "$WATCH_CONFIG" ]; then
        source "$WATCH_CONFIG"
    fi
}

# 打印带颜色的消息
function print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

function print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

function print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 记录日志
function log_message() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $message" >> "$WATCH_LOG"
    echo -e "${CYAN}[LOG]${NC} $message"
}

# 记录重启历史
function log_restart() {
    local service="$1"
    local reason="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $service - $reason" >> "$RESTART_HISTORY"
}

# 检查进程是否在运行
function check_process_running() {
    local pid_file=$1
    local name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# 健康检查
function health_check() {
    local url=$1
    local name=$2

    if curl -s --max-time "$HEALTH_CHECK_TIMEOUT" "$url" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# 检查重启次数
function check_restart_limit() {
    local current_time=$(date +%s)
    local restart_count=0

    if [ -f "$RESTART_HISTORY" ]; then
        # 统计窗口内的重启次数
        restart_count=$(awk -v current="$current_time" -v window="$RESTART_WINDOW" '
            {
                # 提取时间戳
                match($0, /\[([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})\]/, arr)
                if (arr[1] != "") {
                    cmd = "date -d \"" arr[1] "\" +%s"
                    cmd | getline timestamp
                    close(cmd)
                    if (current - timestamp <= window) {
                        count++
                    }
                }
            }
            END { print count + 0 }
        ' "$RESTART_HISTORY")
    fi

    if [ "$MAX_RESTART_COUNT" -gt 0 ] && [ "$restart_count" -ge "$MAX_RESTART_COUNT" ]; then
        print_error "重启次数已达上限 ($restart_count/$MAX_RESTART_COUNT)，停止自动重启"
        log_message "重启次数已达上限，停止自动重启"
        return 1
    fi

    return 0
}

# 重启后端服务
function restart_backend() {
    print_warning "检测到后端服务已停止，尝试重启..."
    log_message "检测到后端服务已停止，尝试重启"

    # 检查重启限制
    if ! check_restart_limit; then
        return 1
    fi

    # 停止可能残留的进程
    if [ -f "$BACKEND_PID_FILE" ]; then
        local old_pid=$(cat "$BACKEND_PID_FILE")
        if ps -p $old_pid > /dev/null 2>&1; then
            kill $old_pid 2>/dev/null
            sleep 2
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    # 清理端口
    for port in 3000 3001; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            lsof -ti:$port | xargs kill -9 2>/dev/null
        fi
    done

    # 启动后端
    cd "$PROJECT_ROOT/src/backend"
    nohup npm run dev > "$PROJECT_ROOT/tmp/backend.log" 2>&1 &
    local backend_pid=$!
    echo $backend_pid > "$BACKEND_PID_FILE"

    # 等待启动
    sleep 5

    # 健康检查
    if health_check "http://localhost:3000/health" "后端服务"; then
        print_success "后端服务重启成功 (PID: $backend_pid)"
        log_message "后端服务重启成功 (PID: $backend_pid)"
        log_restart "后端服务" "自动重启"
        return 0
    else
        print_error "后端服务重启失败"
        log_message "后端服务重启失败"
        log_restart "后端服务" "重启失败"
        rm -f "$BACKEND_PID_FILE"
        return 1
    fi
}

# 重启前端服务
function restart_frontend() {
    print_warning "检测到前端服务已停止，尝试重启..."
    log_message "检测到前端服务已停止，尝试重启"

    # 检查重启限制
    if ! check_restart_limit; then
        return 1
    fi

    # 停止可能残留的进程
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local old_pid=$(cat "$FRONTEND_PID_FILE")
        if ps -p $old_pid > /dev/null 2>&1; then
            kill $old_pid 2>/dev/null
            sleep 2
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    # 清理端口
    for port in 5173 5174 5175 5176 5177; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            lsof -ti:$port | xargs kill -9 2>/dev/null
        fi
    done
    rm -f "$FRONTEND_PORT_FILE"

    # 启动前端
    cd "$PROJECT_ROOT/src/frontend"
    nohup npm run dev > "$PROJECT_ROOT/tmp/frontend.log" 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > "$FRONTEND_PID_FILE"

    # 等待启动
    sleep 5

    # 检测实际端口
    local detected_port=$(grep -oE "Local:.*http://localhost:([0-9]+)" "$PROJECT_ROOT/tmp/frontend.log" | tail -1 | grep -oE "[0-9]+$" || echo "5173")
    echo $detected_port > "$FRONTEND_PORT_FILE"

    # 健康检查
    if health_check "http://localhost:$detected_port" "前端服务"; then
        print_success "前端服务重启成功 (PID: $frontend_pid, 端口: $detected_port)"
        log_message "前端服务重启成功 (PID: $frontend_pid, 端口: $detected_port)"
        log_restart "前端服务" "自动重启"
        return 0
    else
        print_error "前端服务重启失败"
        log_message "前端服务重启失败"
        log_restart "前端服务" "重启失败"
        rm -f "$FRONTEND_PID_FILE"
        rm -f "$FRONTEND_PORT_FILE"
        return 1
    fi
}

# 检查后端服务
function check_backend() {
    # 检查进程
    if ! check_process_running "$BACKEND_PID_FILE" "后端服务"; then
        restart_backend
        return $?
    fi

    # 检查健康端点
    if ! health_check "http://localhost:3000/health" "后端服务"; then
        print_warning "后端服务健康检查失败"
        log_message "后端服务健康检查失败"
        restart_backend
        return $?
    fi

    return 0
}

# 检查前端服务
function check_frontend() {
    # 检查进程
    if ! check_process_running "$FRONTEND_PID_FILE" "前端服务"; then
        restart_frontend
        return $?
    fi

    # 检查健康端点
    local frontend_port=5173
    if [ -f "$FRONTEND_PORT_FILE" ]; then
        frontend_port=$(cat "$FRONTEND_PORT_FILE")
    fi

    if ! health_check "http://localhost:$frontend_port" "前端服务"; then
        print_warning "前端服务健康检查失败"
        log_message "前端服务健康检查失败"
        restart_frontend
        return $?
    fi

    return 0
}

# 主监控循环
function main() {
    echo ""
    echo "=========================================="
    echo "OpenClaw Visualization 服务监控"
    echo "=========================================="
    echo ""

    # 加载配置
    load_config

    # 创建临时目录
    mkdir -p "$PROJECT_ROOT/tmp"

    # 记录监控进程 PID
    echo $$ > "$WATCH_PID_FILE"

    log_message "监控脚本启动 (PID: $$)"
    log_message "检查间隔: ${CHECK_INTERVAL}秒"
    log_message "最大重启次数: ${MAX_RESTART_COUNT}次/${RESTART_WINDOW}秒"

    print_info "监控脚本已启动 (PID: $$)"
    print_info "检查间隔: ${CHECK_INTERVAL}秒"
    print_info "最大重启次数: ${MAX_RESTART_COUNT}次/${RESTART_WINDOW}秒"
    print_info "日志文件: $WATCH_LOG"
    print_info "重启历史: $RESTART_HISTORY"
    echo ""

    # 监控循环
    while true; do
        # 检查后端
        check_backend

        # 检查前端
        check_frontend

        # 等待下一次检查
        sleep $CHECK_INTERVAL
    done
}

# 运行主函数
main