import datetime
import threading

# Simple thread-safe logger that writes events and errors to a log file.

_log_lock = threading.Lock()
LOG_FILE = "the_local.log"


def _write_log(level: str, message: str) -> None:
    """Write a line to the log file with timestamp and level."""
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    line = f"[{timestamp}] {level}: {message}\n"
    with _log_lock:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)


def log_event(message: str) -> None:
    """Log a normal event."""
    _write_log("EVENT", message)


def log_error(message: str) -> None:
    """Log an error message."""
    try:
        _write_log("ERROR", message)
    except Exception as e:
        print(f"Failed to log error: {e}")
