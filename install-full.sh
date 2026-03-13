#!/bin/bash

# ============================================================================
# PM-Workflow-Automation 完整安装脚本
# 版本: 1.0.0
# 
# 功能:
#   - 环境检查 (Node.js, npm, OpenClaw CLI)
#   - 配置向导 (Feishu, Gateway Token)
#   - 安装 Skills (从 skills-lock.json)
#   - 生成目录结构 (templates, workspace)
#   - 绑定群组
#   - 验证安装
#
# 用法:
#   ./install-full.sh              # 完整安装
#   ./install-full.sh --help       # 显示帮助
#   ./install-full.sh --reconfigure # 重新配置
# ============================================================================

set -e

# ===== 版本信息 =====
VERSION="1.0.0"
SCRIPT_NAME="PM-Workflow-Automation 安装向导"

# ===== 颜色定义 =====
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ===== 全局变量 =====
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/src/backend"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"
CONFIG_DIR="$BACKEND_DIR/config"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"
CONFIG_EXAMPLE="$CONFIG_DIR/openclaw.json.example"

# 最低版本要求
MIN_NODE_VERSION=18
MIN_NPM_VERSION=8

# 配置变量 (运行时填充)
GATEWAY_TOKEN=""
GATEWAY_URL="ws://127.0.0.1:18789"
FEISHU_APP_ID=""
FEISHU_APP_SECRET=""
GROUP_ID=""
BACKEND_PORT=3000
FRONTEND_PORT=5173
HEARTBEAT_INTERVAL="5m"
USER_NAME="${USER:-User}"
USER_TIMEZONE="Asia/Shanghai"

# ===== 打印函数 =====
print_header() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BOLD}$SCRIPT_NAME v$VERSION${NC}                                    ${CYAN}║${NC}"
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

print_substep() {
    echo -e "  ${BLUE}→${NC} $1"
}

# ===== 帮助信息 =====
show_help() {
    echo "$SCRIPT_NAME v$VERSION"
    echo ""
    echo "用法:"
    echo "  $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --help, -h          显示此帮助信息"
    echo "  --skip-deps         跳过依赖安装"
    echo "  --skip-skills       跳过 Skills 安装"
    echo "  --skip-bind         跳过群组绑定"
    echo "  --reconfigure       重新配置（备份现有配置）"
    echo "  --check-only        仅检查环境"
    echo "  --non-interactive   非交互模式（使用默认值）"
    echo ""
    echo "示例:"
    echo "  $0                  完整安装"
    echo "  $0 --check-only     仅检查环境"
    echo "  $0 --reconfigure    重新配置"
    exit 0
}

# ===== 检测操作系统 =====
detect_os() {
    case "$OSTYPE" in
        darwin*)  echo "macOS" ;;
        linux*)   echo "Linux" ;;
        msys*|cygwin*) echo "Windows" ;;
        *)        echo "Unknown" ;;
    esac
}

