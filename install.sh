#!/bin/bash

# OpenClaw Visualization 一键安装脚本
# 新用户在干净机器上快速启动可视化看板后端/前端

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
BACKEND_DIR="$PROJECT_ROOT/src/backend"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"
CONFIG_DIR="$BACKEND_DIR/config"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"
CONFIG_EXAMPLE="$CONFIG_DIR/openclaw.json.example"

# 最低版本要求
MIN_NODE_VERSION=18
MIN_NPM_VERSION=8

# 打印函数
print_header() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}OpenClaw Visualization 安装向导${NC}                         ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
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

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Linux"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        echo "Windows"
    else
        echo "Unknown"
    fi
}

# 检查 Node.js 版本
check_nodejs() {
    print_step "检查 Node.js 环境..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        echo ""
        print_info "请先安装 Node.js ${MIN_NODE_VERSION} 或更高版本："
        echo ""
        echo "  macOS (使用 Homebrew):"
        echo "    brew install node"
        echo ""
        echo "  Linux (Ubuntu/Debian):"
        echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "    sudo apt-get install -y nodejs"
        echo ""
        echo "  或访问: https://nodejs.org/"
        echo ""
        exit 1
    fi
    
    local node_version=$(node --version | sed 's/v//')
    local major_version=$(echo $node_version | cut -d. -f1)
    
    print_info "Node.js 版本: v$node_version"
    
    if [ "$major_version" -lt "$MIN_NODE_VERSION" ]; then
        print_error "Node.js 版本过低 (需要 >= ${MIN_NODE_VERSION})"
        print_info "当前版本: v$node_version"
        echo ""
        print_info "请升级 Node.js："
        echo "  nvm install 20"
        echo "  或访问: https://nodejs.org/"
        exit 1
    fi
    
    print_success "Node.js 版本满足要求 (>= ${MIN_NODE_VERSION})"
}

# 检查 npm 版本
check_npm() {
    print_step "检查 npm 环境..."
    
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        echo ""
        print_info "npm 通常随 Node.js 一起安装，请重新安装 Node.js"
        exit 1
    fi
    
    local npm_version=$(npm --version)
    local major_version=$(echo $npm_version | cut -d. -f1)
    
    print_info "npm 版本: $npm_version"
    
    if [ "$major_version" -lt "$MIN_NPM_VERSION" ]; then
        print_warning "npm 版本较低 (建议 >= ${MIN_NPM_VERSION})"
        print_info "可以运行 'npm install -g npm@latest' 升级"
    else
        print_success "npm 版本满足要求 (>= ${MIN_NPM_VERSION})"
    fi
}

# 创建 tmp 目录
create_tmp_dir() {
    print_step "创建临时目录..."
    
    if [ -d "$PROJECT_ROOT/tmp" ]; then
        print_info "tmp 目录已存在"
    else
        mkdir -p "$PROJECT_ROOT/tmp"
        print_success "已创建 tmp 目录"
    fi
    
    # 创建日志目录
    mkdir -p "$PROJECT_ROOT/tmp/logs" 2>/dev/null || true
    
    # 创建 .gitkeep 防止空目录被 git 忽略
    touch "$PROJECT_ROOT/tmp/.gitkeep" 2>/dev/null || true
}

# 检查并提示配置文件
check_config() {
    print_step "检查配置文件..."
    
    if [ -f "$CONFIG_FILE" ]; then
        print_success "配置文件已存在: src/backend/config/openclaw.json"
        
        # 检查是否使用了示例 token
        if grep -q "your-gateway-token-here" "$CONFIG_FILE" 2>/dev/null; then
            print_warning "配置文件中包含占位符，请确保已填写真实的 Gateway Token"
        fi
    else
        print_warning "配置文件不存在"
        
        if [ -f "$CONFIG_EXAMPLE" ]; then
            print_info "正在从示例配置创建配置文件..."
            cp "$CONFIG_EXAMPLE" "$CONFIG_FILE"
            print_success "已创建配置文件: src/backend/config/openclaw.json"
            echo ""
            print_warning "请编辑配置文件，填入你的 Gateway Token："
            echo ""
            echo -e "  ${CYAN}vim src/backend/config/openclaw.json${NC}"
            echo ""
            print_info "获取 Gateway Token："
            echo "  1. 确保 OpenClaw Gateway 已启动: openclaw gateway start"
            echo "  2. 查看 Token: openclaw gateway status"
            echo ""
        else
            print_warning "示例配置文件不存在，请手动创建配置文件"
        fi
    fi
}

