/**
 * Configuración de Biblioteca Digital UNER (TUDW)
 * ------------------------------------------------
 * Para activar la sincronización 100% automática con Google Drive:
 * 1) Abre https://script.google.com y pega el contenido de apps-script/Code.gs
 * 2) Implementa como Aplicación Web (Ejecutar como: Yo | Acceso: Cualquier persona)
 * 3) Pega la URL obtenida en APPS_SCRIPT_URL y haz commit/push.
 *
 * Desde ese momento, cada libro que subas a las carpetas de Drive aparecerá
 * automáticamente en la web sin volver a tocar el repositorio.
 */
window.BIBLIOTECA_CONFIG = {
  DRIVE_ROOT_FOLDER_ID: "18nwSi3XYcgd9TXWOoPEohFmeK6RledF7",
  DRIVE_ROOT_URL: "https://drive.google.com/drive/folders/18nwSi3XYcgd9TXWOoPEohFmeK6RledF7",
  // Pega aquí tu URL de Google Apps Script (ej: "https://script.google.com/macros/s/AKfycb.../exec")
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycby5hYEPVVs5kv3ZgNPNgsmWKNlkkYS9YIkxtcz1NbXMbMF9WNOMF--TR2jze1nN22rJsg/exec",
  // Alternativa opcional: Netlify Function (/.netlify/functions/books) usando GOOGLE_DRIVE_API_KEY
  USE_NETLIFY_FUNCTION: true,
  NETLIFY_FUNCTION_URL: "/.netlify/functions/books",
  // Tiempo de caché local en minutos para acelerar recargas
  CACHE_TTL_MINUTES: 15,
  // Materias excluidas automáticamente de la sincronización
  EXCLUDED_SUBJECTS: [
    "seguridad informática",
    "seguridad informatica"
  ]
};
