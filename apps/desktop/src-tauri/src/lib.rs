mod providers;

use providers::{
    diagnostics_log_path, diagnostics_read_logs, provider_cancel_chat, provider_list_connections,
    provider_list_models, provider_refresh_models, provider_remove_connection,
    provider_save_connection, provider_start_chat, provider_test_connection,
};
use std::process::Command;
use tauri::Manager;

fn allowed_external_url(url: &str) -> bool {
    url.starts_with("https://accounts.google.com/o/oauth2/v2/auth?")
        || url.starts_with("https://drive.google.com/")
        || url.starts_with("https://docs.google.com/")
        || url.starts_with("https://build.nvidia.com/")
        || url.starts_with("https://openrouter.ai/")
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    if !allowed_external_url(&url) {
        return Err("This external address is not allowed by Aegis.".into());
    }
    #[cfg(target_os = "windows")]
    let mut command = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut value = Command::new("rundll32.exe");
        value.args(["url.dll,FileProtocolHandler", &url]);
        value.creation_flags(CREATE_NO_WINDOW);
        value
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut value = Command::new("open");
        value.arg(&url);
        value
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut value = Command::new("xdg-open");
        value.arg(&url);
        value
    };
    command
        .spawn()
        .map_err(|_| "Aegis could not open the system browser.".to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            let log_dir = app.path().app_log_dir()?;
            let registry = providers::registry::ProviderRegistry::new(config_dir, log_dir)?;
            app.manage(registry);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            provider_test_connection,
            provider_save_connection,
            provider_remove_connection,
            provider_list_connections,
            provider_refresh_models,
            provider_list_models,
            provider_start_chat,
            provider_cancel_chat,
            diagnostics_read_logs,
            diagnostics_log_path,
            open_external_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aegis Desktop");
}

#[cfg(test)]
mod tests {
    use super::allowed_external_url;

    #[test]
    fn restricts_external_urls_to_known_destinations() {
        assert!(allowed_external_url(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id=test"
        ));
        assert!(allowed_external_url(
            "https://build.nvidia.com/settings/api-keys"
        ));
        assert!(allowed_external_url("https://openrouter.ai/settings/keys"));
        assert!(!allowed_external_url(
            "https://example.com/?next=https://accounts.google.com"
        ));
        assert!(!allowed_external_url("javascript:alert(1)"));
    }
}
