#!/bin/bash

# OpenClaw Visualization 一键启动脚本 (macOS/Linux) - 优化版
# 解决端口冲突、健康检查、多实例运行等问题

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
BACKEND_DIR="$PROJECT_ROOT/src/backend"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"

# 日志文件
BACKEND_LOG="$PROJECT_ROOT/tmp/backend.log"
FRONTEND_LOG="$PROJECT_ROOT/tmp/frontend.log"

# PID 文件
BACKEND_PID_FILE="$PROJECT_ROOT/tmp/backend.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/tmp/frontend.pid"

# 端口文件（用于记录实际使用的端口）
FRONTEND_PORT_FILE="$PROJECT_ROOT/tmp/frontend.port"

# 健康检查配置
HEALTH_CHECK_MAX_RETRIES=10
HEALTH_CHECK_INTERVAL=2
HEALTH_CHECK_TIMEOUT=60

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

function print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
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
    print_step "检查并安装依赖..."

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

# 获取占用指定端口的进程信息
function get_port_process() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        lsof -Pi :$port -sTCP:LISTEN | grep LISTEN
        return 0
    fi
    return 1
}

# 停止指定进程
function stop_process_by_port() {
    local port=$1
    local name=$2

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -ti:$port)
        print_warning "$name 正在运行 (PID: $pid)，正在停止..."
        kill $pid 2>/dev/null
        sleep 2

        # 如果进程还在运行，强制停止
        if ps -p $pid > /dev/null 2>&1; then
            print_warning "强制停止 $name..."
            kill -9 $pid 2>/dev/null
            sleep 1
        fi

        print_success "$name 已停止"
        return 0
    fi
    return 1
}

# 检查端口是否被占用，并提供处理选项
function handle_port_conflict() {
    local port=$1
    local name=$2

    if get_port_process $port > /dev/null 2>&1; then
        print_warning "端口 $port 已被 $name 占用"
        echo ""
        echo "检测到以下进程："
        get_port_process $port
        echo ""
        echo "请选择操作："
        echo "  1) 停止旧实例并重新启动"
        echo "  2) 使用已有实例"
        echo "  3) 取消启动"
        echo -n "请输入选项 (1-3): "
        read choice

        case $choice in
            1)
                stop_process_by_port $port "$name"
                return 0
                ;;
            2)
                print_info "使用已有的 $name 实例"
                return 1
                ;;
            3)
                print_error "用户取消启动"
                exit 1
                ;;
            *)
                print_error "无效选项"
                exit 1
                ;;
        esac
    fi
    return 0
}

# 检查并停止已有实例
function check_existing_instance() {
    local pid_file=$1
    local name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            print_warning "$name 已在运行 (PID: $pid)"
            return 1
        else
            print_info "发现残留的 PID 文件，正在清理..."
            rm -f "$pid_file"
        fi
    fi
    return 0
}

# 健康检查 - 带重试机制
function health_check() {
    local url=$1
    local name=$2
    local retries=0

    print_info "等待 $name 启动..."

    while [ $retries -lt $HEALTH_CHECK_MAX_RETRIES ]; do
        if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
            print_success "$name 健康检查通过"
            return 0
        fi

        retries=$((retries + 1))
        if [ $retries -lt $HEALTH_CHECK_MAX_RETRIES ]; then
            print_info "$name 启动中... ($retries/$HEALTH_CHECK_MAX_RETRIES)"
            sleep $HEALTH_CHECK_INTERVAL
        fi
    done

    print_error "$name 启动失败或超时"
    print_error "请查看日志: $3"
    return 1
}

# 启动后端服务
function start_backend() {
    print_step "启动后端服务..."

    # 检查是否已有实例
    if ! check_existing_instance "$BACKEND_PID_FILE" "后端服务"; then
        print_warning "后端服务已在运行，跳过启动"
        return
    fi

    # 处理端口冲突
    if ! handle_port_conflict 3000 "后端 HTTP 服务"; then
        print_warning "使用已有的后端 HTTP 服务"
    fi

    if ! handle_port_conflict 3001 "后端 WebSocket 服务"; then
        print_warning "使用已有的后端 WebSocket 服务"
    fi

    cd "$BACKEND_DIR"
    nohup npm run dev > "$BACKEND_LOG" 2>&1 &
    local backend_pid=$!
    echo $backend_pid > "$BACKEND_PID_FILE"

    print_success "后端服务已启动 (PID: $backend_pid)"
    print_info "后端日志: $BACKEND_LOG"

    # 健康检查
    if ! health_check "http://localhost:3000/health" "后端服务" "$BACKEND_LOG"; then
        print_error "后端服务启动失败"
        # 清理 PID 文件
        rm -f "$BACKEND_PID_FILE"
        exit 1
    fi
}

