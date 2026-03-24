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

# 项目根目录（当前文件位于 scripts/cli）
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/src/backend"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"
BACKEND_BIN="$BACKEND_DIR/node_modules/.bin/ts-node"
FRONTEND_BIN="$FRONTEND_DIR/node_modules/.bin/vite"
BACKEND_HOST="127.0.0.1"
FRONTEND_HOST="127.0.0.1"
FRONTEND_DEFAULT_PORT=5173

# 非交互 shell 场景下，优先补齐 nvm 的 Node 22（openclaw 需要 >= 22.12）
NVM_NODE22_BIN=""
for candidate in "$HOME"/.nvm/versions/node/v22*/bin; do
    if [ -d "$candidate" ]; then
        NVM_NODE22_BIN="$candidate"
    fi
done
if [ -n "$NVM_NODE22_BIN" ]; then
    export PATH="$NVM_NODE22_BIN:$PATH"
fi

# 补充用户级可执行目录，避免 openclaw CLI 在非交互 shell 中找不到
export PATH="$HOME/.local/share/pnpm:$HOME/.local/bin:$PATH"

# 日志文件
BACKEND_LOG="$PROJECT_ROOT/tmp/backend.log"
FRONTEND_LOG="$PROJECT_ROOT/tmp/frontend.log"

# PID 文件
BACKEND_PID_FILE="$PROJECT_ROOT/tmp/backend.pid"
FRONTEND_PID_FILE="$PROJECT_ROOT/tmp/frontend.pid"
DISPATCHER_PID_FILE="$PROJECT_ROOT/tmp/pm-dispatcher.pid"

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

function ensure_service_binary() {
    local bin_path=$1
    local name=$2

    if [ ! -x "$bin_path" ]; then
        print_error "$name 启动文件不存在: $bin_path"
        print_error "请先安装依赖后再重试"
        exit 1
    fi
}

function ensure_python3() {
    if ! command -v python3 &> /dev/null; then
        print_error "未找到 python3，无法稳定启动后台进程"
        exit 1
    fi
}

