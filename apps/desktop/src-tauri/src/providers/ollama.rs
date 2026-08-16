use crate::providers::{
    error::ProviderError,
    model::{ChatMessage, ModelDescriptor, ProviderConnection, ProviderHealth, ProviderKind},
    ProviderAdapter,
};
use async_trait::async_trait;
use reqwest::{Client, Response};
use serde_json::{json, Value};
use std::time::Instant;

pub struct OllamaAdapter;

impl OllamaAdapter {
    fn endpoint(connection: &ProviderConnection, path: &str) -> String {
        format!("{}{}", connection.base_url.trim_end_matches('/'), path)
    }
}

#[async_trait]
impl ProviderAdapter for OllamaAdapter {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Ollama
    }

    async fn test_connection(
        &self,
        client: &Client,
        connection: &ProviderConnection,
        secret: Option<&str>,
    ) -> Result<ProviderHealth, ProviderError> {
        let started = Instant::now();
        let models = self.list_models(client, connection, secret).await?;
        Ok(ProviderHealth {
            connection_id: connection.connection_id.clone(),
            status: "ready".into(),
            latency_ms: started.elapsed().as_millis() as u64,
            model_count: models.len(),
        })
    }

    async fn list_models(
        &self,
        client: &Client,
        connection: &ProviderConnection,
        _secret: Option<&str>,
    ) -> Result<Vec<ModelDescriptor>, ProviderError> {
        let endpoint = Self::endpoint(connection, "/api/tags");
        let started = Instant::now();
        let response = client
            .get(&endpoint)
            .send()
            .await
            .map_err(|error| ProviderError::from_reqwest(error, "ollama.models", started))?;
        if !response.status().is_success() {
            return Err(ProviderError::http(
                response.status().as_u16(),
                None,
                "ollama.models",
                started,
            ));
        }
        let payload = response.json::<Value>().await.map_err(|_| {
            ProviderError::new("provider-error", "Ollama returned an invalid model list.")
                .with_endpoint("ollama.models")
        })?;
        let mut models = payload
            .get("models")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|item| {
                let name = item
                    .get("name")
                    .or_else(|| item.get("model"))?
                    .as_str()?
                    .to_string();
                let lower = name.to_ascii_lowercase();
                let mut capabilities = vec!["chat".to_string()];
                if lower.contains("code") || lower.contains("coder") {
                    capabilities.push("coding".into());
                }
                if lower.contains("reason") || lower.contains("deepseek-r1") {
                    capabilities.push("reasoning".into());
                }
                if lower.contains("vision") || lower.contains("llava") || lower.contains("-vl") {
                    capabilities.push("vision".into());
                }
                Some(ModelDescriptor {
                    id: format!("{}:{}", connection.connection_id, name),
                    connection_id: connection.connection_id.clone(),
                    provider: ProviderKind::Ollama,
                    provider_name: connection.display_name.clone(),
                    name,
                    description: item
                        .get("details")
                        .map(Value::to_string)
                        .unwrap_or_else(|| "Installed on this device".into()),
                    location: "local".into(),
                    capabilities,
                    context_length: None,
                    pricing: None,
                    available: true,
                    recommended: false,
                })
            })
            .collect::<Vec<_>>();
        models.sort_by(|left, right| left.name.cmp(&right.name));
        if let Some(first) = models.first_mut() {
            first.recommended = true;
        }
        Ok(models)
    }

    async fn stream_chat(
        &self,
        client: &Client,
        connection: &ProviderConnection,
        _secret: Option<&str>,
        model: &str,
        messages: &[ChatMessage],
    ) -> Result<Response, ProviderError> {
        let endpoint = Self::endpoint(connection, "/api/chat");
        let started = Instant::now();
        let response = client
            .post(&endpoint)
            .json(&json!({ "model": model, "messages": messages, "stream": true }))
            .send()
            .await
            .map_err(|error| ProviderError::from_reqwest(error, "ollama.chat", started))?;
        if response.status().is_success() {
            Ok(response)
        } else {
            Err(ProviderError::http(
                response.status().as_u16(),
                None,
                "ollama.chat",
                started,
            ))
        }
    }
}
