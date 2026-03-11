#!/bin/bash

# OpenClaw Visualization 一键启动脚本 (macOS/Linux)

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

# 日志文件
BACKEND_LOG="$PROJECT_ROOT/tmp/backend.log"
FRONTEND_LOG="$PROJECT_ROOT/tmp/frontend.log"

# 创建临时目录
mkdir -p "$PROJECT_ROOT/tmp"

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

# 检查 Node.js
function check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        echo "请先安装 Node.js: https://nodejs.org/"
        exit 1
    fi
    
    local node_version=$(node --version)
    print_info "Node.js 版本: $node_version"
    
    # 检查版本是否 >= 18
    if ! node --version | grep -qE 'v(1[89]|[2-9][0-9])\.'; then
        print_warning "建议使用 Node.js 18 或更高版本"
    fi
}

# 检查 npm
function check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        exit 1
    fi
    
    local npm_version=$(npm --version)
    print_info "npm 版本: $npm_version"
}

# 安装依赖
function install_dependencies() {
    print_info "检查并安装依赖..."
    
    # 后端依赖
    if [ ! -d "$BACKEND_DIR/node_modules" ]; then
        print_info "安装后端依赖..."
        cd "$BACKEND_DIR"
        npm install --silent
        print_success "后端依赖安装完成"
    else
        print_info "后端依赖已存在"
    fi
    
    # 前端依赖
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        print_info "安装前端依赖..."
        cd "$FRONTEND_DIR"
        npm install --silent
        print_success "前端依赖安装完成"
    else
        print_info "前端依赖已存在"
    fi
    
    cd "$PROJECT_ROOT"
}

# 检查端口是否被占用
function check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "端口 $port 已被占用"
        return 1
    fi
    return 0
}

# 启动后端服务
function start_backend() {
    print_info "启动后端服务..."
    
    if check_port 3000 && check_port 3001; then
        cd "$BACKEND_DIR"
        nohup npm run dev > "$BACKEND_LOG" 2>&1 &
        local backend_pid=$!
        echo $backend_pid > "$PROJECT_ROOT/tmp/backend.pid"
        print_success "后端服务已启动 (PID: $backend_pid)"
        print_info "后端日志: $BACKEND_LOG"
        
        # 等待后端启动
        sleep 3
        
        # 检查后端是否成功启动
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            print_success "后端服务运行正常"
        else
            print_error "后端服务启动失败，请查看日志: $BACKEND_LOG"
            exit 1
        fi
    else
        print_error "无法启动后端服务，端口被占用"
        exit 1
    fi
}

# 启动前端服务
function start_frontend() {
    print_info "启动前端服务..."
    
    if check_port 5173; then
        cd "$FRONTEND_DIR"
        nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
        local frontend_pid=$!
        echo $frontend_pid > "$PROJECT_ROOT/tmp/frontend.pid"
        print_success "前端服务已启动 (PID: $frontend_pid)"
        print_info "前端日志: $FRONTEND_LOG"
        
        # 等待前端启动
        sleep 3
    else
        print_error "无法启动前端服务，端口被占用"
        exit 1
    fi
}

# 显示访问信息
function show_access_info() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}🎉 OpenClaw Visualization 已启动！${NC}"
    echo "=========================================="
    echo ""
    echo "📱 访问地址:"
    echo "   前端: http://localhost:5173"
    echo "   后端: http://localhost:3000"
    echo "   WebSocket: ws://localhost:3001"
    echo ""
    echo "📝 查看日志:"
    echo "   后端: tail -f $BACKEND_LOG"
    echo "   前端: tail -f $FRONTEND_LOG"
    echo ""
    echo "🛑 停止服务: ./stop.sh"
    echo "=========================================="
    echo ""
}

# 主函数
function main() {
    echo ""
    echo "=========================================="
    echo "OpenClaw Visualization 一键启动脚本"
    echo "=========================================="
    echo ""
    
    # 检查环境
    check_nodejs
    check_npm
    echo ""
    
    # 安装依赖
    install_dependencies
    echo ""
    
    # 启动服务
    start_backend
    start_frontend
    echo ""
    
    # 显示访问信息
    show_access_info
}

# 运行主函数
main