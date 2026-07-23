#[path = "commands.rs"]
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      if let Err(error) = commands::start_backend(app.handle()) {
        commands::record_backend_error(error);
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        commands::backend_connection,
        commands::runtime_status,
        commands::list_workspaces,
        commands::save_workspaces,
        commands::git_status,
        commands::git_log_recent,
    ])
    .build(tauri::generate_context!())
    .expect("error while building MAZos desktop application");

  app.run(|_app_handle, event| {
    if matches!(event, tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }) {
      commands::stop_backend();
    }
  });
}
