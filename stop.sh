#!/bin/bash

# OpenClaw Visualization 一键停止脚本 (macOS/Linux) - 优化版

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

# 停止进程
function stop_process() {
    local pid_file=$1
    local name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            print_info "停止 $name (PID: $pid)..."
            kill $pid 2>/dev/null
            sleep 2

            # 如果进程还在运行，强制停止
            if ps -p $pid > /dev/null 2>&1; then
                print_warning "强制停止 $name..."
                kill -9 $pid 2>/dev/null
                sleep 1
            fi

            print_success "$name 已停止"
        else
            print_warning "$name 未运行"
        fi
        rm -f "$pid_file"
    else
        print_warning "$name PID 文件不存在"
    fi
}

# 清理端口占用
function cleanup_ports() {
    print_info "清理端口占用..."

    # 停止端口 3000 (后端 HTTP)
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        lsof -ti:3000 | xargs kill -9 2>/dev/null
        print_success "端口 3000 已清理"
    fi

    # 停止端口 3001 (后端 WebSocket)
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        lsof -ti:3001 | xargs kill -9 2>/dev/null
        print_success "端口 3001 已清理"
    fi

    # 停止端口 5173-5177 (前端 Vite)
    for port in 5173 5174 5175 5176 5177; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            lsof -ti:$port | xargs kill -9 2>/dev/null
        fi
    done
    print_success "前端端口 (5173-5177) 已清理"

    # 清理端口文件
    rm -f "$FRONTEND_PORT_FILE" 2>/dev/null
}

# 主函数
function main() {
    echo ""
    echo "=========================================="
    echo "OpenClaw Visualization 停止服务"
    echo "=========================================="
    echo ""

    # 停止后端服务
    stop_process "$BACKEND_PID_FILE" "后端服务"

    # 停止前端服务
    stop_process "$FRONTEND_PID_FILE" "前端服务"

    echo ""

    # 清理端口
    cleanup_ports

    echo ""
    echo "=========================================="
    echo -e "${GREEN}✅ 所有服务已停止${NC}"
    echo "=========================================="
    echo ""
}

# 运行主函数
main