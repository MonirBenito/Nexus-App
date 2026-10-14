/* ====================================================================
   CONFIGURAZIONE - compila questi valori prima di pubblicare
   ==================================================================== */
window.NX_CONFIG = {
  // Da Supabase: Project Settings > API
  SUPABASE_URL: "INSERISCI_QUI_L_URL_DEL_PROGETTO",      // es. https://abcdxyz.supabase.co
  SUPABASE_ANON_KEY: "INSERISCI_QUI_LA_CHIAVE_ANON",     // la chiave "anon public" (NON la service_role!)
  STORAGE_BUCKET: "media",

  // Accesso Master. ATTENZIONE: questi valori sono visibili a chiunque apra il sito.
  // Cambiali subito, ma sappi che restano un prototipo (vedi README, sezione Sicurezza).
  MASTER_EMAIL: "master@nexus.io",
  MASTER_PASSWORD: "master123"
};
