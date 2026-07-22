use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}, process::Command};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub label: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
struct WorkspaceRegistry {
    workspaces: Vec<Workspace>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    mode: &'static str,
    standalone_ready: bool,
    backend: &'static str,
    capabilities: Vec<&'static str>,
    limitations: Vec<&'static str>,
}

fn registry_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|error| error.to_string())?;
    Ok(dir.join("workspaces.json"))
}

fn load_registry(app: &AppHandle) -> Result<WorkspaceRegistry, String> {
    let path = registry_path(app)?;
    let raw = fs::read_to_string(&path).map_err(|error| {
        format!(
            "Workspace registry is not configured at {}: {}",
            path.display(),
            error
        )
    })?;
    serde_json::from_str(&raw).map_err(|error| {
        format!("Workspace registry at {} is invalid: {}", path.display(), error)
    })
}

fn resolve_workspace(app: &AppHandle, repo_id: &str) -> Result<PathBuf, String> {
    if repo_id.trim().is_empty() || repo_id.len() > 80 {
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

#[tauri::command]
pub fn runtime_status() -> RuntimeStatus {
    RuntimeStatus {
        mode: "desktop",
        standalone_ready: false,
        backend: "tauri-repair-gate",
        capabilities: vec!["runtime-status", "registered-workspace-git"],
        limitations: vec![
            "The packaged backend does not yet implement the full MAZos API surface.",
            "Loops, decisions, runs, actions, Toolkit and Hermes profiles remain unavailable standalone.",
            "Do not publish a desktop release until the acceptance matrix passes.",
        ],
    }
}

#[tauri::command]
pub fn list_workspaces(app: AppHandle) -> Result<Vec<Workspace>, String> {
    Ok(load_registry(&app)?.workspaces)
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
