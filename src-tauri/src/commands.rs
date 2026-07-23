use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    fs::OpenOptions,
    io::ErrorKind,
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub label: String,
    pub path: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct WorkspaceRegistry {
    workspaces: Vec<Workspace>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendConnection {
    pub base_url: String,
    pub token: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    mode: &'static str,
    standalone_ready: bool,
    backend: String,
    registry_path: String,
    capabilities: Vec<&'static str>,
    limitations: Vec<String>,
}

static BACKEND_CONNECTION: OnceLock<BackendConnection> = OnceLock::new();
static BACKEND_ERROR: OnceLock<String> = OnceLock::new();
static BACKEND_CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

fn registry_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|error| error.to_string())?;
    Ok(dir.join("workspaces.json"))
}

fn load_registry(app: &AppHandle) -> Result<WorkspaceRegistry, String> {
    let path = registry_path(app)?;
    let raw = match fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return Ok(WorkspaceRegistry { workspaces: Vec::new() });
        }
        Err(error) => {
            return Err(format!(
                "Workspace registry could not be read at {}: {}",
                path.display(),
                error
            ));
        }
    };

    serde_json::from_str(&raw).map_err(|error| {
        format!("Workspace registry at {} is invalid: {}", path.display(), error)
    })
}

fn valid_workspace_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
}

fn validate_workspace(workspace: Workspace) -> Result<Workspace, String> {
    let id = workspace.id.trim().to_string();
    let label = workspace.label.trim().to_string();

    if !valid_workspace_id(&id) {
        return Err(format!(
            "Workspace id '{}' must contain only letters, numbers, '.', '_' or '-'.",
            workspace.id
        ));
    }
    if label.is_empty() || label.len() > 120 {
        return Err(format!("Workspace '{}' has an invalid label.", id));
    }

    let canonical = fs::canonicalize(Path::new(workspace.path.trim())).map_err(|error| {
        format!("Workspace '{}' path is unavailable: {}", id, error)
    })?;

    if !canonical.join(".git").exists() {
        return Err(format!("Workspace '{}' is not a Git repository.", id));
    }

    Ok(Workspace {
        id,
        label,
        path: canonical.to_string_lossy().to_string(),
    })
}

fn resolve_workspace(app: &AppHandle, repo_id: &str) -> Result<PathBuf, String> {
    if !valid_workspace_id(repo_id) {
        return Err("Invalid workspace id.".to_string());
    }

    let registry = load_registry(app)?;
    let workspace = registry
        .workspaces
        .into_iter()
        .find(|workspace| workspace.id == repo_id)
        .ok_or_else(|| format!("Workspace '{}' is not registered.", repo_id))?;

    let path = fs::canonicalize(Path::new(&workspace.path)).map_err(|error| {
        format!("Registered workspace '{}' is unavailable: {}", workspace.id, error)
    })?;

    if !path.join(".git").exists() {
        return Err(format!("Registered workspace '{}' is not a Git repository.", workspace.id));
    }

    Ok(path)
}

fn run_git(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn reserve_port() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let port = listener.local_addr().map_err(|error| error.to_string())?.port();
    drop(listener);
    Ok(port)
}

fn wait_for_backend(port: u16, child: &mut Child) -> Result<(), String> {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let deadline = Instant::now() + Duration::from_secs(25);

    while Instant::now() < deadline {
        if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
            return Err(format!("Packaged MAZos backend exited during startup with status {}.", status));
        }
        if TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(200));
    }

    Err("Packaged MAZos backend did not become ready within 25 seconds.".to_string())
}

pub fn record_backend_error(error: String) {
    let _ = BACKEND_ERROR.set(error);
}

