# 🚀 LLM-Wiki Web 배포 및 운영 가이드 (Deployment Guide)

본 문서는 `llm-wiki-web` 서비스를 `wiki.k71style.xyz` 도메인 환경에 배포하고, Docker Compose 컨테이너 오케스트레이션 및 GitHub Actions CI/CD 파이프라인을 운영하기 위한 종합 지침서입니다.

---

## 1. 🏗️ 배포 아키텍처 개요

```mermaid
flowchart TD
    subgraph Internet ["인터넷 및 사용자 접속"]
        Client["사용자 브라우저 / 모바일 디바이스\nhttps://wiki.k71style.xyz"]
    end

    subgraph HostServer ["k71style.xyz 호스트 서버"]
        Nginx["Nginx Reverse Proxy\n(Port 80 HTTP -> 443 HTTPS)\n(Let's Encrypt Wildcard / Subdomain SSL)"]
        
        subgraph DockerCompose ["Docker Compose (llm-wiki-web)"]
            Frontend["Next.js 15 Frontend\n(Port 3000, Standalone)\n- Markdown / 2D Graph / Mobile UI"]
            Backend["FastAPI Backend\n(Port 8000)\n- FTS5 + Semantic Hybrid Search\n- Claude Code CLI Streaming\n- Watchdog File Watcher"]
        end

        Volume[("Persistent Storage (Host)\n./data/wikis\n- 마크다운 문서 (*.md)\n- SQLite FTS5 DB (.system/llm_wiki.db)")]
    end

    subgraph GitHub ["GitHub Platform (github.com/k71style/llm-wiki-web)"]
        Repo["Git Repository (main branch)"]
        Actions["GitHub Actions CI/CD\n1. Pytest & Next Build\n2. GHCR Docker Image Push\n3. SSH 원격 배포 트리거"]
    end

    Client -->|HTTPS / WSS| Nginx
    Nginx -->|/ (Web UI)| Frontend
    Nginx -->|/api (REST API)| Backend
    Nginx -->|/ws (WebSocket Stream)| Backend
    Backend <--> Volume
    Frontend -.->|내부 통신| Backend
    Repo --> Actions
    Actions -->|SSH Deploy| HostServer
```

---

## 2. 🌐 도메인 및 DNS 설정 (`wiki.k71style.xyz`)

도메인 관리자 페이지(Cloudflare, 가비아, Route53, 호스팅케이알 등)에서 아래와 같이 **A 레코드**를 등록합니다:

| Type | Name / Host | IPv4 Address (Target) | TTL | Proxy Status (Cloudflare인 경우) |
| :---: | :---: | :---: | :---: | :---: |
| **A** | `wiki` (또는 `wiki.k71style.xyz`) | `<서버의 공인 IP 주소>` | Auto (또는 300) | DNS Only 또는 Proxied |

---

## 3. 🛡️ Nginx 리버스 프록시 및 SSL 설정

프로젝트에 포함된 [nginx/wiki.k71style.xyz.conf](../nginx/wiki.k71style.xyz.conf) 설정을 서버의 Nginx에 적용합니다.

### 1) 설정 파일 복사 및 활성화
```bash
# Nginx conf.d 디렉터리로 설정 파일 복사
sudo cp nginx/wiki.k71style.xyz.conf /etc/nginx/conf.d/

# Nginx 문법 검사
sudo nginx -t

# Nginx 설정 갱신
sudo nginx -s reload
```

### 2) Let's Encrypt SSL 인증서 확인
`k71style.xyz`의 와일드카드 인증서(`*.k71style.xyz`) 또는 `wiki.k71style.xyz` 단독 인증서가 `/etc/letsencrypt/live/k71style.xyz/` 경로에 위치하는지 확인합니다. 단독 인증서 발급이 필요한 경우:
```bash
sudo certbot certonly --webroot -w /var/www/certbot -d wiki.k71style.xyz
```

---

## 4. 🐳 Docker Compose 컨테이너 배포

### 1) 환경 변수 파일(`.env`) 생성
서버의 `llm-wiki-web` 프로젝트 루트 디렉터리에 `.env` 파일을 생성합니다:
```env
# Anthropic API Key (Claude Code CLI 인증용)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Claude Code CLI 실행 경로
CLAUDE_CLI_PATH=claude

# 위키 데이터 저장소 경로 (컨테이너 내부 경로)
LLM_WIKI_DATA_DIR=/app/data/wikis
```

### 2) 서비스 구동 명령어
```bash
# 이미지 빌드 및 백그라운드 구동
docker compose up -d --build

# 실행 상태 및 로그 확인
docker compose ps
docker compose logs -f

# 서비스 재시작
docker compose restart

# 서비스 완전 중지
docker compose down
```

---

---

## 5. 🔄 CI/CD 파이프라인 구성

### 옵션 A: 🏗️ Jenkins 자동 배포 파이프라인 (권장 / 기존 zzooni4와 동일 스택)

서버 내 Jenkins를 사용하여 [Jenkinsfile](../Jenkinsfile) 기반으로 원클릭/자동 빌드 및 배포를 수행할 수 있습니다.

