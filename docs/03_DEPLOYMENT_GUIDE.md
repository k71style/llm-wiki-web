# LLM-Wiki Web 배포 가이드 (Deployment Guide)

본 문서는 `llm-wiki-web` 서비스를 로컬, 개인 서버(VPS), 또는 클라우드 환경에 배포하고 GitHub Actions CI/CD 파이프라인을 연동하는 절차를 설명합니다.

---

## 1. 아키텍처 개요

- **프론트엔드 컨테이너**: Next.js 15 Standalone 경량 이미지 (Port 3000)
- **백엔드 컨테이너**: Python 3.13 + FastAPI + Claude Code CLI + Watchdog + SQLite FTS5 (Port 8000)
- **영속 볼륨**: `./data/wikis` -> `/app/data/wikis` (위키 마크다운 파일 및 SQLite DB 영구 보존)

---

## 2. 로컬 / 서버 Docker Compose 배포

### 1) 사전 준비
- Docker 및 Docker Compose가 설치되어 있어야 합니다.
- `.env` 파일에 필요한 환경 변수를 설정합니다:
  ```env
  ANTHROPIC_API_KEY=your_anthropic_api_key_here
  CLAUDE_CLI_PATH=claude
  LLM_WIKI_DATA_DIR=/app/data/wikis
  ```

### 2) 서비스 빌드 및 실행
```bash
# 컨테이너 빌드 및 백그라운드 실행
docker compose up -d --build

# 로그 확인
docker compose logs -f

# 서비스 중지
docker compose down
```

---

## 3. GitHub Actions CI/CD 파이프라인

리포지토리에 포함된 워크플로우 구성:

### 1) CI 워크플로우 (`.github/workflows/ci.yml`)
- `main` 또는 `master` 브랜치에 Push / PR 생성 시 자동 실행.
- **백엔드 테스트**: Python 3.13 환경에서 `pytest backend/tests` 실행.
- **프론트엔드 빌드 검증**: Node.js 20 환경에서 `npm run build` 실행.

### 2) CD 워크플로우 (`.github/workflows/cd-deploy.yml`)
- `main` 브랜치에 Push되거나 `v*.*.*` 태그 생성 시 자동 실행.
- GitHub Container Registry(GHCR)에 프론트엔드/백엔드 이미지를 자동 빌드 및 Push.
- (선택 사항) 대상 서버 SSH 접속을 통한 자동 롤링 업데이트:
  - GitHub Repository Secrets에 아래 값을 등록하면 원격 서버 배포까지 자동화됩니다:
    - `SERVER_HOST`: 서버 IP 또는 도메인
    - `SERVER_USER`: SSH 사용자명 (예: ubuntu, root)
    - `SERVER_SSH_KEY`: SSH 프라이빗 키
    - `SERVER_PORT`: SSH 포트 (기본 22)
    - `SERVER_DEPLOY_PATH`: 프로젝트 경로 (예: `/home/ubuntu/llm-wiki-web`)