# 安装后端依赖
install_backend_deps() {
    print_step "安装后端依赖..."
    
    cd "$BACKEND_DIR"
    
    if [ -d "node_modules" ]; then
        print_info "检测到已有依赖，检查是否需要更新..."
        
        # 检查 package-lock.json 是否比 node_modules 新
        if [ "package-lock.json" -nt "node_modules" ] 2>/dev/null; then
            print_info "package-lock.json 已更新，重新安装依赖..."
            npm install --silent
        else
            print_success "后端依赖已安装且为最新"
        fi
    else
        print_info "正在安装后端依赖..."
        npm install --silent
        print_success "后端依赖安装完成"
    fi
}

# 安装前端依赖
install_frontend_deps() {
    print_step "安装前端依赖..."
    
    cd "$FRONTEND_DIR"
    
    if [ -d "node_modules" ]; then
        print_info "检测到已有依赖，检查是否需要更新..."
        
        if [ "package-lock.json" -nt "node_modules" ] 2>/dev/null; then
            print_info "package-lock.json 已更新，重新安装依赖..."
            npm install --silent
        else
            print_success "前端依赖已安装且为最新"
        fi
    else
        print_info "正在安装前端依赖..."
        npm install --silent
        print_success "前端依赖安装完成"
    fi
}

# 显示下一步指引
show_next_steps() {
    local os=$(detect_os)
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}安装完成！${NC}                                              ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}下一步操作：${NC}"
    echo ""
    echo -e "  1. ${CYAN}配置 Gateway Token${NC}（如果还没有配置）"
    echo "     vim src/backend/config/openclaw.json"
    echo ""
    echo -e "  2. ${CYAN}启动服务${NC}"
    if [[ "$os" == "Windows" ]]; then
        echo "     start.bat"
    else
        echo "     ./start.sh"
    fi
    echo ""
    echo -e "  3. ${CYAN}访问应用${NC}"
    echo "     http://127.0.0.1:5173"
    echo ""
    echo -e "  4. ${CYAN}验证服务状态${NC}"
    if [[ "$os" == "Windows" ]]; then
        echo "     verify.bat    (Windows)"
    else
        echo "     ./verify.sh   (macOS/Linux)"
    fi
    echo ""
    echo -e "${BOLD}常用命令：${NC}"
    echo ""
    if [[ "$os" == "Windows" ]]; then
        echo "  start.bat          启动服务"
        echo "  stop.bat           停止服务"
        echo "  verify.bat         验证服务状态"
    else
        echo "  ./start.sh         启动服务"
        echo "  ./stop.sh          停止服务"
        echo "  ./verify.sh        验证服务状态"
        echo "  pm2 start ecosystem.config.cjs   使用 PM2 托管"
    fi
    echo ""
    echo -e "${BOLD}获取帮助：${NC}"
    echo ""
    echo "  查看 README.md 或 docs/INSTALL.md 了解更多"
    echo "  GitHub: https://github.com/CCCaptain0129/OpenClaw_Visualization"
    echo ""
}

# 显示帮助信息
show_help() {
    echo "OpenClaw Visualization 安装脚本"
    echo ""
    echo "用法:"
    echo "  $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --help, -h       显示此帮助信息"
    echo "  --skip-deps      跳过依赖安装（仅检查环境）"
    echo "  --check-only     仅检查环境，不执行安装"
    echo ""
    echo "示例:"
    echo "  $0               执行完整安装"
    echo "  $0 --check-only  仅检查环境"
    exit 0
}

# 主函数
main() {
    local skip_deps=false
    local check_only=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                ;;
            --skip-deps)
                skip_deps=true
                shift
                ;;
            --check-only)
                check_only=true
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
    
    # 检查环境
    check_nodejs
    check_npm
    echo ""
    
    if [ "$check_only" = true ]; then
        print_success "环境检查通过！"
        exit 0
    fi
    
    # 创建目录
    create_tmp_dir
    echo ""
    
    # 检查配置
    check_config
    echo ""
    
    # 安装依赖
    if [ "$skip_deps" = false ]; then
        install_backend_deps
        echo ""
        install_frontend_deps
        echo ""
    else
        print_info "跳过依赖安装"
        echo ""
    fi
    
    # 显示下一步
    show_next_steps
}

# 运行主函数
main "$@"
