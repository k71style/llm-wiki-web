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
                            // 백엔드 헬스체크
                            sh "curl -f http://localhost:${BACKEND_PORT}/api/health"
                            // 프론트엔드 응답 체크
                            sh "curl -f http://localhost:${FRONTEND_PORT}"
                            
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
