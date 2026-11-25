/**
 * Biblioteca Digital UNER — Sincronizador Automático de Google Drive
 * -------------------------------------------------------------------
 * Escanea recursivamente la carpeta raíz organizada en:
 *   Año -> Cuatrimestre -> Materia -> (archivos y subcarpetas como Bibliografía/)
 *
 * - Omite automáticamente "Seguridad Informática".
 * - No genera etiquetas de "Obligatoria" ni "Optativa".
 * - Extrae título y autor desde nombres con formato "Título - Autor.pdf".
 * - Usa CacheService (10 minutos) para respuestas casi instantáneas.
 *
 * Pasos para implementar:
 * 1. Ir a https://script.google.com -> Nuevo proyecto.
 * 2. Pegar este archivo completo y guardar.
 * 3. Implementar -> Nueva implementación -> Aplicación web.
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Quién tiene acceso: Cualquier persona
 * 4. Copiar la URL /exec y pegarla en config.js -> APPS_SCRIPT_URL.
 */

const ROOT_FOLDER_ID = "18nwSi3XYcgd9TXWOoPEohFmeK6RledF7";
const CACHE_KEY = "biblioteca_uner_catalog_v2";
const CACHE_SECONDS = 600; // 10 minutos
const EXCLUDED_SUBJECTS = ["seguridad informática", "seguridad informatica"];

const SUBJECT_ACCENTS = [
  "#0ea5e9", "#14b8a6", "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4",
  "#3b82f6", "#f43f5e", "#8b5cf6", "#22c55e", "#0284c7", "#a855f7", "#f97316"
];

function doGet(e) {
  const forceRefresh = e && e.parameter && e.parameter.refresh === "1";
  const cache = CacheService.getScriptCache();

  if (!forceRefresh) {
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return jsonOutput(cached);
    }
  }

  const catalog = buildCatalog();
  const serialized = JSON.stringify(catalog);

  // CacheService admite hasta ~100 KB por clave
  if (serialized.length < 95000) {
    cache.put(CACHE_KEY, serialized, CACHE_SECONDS);
  }

  return jsonOutput(serialized);
}

function jsonOutput(jsonString) {
  return ContentService
    .createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

function buildCatalog() {
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const subjects = [];
  const books = [];

  const yearFolders = getSortedSubfolders(root);

  yearFolders.forEach(function(yearFolder) {
    const yearName = yearFolder.getName().trim();
    const semesterFolders = getSortedSubfolders(yearFolder);

    semesterFolders.forEach(function(semesterFolder) {
      const semesterName = semesterFolder.getName().trim();
      const subjectFolders = getSortedSubfolders(semesterFolder);

      subjectFolders.forEach(function(subjectFolder) {
        const rawSubjectName = subjectFolder.getName().trim();
        if (isExcludedSubject(rawSubjectName)) {
          return;
        }

        const parsed = parseSubjectName(rawSubjectName);
        const accent = SUBJECT_ACCENTS[subjects.length % SUBJECT_ACCENTS.length];
        const fullName = parsed.code ? (parsed.code + " - " + parsed.name) : parsed.name;

        subjects.push({
          code: parsed.code || String(subjects.length + 1).padStart(2, "0"),
          name: parsed.name,
          fullName: fullName,
          year: yearName,
          semester: semesterName,
          folderId: subjectFolder.getId(),
          folderUrl: "https://drive.google.com/drive/folders/" + subjectFolder.getId(),
          accent: accent
        });

        collectFilesRecursively(subjectFolder, {
          subjectCode: parsed.code || String(subjects.length).padStart(2, "0"),
          subject: fullName,
          subjectName: parsed.name,
          year: yearName,
          semester: semesterName
        }, books);
      });
    });
  });

  subjects.sort(function(a, b) {
    return a.code.localeCompare(b.code, "es", { numeric: true });
  });

  return {
    generatedAt: new Date().toISOString(),
    source: "Google Drive (en vivo)",
    rootFolderId: ROOT_FOLDER_ID,
    rootFolderUrl: "https://drive.google.com/drive/folders/" + ROOT_FOLDER_ID,
    subjects: subjects,
    books: books
  };
}

function collectFilesRecursively(folder, meta, outBooks) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.isTrashed()) continue;

    const mime = file.getMimeType();
    if (mime === MimeType.FOLDER) continue;

    const rawName = file.getName().trim();
    const parsedFile = parseBookFilename(rawName);
    const id = file.getId();

    outBooks.push({
      id: id,
      title: parsedFile.title,
      author: parsedFile.author,
      subjectCode: meta.subjectCode,
      subject: meta.subject,
      subjectName: meta.subjectName,
      year: meta.year,
      semester: meta.semester,
      format: parsedFile.ext,
      sizeBytes: file.getSize(),
      modifiedTime: file.getLastUpdated().toISOString(),
      viewUrl: "https://drive.google.com/file/d/" + id + "/view",
      previewUrl: "https://drive.google.com/file/d/" + id + "/preview",
      downloadUrl: "https://drive.google.com/uc?export=download&id=" + id,
      thumbnailUrl: "https://drive.google.com/thumbnail?id=" + id + "&sz=w600"
    });
  }

  const subfolders = getSortedSubfolders(folder);
  subfolders.forEach(function(sub) {
    collectFilesRecursively(sub, meta, outBooks);
  });
}

function getSortedSubfolders(folder) {
  const result = [];
  const iter = folder.getFolders();
  while (iter.hasNext()) {
    const f = iter.next();
    if (!f.isTrashed()) result.push(f);
  }
  result.sort(function(a, b) {
    return a.getName().localeCompare(b.getName(), "es", { numeric: true });
  });
  return result;
}

function isExcludedSubject(name) {
  const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return EXCLUDED_SUBJECTS.some(function(ex) {
    const exNorm = ex.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return norm.indexOf(exNorm) !== -1;
  });
}

function parseSubjectName(raw) {
  const match = raw.match(/^(\d{1,2})\s*[-.]\s*(.+)$/);
  if (match) {
    return {
      code: match[1].padStart(2, "0"),
      name: match[2].trim()
    };
  }
  return { code: "", name: raw };
}

function parseBookFilename(filename) {
  const extMatch = filename.match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = extMatch ? extMatch[1].toUpperCase() : "PDF";
  const withoutExt = extMatch ? filename.slice(0, -extMatch[0].length).trim() : filename;

  const sepIdx = withoutExt.lastIndexOf(" - ");
  if (sepIdx > 0) {
    return {
      title: withoutExt.slice(0, sepIdx).trim().replace(/_/g, " "),
      author: withoutExt.slice(sepIdx + 3).trim().replace(/_/g, " "),
      ext: ext
    };
  }

  return {
    title: withoutExt.replace(/_/g, " "),
    author: "Autor no especificado",
    ext: ext
  };
}
