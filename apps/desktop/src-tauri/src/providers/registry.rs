use crate::providers::{
    error::ProviderError,
    lm_studio::LmStudioAdapter,
    model::{
        ModelDescriptor, ProviderConnection, ProviderHealth, ProviderKind, SaveConnectionInput,
        SaveConnectionResult,
    },
    nvidia::NvidiaAdapter,
    ollama::OllamaAdapter,
    openai_compatible::OpenAiCompatibleAdapter,
    openrouter::OpenRouterAdapter,
    secret_store::{SecretStore, SystemSecretStore},
    xai::XaiAdapter,
    ProviderAdapter,
};
use reqwest::Client;
use std::{
    collections::HashMap,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, RwLock,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

pub struct ProviderRegistry {
    client: Client,
    secret_store: Arc<dyn SecretStore>,
    connections: RwLock<Vec<ProviderConnection>>,
    models: RwLock<HashMap<String, Vec<ModelDescriptor>>>,
    cancellations: Mutex<HashMap<String, Arc<AtomicBool>>>,
    config_path: PathBuf,
    models_path: PathBuf,
    log_path: PathBuf,
}

impl ProviderRegistry {
    pub fn new(config_dir: PathBuf, log_dir: PathBuf) -> Result<Self, ProviderError> {
        fs::create_dir_all(&config_dir).map_err(|_| {
            ProviderError::storage("Aegis could not create its configuration folder.")
        })?;
        fs::create_dir_all(&log_dir).map_err(|_| {
            ProviderError::storage("Aegis could not create its diagnostics folder.")
        })?;
        let config_path = config_dir.join("providers.json");
        let models_path = config_dir.join("provider-models.json");
        let log_path = log_dir.join("aegis-desktop.log");
        let mut connections = Self::read_connections(&config_path)?;
        let models = Self::read_models(&models_path)?;
        Self::ensure_builtin(&mut connections, ProviderKind::Ollama, "ollama-default");
        Self::ensure_builtin(
            &mut connections,
            ProviderKind::LmStudio,
            "lm-studio-default",
        );
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(180))
            .user_agent("Aegis-Desktop/0.3")
            .build()
            .map_err(|_| {
                ProviderError::network(
                    "Aegis could not initialize networking.",
                    "client",
                    std::time::Instant::now(),
                )
            })?;
        let registry = Self {
            client,
            secret_store: Arc::new(SystemSecretStore),
            connections: RwLock::new(connections),
            models: RwLock::new(models),
            cancellations: Mutex::new(HashMap::new()),
            config_path,
            models_path,
            log_path,
        };
        registry.persist()?;
        registry.log("provider registry initialized");
        Ok(registry)
    }

    #[cfg(test)]
    pub fn with_store(
        config_dir: PathBuf,
        store: Arc<dyn SecretStore>,
    ) -> Result<Self, ProviderError> {
        fs::create_dir_all(&config_dir).unwrap();
        let log_dir = config_dir.join("logs");
        fs::create_dir_all(&log_dir).unwrap();
        Ok(Self {
            client: Client::new(),
            secret_store: store,
            connections: RwLock::new(Vec::new()),
            models: RwLock::new(HashMap::new()),
            cancellations: Mutex::new(HashMap::new()),
            config_path: config_dir.join("providers.json"),
            models_path: config_dir.join("provider-models.json"),
            log_path: log_dir.join("aegis-desktop.log"),
        })
    }

    fn read_connections(path: &Path) -> Result<Vec<ProviderConnection>, ProviderError> {
        if !path.exists() {
            return Ok(Vec::new());
        }
        let raw = fs::read_to_string(path)
            .map_err(|_| ProviderError::storage("Aegis could not read provider settings."))?;
        serde_json::from_str(&raw)
            .map_err(|_| ProviderError::storage("Provider settings are damaged or invalid."))
    }

    fn read_models(path: &Path) -> Result<HashMap<String, Vec<ModelDescriptor>>, ProviderError> {
        if !path.exists() {
            return Ok(HashMap::new());
        }
        let raw = fs::read_to_string(path)
            .map_err(|_| ProviderError::storage("Aegis could not read the model cache."))?;
        serde_json::from_str(&raw)
            .map_err(|_| ProviderError::storage("The local model cache is damaged or invalid."))
    }

    fn ensure_builtin(connections: &mut Vec<ProviderConnection>, provider: ProviderKind, id: &str) {
        if connections
            .iter()
            .any(|connection| connection.provider == provider)
        {
            return;
        }
        connections.push(ProviderConnection {
            connection_id: id.into(),
            provider,
            display_name: provider.display_name().into(),
            secret_ref: None,
            enabled: true,
            default_model: None,
            base_url: provider.default_base_url().into(),
        });
    }

    fn persist(&self) -> Result<(), ProviderError> {
        let connections = self
            .connections
            .read()
            .map_err(|_| ProviderError::storage("Provider settings are locked."))?;
        let raw = serde_json::to_vec_pretty(&*connections)
            .map_err(|_| ProviderError::storage("Provider settings could not be encoded."))?;
        let temp_path = self.config_path.with_extension("json.tmp");
        fs::write(&temp_path, raw)
            .map_err(|_| ProviderError::storage("Provider settings could not be saved."))?;
        if self.config_path.exists() {
            fs::remove_file(&self.config_path)
                .map_err(|_| ProviderError::storage("Provider settings could not be replaced."))?;
        }
        fs::rename(temp_path, &self.config_path)
            .map_err(|_| ProviderError::storage("Provider settings could not be finalized."))
    }

    fn persist_models(&self) -> Result<(), ProviderError> {
        let models = self
            .models
            .read()
            .map_err(|_| ProviderError::storage("The model cache is locked."))?;
        let raw = serde_json::to_vec_pretty(&*models)
            .map_err(|_| ProviderError::storage("The model cache could not be encoded."))?;
        fs::write(&self.models_path, raw)
            .map_err(|_| ProviderError::storage("The model cache could not be saved."))
    }

    pub fn log(&self, message: &str) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or_default();
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)
        {
            let _ = writeln!(file, "[{timestamp}] {message}");
        }
    }

    pub fn read_logs(&self) -> Result<String, ProviderError> {
        let content = fs::read_to_string(&self.log_path).unwrap_or_default();
        let lines = content.lines().rev().take(500).collect::<Vec<_>>();
        Ok(lines.into_iter().rev().collect::<Vec<_>>().join("\n"))
    }

    pub fn log_path(&self) -> String {
        self.log_path.to_string_lossy().to_string()
    }

    fn adapter(kind: ProviderKind) -> Arc<dyn ProviderAdapter> {
        match kind {
            ProviderKind::Nvidia => Arc::new(NvidiaAdapter::new()),
            ProviderKind::Openrouter => Arc::new(OpenRouterAdapter::new()),
            ProviderKind::Ollama => Arc::new(OllamaAdapter),
            ProviderKind::LmStudio => Arc::new(LmStudioAdapter::new()),
            ProviderKind::OpenaiCompatible => Arc::new(OpenAiCompatibleAdapter::new(kind)),
            ProviderKind::Xai => Arc::new(XaiAdapter::new()),
        }
    }

    pub fn connections(&self) -> Result<Vec<ProviderConnection>, ProviderError> {
        self.connections
            .read()
            .map(|connections| connections.clone())
            .map_err(|_| ProviderError::storage("Provider settings are locked."))
    }

    pub fn connection(&self, connection_id: &str) -> Result<ProviderConnection, ProviderError> {
        self.connections()?
            .into_iter()
            .find(|connection| connection.connection_id == connection_id)
            .ok_or_else(|| ProviderError::validation("The provider connection does not exist."))
    }

    fn secret(&self, connection: &ProviderConnection) -> Result<Option<String>, ProviderError> {
        match &connection.secret_ref {
            Some(reference) => self.secret_store.get(reference),
            None => Ok(None),
        }
    }

    pub async fn save_connection<F>(
        &self,
        input: SaveConnectionInput,
        mut progress: F,
    ) -> Result<SaveConnectionResult, ProviderError>
    where
        F: FnMut(&str, &str),
    {
        input.validate()?;
        let connection_id = input.connection_id.clone().unwrap_or_else(|| {
            format!(
                "{}-{}",
                input.provider.as_str(),
                &Uuid::new_v4().simple().to_string()[..8]
            )
        });
        progress(&connection_id, "saving-secret");
        let secret_ref = input.provider.needs_secret().then(|| {
            format!(
                "aegis/providers/{}/{}",
                input.provider.as_str(),
                connection_id
            )
        });
        let previous_secret = match &secret_ref {
            Some(reference) => self.secret_store.get(reference)?,
            None => None,
        };
        if let (Some(reference), Some(secret)) = (&secret_ref, input.api_key.as_deref()) {
            self.secret_store.set(reference, secret.trim())?;
        }
        let mut connection = ProviderConnection {
            connection_id: connection_id.clone(),
            provider: input.provider,
            display_name: input
                .display_name
                .unwrap_or_else(|| input.provider.display_name().into()),
            secret_ref: secret_ref.clone(),
            enabled: true,
            default_model: input.default_model,
            base_url: input
                .base_url
                .unwrap_or_else(|| input.provider.default_base_url().into())
                .trim_end_matches('/')
                .to_string(),
        };
        let adapter = Self::adapter(connection.provider);
        debug_assert_eq!(adapter.kind(), connection.provider);
        let secret = input.api_key.as_deref().map(str::trim);
        let operation = async {
            progress(&connection_id, "testing");
            let mut health = adapter
                .test_connection(&self.client, &connection, secret)
                .await?;
            progress(&connection_id, "discovering-models");
            let models = adapter
                .list_models(&self.client, &connection, secret)
                .await?;
            if models.is_empty() {
                return Err(ProviderError::new(
                    "no-models",
                    "No models are available for this account.",
                ));
            }
            if connection.default_model.is_none() {
                connection.default_model = models
                    .iter()
                    .find(|model| model.recommended)
                    .or_else(|| models.first())
                    .map(|model| model.name.clone());
            }
            health.model_count = models.len();
            Ok::<_, ProviderError>((health, models))
        }
        .await;
        let (health, models) = match operation {
            Ok(result) => result,
            Err(error) => {
                if let Some(reference) = &secret_ref {
                    if let Some(previous) = previous_secret {
                        let _ = self.secret_store.set(reference, &previous);
                    } else {
                        let _ = self.secret_store.remove(reference);
                    }
                }
                self.log(&format!(
                    "connection {} failed: {}",
                    connection_id, error.category
                ));
                return Err(error);
            }
        };
        {
            let mut connections = self
                .connections
                .write()
                .map_err(|_| ProviderError::storage("Provider settings are locked."))?;
            connections.retain(|item| item.connection_id != connection.connection_id);
            connections.push(connection.clone());
        }
        if let Err(error) = self.persist() {
            if let Some(reference) = &secret_ref {
                let _ = self.secret_store.remove(reference);
            }
            return Err(error);
        }
        self.models
            .write()
            .map_err(|_| ProviderError::storage("The model cache is locked."))?
            .insert(connection_id.clone(), models.clone());
        self.persist_models()?;
        self.log(&format!(
            "connection {} saved with {} models",
            connection_id,
            models.len()
        ));
        progress(&connection_id, "connected");
        Ok(SaveConnectionResult {
            connection,
            health,
            models,
        })
    }

    pub async fn test_connection(
        &self,
        connection_id: &str,
    ) -> Result<ProviderHealth, ProviderError> {
        let connection = self.connection(connection_id)?;
        let secret = self.secret(&connection)?;
        let result = Self::adapter(connection.provider)
            .test_connection(&self.client, &connection, secret.as_deref())
            .await;
        match &result {
            Ok(health) => self.log(&format!(
                "connection {} ready in {} ms",
                connection_id, health.latency_ms
            )),
            Err(error) => self.log(&format!(
                "connection {} test failed: {}",
                connection_id, error.category
            )),
        }
        result
    }

    pub async fn refresh_models(
        &self,
        connection_id: &str,
    ) -> Result<Vec<ModelDescriptor>, ProviderError> {
        let connection = self.connection(connection_id)?;
        let secret = self.secret(&connection)?;
        let models = Self::adapter(connection.provider)
            .list_models(&self.client, &connection, secret.as_deref())
            .await?;
        self.models
            .write()
            .map_err(|_| ProviderError::storage("The model cache is locked."))?
            .insert(connection_id.to_string(), models.clone());
        self.persist_models()?;
        self.log(&format!(
            "connection {} refreshed {} models",
            connection_id,
            models.len()
        ));
        Ok(models)
    }

    pub fn list_models(
        &self,
        connection_id: Option<&str>,
    ) -> Result<Vec<ModelDescriptor>, ProviderError> {
        let cache = self
            .models
            .read()
            .map_err(|_| ProviderError::storage("The model cache is locked."))?;
        Ok(match connection_id {
            Some(connection_id) => cache.get(connection_id).cloned().unwrap_or_default(),
            None => cache.values().flatten().cloned().collect(),
        })
    }

    pub fn remove_connection(&self, connection_id: &str) -> Result<(), ProviderError> {
        let connection = self.connection(connection_id)?;
        if connection.provider.is_local() {
            return Err(ProviderError::validation(
                "Built-in local providers cannot be removed.",
            ));
        }
        if let Some(reference) = &connection.secret_ref {
            self.secret_store.remove(reference)?;
        }
        self.connections
            .write()
            .map_err(|_| ProviderError::storage("Provider settings are locked."))?
            .retain(|item| item.connection_id != connection_id);
        self.models
            .write()
            .map_err(|_| ProviderError::storage("The model cache is locked."))?
            .remove(connection_id);
        self.persist()?;
        self.persist_models()?;
        self.log(&format!(
            "connection {} and its credential were removed",
            connection_id
        ));
        Ok(())
    }

    pub fn begin_generation(&self, request_id: &str) -> Result<Arc<AtomicBool>, ProviderError> {
        let flag = Arc::new(AtomicBool::new(false));
        self.cancellations
            .lock()
            .map_err(|_| ProviderError::new("provider-error", "Generation state is unavailable."))?
            .insert(request_id.to_string(), flag.clone());
        Ok(flag)
    }

    pub async fn cancel_generation(&self, request_id: &str) -> Result<(), ProviderError> {
        if let Some(flag) = self
            .cancellations
            .lock()
            .map_err(|_| ProviderError::new("provider-error", "Generation state is unavailable."))?
            .get(request_id)
        {
            flag.store(true, Ordering::SeqCst);
        }
        for kind in [
            ProviderKind::Nvidia,
            ProviderKind::Openrouter,
            ProviderKind::Ollama,
            ProviderKind::LmStudio,
            ProviderKind::OpenaiCompatible,
            ProviderKind::Xai,
        ] {
            Self::adapter(kind).cancel_generation(request_id).await?;
        }
        self.log(&format!("generation {} cancelled", request_id));
        Ok(())
    }

    pub fn finish_generation(&self, request_id: &str) {
        if let Ok(mut cancellations) = self.cancellations.lock() {
            cancellations.remove(request_id);
        }
    }

    pub async fn chat_response(
        &self,
        connection: &ProviderConnection,
        model: &str,
        messages: &[crate::providers::model::ChatMessage],
    ) -> Result<reqwest::Response, ProviderError> {
        let secret = self.secret(connection)?;
        Self::adapter(connection.provider)
            .stream_chat(&self.client, connection, secret.as_deref(), model, messages)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::secret_store::{MemorySecretStore, SecretStore};

    #[test]
    fn serialized_settings_never_contain_the_secret() {
        let known_secret = "nvapi-test-secret-that-must-never-be-written";
        let connection = ProviderConnection {
            connection_id: "nvidia-default".into(),
            provider: ProviderKind::Nvidia,
            display_name: "NVIDIA".into(),
            secret_ref: Some("aegis/providers/nvidia/nvidia-default".into()),
            enabled: true,
            default_model: Some("test/model".into()),
            base_url: ProviderKind::Nvidia.default_base_url().into(),
        };
        let serialized = serde_json::to_string(&connection).unwrap();
        assert!(!serialized.contains(known_secret));
        assert!(serialized.contains("secretRef"));
    }

    #[test]
    fn known_secret_is_absent_from_every_local_configuration_file() {
        let directory =
            std::env::temp_dir().join(format!("aegis-provider-test-{}", Uuid::new_v4()));
        let store = Arc::new(MemorySecretStore::new());
        let registry = ProviderRegistry::with_store(directory.clone(), store.clone()).unwrap();
        let known_secret = "nvapi-known-secret-file-leak-test";
        let secret_ref = "aegis/providers/nvidia/nvidia-default";
        store.set(secret_ref, known_secret).unwrap();
        registry
            .connections
            .write()
            .unwrap()
            .push(ProviderConnection {
                connection_id: "nvidia-default".into(),
                provider: ProviderKind::Nvidia,
                display_name: "NVIDIA".into(),
                secret_ref: Some(secret_ref.into()),
                enabled: true,
                default_model: Some("test/model".into()),
                base_url: ProviderKind::Nvidia.default_base_url().into(),
            });
        registry.persist().unwrap();
        registry.persist_models().unwrap();
        for entry in fs::read_dir(&directory).unwrap().flatten() {
            if entry.path().is_file() {
                let raw = fs::read_to_string(entry.path()).unwrap_or_default();
                assert!(!raw.contains(known_secret));
            }
        }
        registry.remove_connection("nvidia-default").unwrap();
        assert_eq!(store.get(secret_ref).unwrap(), None);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn removing_a_secret_really_deletes_its_reference() {
        let store = MemorySecretStore::new();
        store
            .set("aegis/providers/nvidia/default", "known-secret")
            .unwrap();
        assert_eq!(
            store
                .get("aegis/providers/nvidia/default")
                .unwrap()
                .as_deref(),
            Some("known-secret")
        );
        store.remove("aegis/providers/nvidia/default").unwrap();
        assert_eq!(store.get("aegis/providers/nvidia/default").unwrap(), None);
    }
}
