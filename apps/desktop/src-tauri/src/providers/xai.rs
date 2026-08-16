use crate::providers::{
    error::ProviderError,
    model::{ChatMessage, ModelDescriptor, ProviderConnection, ProviderHealth, ProviderKind},
    openai_compatible::OpenAiCompatibleAdapter,
    ProviderAdapter,
};
use async_trait::async_trait;
use reqwest::{Client, Response};

pub struct XaiAdapter(OpenAiCompatibleAdapter);

impl XaiAdapter {
    pub fn new() -> Self {
        Self(OpenAiCompatibleAdapter::new(ProviderKind::Xai))
    }
}

#[async_trait]
impl ProviderAdapter for XaiAdapter {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Xai
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
