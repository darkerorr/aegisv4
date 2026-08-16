use crate::providers::{
    error::ProviderError,
    model::{ChatMessage, ModelDescriptor, ProviderConnection, ProviderHealth, ProviderKind},
    openai_compatible::OpenAiCompatibleAdapter,
    ProviderAdapter,
};
use async_trait::async_trait;
use reqwest::{Client, Response};
use serde_json::json;
use std::time::Instant;

pub struct NvidiaAdapter(OpenAiCompatibleAdapter);

impl NvidiaAdapter {
    pub fn new() -> Self {
        Self(OpenAiCompatibleAdapter::new(ProviderKind::Nvidia))
    }
}

#[async_trait]
impl ProviderAdapter for NvidiaAdapter {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Nvidia
    }

    async fn test_connection(
        &self,
        client: &Client,
        connection: &ProviderConnection,
        secret: Option<&str>,
    ) -> Result<ProviderHealth, ProviderError> {
        let secret = secret
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| ProviderError::new("invalid-key", "The NVIDIA API key was rejected."))?;
        let started = Instant::now();
        // NVIDIA's model catalogue is currently public and returns 200 even for an
        // invalid bearer token. A tiny chat request is therefore required to prove
        // that the credential itself is accepted before persisting the connection.
        let models = self.0.list_models(client, connection, Some(secret)).await?;
        let probe_model = models
            .iter()
            .find(|model| {
                let name = model.name.to_ascii_lowercase();
                (name.contains("instruct") || name.contains("chat") || name.contains("llama"))
                    && !name.contains("embed")
                    && !name.contains("rerank")
                    && !name.contains("bge-")
            })
            .or_else(|| models.first())
            .ok_or_else(|| {
                ProviderError::new("no-models", "No models are available for this account.")
            })?;
        let endpoint = format!(
            "{}/chat/completions",
            connection.base_url.trim_end_matches('/')
        );
        let response = client
            .post(&endpoint)
            .bearer_auth(secret)
            .json(&json!({
                "model": probe_model.name,
                "messages": [{ "role": "user", "content": "ping" }],
                "max_tokens": 1,
                "stream": false
            }))
            .send()
            .await
            .map_err(|error| {
                ProviderError::from_reqwest(error, "chat authentication probe", started)
            })?;
        if !response.status().is_success() {
            let status = response.status().as_u16();
            let request_id = response
                .headers()
                .get("x-request-id")
                .or_else(|| response.headers().get("request-id"))
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            if matches!(status, 401 | 403) {
                return Err(
                    ProviderError::new("invalid-key", "The NVIDIA API key was rejected.")
                        .with_status(status)
                        .with_request_id(request_id)
                        .with_endpoint("chat authentication probe")
                        .with_duration(started.elapsed().as_millis() as u64),
                );
            }
            return Err(ProviderError::http(
                status,
                request_id,
                "chat authentication probe",
                started,
            ));
        }
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
        secret: Option<&str>,
    ) -> Result<Vec<ModelDescriptor>, ProviderError> {
        self.0.list_models(client, connection, secret).await
    }

    async fn stream_chat(
        &self,
        client: &Client,
        connection: &ProviderConnection,
        secret: Option<&str>,
        model: &str,
        messages: &[ChatMessage],
    ) -> Result<Response, ProviderError> {
        self.0
            .stream_chat(client, connection, secret, model, messages)
            .await
    }
}
