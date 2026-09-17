pipeline {
    // Jenkins 에이전트(실행 노드) 제약 없이 사용 가능한 노드에서 파이프라인을 실행
    agent any

    // 파이프라인 전역 환경 변수
    // - 배포 타겟, 포트, Compose 프로젝트명을 한 곳에서 관리
    environment {
        // 소스 코드를 가져올 원격 저장소 URL
        REPO_URL = 'https://github.com/k71style/llm-wiki-web.git'
        // 애플리케이션 식별용 이름
        APP_NAME = 'llm-wiki-web'
        // Docker Compose 프로젝트명 (컨테이너/네트워크 접두사)
        COMPOSE_PROJECT_NAME = 'llm-wiki'
        // 백엔드 / 프론트엔드 포트
        BACKEND_PORT = '8000'
        FRONTEND_PORT = '3000'
        // 도메인
        DOMAIN = 'wiki.k71style.xyz'
    }

    stages {
        stage('Checkout') {
            steps {
                // main 브랜치 코드를 Jenkins 워크스페이스로 체크아웃
                git credentialsId: 'github-credentials', branch: 'main', url: "${REPO_URL}"
            }
        }

        stage('Deploy') {
            steps {
                script {
                    // Jenkins 컨테이너에서 호스트 Docker 데몬을 제어(DooD)하여
                    // docker-compose -p llm-wiki up --build -d 로 서비스 갱신
                    sh '''
                        echo "=== LLM Wiki Web Docker Compose Deployment ==="
                        
                        # 사용자 로컬 바이너리 경로를 우선하도록 PATH 확장
                        export PATH="$HOME/bin:$PATH"
                        if ! command -v docker-compose > /dev/null 2>&1; then
                            echo "⚠️ docker-compose not found! Auto-installing standalone binary to $HOME/bin ..."
                            mkdir -p "$HOME/bin"
                            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o "$HOME/bin/docker-compose"
                            chmod +x "$HOME/bin/docker-compose"
                        fi
                        DC="docker-compose"
                        
                        echo "Current directory: $(pwd)"
                        echo "Files in current directory:"
                        ls -la
                        
                        # 배포 필수 파일 존재 검증
                        if [ ! -f "docker-compose.yml" ]; then
                            echo "ERROR: docker-compose.yml file not found"
                            exit 1
                        fi
                        
                        echo "docker-compose.yml file found!"
                        
                        # Cloudflare DNS 자동 등록 시도
                        echo "Checking for Cloudflare credentials in Docker volumes..."
                        CF_TOKEN=$(docker run --rm -v zzooni4_certbot-conf:/certs alpine sh -c 'grep -hoE "[a-zA-Z0-9_-]{35,50}" /certs/cloudflare.ini /certs/*.ini 2>/dev/null | head -n 1' || true)
                        if [ -n "$CF_TOKEN" ]; then
                            echo "Found Cloudflare token! Checking/Adding DNS record for wiki.k71style.xyz..."
                            ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=k71style.xyz" \
                                -H "Authorization: Bearer $CF_TOKEN" \
                                -H "Content-Type: application/json" | grep -o '"id":"[^"]*"' | head -n 1 | cut -d'"' -f4 || true)
                            if [ -n "$ZONE_ID" ]; then
                                echo "Zone ID: $ZONE_ID"
                                # Check if wiki record already exists
                                REC_EXISTS=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=wiki.k71style.xyz" \
                                    -H "Authorization: Bearer $CF_TOKEN" \
                                    -H "Content-Type: application/json" | grep -o '"count":[0-9]*' | cut -d: -f2 || echo 0)
                                if [ "$REC_EXISTS" = "0" ] || [ -z "$REC_EXISTS" ]; then
                                    echo "Creating A record wiki.k71style.xyz -> 121.126.171.169..."
                                    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
                                        -H "Authorization: Bearer $CF_TOKEN" \
                                        -H "Content-Type: application/json" \
                                        --data '{"type":"A","name":"wiki","content":"121.126.171.169","ttl":1,"proxied":true}'
                                    echo "DNS Record created successfully!"
                                else
                                    echo "DNS Record for wiki.k71style.xyz already exists."
                                fi
                            fi
                        else
                            echo "No cloudflare.ini token found in volume."
                        fi

                        # 데이터 디렉터리 권한 보장
                        mkdir -p data/wikis
                        
                        # 기존 컨테이너 중지
                        echo "Stopping existing containers for project ${COMPOSE_PROJECT_NAME}..."
                        $DC -p ${COMPOSE_PROJECT_NAME} down || echo "No existing containers to stop"
                        
                        # 사용하지 않는 댕글링 이미지 정리
                        echo "Cleaning up old dangling images..."
                        docker image prune -f || echo "No images to clean"
                        
                        # 최신 소스 기준으로 이미지 빌드 및 백그라운드 구동
                        echo "Building and starting LLM Wiki Web containers..."
                        $DC -p ${COMPOSE_PROJECT_NAME} up --build -d
                        
                        # Nginx Reverse Proxy 설정 동적 주입 및 리로드
                        echo "Configuring Nginx Reverse Proxy for wiki.k71style.xyz..."
                        if [ -f "nginx/wiki.k71style.xyz.conf" ]; then
                            # zzooni4-network 네트워크 연결 (컨테이너 간 이름 기반 통신 보장)
                            NET_NAME=$(docker network ls --format '{{.Name}}' | grep -E "zzooni4.*network" | head -n 1 || true)
                            if [ -n "$NET_NAME" ]; then
                                echo "Connecting containers to $NET_NAME..."
                                docker network connect $NET_NAME llm-wiki-backend || true
                                docker network connect $NET_NAME llm-wiki-frontend || true
                            fi

                            # Nginx 컨테이너에 설정 파일 복사 및 reload
                            if docker ps --format '{{.Names}}' | grep -q "zzooni4-nginx"; then
                                echo "Updating zzooni4-nginx configuration..."
                                sed -i 's/\r$//' nginx/wiki.k71style.xyz.conf || true
                                sed -i '1s/^\xEF\xBB\xBF//' nginx/wiki.k71style.xyz.conf || true
                                docker cp nginx/wiki.k71style.xyz.conf zzooni4-nginx:/etc/nginx/conf.d/wiki.conf
                                docker exec zzooni4-nginx nginx -t
                                docker exec zzooni4-nginx nginx -s reload
                                echo "Nginx reloaded successfully!"
                            fi
                        fi

                        # 컨테이너 상태 요약 출력
                        echo "Checking container status..."
                        $DC -p ${COMPOSE_PROJECT_NAME} ps
                        
                        # 최근 로그 샘플 출력
                        echo "Container logs:"
                        $DC -p ${COMPOSE_PROJECT_NAME} logs --tail=30
                    '''
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    // 최대 30회 * 10초 간격 = 약 5분 대기
                    def maxRetries = 30
                    def retryCount = 0
                    def isHealthy = false
                    
                    echo "=== Container Health Check (${DOMAIN}) ==="
                    echo "Checking Backend health at http://localhost:${BACKEND_PORT}/api/health and Frontend at http://localhost:${FRONTEND_PORT}..."
                    
                    while (retryCount < maxRetries && !isHealthy) {
                        try {
                            // 백엔드 헬스체크 (DooD 환경 컨테이너 내부 직접 검증)
                            sh '''
                                export PATH="$HOME/bin:$PATH"
                                DC="docker-compose"
                                $DC -p ${COMPOSE_PROJECT_NAME} exec -T backend curl -f http://localhost:8000/api/health
                            '''
                            
                            isHealthy = true
                            echo "LLM Wiki Web services are healthy and running!"
                        } catch (Exception e) {
                            retryCount++
                            echo "Health check attempt ${retryCount}/${maxRetries} failed. Retrying in 10 seconds..."
                            echo "Error: ${e.getMessage()}"
                            
                            sh '''
                                export PATH="$HOME/bin:$PATH"
                                DC="docker-compose"
                                echo "=== Current Container Status ==="
                                $DC -p ${COMPOSE_PROJECT_NAME} ps
                                echo "=== Container Logs (last 15 lines) ==="
                                $DC -p ${COMPOSE_PROJECT_NAME} logs --tail=15
                            '''
                            
                            sleep(10)
                        }
                    }
                    
                    if (!isHealthy) {
                        echo "=== Application Health Check Failed ==="
                        sh '''
                            export PATH="$HOME/bin:$PATH"
                            DC="docker-compose"
                            echo "=== Final Container Status ==="
                            $DC -p ${COMPOSE_PROJECT_NAME} ps
                            echo "=== Full Container Logs ==="
                            $DC -p ${COMPOSE_PROJECT_NAME} logs
                        '''
                        error "LLM Wiki Web services failed to start properly."
                    }
                }
            }
        }
    }

    post {
        always {
            // 빌드 종료 후 워크스페이스 정리
            cleanWs()
        }
        success {
            echo "🚀 Deployment of LLM Wiki Web (${DOMAIN}) completed successfully!"
        }
        failure {
            echo "❌ Deployment of LLM Wiki Web (${DOMAIN}) failed!"
        }
    }
}
