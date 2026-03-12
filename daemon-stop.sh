#!/bin/bash

# OpenClaw Visualization 守护进程停止脚本 (macOS/Linux)
# 停止服务和监控脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# PID 文件
WATCH_PID_FILE="$PROJECT_ROOT/tmp/watch.pid"
BACKEND_PID_FILE="$PROJECT_ROOT/tmp/backend.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/tmp/frontend.pid"
FRONTEND_PORT_FILE="$PROJECT_ROOT/tmp/frontend.port"

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

# 停止监控脚本
function stop_watch() {
    print_info "停止监控脚本..."

    if [ -f "$WATCH_PID_FILE" ]; then
        local watch_pid=$(cat "$WATCH_PID_FILE")
        if ps -p $watch_pid > /dev/null 2>&1; then
            kill $watch_pid 2>/dev/null
            sleep 2

            # 如果进程还在运行，强制停止
            if ps -p $watch_pid > /dev/null 2>&1; then
                print_warning "强制停止监控脚本..."
                kill -9 $watch_pid 2>/dev/null
                sleep 1
            fi

            print_success "监控脚本已停止 (PID: $watch_pid)"
        else
            print_warning "监控脚本未运行"
        fi
        rm -f "$WATCH_PID_FILE"
    else
        print_warning "监控脚本 PID 文件不存在"
    fi
}

# 停止服务
function stop_services() {
    print_info "停止服务..."

    # 使用现有的 stop.sh 停止服务
    if [ -x "./stop.sh" ]; then
        ./stop.sh
    else
        print_error "找不到 stop.sh 或没有执行权限"
        return 1
    fi
}

# 清理所有 PID 文件
function cleanup_pid_files() {
    print_info "清理 PID 文件..."
    rm -f "$WATCH_PID_FILE" 2>/dev/null
    rm -f "$BACKEND_PID_FILE" 2>/dev/null
    rm -f "$FRONTEND_PID_FILE" 2>/dev/null
    rm -f "$FRONTEND_PORT_FILE" 2>/dev/null
    print_success "PID 文件已清理"
}

# 主函数
function main() {
    echo ""
    echo "=========================================="
    echo "OpenClaw Visualization 守护进程停止"
    echo "=========================================="
    echo ""

    # 停止监控脚本
    stop_watch

    echo ""

    # 停止服务
    stop_services

    echo ""

    # 清理 PID 文件
    cleanup_pid_files

    echo ""
    echo "=========================================="
    echo -e "${GREEN}✅ 守护进程已停止${NC}"
    echo "=========================================="
    echo ""
}

# 运行主函数
main