# 启动前端服务
function start_frontend() {
    print_step "启动前端服务..."

    # 检查是否已有实例
    if ! check_existing_instance "$FRONTEND_PID_FILE" "前端服务"; then
        print_warning "前端服务已在运行，跳过启动"
        return
    fi

    # 处理端口冲突（Vite 会自动切换端口）
    local port=5173
    local actual_port=5173

    # 尝试检测 Vite 是否已运行并使用其他端口
    for try_port in 5173 5174 5175 5176 5177; do
        if get_port_process $try_port > /dev/null 2>&1; then
            local process_info=$(get_port_process $try_port)
            if echo "$process_info" | grep -q "vite\|node"; then
                print_warning "检测到 Vite 已在端口 $try_port 运行"
                actual_port=$try_port
                break
            fi
        fi
    done

    # 如果端口被占用，询问用户
    if [ "$actual_port" = "5173" ] && get_port_process 5173 > /dev/null 2>&1; then
        print_warning "端口 5173 已被占用"
        echo ""
        echo "检测到以下进程："
        get_port_process 5173
        echo ""
        echo "请选择操作："
        echo "  1) 停止旧实例并重新启动"
        echo "  2) 使用已有实例"
        echo "  3) 取消启动"
        echo -n "请输入选项 (1-3): "
        read choice

        case $choice in
            1)
                stop_process_by_port 5173 "前端服务"
                ;;
            2)
                print_info "使用已有的前端服务实例"
                # 检测实际端口
                for try_port in 5173 5174 5175 5176 5177; do
                    if get_port_process $try_port > /dev/null 2>&1; then
                        actual_port=$try_port
                        break
                    fi
                done
                echo $actual_port > "$FRONTEND_PORT_FILE"
                return
                ;;
            3)
                print_error "用户取消启动"
                exit 1
                ;;
            *)
                print_error "无效选项"
                exit 1
                ;;
        esac
    fi

    cd "$FRONTEND_DIR"
    nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > "$FRONTEND_PID_FILE"

    print_success "前端服务已启动 (PID: $frontend_pid)"
    print_info "前端日志: $FRONTEND_LOG"

    # 等待 Vite 启动并检测实际端口
    print_info "等待前端服务启动..."
    sleep 5

    # 从日志中提取实际使用的端口
    local detected_port=$(grep -oE "Local:.*http://localhost:([0-9]+)" "$FRONTEND_LOG" | tail -1 | grep -oE "[0-9]+$" || echo "")

    if [ -n "$detected_port" ]; then
        actual_port=$detected_port
        echo $actual_port > "$FRONTEND_PORT_FILE"
        print_success "前端服务运行在端口 $actual_port"
    else
        actual_port=5173
        echo $actual_port > "$FRONTEND_PORT_FILE"
        print_warning "无法自动检测前端端口，使用默认端口 5173"
    fi

    # 健康检查
    if ! health_check "http://localhost:$actual_port" "前端服务" "$FRONTEND_LOG"; then
        print_error "前端服务启动失败"
        # 清理 PID 文件
        rm -f "$FRONTEND_PID_FILE"
        rm -f "$FRONTEND_PORT_FILE"
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

    # 读取前端实际端口
    local frontend_port=5173
    if [ -f "$FRONTEND_PORT_FILE" ]; then
        frontend_port=$(cat "$FRONTEND_PORT_FILE")
    fi

    echo "📱 访问地址:"
    echo "   前端: http://localhost:$frontend_port"
    echo "   后端: http://localhost:3000"
    echo "   WebSocket: ws://localhost:3001"
    echo ""
    echo "📝 查看日志:"
    echo "   后端: tail -f $BACKEND_LOG"
    echo "   前端: tail -f $FRONTEND_LOG"
    echo ""
    echo "🔍 查看进程:"
    echo "   后端: cat $BACKEND_PID_FILE"
    echo "   前端: cat $FRONTEND_PID_FILE"
    echo ""
    echo "🛑 停止服务: ./stop.sh"
    echo "=========================================="
    echo ""
}

# 显示帮助信息
function show_help() {
    echo "OpenClaw Visualization 启动脚本"
    echo ""
    echo "用法:"
    echo "  $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --daemon, -d    以守护进程模式启动（后台运行，启动监控）"
    echo "  --help, -h      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0              普通模式启动"
    echo "  $0 --daemon     守护进程模式启动"
    exit 0
}

