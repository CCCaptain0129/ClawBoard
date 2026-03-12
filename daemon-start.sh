#!/bin/bash

# OpenClaw Visualization 守护进程启动脚本 (macOS/Linux)
# 启动服务并启动监控脚本，确保持续运行

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

# PID 文件
WATCH_PID_FILE="$PROJECT_ROOT/tmp/watch.pid"
DAEMON_LOG="$PROJECT_ROOT/tmp/daemon.log"

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

# 检查监控脚本是否已在运行
function check_watch_running() {
    if [ -f "$WATCH_PID_FILE" ]; then
        local pid=$(cat "$WATCH_PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            print_warning "监控脚本已在运行 (PID: $pid)"
            return 0
        fi
    fi
    return 1
}

# 启动服务
function start_services() {
    print_info "启动服务..."
    cd "$PROJECT_ROOT"

    # 使用现有的 start.sh 启动服务
    if [ -x "./start.sh" ]; then
        ./start.sh
    else
        print_error "找不到 start.sh 或没有执行权限"
        return 1
    fi
}

# 启动监控脚本
function start_watch() {
    print_info "启动监控脚本..."

    # 创建临时目录
    mkdir -p "$PROJECT_ROOT/tmp"

    # 使用 nohup 在后台运行监控脚本
    nohup "$PROJECT_ROOT/watch.sh" > "$DAEMON_LOG" 2>&1 &

    # 等待一下让脚本启动
    sleep 2

    # 检查监控脚本是否成功启动
    if [ -f "$WATCH_PID_FILE" ]; then
        local watch_pid=$(cat "$WATCH_PID_FILE")
        if ps -p $watch_pid > /dev/null 2>&1; then
            print_success "监控脚本已启动 (PID: $watch_pid)"
            return 0
        fi
    fi

    print_error "监控脚本启动失败"
    return 1
}

# 主函数
function main() {
    echo ""
    echo "=========================================="
    echo "OpenClaw Visualization 守护进程启动"
    echo "=========================================="
    echo ""

    # 检查监控脚本是否已在运行
    if check_watch_running; then
        echo ""
        print_info "守护进程已在运行，无需重复启动"
        echo ""
        echo "查看监控日志: tail -f $DAEMON_LOG"
        echo "停止守护进程: ./daemon-stop.sh"
        echo ""
        return 0
    fi

    # 启动服务
    if ! start_services; then
        print_error "服务启动失败"
        exit 1
    fi

    echo ""

    # 启动监控脚本
    if ! start_watch; then
        print_error "监控脚本启动失败"
        exit 1
    fi

    echo ""
    echo "=========================================="
    echo -e "${GREEN}✅ 守护进程已启动${NC}"
    echo "=========================================="
    echo ""
    echo "📝 监控日志: tail -f $DAEMON_LOG"
    echo "📝 重启历史: tail -f $PROJECT_ROOT/tmp/restart-history.log"
    echo "🔍 监控进程 PID: cat $WATCH_PID_FILE"
    echo ""
    echo "🛑 停止守护进程: ./daemon-stop.sh"
    echo "=========================================="
    echo ""
}

# 运行主函数
main