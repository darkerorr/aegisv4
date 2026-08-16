use crate::providers::error::ProviderError;

const SERVICE: &str = "com.aegis.desktop.providers";

pub trait SecretStore: Send + Sync {
    fn get(&self, secret_ref: &str) -> Result<Option<String>, ProviderError>;
    fn set(&self, secret_ref: &str, value: &str) -> Result<(), ProviderError>;
    fn remove(&self, secret_ref: &str) -> Result<(), ProviderError>;
}

pub struct SystemSecretStore;

impl SystemSecretStore {
    fn entry(secret_ref: &str) -> Result<keyring::Entry, ProviderError> {
        keyring::Entry::new(SERVICE, secret_ref)
            .map_err(|_| ProviderError::storage("The system credential vault is unavailable."))
    }
}

impl SecretStore for SystemSecretStore {
    fn get(&self, secret_ref: &str) -> Result<Option<String>, ProviderError> {
        match Self::entry(secret_ref)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(ProviderError::storage(
                "Aegis could not read the credential from the system vault.",
            )),
        }
    }

    fn set(&self, secret_ref: &str, value: &str) -> Result<(), ProviderError> {
        Self::entry(secret_ref)?
            .set_password(value)
            .map_err(|_| ProviderError::storage("Aegis could not save the credential securely."))
    }

    fn remove(&self, secret_ref: &str) -> Result<(), ProviderError> {
        match Self::entry(secret_ref)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(ProviderError::storage(
                "Aegis could not remove the credential from the system vault.",
            )),
        }
    }
}

#[cfg(test)]
pub struct MemorySecretStore {
    values: std::sync::Mutex<std::collections::HashMap<String, String>>,
}

#[cfg(test)]
impl MemorySecretStore {
    pub fn new() -> Self {
        Self {
            values: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }
}

#[cfg(test)]
impl SecretStore for MemorySecretStore {
    fn get(&self, secret_ref: &str) -> Result<Option<String>, ProviderError> {
        Ok(self.values.lock().unwrap().get(secret_ref).cloned())
    }

    fn set(&self, secret_ref: &str, value: &str) -> Result<(), ProviderError> {
        self.values
            .lock()
            .unwrap()
            .insert(secret_ref.to_string(), value.to_string());
        Ok(())
    }

    fn remove(&self, secret_ref: &str) -> Result<(), ProviderError> {
        self.values.lock().unwrap().remove(secret_ref);
        Ok(())
    }
}
