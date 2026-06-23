use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use keyring::Entry;
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;
use std::collections::HashMap;

const SERVICE_NAME: &str = "smart-assistant-credentials";

#[tauri::command]
pub fn save_secure_api_key(provider: String, key: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &provider).map_err(|e| e.to_string())?;
    entry.set_password(&key).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_secure_api_key(provider: String) -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, &provider).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pass) => Ok(pass),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_secure_api_key(provider: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &provider).map_err(|e| e.to_string())?;
    if entry.get_password().is_ok() {
        entry.delete_password().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn load_all_secure_api_keys() -> Result<HashMap<String, String>, String> {
    let providers = vec![
        "Gemini",
        "Groq",
        "OpenAI",
        "Anthropic",
        "DeepSeek",
        "Mistral",
        "OpenRouter",
        "xAI",
    ];
    let mut map = HashMap::new();
    for p in providers {
        if let Ok(key) = load_secure_api_key(p.to_string()) {
            if !key.is_empty() {
                map.insert(p.to_string(), key);
            }
        }
    }
    Ok(map)
}

#[tauri::command]
pub fn export_settings_backup(payload: String, password: String) -> Result<String, String> {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);

    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, 100_000, &mut key);

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, payload.as_bytes())
        .map_err(|e| e.to_string())?;

    let mut backup_bytes = Vec::with_capacity(salt.len() + nonce_bytes.len() + ciphertext.len());
    backup_bytes.extend_from_slice(&salt);
    backup_bytes.extend_from_slice(&nonce_bytes);
    backup_bytes.extend_from_slice(&ciphertext);

    let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, backup_bytes);
    Ok(encoded)
}

#[tauri::command]
pub fn import_settings_backup(encrypted_data: String, password: String) -> Result<String, String> {
    let backup_bytes =
        base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encrypted_data)
            .map_err(|e| e.to_string())?;

    if backup_bytes.len() < 28 {
        return Err("بيانات النسخة الاحتياطية تالفة أو غير صالحة".to_string());
    }

    let salt = &backup_bytes[0..16];
    let nonce_bytes = &backup_bytes[16..28];
    let ciphertext = &backup_bytes[28..];

    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 100_000, &mut key);

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);

    let decrypted_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "كلمة المرور غير صحيحة أو البيانات تالفة".to_string())?;

    let payload = String::from_utf8(decrypted_bytes)
        .map_err(|e| format!("فشل قراءة محتوى النسخة الاحتياطية: {}", e))?;

    Ok(payload)
}
