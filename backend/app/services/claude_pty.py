import asyncio
import codecs
import logging
import os
import shutil
import subprocess
import sys
import threading
from pathlib import Path
from typing import Optional, Callable, Dict
from backend.app.core.config import settings

logger = logging.getLogger("llm_wiki.claude_pty")

class ClaudeSession:
    def __init__(self, topic_id: str, topic_path: str, output_callback: Callable[[str], None]):
        self.topic_id = topic_id
        self.topic_path = topic_path
        self.output_callback = output_callback
        self.process: Optional[subprocess.Popen] = None
        self._reader_thread: Optional[threading.Thread] = None
        self._is_running = False

    def _get_executable(self, custom_command: Optional[str] = None) -> str:
        cmd = custom_command or settings.CLAUDE_CLI_PATH
        return (
            shutil.which(cmd)
            or shutil.which("claude.cmd")
            or shutil.which("claude.exe")
            or shutil.which(str(Path.home() / ".local" / "bin" / "claude.exe"))
            or cmd
        )

    async def execute_prompt(self, prompt: str):
        """Executes a one-shot prompt with `claude -p` streaming stdout with robust UTF-8 incremental decoding."""
        executable = self._get_executable()
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUNBUFFERED"] = "1"
        env["LANG"] = "en_US.UTF-8"
        env["LC_ALL"] = "en_US.UTF-8"
        env["FORCE_COLOR"] = "0"
        
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[Optional[str]] = asyncio.Queue()

        def _run():
            try:
                proc = subprocess.Popen(
                    [executable, "-p", prompt],
                    cwd=self.topic_path,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    env=env,
                    bufsize=0
                )
                decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
                while True:
                    chunk = proc.stdout.read(512)
                    if not chunk:
                        break
                    text = decoder.decode(chunk)
                    if "Warning: no stdin data received" in text:
                        text = text.replace("Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.\n", "")
                    if text:
                        asyncio.run_coroutine_threadsafe(queue.put(text), loop)

                final_text = decoder.decode(b"", final=True)
                if final_text:
                    asyncio.run_coroutine_threadsafe(queue.put(final_text), loop)
                proc.wait()
            except Exception as e:
                logger.error("Error in Claude execution thread: %s", e, exc_info=True)
                asyncio.run_coroutine_threadsafe(queue.put(f"\n\n[오류 발생: {e}]"), loop)
            finally:
                asyncio.run_coroutine_threadsafe(queue.put(None), loop)

        logger.info("Executing Claude prompt in %s", self.topic_path)
        thread = threading.Thread(target=_run, daemon=True)
        thread.start()

        while True:
            item = await queue.get()
            if item is None:
                break
            await self.output_callback(item)

    async def start_interactive(self, custom_command: Optional[str] = None):
        """Starts interactive Claude CLI process for xterm.js terminal."""
        if self._is_running:
            return

        executable = self._get_executable(custom_command)
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["FORCE_COLOR"] = "1"
        env["TERM"] = "xterm-256color"
        env["PYTHONIOENCODING"] = "utf-8"

        logger.info("Starting interactive Claude CLI in %s with command: %s", self.topic_path, executable)

        try:
            self.process = subprocess.Popen(
                [executable],
                cwd=self.topic_path,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=env,
                bufsize=0
            )

            self._is_running = True
            loop = asyncio.get_running_loop()

            def _read_stdout():
                decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
                try:
                    while self._is_running and self.process and self.process.stdout:
                        chunk = self.process.stdout.read(512)
                        if not chunk:
                            break
                        text = decoder.decode(chunk)
                        if text:
                            asyncio.run_coroutine_threadsafe(self.output_callback(text), loop)
                except Exception as e:
                    logger.error("Error reading stdout: %s", e)
                finally:
                    self._is_running = False
                    asyncio.run_coroutine_threadsafe(self.output_callback("\r\n\x1b[33m[Claude Code session ended]\x1b[0m\r\n"), loop)

            self._reader_thread = threading.Thread(target=_read_stdout, daemon=True)
            self._reader_thread.start()

        except Exception as e:
            logger.error("Failed to start interactive Claude process: %s", e, exc_info=True)
            msg = f"\r\n\x1b[31m[Error starting Claude Code CLI: {e}]\x1b[0m\r\n"
            msg += f"\x1b[33mHint: Ensure 'claude' is in your PATH or installed via npm install -g @anthropic-ai/claude-code\x1b[0m\r\n"
            await self.output_callback(msg)
            self._is_running = False

    async def write_input(self, data: str):
        if self._is_running and self.process and self.process.stdin:
            try:
                self.process.stdin.write(data.encode("utf-8"))
                self.process.stdin.flush()
            except Exception as e:
                logger.error("Error writing to stdin: %s", e)

    async def stop(self):
        self._is_running = False
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=2.0)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
        self.process = None

class ClaudePTYManager:
    def __init__(self):
        self.sessions: Dict[str, ClaudeSession] = {}

    def get_or_create_session(self, topic_id: str, topic_path: str, output_callback: Callable[[str], None]) -> ClaudeSession:
        if topic_id in self.sessions and self.sessions[topic_id]._is_running:
            self.sessions[topic_id].output_callback = output_callback
            return self.sessions[topic_id]
        
        session = ClaudeSession(topic_id, topic_path, output_callback)
        self.sessions[topic_id] = session
        return session

    async def close_session(self, topic_id: str):
        if topic_id in self.sessions:
            await self.sessions[topic_id].stop()
            del self.sessions[topic_id]

claude_pty_manager = ClaudePTYManager()
