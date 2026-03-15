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
BACKEND_DIR="$PROJECT_ROOT/src/backend"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"

# PID 文件
BACKEND_PID_FILE="$PROJECT_ROOT/tmp/backend.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/tmp/frontend.pid"
FRONTEND_PORT_FILE="$PROJECT_ROOT/tmp/frontend.port"
DISPATCHER_PID_FILE="$PROJECT_ROOT/tmp/pm-dispatcher.pid"

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

# 停止指定 PID（温和 kill，超时后 kill -9）
function stop_process_by_pid() {
    local pid=$1
    local name=$2
    local timeout=5

    if [ -z "$pid" ]; then
        return 1
    fi

    if ! ps -p $pid > /dev/null 2>&1; then
        return 1  # 进程不存在
    fi

    print_info "停止 $name (PID: $pid)..."
    kill $pid 2>/dev/null

    # 等待进程退出
    local waited=0
    while [ $waited -lt $timeout ]; do
        if ! ps -p $pid > /dev/null 2>&1; then
            print_success "$name 已停止"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    # 强制停止
    if ps -p $pid > /dev/null 2>&1; then
        print_warning "强制停止 $name (PID: $pid)..."
        kill -9 $pid 2>/dev/null
        sleep 1
        print_success "$name 已强制停止"
        return 0
    fi

    return 1
}

# 按命令行模式匹配并停止所有后端进程
function stop_backend_processes() {
    local stopped_count=0
    local killed_count=0

    # 查找所有匹配的进程
    local pids=$(pgrep -f "$BACKEND_DIR/.*/ts-node.*src/index.ts|$BACKEND_DIR/node_modules/.bin/ts-node src/index.ts" || true)

    if [ -z "$pids" ]; then
        return 0
    fi

    print_info "发现运行中的后端进程，正在停止..."

    for pid in $pids; do
        if ps -p $pid > /dev/null 2>&1; then
            # 温和 kill
            kill $pid 2>/dev/null
            stopped_count=$((stopped_count + 1))
        fi
    done

    # 等待进程退出
    sleep 3

    # 检查是否还有进程存活，强制 kill
    for pid in $pids; do
        if ps -p $pid > /dev/null 2>&1; then
            print_warning "强制停止后端进程 (PID: $pid)..."
            kill -9 $pid 2>/dev/null
            killed_count=$((killed_count + 1))
        fi
    done

    if [ $stopped_count -gt 0 ] || [ $killed_count -gt 0 ]; then
        print_success "已停止 $stopped_count 个后端进程，强制停止 $killed_count 个"
    fi
}

# 按命令行模式匹配并停止所有前端进程
function stop_frontend_processes() {
    local stopped_count=0
    local killed_count=0

    # 查找当前项目下所有匹配的 Vite 进程
    local pids=$(pgrep -f "$FRONTEND_DIR/node_modules/.bin/vite" || true)

    if [ -z "$pids" ]; then
        return 0
    fi

    print_info "发现运行中的前端进程，正在停止..."

    for pid in $pids; do
        if ps -p $pid > /dev/null 2>&1; then
            # 温和 kill
            kill $pid 2>/dev/null
            stopped_count=$((stopped_count + 1))
        fi
    done

    # 等待进程退出
    sleep 2

    # 检查是否还有进程存活，强制 kill
    for pid in $pids; do
        if ps -p $pid > /dev/null 2>&1; then
            kill -9 $pid 2>/dev/null
            killed_count=$((killed_count + 1))
        fi
    done

    if [ $stopped_count -gt 0 ] || [ $killed_count -gt 0 ]; then
        print_success "已停止 $stopped_count 个前端进程，强制停止 $killed_count 个"
    fi
}

# 停止 PM-Agent Dispatcher 进程
function stop_dispatcher() {
    if [ -f "$DISPATCHER_PID_FILE" ]; then
        local pid=$(cat "$DISPATCHER_PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            print_info "停止 PM-Agent Dispatcher (PID: $pid)..."
            kill $pid 2>/dev/null
            sleep 2

            # 如果进程还在运行，强制停止
            if ps -p $pid > /dev/null 2>&1; then
                print_warning "强制停止 PM-Agent Dispatcher (PID: $pid)..."
                kill -9 $pid 2>/dev/null
                sleep 1
            fi

            print_success "PM-Agent Dispatcher 已停止"
        else
            print_info "PM-Agent Dispatcher 进程不存在，清理 PID 文件"
        fi
        rm -f "$DISPATCHER_PID_FILE"
    else
        # 兜底：按进程名匹配
        local pids=$(pgrep -f "pm-agent-dispatcher.mjs --watch" | grep -v grep || true)
        if [ -n "$pids" ]; then
            print_info "发现运行中的 PM-Agent Dispatcher 进程，正在停止..."
            for pid in $pids; do
                if ps -p $pid > /dev/null 2>&1; then
                    kill $pid 2>/dev/null
                fi
            done
            sleep 2
            # 强制 kill 存活进程
            for pid in $pids; do
                if ps -p $pid > /dev/null 2>&1; then
                    kill -9 $pid 2>/dev/null
                fi
            done
            print_success "PM-Agent Dispatcher 已停止"
        fi
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

    # 停止 PM-Agent Dispatcher
    stop_dispatcher

    # 停止后端服务（优先使用 pidfile，兜底使用进程匹配）
    if [ -f "$BACKEND_PID_FILE" ]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        stop_process_by_pid $pid "后端服务" || true
        rm -f "$BACKEND_PID_FILE"
    else
        stop_backend_processes
    fi

    # 停止前端服务（优先使用 pidfile，兜底使用进程匹配）
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        stop_process_by_pid $pid "前端服务" || true
        rm -f "$FRONTEND_PID_FILE"
    else
        stop_frontend_processes
    fi

    echo ""

    # 清理端口文件
    rm -f "$FRONTEND_PORT_FILE" 2>/dev/null

    echo ""
    echo "=========================================="
    echo -e "${GREEN}✅ 所有服务已停止${NC}"
    echo "=========================================="
    echo ""
}

# 运行主函数
main
