use crate::providers::{
    error::ProviderError,
    model::{ChatMessage, ModelDescriptor, ProviderConnection, ProviderHealth, ProviderKind},
    openai_compatible::OpenAiCompatibleAdapter,
    ProviderAdapter,
};
use async_trait::async_trait;
use reqwest::{Client, Response};

pub struct OpenRouterAdapter(OpenAiCompatibleAdapter);

impl OpenRouterAdapter {
    pub fn new() -> Self {
        Self(OpenAiCompatibleAdapter::new(ProviderKind::Openrouter))
    }
}

#[async_trait]
impl ProviderAdapter for OpenRouterAdapter {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Openrouter
    }

    async fn test_connection(
        &self,
        client: &Client,
        connection: &ProviderConnection,
        secret: Option<&str>,
    ) -> Result<ProviderHealth, ProviderError> {
        self.0.test_connection(client, connection, secret).await
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