function start_detached_process() {
    local workdir=$1
    local logfile=$2
    local pidfile=$3
    shift 3

    python3 - "$workdir" "$logfile" "$pidfile" "$@" <<'PY'
import subprocess
import sys

workdir, logfile, pidfile, *cmd = sys.argv[1:]

with open(logfile, "ab", buffering=0) as log_file:
    proc = subprocess.Popen(
        cmd,
        cwd=workdir,
        stdin=subprocess.DEVNULL,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )

with open(pidfile, "w", encoding="utf-8") as pid_output:
    pid_output.write(str(proc.pid))

print(proc.pid)
PY
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

    print_warning "$name 正在运行 (PID: $pid)，正在停止..."
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

# 按命令行模式匹配并停止所有 openclaw-visualization 后端进程
function stop_backend_processes() {
    local stopped_count=0
    local killed_count=0

    # 查找所有匹配的进程
    local pids=$(pgrep -f "$BACKEND_DIR/.*/ts-node.*src/index.ts|$BACKEND_BIN src/index.ts" || true)

    if [ -z "$pids" ]; then
        print_info "未发现运行中的后端进程"
        return 0
    fi

    print_warning "发现 ${#pids[@]} 个旧的后端进程，正在停止..."

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

# 停止所有前端进程
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

# 停止后端服务（优先使用 pidfile，兜底使用进程匹配）
function stop_backend() {
    local stopped=0

    # 优先使用 pidfile
    if [ -f "$BACKEND_PID_FILE" ]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            stop_process_by_pid $pid "后端服务"
            stopped=1
        else
            print_info "PID 文件中的进程不存在，清理 PID 文件"
            rm -f "$BACKEND_PID_FILE"
        fi
    fi

    # 兜底：按命令行模式匹配并停止所有后端进程
    if [ $stopped -eq 0 ]; then
        stop_backend_processes
    fi

    # 清理 PID 文件
    rm -f "$BACKEND_PID_FILE"
}

# 停止前端服务（优先使用 pidfile，兜底使用进程匹配）
function stop_frontend() {
    local stopped=0

    # 优先使用 pidfile
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            stop_process_by_pid $pid "前端服务"
            stopped=1
        else
            print_info "PID 文件中的进程不存在，清理 PID 文件"
            rm -f "$FRONTEND_PID_FILE"
        fi
    fi

    # 兜底：按命令行模式匹配并停止所有前端进程
    if [ $stopped -eq 0 ]; then
        stop_frontend_processes
    fi

    # 清理 PID 文件和端口文件
    rm -f "$FRONTEND_PID_FILE"
    rm -f "$FRONTEND_PORT_FILE"
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
    ensure_service_binary "$BACKEND_BIN" "后端"

    # 停止所有旧的后端实例（优先使用 pidfile，兜底使用进程匹配）
    stop_backend

    # 再次检查端口是否被占用（兜底）
    if get_port_process 3000 > /dev/null 2>&1; then
        print_warning "端口 3000 仍被占用，尝试停止占用进程..."
        stop_process_by_port 3000 "后端 HTTP 服务"
    fi

    if get_port_process 3001 > /dev/null 2>&1; then
        print_warning "端口 3001 仍被占用，尝试停止占用进程..."
        stop_process_by_port 3001 "后端 WebSocket 服务"
    fi

    # 等待端口释放
    sleep 2

    local backend_pid=$(start_detached_process "$BACKEND_DIR" "$BACKEND_LOG" "$BACKEND_PID_FILE" "$BACKEND_BIN" "src/index.ts")

    print_success "后端服务已启动 (PID: $backend_pid)"
    print_info "后端日志: $BACKEND_LOG"

    # 健康检查
    if ! ps -p $backend_pid > /dev/null 2>&1; then
        print_error "后端服务进程已退出"
        print_error "请查看日志: $BACKEND_LOG"
        rm -f "$BACKEND_PID_FILE"
        exit 1
    fi

    if ! health_check "http://$BACKEND_HOST:3000/health" "后端服务" "$BACKEND_LOG"; then
        print_error "后端服务启动失败"
        print_error "请查看日志: $BACKEND_LOG"
        # 清理 PID 文件
        rm -f "$BACKEND_PID_FILE"
        exit 1
    fi
}

# 启动前端服务
function start_frontend() {
    print_step "启动前端服务..."
    ensure_service_binary "$FRONTEND_BIN" "前端"

    # 停止所有旧的前端实例（优先使用 pidfile，兜底使用进程匹配）
    stop_frontend

    # 等待端口释放
    sleep 2

    local frontend_pid=$(start_detached_process "$FRONTEND_DIR" "$FRONTEND_LOG" "$FRONTEND_PID_FILE" "$FRONTEND_BIN" "--host" "$FRONTEND_HOST" "--port" "$FRONTEND_DEFAULT_PORT" "--strictPort")

    print_success "前端服务已启动 (PID: $frontend_pid)"
    print_info "前端日志: $FRONTEND_LOG"

    # 等待 Vite 启动并检测实际端口
    print_info "等待前端服务启动..."
    sleep 5

    # 从日志中提取实际使用的端口
    local detected_port=$(grep -oE "Local:.*http://(localhost|127\\.0\\.0\\.1):([0-9]+)" "$FRONTEND_LOG" | tail -1 | grep -oE "[0-9]+$" || echo "")

    if [ -n "$detected_port" ]; then
        actual_port=$detected_port
        echo $actual_port > "$FRONTEND_PORT_FILE"
        print_success "前端服务运行在端口 $actual_port"
    else
        actual_port=$FRONTEND_DEFAULT_PORT
        echo $actual_port > "$FRONTEND_PORT_FILE"
        print_warning "无法自动检测前端端口，使用默认端口 $FRONTEND_DEFAULT_PORT"
    fi

    # 健康检查
    if ! ps -p $frontend_pid > /dev/null 2>&1; then
        print_error "前端服务进程已退出"
        print_error "请查看日志: $FRONTEND_LOG"
        rm -f "$FRONTEND_PID_FILE"
        rm -f "$FRONTEND_PORT_FILE"
        exit 1
    fi

    if ! health_check "http://$FRONTEND_HOST:$actual_port" "前端服务" "$FRONTEND_LOG"; then
        print_error "前端服务启动失败"
        print_error "请查看日志: $FRONTEND_LOG"
        # 清理 PID 文件
        rm -f "$FRONTEND_PID_FILE"
        rm -f "$FRONTEND_PORT_FILE"
        exit 1
    fi
}

# 停止 dispatcher 服务
function stop_dispatcher() {
    if [ -f "$DISPATCHER_PID_FILE" ]; then
        local pid=$(cat "$DISPATCHER_PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            print_info "停止 PM-Agent Dispatcher (PID: $pid)..."
            kill $pid 2>/dev/null
            sleep 2

            # 如果进程还在运行，强制停止
            if ps -p $pid > /dev/null 2>&1; then
                kill -9 $pid 2>/dev/null
                sleep 1
            fi

            print_success "PM-Agent Dispatcher 已停止"
        fi
        rm -f "$DISPATCHER_PID_FILE"
    fi
}

# 启动 PM-Agent Dispatcher 服务
function start_dispatcher() {
    print_step "启动 PM-Agent Dispatcher..."

    # 停止旧实例
    stop_dispatcher

    # 确保日志目录存在
    mkdir -p "$PROJECT_ROOT/tmp/logs"

    # 获取轮询间隔（默认 10 秒）
    local interval=${DISPATCHER_INTERVAL:-10}

    local dispatcher_pid=$(start_detached_process "$PROJECT_ROOT" "$PROJECT_ROOT/tmp/logs/pm-dispatcher.out" "$DISPATCHER_PID_FILE" "node" "scripts/pm-agent-dispatcher.mjs" "--watch" "--interval" "$interval" "--pidfile" "$DISPATCHER_PID_FILE")

    # 等待一下确认进程启动
    sleep 2

    if ps -p $dispatcher_pid > /dev/null 2>&1; then
        print_success "PM-Agent Dispatcher 已启动 (PID: $dispatcher_pid, 轮询间隔: ${interval}s)"
        print_info "调度日志: $PROJECT_ROOT/tmp/logs/pm-dispatcher.log"
        print_info "标准输出: $PROJECT_ROOT/tmp/logs/pm-dispatcher.out"
    else
        print_warning "PM-Agent Dispatcher 启动可能失败，请检查日志"
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
    echo "   前端: http://$FRONTEND_HOST:$frontend_port"
    echo "   后端: http://$BACKEND_HOST:3000"
    echo "   WebSocket: ws://$BACKEND_HOST:3001"
    echo "   提示: 如果浏览器里 localhost 打不开，请优先使用 127.0.0.1"
    echo ""
    echo "📝 查看日志:"
    echo "   后端: tail -f $BACKEND_LOG"
    echo "   前端: tail -f $FRONTEND_LOG"
    echo "   PM-Agent Dispatcher: tail -f $PROJECT_ROOT/tmp/logs/pm-dispatcher.log"
    echo ""
    echo "🔍 查看进程:"
    echo "   后端: cat $BACKEND_PID_FILE"
    echo "   前端: cat $FRONTEND_PID_FILE"
    echo "   PM-Agent Dispatcher: cat $DISPATCHER_PID_FILE"
    echo ""
    echo "🛑 停止服务: ./clawboard stop"
    echo ""
    echo "⚙️  PM-Agent Dispatcher 配置:"
    echo "   轮询间隔: ${DISPATCHER_INTERVAL:-10} 秒 (可通过 DISPATCHER_INTERVAL 环境变量修改)"
    echo "   配置文件: config/pm-agent-dispatcher.json"
    echo "=========================================="
    echo ""
}

# 显示帮助信息
function show_help() {
    echo "OpenClaw Visualization 启动脚本"
    echo ""
    echo "用法:"
    echo "  $0"
    echo "  $0 --help"
    echo ""
    echo "说明:"
    echo "  默认以后台常驻方式启动后端、前端和 PM-Agent Dispatcher"
    echo "  如需进程托管，推荐使用 PM2: pm2 start ecosystem.config.cjs"
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

# 主函数
function main() {
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
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
    echo "OpenClaw Visualization 一键启动脚本"
    echo "=========================================="
    echo ""

    # 检查环境
    check_nodejs
    check_npm
    ensure_python3
    echo ""

    # 安装依赖
    install_dependencies
    echo ""

    # 启动服务
    start_backend
    echo ""
    start_frontend
    echo ""
    
    # 启动 PM-Agent Dispatcher（在后端健康后启动）
    start_dispatcher
    echo ""

    # 显示访问信息
    show_access_info
}

# 预处理命令行参数（提前处理 --help）
pre_parse_args "$@"

# 运行主函数
main "$@"
