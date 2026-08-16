use serde::Serialize;
use std::{error::Error, fmt, time::Instant};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderError {
    pub category: String,
    pub message: String,
    pub status: Option<u16>,
    pub request_id: Option<String>,
    pub endpoint: Option<String>,
    pub duration_ms: Option<u64>,
}

impl ProviderError {
    pub fn new(category: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            category: category.into(),
            message: message.into(),
            status: None,
            request_id: None,
            endpoint: None,
            duration_ms: None,
        }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new("validation", message)
    }

    pub fn storage(message: impl Into<String>) -> Self {
        Self::new("storage", message)
    }

    pub fn network(
        message: impl Into<String>,
        endpoint: impl Into<String>,
        started: Instant,
    ) -> Self {
        Self::new("network-error", message)
            .with_endpoint(endpoint)
            .with_duration(started.elapsed().as_millis() as u64)
    }

    pub fn from_reqwest(
        error: reqwest::Error,
        endpoint: impl Into<String>,
        started: Instant,
    ) -> Self {
        let category = if error.is_timeout() {
            "timeout"
        } else {
            "network-error"
        };
        let message = if error.is_timeout() {
            "The request timed out."
        } else {
            "The provider could not be reached."
        };
        Self::new(category, message)
            .with_endpoint(endpoint)
            .with_duration(started.elapsed().as_millis() as u64)
    }

    pub fn http(
        status: u16,
        request_id: Option<String>,
        endpoint: impl Into<String>,
        started: Instant,
    ) -> Self {
        let (category, message) = match status {
            401 | 403 => ("invalid-key", "The API key was rejected."),
            408 | 504 => ("timeout", "The request timed out."),
            429 => ("provider-error", "The provider rate limit was reached."),
            _ => (
                "provider-error",
                "The provider returned an unexpected response.",
            ),
        };
        Self::new(category, message)
            .with_status(status)
            .with_request_id(request_id)
            .with_endpoint(endpoint)
            .with_duration(started.elapsed().as_millis() as u64)
    }

    pub fn with_status(mut self, status: u16) -> Self {
        self.status = Some(status);
        self
    }

    pub fn with_request_id(mut self, request_id: Option<String>) -> Self {
        self.request_id = request_id;
        self
    }

    pub fn with_endpoint(mut self, endpoint: impl Into<String>) -> Self {
        self.endpoint = Some(endpoint.into());
        self
    }

    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }
}

impl fmt::Display for ProviderError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.message)
    }
}

impl Error for ProviderError {}