#### 1) Jenkins Pipeline Job 생성 방법
1. Jenkins 대시보드에서 **새로운 Item (New Item)** 클릭
2. Item 이름 입력 (예: `llm-wiki-web`) -> **Pipeline** 선택 후 [OK]
3. **Pipeline 설정**:
   - **Definition**: `Pipeline script from SCM`
   - **SCM**: `Git`
   - **Repository URL**: `https://github.com/k71style/llm-wiki-web.git`
   - **Credentials**: `github-credentials` (기존 저장된 계정/토큰 선택)
   - **Branches to build**: `*/main`
   - **Script Path**: `Jenkinsfile`
4. [저장(Save)] 후 **지금 빌드(Build Now)** 실행

#### 2) 파이프라인 동작 단계
1. **Checkout**: GitHub `main` 브랜치 소스코드 체크아웃
2. **Deploy**: 호스트 Docker 데몬을 통해 `docker-compose -p llm-wiki up --build -d` 실행 (컨테이너 무중단 교체)
3. **Health Check**: `http://localhost:8000/api/health` 및 프론트엔드 포트(3000) 헬스체크 자동 수행
4. **Post Actions**: 워크스페이스 자동 정리(`cleanWs`) 및 완료 로그 출력

---

### 옵션 B: ☁️ GitHub Actions CI/CD 파이프라인

리포지토리([github.com/k71style/llm-wiki-web](https://github.com/k71style/llm-wiki-web))에 코드를 푸시하면 자동으로 테스트 및 배포가 진행됩니다.

#### 1) 파이프라인 구성
- **CI 파이프라인 ([.github/workflows/ci.yml](../.github/workflows/ci.yml))**:
  - `main` 브랜치에 Push 또는 PR 발생 시 구동.
  - 백엔드 `pytest` 테스트 (검색, 마크다운 파서, API 엔드포인트) 자동 검증.
  - 프론트엔드 `Next.js 15` 빌드 및 TypeScript 정적 타입 검사.
- **CD 파이프라인 ([.github/workflows/cd-deploy.yml](../.github/workflows/cd-deploy.yml))**:
  - GitHub Container Registry(GHCR)에 프론트엔드/백엔드 최신 Docker 이미지 빌드 및 Push.
  - GitHub Repository Secrets에 SSH 정보가 등록되어 있다면 대상 서버에 원격 접속하여 `docker compose pull && docker compose up -d`를 자동 실행.

#### 2) 자동 배포를 위한 GitHub Secrets 설정 (선택 사항)
GitHub 저장소 `Settings -> Secrets and variables -> Actions`에서 다음 Secret을 등록하면 서버 자동 배포가 활성화됩니다:
- `SERVER_HOST`: 서버 공인 IP 또는 도메인
- `SERVER_USER`: SSH 접속 계정 (예: `ubuntu`, `root`)
- `SERVER_SSH_KEY`: SSH 비공개 키 (Private Key)
- `SERVER_PORT`: SSH 포트 (기본 `22`)
- `SERVER_DEPLOY_PATH`: 서버 내 프로젝트 경로 (예: `/home/ubuntu/llm-wiki-web`)

---

## 6. 💾 데이터 백업 및 복원 (Data Backup & Recovery)

위키 시스템의 모든 지식 데이터와 검색 인덱스는 `./data/wikis` 디렉터리에 로컬 파일로 저장됩니다.

- **백업 대상**: `./data/wikis` 디렉터리 전체 (마크다운 파일 + `.system/llm_wiki.db`)
- **백업 명령어**:
  ```bash
  # 압축 백업 생성
  tar -czvf wiki_backup_$(date +%Y%m%d_%H%M%S).tar.gz ./data/wikis
  ```
- **복원 명령어**:
  ```bash
  # 백업 복원 후 서비스 재시작
  tar -xzvf wiki_backup_YYYYMMDD_HHMMSS.tar.gz
  docker compose restart backend
  ```

---

## 7. 🛠️ 트러블슈팅 (Troubleshooting)

| 현상 | 원인 | 조치 방법 |
| :--- | :--- | :--- |
| **WebSocket 연결 실패 (WSS Error)** | Nginx 리버스 프록시 헤더 누락 | `nginx/wiki.k71style.xyz.conf`의 `Upgrade`, `Connection "upgrade"` 헤더 설정 확인 후 Nginx reload |
| **Claude 대화 응답 지연/오류** | ANTHROPIC_API_KEY 누락 또는 한글 인코딩 충돌 | `.env`의 API 키 유효성 확인 및 컨테이너 로그(`docker compose logs backend`) 확인 |
| **파일 업로드/편집 용량 제한** | Nginx `client_max_body_size` 기본값 초과 | Nginx 설정의 `client_max_body_size 500m;` 확인 |
| **컨테이너 재부팅 시 데이터 유실** | 볼륨 마운트 미설정 | `docker-compose.yml`의 `./data/wikis:/app/data/wikis` 마운트 설정 확인 |
