/* ====================================================================
   CONFIGURAZIONE - compila questi valori prima di pubblicare
   ==================================================================== */
window.NX_CONFIG = {
  // Da Supabase: Project Settings > API
  SUPABASE_URL: "https://bkeluugcngfynmdnmsbr.supabase.co",      // es. https://abcdxyz.supabase.co
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZWx1dWdjbmdmeW5tZG5tc2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTAzNTcsImV4cCI6MjEwNzU2NjM1N30.n0WXylMbNKN6Efiot7ZZX3TXUgpa5LZ264t80aI2R7c",     // la chiave "anon public" (NON la service_role!)
  STORAGE_BUCKET: "media",

  // Accesso Master. ATTENZIONE: questi valori sono visibili a chiunque apra il sito.
  // Cambiali subito, ma sappi che restano un prototipo (vedi README, sezione Sicurezza).
  MASTER_EMAIL: "master@nexus.io",
  MASTER_PASSWORD: "master123"
};