pub fn start_backend(app: &AppHandle) -> Result<(), String> {
    if BACKEND_CONNECTION.get().is_some() {
        return Ok(());
    }

    if cfg!(debug_assertions) {
        BACKEND_CONNECTION
            .set(BackendConnection {
                base_url: "http://127.0.0.1:3046".to_string(),
                token: String::new(),
            })
            .map_err(|_| "Desktop development backend was already configured.".to_string())?;
        return Ok(());
    }

    let server_dir = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?
        .join("server");
    let node_path = server_dir.join("node.exe");
    let server_path = server_dir.join("server.js");

    if !node_path.exists() || !server_path.exists() {
        return Err(format!(
            "Packaged backend resources are missing from {}.",
            server_dir.display()
        ));
    }

    let runtime_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("runtime");
    let data_dir = runtime_dir.join("data").join("mazos");
    let research_dir = runtime_dir.join("research").join("mazos");
    fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&research_dir).map_err(|error| error.to_string())?;

    let log_path = runtime_dir.join("desktop-backend.log");
    let stdout_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|error| error.to_string())?;
    let stderr_log = stdout_log.try_clone().map_err(|error| error.to_string())?;

    let port = reserve_port()?;
    let token = Uuid::new_v4().to_string();
    let mut child = Command::new(&node_path)
        .arg(&server_path)
        .current_dir(&server_dir)
        .env("HOSTNAME", "127.0.0.1")
        .env("PORT", port.to_string())
        .env("NODE_ENV", "production")
        .env("NEXT_TELEMETRY_DISABLED", "1")
        .env("MAZOS_DESKTOP_TOKEN", &token)
        .env("MAZOS_DATA_DIR", &data_dir)
        .env("MAZOS_RESEARCH_DIR", &research_dir)
        .stdout(Stdio::from(stdout_log))
        .stderr(Stdio::from(stderr_log))
        .spawn()
        .map_err(|error| format!("Packaged MAZos backend could not start: {}", error))?;

    if let Err(error) = wait_for_backend(port, &mut child) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(format!("{} See {} for backend output.", error, log_path.display()));
    }

    BACKEND_CONNECTION
        .set(BackendConnection {
            base_url: format!("http://127.0.0.1:{}", port),
            token,
        })
        .map_err(|_| "Packaged backend connection was already configured.".to_string())?;
    BACKEND_CHILD
        .set(Mutex::new(Some(child)))
        .map_err(|_| "Packaged backend process was already configured.".to_string())?;

    Ok(())
}

pub fn stop_backend() {
    if let Some(child) = BACKEND_CHILD.get() {
        if let Ok(mut guard) = child.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

#[tauri::command]
pub fn backend_connection() -> Result<BackendConnection, String> {
    BACKEND_CONNECTION.get().cloned().ok_or_else(|| {
        BACKEND_ERROR
            .get()
            .cloned()
            .unwrap_or_else(|| "Packaged backend is not available.".to_string())
    })
}

#[tauri::command]
pub fn runtime_status(app: AppHandle) -> Result<RuntimeStatus, String> {
    let ready = BACKEND_CONNECTION.get().is_some();
    let error = BACKEND_ERROR.get().cloned();
    Ok(RuntimeStatus {
        mode: "desktop",
        standalone_ready: ready,
        backend: if cfg!(debug_assertions) {
            "next-development".to_string()
        } else if ready {
            "next-standalone-sidecar".to_string()
        } else {
            "backend-start-failed".to_string()
        },
        registry_path: registry_path(&app)?.to_string_lossy().to_string(),
        capabilities: if ready {
            vec![
                "authenticated-packaged-next-backend",
                "runtime-status",
                "validated-workspace-registry",
                "registered-workspace-git-health",
            ]
        } else {
            vec![
                "runtime-status",
                "validated-workspace-registry",
                "registered-workspace-git-health",
            ]
        },
        limitations: if ready {
            vec!["Installed-app acceptance matrix still requires independent verification.".to_string()]
        } else {
            vec![error.unwrap_or_else(|| "Packaged backend is unavailable.".to_string())]
        },
    })
}

#[tauri::command]
pub fn list_workspaces(app: AppHandle) -> Result<Vec<Workspace>, String> {
    Ok(load_registry(&app)?.workspaces)
}

#[tauri::command]
pub fn save_workspaces(app: AppHandle, workspaces: Vec<Workspace>) -> Result<Vec<Workspace>, String> {
    if workspaces.len() > 50 {
        return Err("A maximum of 50 workspaces may be registered.".to_string());
    }

    let mut ids = HashSet::new();
    let mut validated = Vec::with_capacity(workspaces.len());
    for workspace in workspaces {
        let workspace = validate_workspace(workspace)?;
        if !ids.insert(workspace.id.clone()) {
            return Err(format!("Duplicate workspace id '{}'.", workspace.id));
        }
        validated.push(workspace);
    }

    let path = registry_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let registry = WorkspaceRegistry {
        workspaces: validated.clone(),
    };
    let json = serde_json::to_string_pretty(&registry).map_err(|error| error.to_string())?;
    fs::write(&path, format!("{}\n", json)).map_err(|error| {
        format!("Workspace registry could not be written at {}: {}", path.display(), error)
    })?;

    Ok(validated)
}

#[tauri::command]
pub fn git_status(app: AppHandle, repo_id: String) -> Result<String, String> {
    let path = resolve_workspace(&app, &repo_id)?;
    run_git(&path, &["status", "--porcelain"])
}

#[tauri::command]
pub fn git_log_recent(app: AppHandle, repo_id: String, since: String) -> Result<String, String> {
    if since.trim().is_empty() || since.len() > 64 {
        return Err("Invalid git log date range.".to_string());
    }
    let path = resolve_workspace(&app, &repo_id)?;
    run_git(
        &path,
        &[
            "log",
            &format!("--since={}", since),
            "--pretty=format:%H|%s|%ad",
            "--date=iso",
        ],
    )
}
