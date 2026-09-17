import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env
env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "LLM-Wiki Web"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Default base directory for all topic wikis (~/llm-wikis or ./data/wikis)
    DATA_DIR: Path = Path(os.getenv("LLM_WIKI_DATA_DIR", Path(__file__).resolve().parent.parent.parent / "data" / "wikis"))
    
    # Database
    DATABASE_PATH: Path = DATA_DIR / ".system" / "llm_wiki.db"
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"]
    
    # Claude Code CLI
    CLAUDE_CLI_PATH: str = os.getenv("CLAUDE_CLI_PATH", "claude")
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

# Ensure directories exist
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