# 预处理命令行参数（在 main 之前）
function pre_parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                ;;
            *)
                shift
                ;;
        esac
    done
}

# 启动监控脚本（内嵌监控逻辑）
function start_watch() {
    print_info "启动监控进程..."

    # 创建临时目录
    mkdir -p "$PROJECT_ROOT/tmp"

    # 监控配置
    local watch_log="$PROJECT_ROOT/tmp/daemon.log"
    local watch_pid_file="$PROJECT_ROOT/tmp/watch.pid"
    local restart_history="$PROJECT_ROOT/tmp/restart-history.log"
    local check_interval=30

    # 在后台启动监控进程
    (
        while true; do
            # 检查后端服务
            if [ -f "$BACKEND_PID_FILE" ]; then
                local backend_pid=$(cat "$BACKEND_PID_FILE")
                if ! ps -p $backend_pid > /dev/null 2>&1 || ! curl -s --max-time 5 "http://localhost:3000/health" > /dev/null 2>&1; then
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 后端服务异常，尝试重启..." >> "$watch_log"
                    cd "$BACKEND_DIR"
                    nohup npm run dev > "$BACKEND_LOG" 2>&1 &
                    echo $! > "$BACKEND_PID_FILE"
                    sleep 5
                    if curl -s --max-time 5 "http://localhost:3000/health" > /dev/null 2>&1; then
                        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 后端服务重启成功" >> "$watch_log"
                        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 后端服务 - 自动重启" >> "$restart_history"
                    fi
                fi
            fi

            # 检查前端服务
            if [ -f "$FRONTEND_PID_FILE" ]; then
                local frontend_pid=$(cat "$FRONTEND_PID_FILE")
                local frontend_port=5173
                [ -f "$FRONTEND_PORT_FILE" ] && frontend_port=$(cat "$FRONTEND_PORT_FILE")

                if ! ps -p $frontend_pid > /dev/null 2>&1 || ! curl -s --max-time 5 "http://localhost:$frontend_port" > /dev/null 2>&1; then
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 前端服务异常，尝试重启..." >> "$watch_log"
                    cd "$FRONTEND_DIR"
                    nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
                    echo $! > "$FRONTEND_PID_FILE"
                    sleep 5
                    # 检测实际端口
                    local detected_port=$(grep -oE "Local:.*http://localhost:([0-9]+)" "$FRONTEND_LOG" | tail -1 | grep -oE "[0-9]+$" || echo "5173")
                    echo $detected_port > "$FRONTEND_PORT_FILE"
                    if curl -s --max-time 5 "http://localhost:$detected_port" > /dev/null 2>&1; then
                        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 前端服务重启成功 (端口: $detected_port)" >> "$watch_log"
                        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 前端服务 - 自动重启" >> "$restart_history"
                    fi
                fi
            fi

            sleep $check_interval
        done
    ) > "$watch_log" 2>&1 &

    local watch_pid=$!
    echo $watch_pid > "$watch_pid_file"

    # 等待一下让进程启动
    sleep 2

    # 检查监控进程是否成功启动
    if ps -p $watch_pid > /dev/null 2>&1; then
        print_success "监控进程已启动 (PID: $watch_pid)"
        return 0
    fi

    print_warning "监控进程启动失败"
    return 1
}

# 主函数
function main() {
    local daemon_mode=false

    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --daemon|-d)
                daemon_mode=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                print_error "未知参数: $1"
                echo ""
                show_help
                exit 1
                ;;
        esac
    done

    echo ""
    echo "=========================================="
    if [ "$daemon_mode" = true ]; then
        echo "OpenClaw Visualization 守护进程启动"
    else
        echo "OpenClaw Visualization 一键启动脚本 (优化版)"
    fi
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
    echo ""
    start_frontend
    echo ""

    # 如果是守护模式，启动监控脚本
    if [ "$daemon_mode" = true ]; then
        start_watch
        echo ""

        echo "=========================================="
        echo -e "${GREEN}✅ 守护进程已启动${NC}"
        echo "=========================================="
        echo ""
        echo "📝 监控日志: tail -f $PROJECT_ROOT/tmp/daemon.log"
        echo "📝 重启历史: tail -f $PROJECT_ROOT/tmp/restart-history.log"
        echo ""
        echo "🛑 停止守护进程: ./stop.sh"
        echo "=========================================="
        echo ""
    else
        # 显示访问信息
        show_access_info
    fi
}

# 预处理命令行参数（提前处理 --help）
pre_parse_args "$@"

# 运行主函数
main "$@"