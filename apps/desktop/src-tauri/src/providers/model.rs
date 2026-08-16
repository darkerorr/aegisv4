use crate::providers::error::ProviderError;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderKind {
    Nvidia,
    Openrouter,
    Ollama,
    LmStudio,
    OpenaiCompatible,
    Xai,
}

impl ProviderKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Nvidia => "nvidia",
            Self::Openrouter => "openrouter",
            Self::Ollama => "ollama",
            Self::LmStudio => "lm-studio",
            Self::OpenaiCompatible => "openai-compatible",
            Self::Xai => "xai",
        }
    }

    pub fn display_name(self) -> &'static str {
        match self {
            Self::Nvidia => "NVIDIA",
            Self::Openrouter => "OpenRouter",
            Self::Ollama => "Ollama",
            Self::LmStudio => "LM Studio",
            Self::OpenaiCompatible => "OpenAI-compatible",
            Self::Xai => "xAI",
        }
    }

    pub fn is_local(self) -> bool {
        matches!(self, Self::Ollama | Self::LmStudio)
    }

    pub fn needs_secret(self) -> bool {
        matches!(
            self,
            Self::Nvidia | Self::Openrouter | Self::OpenaiCompatible | Self::Xai
        )
    }

    pub fn default_base_url(self) -> &'static str {
        match self {
            Self::Nvidia => "https://integrate.api.nvidia.com/v1",
            Self::Openrouter => "https://openrouter.ai/api/v1",
            Self::Ollama => "http://127.0.0.1:11434",
            Self::LmStudio => "http://127.0.0.1:1234/v1",
            Self::OpenaiCompatible => "https://api.openai.com/v1",
            Self::Xai => "https://api.x.ai/v1",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProviderConnection {
    pub connection_id: String,
    pub provider: ProviderKind,
    pub display_name: String,
    pub secret_ref: Option<String>,
    pub enabled: bool,
    pub default_model: Option<String>,
    pub base_url: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveConnectionInput {
    pub connection_id: Option<String>,
    pub provider: ProviderKind,
    pub display_name: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub default_model: Option<String>,
}

impl SaveConnectionInput {
    pub fn validate(&self) -> Result<(), ProviderError> {
        if let Some(id) = &self.connection_id {
            validate_connection_id(id)?;
        }
        if let Some(name) = &self.display_name {
            if name.trim().is_empty() || name.chars().count() > 80 {
                return Err(ProviderError::validation("The connection name is invalid."));
            }
        }
        if self.provider.needs_secret() {
            let secret = self
                .api_key
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| ProviderError::validation("An API key is required."))?;
            if secret.len() < 8 || secret.len() > 2048 || secret.chars().any(char::is_control) {
                return Err(ProviderError::validation("The API key format is invalid."));
            }
        }
        validate_base_url(
            self.provider,
            self.base_url
                .as_deref()
                .unwrap_or(self.provider.default_base_url()),
        )
    }
}

pub fn validate_connection_id(value: &str) -> Result<(), ProviderError> {
    if value.len() < 3
        || value.len() > 64
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err(ProviderError::validation(
            "The connection identifier is invalid.",
        ));
    }
    Ok(())
}

fn validate_base_url(provider: ProviderKind, value: &str) -> Result<(), ProviderError> {
    if value.len() > 512 || value.contains(['\r', '\n']) {
        return Err(ProviderError::validation(
            "The provider address is invalid.",
        ));
    }
    let lower = value.to_ascii_lowercase();
    if provider.is_local() {
        if !(lower.starts_with("http://127.0.0.1")
            || lower.starts_with("http://localhost")
            || lower.starts_with("http://[::1]"))
        {
            return Err(ProviderError::validation(
                "Local providers must use a loopback address.",
            ));
        }
    } else if !lower.starts_with("https://") {
        return Err(ProviderError::validation(
            "Online providers must use an HTTPS address.",
        ));
    }
    Ok(())
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderHealth {
    pub connection_id: String,
    pub status: String,
    pub latency_ms: u64,
    pub model_count: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelPricing {
    pub prompt: Option<String>,
    pub completion: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDescriptor {
    pub id: String,
    pub connection_id: String,
    pub provider: ProviderKind,
    pub provider_name: String,
    pub name: String,
    pub description: String,
    pub location: String,
    pub capabilities: Vec<String>,
    pub context_length: Option<u64>,
    pub pricing: Option<ModelPricing>,
    pub available: bool,
    pub recommended: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

impl ChatMessage {
    pub fn validate(&self) -> Result<(), ProviderError> {
        if !matches!(self.role.as_str(), "system" | "user" | "assistant") {
            return Err(ProviderError::validation("A chat message role is invalid."));
        }
        if self.content.len() > 2_000_000 {
            return Err(ProviderError::validation("A chat message is too large."));
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StartChatInput {
    pub request_id: String,
    pub connection_id: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
}

impl StartChatInput {
    pub fn validate(&self) -> Result<(), ProviderError> {
        validate_connection_id(&self.connection_id)?;
        if self.request_id.len() < 8 || self.request_id.len() > 128 {
            return Err(ProviderError::validation(
                "The request identifier is invalid.",
            ));
        }
        if self.model.trim().is_empty() || self.model.len() > 512 {
            return Err(ProviderError::validation("A valid model is required."));
        }
        if self.messages.is_empty() || self.messages.len() > 512 {
            return Err(ProviderError::validation(
                "The chat message list is invalid.",
            ));
        }
        for message in &self.messages {
            message.validate()?;
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderChatEvent {
    pub kind: String,
    pub data: Option<String>,
    pub error: Option<ProviderError>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveConnectionResult {
    pub connection: ProviderConnection,
    pub health: ProviderHealth,
    pub models: Vec<ModelDescriptor>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProgress {
    pub connection_id: String,
    pub state: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConnectionIdInput {
    pub connection_id: String,
}

impl ConnectionIdInput {
    pub fn validate(&self) -> Result<(), ProviderError> {
        validate_connection_id(&self.connection_id)
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ListModelsInput {
    pub connection_id: Option<String>,
}

impl ListModelsInput {
    pub fn validate(&self) -> Result<(), ProviderError> {
        if let Some(connection_id) = &self.connection_id {
            validate_connection_id(connection_id)?;
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CancelChatInput {
    pub request_id: String,
}

impl CancelChatInput {
    pub fn validate(&self) -> Result<(), ProviderError> {
        if self.request_id.len() < 8 || self.request_id.len() > 128 {
            return Err(ProviderError::validation(
                "The request identifier is invalid.",
            ));
        }
        Ok(())
    }
}
