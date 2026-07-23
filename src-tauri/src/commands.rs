use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    mode: &'static str,
    standalone_ready: bool,
    backend: &'static str,
    registry_path: String,
    capabilities: Vec<&'static str>,
    limitations: Vec<&'static str>,
}

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

#[tauri::command]
pub fn runtime_status(app: AppHandle) -> Result<RuntimeStatus, String> {
    Ok(RuntimeStatus {
        mode: "desktop",
        standalone_ready: false,
        backend: "tauri-repair-gate",
        registry_path: registry_path(&app)?.to_string_lossy().to_string(),
        capabilities: vec![
            "runtime-status",
            "validated-workspace-registry",
            "registered-workspace-git-health",
        ],
        limitations: vec![
            "The packaged backend does not yet implement the full MAZos API surface.",
            "Loops, decisions, runs, actions, Toolkit and Hermes profiles remain unavailable standalone.",
            "Do not publish a desktop release until the acceptance matrix passes.",
        ],
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