# ===== Phase 1: Preflight 检查 =====
preflight_check() {
    print_step "Phase 1: 环境检查"
    echo ""
    
    # 1. 操作系统
    local os=$(detect_os)
    print_info "操作系统: $os"
    
    # 2. Node.js
    print_substep "检查 Node.js..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        echo ""
        print_info "请安装 Node.js ${MIN_NODE_VERSION}+:"
        echo "  macOS: brew install node"
        echo "  Linux: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
        echo "  或访问: https://nodejs.org/"
        exit 1
    fi
    
    local node_version=$(node --version | sed 's/v//')
    local major_version=$(echo $node_version | cut -d. -f1)
    print_info "Node.js 版本: v$node_version"
    
    if [ "$major_version" -lt "$MIN_NODE_VERSION" ]; then
        print_error "Node.js 版本过低 (需要 >= ${MIN_NODE_VERSION})"
        exit 1
    fi
    print_success "Node.js 版本满足要求"
    
    # 3. npm
    print_substep "检查 npm..."
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        exit 1
    fi
    
    local npm_version=$(npm --version)
    print_info "npm 版本: $npm_version"
    print_success "npm 可用"
    
    # 4. OpenClaw CLI
    print_substep "检查 OpenClaw CLI..."
    if ! command -v openclaw &> /dev/null; then
        print_warning "OpenClaw CLI 未安装"
        print_info "安装命令: npm install -g openclaw"
        print_info "安装后运行: openclaw init"
        
        read -p "是否继续安装（跳过 OpenClaw 功能）？[y/N]: " continue_without_openclaw
        if [[ ! "$continue_without_openclaw" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        local openclaw_version=$(openclaw --version 2>/dev/null || echo "unknown")
        print_info "OpenClaw CLI 版本: $openclaw_version"
        print_success "OpenClaw CLI 已安装"
    fi
    
    # 5. Gateway 状态
    print_substep "检查 OpenClaw Gateway..."
    if command -v openclaw &> /dev/null; then
        if openclaw gateway status 2>/dev/null | grep -q "running"; then
            print_success "Gateway 运行中"
            
            # 获取 Gateway Token
            GATEWAY_TOKEN=$(openclaw gateway status 2>/dev/null | grep -i "token" | awk '{print $NF}' || echo "")
            if [ -n "$GATEWAY_TOKEN" ]; then
                print_info "Gateway Token 已获取"
            fi
        else
            print_warning "Gateway 未运行"
            print_info "启动命令: openclaw gateway start"
        fi
    fi
    
    # 6. 端口检查
    print_substep "检查端口占用..."
    local ports="$BACKEND_PORT 3001 $FRONTEND_PORT 18789"
    local port_conflict=false
    
    for port in $ports; do
        if lsof -i :$port &>/dev/null; then
            print_warning "端口 $port 已被占用"
            port_conflict=true
        fi
    done
    
    if [ "$port_conflict" = true ]; then
        print_info "可以稍后运行 ./stop.sh 停止占用进程"
    else
        print_success "所有端口可用"
    fi
    
    echo ""
    print_success "环境检查完成"
}

# ===== Phase 2: 配置向导 =====
config_wizard() {
    print_step "Phase 2: 配置向导"
    echo ""
    
    # 检查是否有现有配置
    if [ -f "$CONFIG_FILE" ] && [ "$RECONFIGURE" != true ]; then
        print_info "检测到现有配置文件"
        read -p "是否使用现有配置？[Y/n]: " use_existing
        if [[ ! "$use_existing" =~ ^[Nn]$ ]]; then
            print_success "使用现有配置"
            
            # 从现有配置读取
            if command -v jq &>/dev/null; then
                local existing_app_id=$(jq -r '.feishu.appId // empty' "$CONFIG_FILE" 2>/dev/null)
                if [ -n "$existing_app_id" ] && [ "$existing_app_id" != "null" ]; then
                    FEISHU_APP_ID="$existing_app_id"
                fi
            fi
            
            return 0
        fi
    fi
    
    # 备份现有配置
    if [ -f "$CONFIG_FILE" ]; then
        local backup_file="${CONFIG_FILE}.bak.$(date +%Y%m%d%H%M%S)"
        cp "$CONFIG_FILE" "$backup_file"
        print_info "已备份配置到: $backup_file"
    fi
    
    echo ""
    echo -e "${BOLD}请填写以下配置信息：${NC}"
    echo ""
    
    # 1. Gateway Token
    if [ -z "$GATEWAY_TOKEN" ]; then
        echo -e "${CYAN}[1/4] Gateway Token${NC}"
        print_info "获取方式: openclaw gateway status"
        read -p "  请输入 Gateway Token: " GATEWAY_TOKEN
    else
        echo -e "${CYAN}[1/4] Gateway Token${NC}"
        print_success "已自动获取: ${GATEWAY_TOKEN:0:10}..."
    fi
    
    # 2. Feishu App ID (必需)
    echo ""
    echo -e "${CYAN}[2/4] 飞书应用配置${NC}"
    print_info "获取方式: 飞书开放平台 -> 我的应用 -> 凭证与基础信息"
    read -p "  App ID (cli_xxx): " FEISHU_APP_ID
    
    while [ -z "$FEISHU_APP_ID" ]; do
        print_warning "App ID 为必填项"
        read -p "  App ID: " FEISHU_APP_ID
    done
    
    # 3. Feishu App Secret (必需)
    echo ""
    read -s -p "  App Secret: " FEISHU_APP_SECRET
    echo ""
    
    while [ -z "$FEISHU_APP_SECRET" ]; do
        print_warning "App Secret 为必填项"
        read -s -p "  App Secret: " FEISHU_APP_SECRET
        echo ""
    done
    
    # 4. 绑定群组 (可选)
    echo ""
    echo -e "${CYAN}[3/4] 群组绑定 (可选)${NC}"
    print_info "格式: oc_xxx 或群组 URL 中的 ID"
    read -p "  群组 ID (留空跳过): " GROUP_ID
    
    # 5. 其他配置 (有默认值)
    echo ""
    echo -e "${CYAN}[4/4] 其他配置 (回车使用默认值)${NC}"
    read -p "  后端端口 [$BACKEND_PORT]: " input_backend_port
    BACKEND_PORT=${input_backend_port:-$BACKEND_PORT}
    
    read -p "  前端端口 [$FRONTEND_PORT]: " input_frontend_port
    FRONTEND_PORT=${input_frontend_port:-$FRONTEND_PORT}
    
    read -p "  心跳间隔 [$HEARTBEAT_INTERVAL]: " input_heartbeat
    HEARTBEAT_INTERVAL=${input_heartbeat:-$HEARTBEAT_INTERVAL}
    
    echo ""
    print_success "配置收集完成"
}

# ===== Phase 3: 保存配置 =====
save_config() {
    print_step "Phase 3: 保存配置"
    
    # 创建配置目录
    mkdir -p "$CONFIG_DIR"
    
    # 生成配置文件
    cat > "$CONFIG_FILE" << EOF
{
  "\$schema": "./openclaw.schema.json",
  "gateway": {
    "url": "$GATEWAY_URL",
    "token": "$GATEWAY_TOKEN"
  },
  "feishu": {
    "appId": "$FEISHU_APP_ID",
    "appSecret": "$FEISHU_APP_SECRET"
  },
  "server": {
    "port": $BACKEND_PORT,
    "wsPort": 3001
  }
}
EOF
    
    # 设置权限
    chmod 600 "$CONFIG_FILE"
    
    print_success "配置文件已保存: src/backend/config/openclaw.json"
    print_info "权限已设置为 600 (仅所有者可读写)"
}

# ===== Phase 4: 安装依赖 =====
install_dependencies() {
    print_step "Phase 4: 安装依赖"
    
    # 后端
    print_substep "安装后端依赖..."
    cd "$BACKEND_DIR"
    
    if [ -d "node_modules" ]; then
        print_info "检测到已有依赖，检查更新..."
        npm install --silent 2>/dev/null || npm install
    else
        npm install --silent 2>/dev/null || npm install
    fi
    print_success "后端依赖安装完成"
    
    # 前端
    print_substep "安装前端依赖..."
    cd "$FRONTEND_DIR"
    
    if [ -d "node_modules" ]; then
        print_info "检测到已有依赖，检查更新..."
        npm install --silent 2>/dev/null || npm install
    else
        npm install --silent 2>/dev/null || npm install
    fi
    print_success "前端依赖安装完成"
    
    cd "$PROJECT_ROOT"
}

# ===== Phase 5: 安装 Skills =====
install_skills() {
    print_step "Phase 5: 安装 Skills"
    
    local skills_file="$PROJECT_ROOT/skills-lock.json"
    
    if [ ! -f "$skills_file" ]; then
        print_warning "skills-lock.json 不存在，跳过"
        return 0
    fi
    
    # 检查 clawhub
    if ! command -v clawhub &>/dev/null; then
        print_warning "ClawHub 未安装，跳过 Skills 安装"
        print_info "安装 ClawHub: npm install -g clawhub"
        print_info "手动安装: clawhub install <skill-name>"
        return 0
    fi
    
    # 读取并安装 skills
    if command -v jq &>/dev/null; then
        local skills=$(jq -r '.skills[].slug' "$skills_file" 2>/dev/null)
        
        if [ -z "$skills" ]; then
            print_warning "未找到 Skills 定义"
            return 0
        fi
        
        for skill in $skills; do
            print_substep "安装 $skill..."
            clawhub install "$skill" --no-input 2>/dev/null || {
                print_warning "安装 $skill 失败，尝试 openclaw 方式..."
                openclaw skill install "$skill" 2>/dev/null || print_warning "安装失败: $skill"
            }
        done
        
        print_success "Skills 安装完成"
    else
        print_warning "jq 未安装，无法解析 skills-lock.json"
        print_info "手动安装: clawhub install github summarize weather"
    fi
}

# ===== Phase 6: 生成目录结构 =====
generate_structure() {
    print_step "Phase 6: 生成目录结构"
    
    # 1. 创建临时目录
    print_substep "创建临时目录..."
    mkdir -p "$PROJECT_ROOT/tmp/logs"
    touch "$PROJECT_ROOT/tmp/.gitkeep"
    print_success "tmp/ 目录已创建"
    
    # 2. 确保任务目录存在
    print_substep "检查任务目录..."
    if [ ! -d "$PROJECT_ROOT/tasks" ]; then
        mkdir -p "$PROJECT_ROOT/tasks"
        print_success "tasks/ 目录已创建"
    else
        print_info "tasks/ 目录已存在"
    fi
    
    # 3. 确保 projects.json 存在
    local projects_file="$PROJECT_ROOT/tasks/projects.json"
    if [ ! -f "$projects_file" ]; then
        cat > "$projects_file" << 'EOF'
{
  "projects": [
    {
      "id": "pm-workflow-automation",
      "name": "PM Workflow Automation",
      "description": "项目管理自动化系统",
      "status": "active"
    },
    {
      "id": "openclaw-visualization",
      "name": "OpenClaw Visualization",
      "description": "任务可视化看板",
      "status": "active"
    }
  ]
}
EOF
        print_success "projects.json 已创建"
    fi
    
    # 4. 创建 project-manager workspace
    print_substep "创建 Project-Manager Agent workspace..."
    local pm_workspace="$HOME/.openclaw/project-manager-workspace"
    local pm_agent="$HOME/.openclaw/agents/project-manager"
    
    mkdir -p "$pm_workspace"
    mkdir -p "$pm_agent"/{agent,sessions,memory,.openclaw}
    
    # 5. 复制模板文件
    print_substep "复制模板文件..."
    local templates_dir="$PROJECT_ROOT/templates"
    
    if [ -d "$templates_dir" ]; then
        # AGENTS.md
        if [ -f "$templates_dir/AGENTS.md" ]; then
            sed "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" "$templates_dir/AGENTS.md" > "$pm_agent/AGENTS.md"
            print_info "AGENTS.md 已生成"
        fi
        
        # SOUL.md
        if [ -f "$templates_dir/SOUL.md" ]; then
            cp "$templates_dir/SOUL.md" "$pm_agent/"
        fi
        
        # TOOLS.md
        if [ -f "$templates_dir/TOOLS.md" ]; then
            sed "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" "$templates_dir/TOOLS.md" > "$pm_agent/TOOLS.md"
        fi
        
        # IDENTITY.md
        if [ -f "$templates_dir/IDENTITY.md" ]; then
            cp "$templates_dir/IDENTITY.md" "$pm_agent/"
        fi
        
        # USER.md
        if [ -f "$templates_dir/USER.md" ]; then
            sed -e "s|__USER_NAME__|$USER_NAME|g" \
                -e "s|__USER_TIMEZONE__|$USER_TIMEZONE|g" \
                "$templates_dir/USER.md" > "$pm_agent/USER.md"
        fi
        
        # HEARTBEAT.md
        if [ -f "$templates_dir/HEARTBEAT.md" ]; then
            sed "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" "$templates_dir/HEARTBEAT.md" > "$pm_agent/HEARTBEAT.md"
        fi
    fi
    
    # 设置权限
    chmod 700 "$HOME/.openclaw/agents"
    chmod 700 "$pm_agent"
    
    print_success "Project-Manager workspace 已创建"
    print_info "位置: $pm_agent"
    
    # 6. 创建 PM-Agent 调度器配置
    print_substep "创建 PM-Agent 调度器配置..."
    local config_dir="$PROJECT_ROOT/config"
    mkdir -p "$config_dir"
    
    # PM-Agent 调度器配置文件
    local pm_config="$config_dir/pm-agent-dispatcher.json"
    if [ ! -f "$pm_config" ]; then
        cat > "$pm_config" << EOF
{
  "\$schema": "./pm-agent-dispatcher.schema.json",
  "projectAllowlist": [],
  "pollIntervalMs": 30000,
  "maxConcurrent": 3,
  "backendUrl": "http://localhost:${BACKEND_PORT}",
  "tasksDir": "./tasks",
  "logsDir": "./tmp/logs",
  "promptLogFile": "./tmp/logs/pm-prompts.log",
  "dispatchRecordFile": "./docs/internal/SUBAGENTS任务分发记录.md",
  "globalConstraints": {
    "codeStyle": "TypeScript/Node.js，遵循项目现有代码风格",
    "commitStyle": "使用 conventional commits 格式：feat/fix/docs/style/refactor/test/chore",
    "testRequired": false,
    "docRequired": true,
    "timeoutMinutes": 30,
    "defaultModel": "bailian/glm-4.7"
  }
}
EOF
        print_success "pm-agent-dispatcher.json 已创建"
    else
        print_info "pm-agent-dispatcher.json 已存在"
    fi
    
    # 7. 创建 docs/internal 目录
    print_substep "创建文档目录..."
    mkdir -p "$PROJECT_ROOT/docs/internal"
    touch "$PROJECT_ROOT/docs/internal/.gitkeep"
    
    # 创建 SUBAGENTS任务分发记录.md（如果不存在）
    local dispatch_record="$PROJECT_ROOT/docs/internal/SUBAGENTS任务分发记录.md"
    if [ ! -f "$dispatch_record" ]; then
        cat > "$dispatch_record" << 'EOF'
# SUBAGENTS 任务分发记录

此文件记录任务分发给 subagent 的历史。

EOF
        print_success "SUBAGENTS任务分发记录.md 已创建"
    fi
}

# ===== Phase 7: 配置 Agent 绑定 =====
configure_agent_binding() {
    print_step "Phase 7: 配置 Agent 绑定"
    
    local openclaw_config="$HOME/.openclaw/openclaw.json"
    
    if [ ! -f "$openclaw_config" ]; then
        print_warning "openclaw.json 不存在"
        print_info "请先运行: openclaw init"
        return 0
    fi
    
    # 检查是否已配置 project-manager agent
    if command -v jq &>/dev/null; then
        local has_pm=$(jq -r '.agents.list[]?.id' "$openclaw_config" 2>/dev/null | grep -c "project-manager" || echo "0")
        
        if [ "$has_pm" -gt 0 ]; then
            print_info "project-manager agent 已配置"
        else
            print_substep "添加 project-manager agent 配置..."
            
            # 备份
            cp "$openclaw_config" "${openclaw_config}.bak.$(date +%Y%m%d%H%M%S)"
            
            # 创建 agent 配置片段
            local agent_config=$(cat << EOF
{
  "id": "project-manager",
  "name": "project-manager",
  "workspace": "~/.openclaw/project-manager-workspace",
  "agentDir": "~/.openclaw/agents/project-manager/agent",
  "heartbeat": {
    "every": "$HEARTBEAT_INTERVAL"
  },
  "groupChat": {
    "mentionPatterns": ["@PM", "@pm", "@project-manager"]
  }
}
EOF
)
            
            # 使用 jq 添加 agent
            jq --argjson agent "$agent_config" '
                .agents.list += [$agent]
            ' "$openclaw_config" > "${openclaw_config}.tmp"
            mv "${openclaw_config}.tmp" "$openclaw_config"
            
            print_success "project-manager agent 已添加到配置"
        fi
        
        # 添加绑定
        if [ -n "$GROUP_ID" ]; then
            print_substep "添加群组绑定: $GROUP_ID"
            
            local binding=$(cat << EOF
{
  "agentId": "project-manager",
  "match": {
    "channel": "feishu",
    "accountId": "chat",
    "group": "$GROUP_ID"
  }
}
EOF
)
            
            jq --argjson binding "$binding" '
                .bindings += [$binding]
            ' "$openclaw_config" > "${openclaw_config}.tmp"
            mv "${openclaw_config}.tmp" "$openclaw_config"
            
            print_success "群组绑定已添加"
        else
            print_info "未配置群组 ID，跳过绑定"
        fi
    else
        print_warning "jq 未安装，无法自动配置"
        print_info "请手动编辑 ~/.openclaw/openclaw.json"
    fi
    
    # 设置权限
    chmod 600 "$openclaw_config"
}

# ===== Phase 8: 绑定验证 =====
bind_and_verify() {
    print_step "Phase 8: 绑定验证"
    
    if [ -z "$GROUP_ID" ]; then
        print_info "未配置群组 ID，跳过绑定"
        print_info "稍后可运行以下命令绑定群组:"
        echo ""
        echo -e "  ${CYAN}openclaw bind feishu --group $GROUP_ID --agent project-manager${NC}"
        echo ""
        return 0
    fi
    
    if command -v openclaw &>/dev/null; then
        print_substep "执行群组绑定..."
        print_info "群组 ID: $GROUP_ID"
        
        # 输出绑定命令
        echo ""
        echo -e "${BOLD}请执行以下命令完成绑定：${NC}"
        echo ""
        echo -e "  ${CYAN}openclaw bind feishu --group $GROUP_ID --agent project-manager${NC}"
        echo ""
        
        read -p "是否自动执行？[y/N]: " auto_bind
        if [[ "$auto_bind" =~ ^[Yy]$ ]]; then
            openclaw bind feishu --group "$GROUP_ID" --agent project-manager 2>/dev/null || {
                print_warning "自动绑定失败，请手动执行上述命令"
            }
        fi
    else
        print_warning "OpenClaw CLI 未安装，无法执行绑定"
    fi
}

# ===== Phase 9: 验证安装 =====
verify_installation() {
    print_step "Phase 9: 验证安装"
    
    local errors=0
    
    # 检查配置文件
    print_substep "检查配置文件..."
    if [ -f "$CONFIG_FILE" ]; then
        print_success "配置文件存在"
        
        # 验证内容
        if command -v jq &>/dev/null; then
            if jq empty "$CONFIG_FILE" 2>/dev/null; then
                print_success "配置文件格式正确"
            else
                print_error "配置文件 JSON 格式错误"
                ((errors++))
            fi
        fi
    else
        print_error "配置文件缺失"
        ((errors++))
    fi
    
    # 检查 project-manager workspace
    print_substep "检查 Project-Manager workspace..."
    local pm_agent="$HOME/.openclaw/agents/project-manager"
    
    if [ -d "$pm_agent" ]; then
        print_success "workspace 目录存在"
        
        if [ -f "$pm_agent/HEARTBEAT.md" ]; then
            print_success "HEARTBEAT.md 存在"
        else
            print_warning "HEARTBEAT.md 缺失"
        fi
    else
        print_error "workspace 目录缺失"
        ((errors++))
    fi
    
    # 检查任务数据
    print_substep "检查任务数据..."
    if [ -f "$PROJECT_ROOT/tasks/projects.json" ]; then
        print_success "projects.json 存在"
    else
        print_warning "projects.json 缺失"
    fi
    
    # 检查 skills
    print_substep "检查 Skills..."
    if command -v clawhub &>/dev/null; then
        print_success "ClawHub 已安装"
    else
        print_info "ClawHub 未安装 (可选)"
    fi
    
    echo ""
    
    if [ $errors -eq 0 ]; then
        print_success "验证通过"
        return 0
    else
        print_error "发现 $errors 个问题"
        return 1
    fi
}

# ===== 显示完成信息 =====
show_completion() {
    local os=$(detect_os)
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  ${BOLD}安装完成！${NC}                                              ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}安装摘要：${NC}"
    echo ""
    echo "  项目目录:    $PROJECT_ROOT"
    echo "  配置文件:    src/backend/config/openclaw.json"
    echo "  Agent 目录:  ~/.openclaw/agents/project-manager"
    echo "  PM-Agent 配置: config/pm-agent-dispatcher.json"
    echo ""
    
    echo -e "${BOLD}下一步操作：${NC}"
    echo ""
    echo -e "  1. ${CYAN}启动服务${NC}"
    if [[ "$os" == "Windows" ]]; then
        echo "     start.bat"
    else
        echo "     ./start.sh"
    fi
    echo ""
    echo -e "  2. ${CYAN}访问应用${NC}"
    echo "     http://localhost:$FRONTEND_PORT"
    echo ""
    echo -e "  3. ${CYAN}验证服务${NC}"
    if [[ "$os" == "Windows" ]]; then
        echo "     verify.bat"
    else
        echo "     ./verify.sh"
    fi
    echo ""
    
    if [ -n "$GROUP_ID" ]; then
        echo -e "  4. ${CYAN}绑定群组${NC} (如果尚未完成)"
        echo "     openclaw bind feishu --group $GROUP_ID --agent project-manager"
        echo ""
    fi
    
    echo -e "${BOLD}PM-Agent 调度器：${NC}"
    echo ""
    echo "  # 单次执行（心跳模式）"
    echo "  node scripts/pm-agent-dispatcher.mjs --once"
    echo ""
    echo "  # 持续运行（守护模式）"
    echo "  node scripts/pm-agent-dispatcher.mjs"
    echo ""
    echo "  # 使用自定义配置"
    echo "  node scripts/pm-agent-dispatcher.mjs --config ./config/pm-agent-dispatcher.json"
    echo ""
    
    echo -e "${BOLD}常用命令：${NC}"
    echo ""
    echo "  ./start.sh         启动服务"
    echo "  ./stop.sh          停止服务"
    echo "  ./verify.sh        验证状态"
    echo ""
    echo -e "${BOLD}文档：${NC}"
    echo ""
    echo "  PM-Agent 文档: docs/PROJECT-MANAGER-AGENT.md"
    echo "  安装指南: docs/INSTALL-PACKAGE.md"
    echo "  用户指南: docs/USER_GUIDE.md"
    echo ""
}

# ===== 主函数 =====
main() {
    # 默认值
    local skip_deps=false
    local skip_skills=false
    local skip_bind=false
    RECONFIGURE=false
    local check_only=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                ;;
            --skip-deps)
                skip_deps=true
                shift
                ;;
            --skip-skills)
                skip_skills=true
                shift
                ;;
            --skip-bind)
                skip_bind=true
                shift
                ;;
            --reconfigure)
                RECONFIGURE=true
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
                ;;
        esac
    done
    
    print_header
    
    # Phase 1: Preflight
    preflight_check
    echo ""
    
    if [ "$check_only" = true ]; then
        print_success "环境检查完成"
        exit 0
    fi
    
    # Phase 2: Config Wizard
    config_wizard
    echo ""
    
    # Phase 3: Save Config
    save_config
    echo ""
    
    # Phase 4: Install Dependencies
    if [ "$skip_deps" = false ]; then
        install_dependencies
        echo ""
    else
        print_info "跳过依赖安装"
        echo ""
    fi
    
    # Phase 5: Install Skills
    if [ "$skip_skills" = false ]; then
        install_skills
        echo ""
    else
        print_info "跳过 Skills 安装"
        echo ""
    fi
    
    # Phase 6: Generate Structure
    generate_structure
    echo ""
    
    # Phase 7: Configure Agent Binding
    configure_agent_binding
    echo ""
    
    # Phase 8: Bind and Verify
    if [ "$skip_bind" = false ]; then
        bind_and_verify
        echo ""
    fi
    
    # Phase 9: Verify
    verify_installation
    echo ""
    
    # Show completion
    show_completion
}

# 运行
main "$@"