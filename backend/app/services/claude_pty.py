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
        self.master_fd: Optional[int] = None
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

    def set_window_size(self, rows: int, cols: int):
        """Resizes the pseudo-terminal window."""
        if sys.platform != "win32" and self.master_fd is not None:
            try:
                import fcntl
                import termios
                import struct
                winsize = struct.pack("HHHH", max(1, rows), max(1, cols), 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
            except Exception as e:
                logger.debug(f"Could not resize PTY window: {e}")

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
        """Starts interactive Claude CLI process for xterm.js terminal with genuine TTY."""
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
            loop = asyncio.get_running_loop()

            if sys.platform != "win32":
                import pty
                master_fd, slave_fd = pty.openpty()
                self.master_fd = master_fd

                self.process = subprocess.Popen(
                    [executable],
                    cwd=self.topic_path,
                    stdin=slave_fd,
                    stdout=slave_fd,
                    stderr=slave_fd,
                    env=env,
                    close_fds=True,
                    preexec_fn=os.setsid
                )
                os.close(slave_fd)

                self._is_running = True

                def _read_stdout_pty():
                    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
                    try:
                        while self._is_running and self.master_fd is not None:
                            try:
                                chunk = os.read(self.master_fd, 1024)
                                if not chunk:
                                    break
                                text = decoder.decode(chunk)
                                if text:
                                    asyncio.run_coroutine_threadsafe(self.output_callback(text), loop)
                            except OSError:
                                # EIO means EOF on Linux PTY
                                break
                    except Exception as e:
                        logger.error("Error reading PTY stdout: %s", e)
                    finally:
                        self._is_running = False
                        if self.master_fd is not None:
                            try:
                                os.close(self.master_fd)
                            except Exception:
                                pass
                            self.master_fd = None
                        asyncio.run_coroutine_threadsafe(self.output_callback("\r\n\x1b[33m[Claude Code session ended]\x1b[0m\r\n"), loop)

                self._reader_thread = threading.Thread(target=_read_stdout_pty, daemon=True)
                self._reader_thread.start()

            else:
                # Windows fallback (pipe-based)
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

                def _read_stdout_pipe():
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

                self._reader_thread = threading.Thread(target=_read_stdout_pipe, daemon=True)
                self._reader_thread.start()

        except Exception as e:
            logger.error("Failed to start interactive Claude process: %s", e, exc_info=True)
            msg = f"\r\n\x1b[31m[Error starting Claude Code CLI: {e}]\x1b[0m\r\n"
            msg += f"\x1b[33mHint: Ensure 'claude' is in your PATH or installed via npm install -g @anthropic-ai/claude-code\x1b[0m\r\n"
            await self.output_callback(msg)
            self._is_running = False

    async def write_input(self, data: str):
        if self._is_running:
            if self.master_fd is not None:
                try:
                    os.write(self.master_fd, data.encode("utf-8"))
                except Exception as e:
                    logger.error("Error writing to PTY: %s", e)
            elif self.process and self.process.stdin:
                try:
                    self.process.stdin.write(data.encode("utf-8"))
                    self.process.stdin.flush()
                except Exception as e:
                    logger.error("Error writing to stdin: %s", e)

    async def stop(self):
        self._is_running = False
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except Exception:
                pass
            self.master_fd = None

        if self.process:
            try:
                if sys.platform != "win32":
                    import signal
                    os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                else:
                    self.process.terminate()
                self.process.wait(timeout=2.0)
            except Exception:
                try:
                    if sys.platform != "win32":
                        import signal
                        os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                    else:
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
