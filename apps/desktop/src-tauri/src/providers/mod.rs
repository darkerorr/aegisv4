pub mod error;
pub mod lm_studio;
pub mod model;
pub mod nvidia;
pub mod ollama;
pub mod openai_compatible;
pub mod openrouter;
pub mod registry;
pub mod secret_store;
pub mod xai;

use async_trait::async_trait;
use error::ProviderError;
use futures_util::StreamExt;
use model::{
    CancelChatInput, ChatMessage, ConnectionIdInput, ConnectionProgress, ListModelsInput,
    ModelDescriptor, ProviderChatEvent, ProviderConnection, ProviderHealth, ProviderKind,
    SaveConnectionInput, SaveConnectionResult, StartChatInput,
};
use registry::ProviderRegistry;
use reqwest::{Client, Response};
use serde_json::Value;
use std::sync::atomic::Ordering;
use tauri::{ipc::Channel, AppHandle, Emitter, State};

#[async_trait]
pub trait ProviderAdapter: Send + Sync {
    fn kind(&self) -> ProviderKind;

    async fn test_connection(
        &self,
        client: &Client,
        connection: &ProviderConnection,
        secret: Option<&str>,
    ) -> Result<ProviderHealth, ProviderError>;

    async fn list_models(
        &self,
        client: &Client,
        connection: &ProviderConnection,
        secret: Option<&str>,
    ) -> Result<Vec<ModelDescriptor>, ProviderError>;

    async fn stream_chat(
        &self,
        client: &Client,
        connection: &ProviderConnection,
        secret: Option<&str>,
        model: &str,
        messages: &[ChatMessage],
    ) -> Result<Response, ProviderError>;

    async fn cancel_generation(&self, _request_id: &str) -> Result<(), ProviderError> {
        Ok(())
    }
}

#[tauri::command]
pub async fn provider_save_connection(
    app: AppHandle,
    input: SaveConnectionInput,
    registry: State<'_, ProviderRegistry>,
) -> Result<SaveConnectionResult, ProviderError> {
    input.validate()?;
    registry
        .save_connection(input, |connection_id, state| {
            let _ = app.emit(
                "provider-connection-progress",
                ConnectionProgress {
                    connection_id: connection_id.to_string(),
                    state: state.to_string(),
                },
            );
        })
        .await
}

#[tauri::command]
pub fn provider_list_connections(
    registry: State<'_, ProviderRegistry>,
) -> Result<Vec<ProviderConnection>, ProviderError> {
    registry.connections()
}

#[tauri::command]
pub fn provider_remove_connection(
    input: ConnectionIdInput,
    registry: State<'_, ProviderRegistry>,
) -> Result<(), ProviderError> {
    input.validate()?;
    registry.remove_connection(&input.connection_id)
}

#[tauri::command]
pub async fn provider_test_connection(
    input: ConnectionIdInput,
    registry: State<'_, ProviderRegistry>,
) -> Result<ProviderHealth, ProviderError> {
    input.validate()?;
    registry.test_connection(&input.connection_id).await
}

#[tauri::command]
pub async fn provider_refresh_models(
    input: ConnectionIdInput,
    registry: State<'_, ProviderRegistry>,
) -> Result<Vec<ModelDescriptor>, ProviderError> {
    input.validate()?;
    registry.refresh_models(&input.connection_id).await
}

#[tauri::command]
pub fn provider_list_models(
    input: ListModelsInput,
    registry: State<'_, ProviderRegistry>,
) -> Result<Vec<ModelDescriptor>, ProviderError> {
    input.validate()?;
    registry.list_models(input.connection_id.as_deref())
}

fn stream_delta(provider: ProviderKind, raw_line: &[u8]) -> Option<String> {
    let raw = String::from_utf8_lossy(raw_line);
    let line = raw
        .trim()
        .strip_prefix("data:")
        .map(str::trim)
        .unwrap_or_else(|| raw.trim());
    if line.is_empty() || line == "[DONE]" {
        return None;
    }
    let payload = serde_json::from_str::<Value>(line).ok()?;
    if provider == ProviderKind::Ollama {
        payload
            .pointer("/message/content")
            .or_else(|| payload.get("response"))
            .and_then(Value::as_str)
            .map(str::to_owned)
    } else {
        payload
            .pointer("/choices/0/delta/content")
            .and_then(Value::as_str)
            .map(str::to_owned)
    }
}

#[tauri::command]
pub async fn provider_start_chat(
    input: StartChatInput,
    on_event: Channel<ProviderChatEvent>,
    registry: State<'_, ProviderRegistry>,
) -> Result<(), ProviderError> {
    input.validate()?;
    let connection = registry.connection(&input.connection_id)?;
    let cancelled = registry.begin_generation(&input.request_id)?;
    let response = match registry
        .chat_response(&connection, &input.model, &input.messages)
        .await
    {
        Ok(response) => response,
        Err(error) => {
            registry.finish_generation(&input.request_id);
            return Err(error);
        }
    };
    let mut stream = response.bytes_stream();
    let mut buffer = Vec::<u8>::new();
    while let Some(chunk) = stream.next().await {
        if cancelled.load(Ordering::SeqCst) {
            let _ = on_event.send(ProviderChatEvent {
                kind: "cancelled".into(),
                data: None,
                error: None,
            });
            registry.finish_generation(&input.request_id);
            return Ok(());
        }
        let chunk = chunk.map_err(|_| {
            ProviderError::new("network-error", "The provider stream was interrupted.")
        })?;
        buffer.extend_from_slice(&chunk);
        while let Some(newline) = buffer.iter().position(|byte| *byte == b'\n') {
            let line = buffer.drain(..=newline).collect::<Vec<_>>();
            if let Some(delta) = stream_delta(connection.provider, &line) {
                on_event
                    .send(ProviderChatEvent {
                        kind: "delta".into(),
                        data: Some(delta),
                        error: None,
                    })
                    .map_err(|_| ProviderError::new("cancelled", "The chat window was closed."))?;
            }
        }
    }
    if let Some(delta) = stream_delta(connection.provider, &buffer) {
        let _ = on_event.send(ProviderChatEvent {
            kind: "delta".into(),
            data: Some(delta),
            error: None,
        });
    }
    let _ = on_event.send(ProviderChatEvent {
        kind: "done".into(),
        data: None,
        error: None,
    });
    registry.finish_generation(&input.request_id);
    Ok(())
}

#[tauri::command]
pub async fn provider_cancel_chat(
    input: CancelChatInput,
    registry: State<'_, ProviderRegistry>,
) -> Result<(), ProviderError> {
    input.validate()?;
    registry.cancel_generation(&input.request_id).await
}

#[tauri::command]
pub fn diagnostics_read_logs(
    registry: State<'_, ProviderRegistry>,
) -> Result<String, ProviderError> {
    registry.read_logs()
}

#[tauri::command]
pub fn diagnostics_log_path(registry: State<'_, ProviderRegistry>) -> String {
    registry.log_path()
}

#[cfg(test)]
mod tests {
    use super::stream_delta;
    use crate::providers::model::ProviderKind;

    #[test]
    fn parses_ollama_and_openai_streams() {
        assert_eq!(
            stream_delta(ProviderKind::Ollama, br#"{"message":{"content":"Aegis"}}"#).as_deref(),
            Some("Aegis")
        );
        assert_eq!(
            stream_delta(
                ProviderKind::LmStudio,
                br#"data: {"choices":[{"delta":{"content":" ready"}}]}"#
            )
            .as_deref(),
            Some(" ready")
        );
    }
}
