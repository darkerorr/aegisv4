use crate::providers::{
    error::ProviderError,
    model::{
        ChatMessage, ModelDescriptor, ModelPricing, ProviderConnection, ProviderHealth,
        ProviderKind,
    },
    ProviderAdapter,
};
use async_trait::async_trait;
use reqwest::{Client, RequestBuilder, Response};
use serde_json::{json, Value};
use std::time::Instant;

#[derive(Clone)]
pub struct OpenAiCompatibleAdapter {
    kind: ProviderKind,
}

impl OpenAiCompatibleAdapter {
    pub fn new(kind: ProviderKind) -> Self {
        Self { kind }
    }

    fn endpoint(connection: &ProviderConnection, path: &str) -> String {
        format!("{}{}", connection.base_url.trim_end_matches('/'), path)
    }

    fn authorize(&self, request: RequestBuilder, secret: Option<&str>) -> RequestBuilder {
        let request = if let Some(secret) = secret {
            request.bearer_auth(secret)
        } else {
            request
        };
        if self.kind == ProviderKind::Openrouter {
            request
                .header("HTTP-Referer", "https://aegis.local")
                .header("X-Title", "Aegis Desktop")
        } else {
            request
        }
    }

    async fn checked_response(
        &self,
        request: RequestBuilder,
        endpoint: &str,
        started: Instant,
    ) -> Result<Response, ProviderError> {
        let response = request
            .send()
            .await
            .map_err(|error| ProviderError::from_reqwest(error, endpoint, started))?;
        if response.status().is_success() {
            return Ok(response);
        }
        let request_id = response
            .headers()
            .get("x-request-id")
            .or_else(|| response.headers().get("request-id"))
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned);
        Err(ProviderError::http(
            response.status().as_u16(),
            request_id,
            endpoint,
            started,
        ))
    }

    fn capabilities(model_name: &str, payload: &Value) -> Vec<String> {
        let lower = model_name.to_ascii_lowercase();
        let mut capabilities = vec!["chat".to_string()];
        if lower.contains("code") || lower.contains("coder") {
            capabilities.push("coding".to_string());
        }
        if lower.contains("reason") || lower.contains("deepseek-r1") || lower.contains("o1") {
            capabilities.push("reasoning".to_string());
        }
        let modality_text = payload
            .get("architecture")
            .or_else(|| payload.get("modalities"))
            .map(Value::to_string)
            .unwrap_or_default()
            .to_ascii_lowercase();
        if lower.contains("vision") || lower.contains("vl") || modality_text.contains("image") {
            capabilities.push("vision".to_string());
        }
        if payload
            .get("supported_parameters")
            .map(Value::to_string)
            .unwrap_or_default()
            .contains("tools")
        {
            capabilities.push("tools".to_string());
        }
        capabilities
    }

    fn parse_models(
        &self,
        connection: &ProviderConnection,
        payload: Value,
    ) -> Result<Vec<ModelDescriptor>, ProviderError> {
        let entries = payload
            .get("data")
            .and_then(Value::as_array)
            .or_else(|| payload.as_array())
            .ok_or_else(|| {
                ProviderError::new(
                    "provider-error",
                    "The provider returned an unexpected model list.",
                )
            })?;
        let mut models = entries
            .iter()
            .filter_map(|item| {
                let name = item
                    .get("id")
                    .or_else(|| item.get("name"))?
                    .as_str()?
                    .to_string();
                let description = item
                    .get("description")
                    .and_then(Value::as_str)
                    .unwrap_or("Available through this provider")
                    .to_string();
                let context_length = item
                    .get("context_length")
                    .or_else(|| item.get("contextLength"))
                    .and_then(Value::as_u64);
                let pricing = item.get("pricing").map(|pricing| ModelPricing {
                    prompt: pricing
                        .get("prompt")
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                    completion: pricing
                        .get("completion")
                        .and_then(Value::as_str)
                        .map(str::to_owned),
                });
                Some(ModelDescriptor {
                    id: format!("{}:{}", connection.connection_id, name),
                    connection_id: connection.connection_id.clone(),
                    provider: connection.provider,
                    provider_name: connection.display_name.clone(),
                    capabilities: Self::capabilities(&name, item),
                    name,
                    description,
                    location: if connection.provider.is_local() {
                        "local"
                    } else {
                        "online"
                    }
                    .into(),
                    context_length,
                    pricing,
                    available: true,
                    recommended: false,
                })
            })
            .collect::<Vec<_>>();
        models.sort_by(|left, right| left.name.cmp(&right.name));
        let recommended_index = models
            .iter()
            .position(|model| {
                let lower = model.name.to_ascii_lowercase();
                lower.contains("llama") || lower.contains("qwen") || lower.contains("deepseek")
            })
            .or_else(|| (!models.is_empty()).then_some(0));
        if let Some(model) = recommended_index.and_then(|index| models.get_mut(index)) {
            model.recommended = true;
        }
        Ok(models)
    }
}

#[async_trait]
impl ProviderAdapter for OpenAiCompatibleAdapter {
    fn kind(&self) -> ProviderKind {
        self.kind
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
        secret: Option<&str>,
    ) -> Result<Vec<ModelDescriptor>, ProviderError> {
        let endpoint = Self::endpoint(connection, "/models");
        let started = Instant::now();
        let request = self.authorize(client.get(&endpoint), secret);
        let response = self.checked_response(request, &endpoint, started).await?;
        let payload = response.json::<Value>().await.map_err(|_| {
            ProviderError::new(
                "provider-error",
                "The provider returned invalid model data.",
            )
            .with_endpoint("models")
            .with_duration(started.elapsed().as_millis() as u64)
        })?;
        self.parse_models(connection, payload)
    }

    async fn stream_chat(
        &self,
        client: &Client,
        connection: &ProviderConnection,
        secret: Option<&str>,
        model: &str,
        messages: &[ChatMessage],
    ) -> Result<Response, ProviderError> {
        let endpoint = Self::endpoint(connection, "/chat/completions");
        let started = Instant::now();
        let request = self.authorize(
            client.post(&endpoint).json(&json!({
                "model": model,
                "messages": messages,
                "stream": true
            })),
            secret,
        );
        self.checked_response(request, &endpoint, started).await
    }
}
