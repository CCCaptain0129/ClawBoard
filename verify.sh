#!/bin/bash

# OpenClaw Visualization 服务验证脚本
# 验证后端和前端服务是否正常运行

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 默认端口
BACKEND_PORT=${BACKEND_PORT:-3000}
FRONTEND_PORT=${FRONTEND_PORT:-5173}

# PID 文件
BACKEND_PID_FILE="$PROJECT_ROOT/tmp/backend.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/tmp/frontend.pid"
FRONTEND_PORT_FILE="$PROJECT_ROOT/tmp/frontend.port"

# 打印函数
print_header() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}OpenClaw Visualization 服务验证${NC}                       ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${CYAN}[CHECK]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# 检查服务是否响应
check_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    print_step "检查 $name ..."
    
    local response
    local http_code
    
    if command -v curl &> /dev/null; then
        response=$(curl -s -w "\n%{http_code}" --max-time 5 "$url" 2>/dev/null || echo -e "\n000")
        http_code=$(echo "$response" | tail -1)
        local body=$(echo "$response" | sed '$d')
        
        if [ "$http_code" = "$expected_status" ]; then
            print_success "$name 响应正常 (HTTP $http_code)"
            if [ -n "$body" ]; then
                echo -e "        ${BLUE}响应:${NC} $(echo "$body" | head -c 100)..."
            fi
            return 0
        else
            print_error "$name 响应异常 (HTTP $http_code)"
            return 1
        fi
    else
        print_warning "curl 未安装，跳过 HTTP 检查"
        return 2
    fi
}

# 检查端口是否被占用
check_port() {
    local port=$1
    local name=$2
    
    print_step "检查端口 $port ($name)..."
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -ti:$port)
        local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        print_success "端口 $port 已被监听 (PID: $pid, 进程: $process_name)"
        return 0
    else
        print_error "端口 $port 未被监听"
        return 1
    fi
}

# 检查进程是否运行
check_process() {
    local pid_file=$1
    local name=$2
    
    print_step "检查 $name 进程..."
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
            print_success "$name 正在运行 (PID: $pid, 进程: $process_name)"
            return 0
        else
            print_warning "$name PID 文件存在但进程未运行 (PID: $pid)"
            return 1
        fi
    else
        print_warning "$name PID 文件不存在"
        return 1
    fi
}

# 验证后端健康检查
verify_backend_health() {
    print_step "验证后端健康检查..."
    
    local response
    response=$(curl -s --max-time 5 "http://localhost:$BACKEND_PORT/health" 2>/dev/null || echo '{"status":"error"}')
    
    if echo "$response" | grep -q '"status":"ok"'; then
        print_success "后端健康检查通过"
        print_info "响应: $response"
        return 0
    else
        print_error "后端健康检查失败"
        print_info "响应: $response"
        return 1
    fi
}

# 验证文件监听服务状态
verify_file_watcher() {
    print_step "验证文件监听服务..."
    
    local response
    response=$(curl -s --max-time 5 "http://localhost:$BACKEND_PORT/api/file-watcher/status" 2>/dev/null || echo '{"error":"failed"}')
    
    if echo "$response" | grep -q '"isRunning"'; then
        print_success "文件监听服务正常"
        print_info "响应: $response"
        return 0
    else
        print_warning "文件监听服务可能未启动或异常"
        print_info "响应: $response"
        return 1
    fi
}

# 验证同步锁服务状态
verify_sync_lock() {
    print_step "验证同步锁服务..."
    
    local response
    response=$(curl -s --max-time 5 "http://localhost:$BACKEND_PORT/api/sync-lock/status" 2>/dev/null || echo '{"error":"failed"}')
    
    if echo "$response" | grep -q '"locked"'; then
        print_success "同步锁服务正常"
        print_info "响应: $response"
        return 0
    else
        print_warning "同步锁服务可能未启动或异常"
        print_info "响应: $response"
        return 1
    fi
}

# 验证前端服务
verify_frontend() {
    print_step "验证前端服务..."
    
    # 尝试读取实际端口
    local port=$FRONTEND_PORT
    if [ -f "$FRONTEND_PORT_FILE" ]; then
        port=$(cat "$FRONTEND_PORT_FILE")
    fi
    
    local response
    response=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "http://localhost:$port" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        print_success "前端服务正常 (端口: $port)"
        return 0
    else
        print_error "前端服务异常 (HTTP $response)"
        return 1
    fi
}

# 验证 WebSocket 连接
verify_websocket() {
    print_step "验证 WebSocket 端口..."
    
    local ws_port=3001
    
    if lsof -Pi :$ws_port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_success "WebSocket 端口 $ws_port 正常监听"
        return 0
    else
        print_warning "WebSocket 端口 $ws_port 未监听"
        return 1
    fi
}

