use std::process::Command;

#[tauri::command]
pub fn git_status(repo_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
pub fn git_log_recent(repo_path: String, since: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["log", &format!("--since={}", since), "--pretty=format:%H|%s|%ad", "--date=iso"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