# 显示服务状态摘要
show_summary() {
    local backend_ok=$1
    local frontend_ok=$2
    local ws_ok=$3
    
    echo ""
    echo -e "${BOLD}═════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}服务状态摘要${NC}"
    echo -e "${BOLD}═════════════════════════════════════════════════════════${NC}"
    echo ""
    
    if [ "$backend_ok" -eq 0 ]; then
        echo -e "  后端服务:     ${GREEN}✓ 正常${NC}"
    else
        echo -e "  后端服务:     ${RED}✗ 异常${NC}"
    fi
    
    if [ "$frontend_ok" -eq 0 ]; then
        echo -e "  前端服务:     ${GREEN}✓ 正常${NC}"
    else
        echo -e "  前端服务:     ${RED}✗ 异常${NC}"
    fi
    
    if [ "$ws_ok" -eq 0 ]; then
        echo -e "  WebSocket:    ${GREEN}✓ 正常${NC}"
    else
        echo -e "  WebSocket:    ${RED}✗ 异常${NC}"
    fi
    
    echo ""
    
    if [ "$backend_ok" -eq 0 ] && [ "$frontend_ok" -eq 0 ]; then
        echo -e "${GREEN}✓ 所有服务运行正常！${NC}"
        echo ""
        echo -e "  访问地址: ${CYAN}http://localhost:${FRONTEND_PORT}${NC}"
        echo -e "  后端 API: ${CYAN}http://localhost:${BACKEND_PORT}${NC}"
        echo ""
    else
        echo -e "${YELLOW}! 部分服务异常，请检查日志${NC}"
        echo ""
        echo "  查看日志:"
        echo "    后端: tail -f tmp/backend.log"
        echo "    前端: tail -f tmp/frontend.log"
        echo ""
        echo "  重启服务:"
        echo "    ./stop.sh && ./start.sh"
        echo ""
    fi
}

# 显示帮助信息
show_help() {
    echo "OpenClaw Visualization 服务验证脚本"
    echo ""
    echo "用法:"
    echo "  $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --help, -h       显示此帮助信息"
    echo "  --quick          快速检查（仅检查端口）"
    echo "  --full           完整检查（包含 API 端点）"
    echo ""
    echo "示例:"
    echo "  $0               标准检查"
    echo "  $0 --quick       快速检查"
    echo "  $0 --full        完整检查"
    exit 0
}

# 主函数
main() {
    local quick_mode=false
    local full_mode=false
    local backend_status=1
    local frontend_status=1
    local ws_status=1
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                ;;
            --quick)
                quick_mode=true
                shift
                ;;
            --full)
                full_mode=true
                shift
                ;;
            *)
                print_error "未知参数: $1"
                echo ""
                show_help
                exit 1
                ;;
        esac
    done
    
    print_header
    
    # 基础检查
    echo -e "${BOLD}[基础检查]${NC}"
    echo ""
    
    # 检查进程
    check_process "$BACKEND_PID_FILE" "后端服务"
    echo ""
    check_process "$FRONTEND_PID_FILE" "前端服务"
    echo ""
    
    # 检查端口
    check_port $BACKEND_PORT "后端 HTTP"
    backend_status=$?
    echo ""
    
    check_port 3001 "后端 WebSocket"
    ws_status=$?
    echo ""
    
    # 读取前端实际端口
    if [ -f "$FRONTEND_PORT_FILE" ]; then
        FRONTEND_PORT=$(cat "$FRONTEND_PORT_FILE")
    fi
    
    check_port $FRONTEND_PORT "前端"
    frontend_status=$?
    echo ""
    
    if [ "$quick_mode" = true ]; then
        show_summary $backend_status $frontend_status $ws_status
        exit $((backend_status + frontend_status))
    fi
    
    # API 检查
    echo -e "${BOLD}[API 端点检查]${NC}"
    echo ""
    
    # 后端健康检查
    verify_backend_health
    echo ""
    
    if [ "$full_mode" = true ]; then
        # 文件监听服务
        verify_file_watcher
        echo ""
        
        # 同步锁服务
        verify_sync_lock
        echo ""
    fi
    
    # 前端检查
    verify_frontend
    frontend_status=$?
    echo ""
    
    # WebSocket 检查
    verify_websocket
    ws_status=$?
    echo ""
    
    # 显示摘要
    show_summary $backend_status $frontend_status $ws_status
    
    # 返回状态码
    if [ $backend_status -eq 0 ] && [ $frontend_status -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# 运行主函数
main "$@"
