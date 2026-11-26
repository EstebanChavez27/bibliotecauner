/**
 * Biblioteca Digital UNER — Sincronizador Automático de Google Drive (v3)
 * -----------------------------------------------------------------------
 * Escanea recursivamente la carpeta raíz organizada en:
 *   - Carpetas de Año (1er Año, 2do Año...) -> Cuatrimestre -> Materia -> PDFs (y subcarpetas)
 *   - Carpeta "Varios" (o cualquier carpeta raíz sin "Año") -> Lecturas recomendadas al final
 *
 * Funciones automáticas:
 * - Omite "Seguridad Informática" y no genera etiquetas de "Obligatoria"/"Optativa".
 * - Extrae título y autor desde "Título - Autor.pdf".
 * - Asigna múltiples categorías temáticas automáticamente (Bases de Datos, Redes, Seguridad, etc.).
 * - También reconoce etiquetas manuales entre corchetes en el nombre del archivo, ej: "[Seguridad]".
 * - Usa CacheService (10 minutos) para respuestas casi instantáneas (?refresh=1 fuerza actualización).
 */

const ROOT_FOLDER_ID = "18nwSi3XYcgd9TXWOoPEohFmeK6RledF7";
const CACHE_KEY = "biblioteca_uner_catalog_v3";
const CACHE_SECONDS = 600;
const EXCLUDED_SUBJECTS = ["seguridad informática", "seguridad informatica"];

const SUBJECT_ACCENTS = [
  "#0ea5e9", "#14b8a6", "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4",
  "#3b82f6", "#f43f5e", "#8b5cf6", "#22c55e", "#0284c7", "#a855f7", "#f97316"
];

const TOPIC_RULES = [
  { topic: "Bases de Datos", re: /\b(base de datos|bases de datos|sql|mysql|postgres|postgresql|mongodb|nosql|relacional|database|databases)\b/ },
  { topic: "Redes", re: /\b(red|redes|comunicaciones|networking|network|tcp|http|protocolos|teleprocesamiento)\b/ },
  { topic: "Seguridad", re: /\b(seguridad|ciberseguridad|security|hacking|pentest|pentesting|criptografia|cryptography|owasp|vulnerabilidad|malware|forense|defensa)\b/ },
  { topic: "Sistemas Operativos", re: /\b(sistema operativo|sistemas operativos|operating system|linux|unix|kernel|bash|shell)\b/ },
  { topic: "Arquitectura", re: /\b(arquitectura de computad|organizacion y arquitectura|hardware|microprocesador|ensamblador|cpu)\b/ },
  { topic: "Python", re: /\b(python)\b/ },
  { topic: "JavaScript", re: /\b(javascript|typescript|react|node\.?js|ecmascript)\b/ },
  { topic: "Desarrollo Web", re: /\b(desarrollo web|aplicaciones web|web development|web design|html|html5|css|bootstrap|react|javascript|responsive|frontend|backend|sitios web)\b/ },
  { topic: "Frontend y CSS", re: /\b(css|html|html5|bootstrap|responsive|react|frontend|maquetacion|tailwind)\b/ },
  { topic: "POO y Algoritmos", re: /\b(orientada a objetos|object-oriented|poo|algoritmos|estructura de datos|estructuras de datos|patrones de diseno|design patterns)\b/ },
  { topic: "Programación", re: /\b(programacion|programador|programming|python|pascal|delphi|javascript|react|algoritmos|codigo|code|poo|object-oriented)\b/ },
  { topic: "Ingeniería de Software", re: /\b(ingenieria de software|software engineering|requisitos|uml|testing|pruebas|agile|scrum|clean code|arquitectura de software)\b/ },
  { topic: "Diseño y UX/UI", re: /\b(diseno grafico|ux|ui|usabilidad|tipografia|color|marca|logo|reticula|reticulas|interfaz|interfaces|figma|branding)\b/ },
  { topic: "Móviles y Multimedia", re: /\b(movil|moviles|mobile|android|ios|react native|expo|multimedia|videojuegos|juegos|canvas|animacion)\b/ },
  { topic: "Fundamentos", re: /\b(introduccion a la informatica|introduccion a la computacion|fundamentos de informatica|ciencias de la computacion)\b/ }
];

function doGet(e) {
  const forceRefresh = e && e.parameter && e.parameter.refresh === "1";
  const cache = CacheService.getScriptCache();

  if (!forceRefresh) {
    const cached = cache.get(CACHE_KEY);
    if (cached) return jsonOutput(cached);
  }

  const catalog = buildCatalog();
  const serialized = JSON.stringify(catalog);

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
  const extraSubjects = [];
  const books = [];

  const rootFolders = getSortedSubfolders(root);

  rootFolders.forEach(function(topFolder) {
    const topName = topFolder.getName().trim();
    const normTop = normalizeStr(topName);

    // Carpetas de carrera ("1er Año", "2do Año", etc.)
    if (normTop.indexOf("ano") !== -1) {
      const semesterFolders = getSortedSubfolders(topFolder);
      semesterFolders.forEach(function(semesterFolder) {
        const semesterName = semesterFolder.getName().trim();
        const subjectFolders = getSortedSubfolders(semesterFolder);

        subjectFolders.forEach(function(subjectFolder) {
          const rawSubjectName = subjectFolder.getName().trim();
          if (isExcludedSubject(rawSubjectName)) return;

          const parsed = parseSubjectName(rawSubjectName);
          const code = parsed.code || String(subjects.length + 1).padStart(2, "0");
          const accent = SUBJECT_ACCENTS[subjects.length % SUBJECT_ACCENTS.length];
          const fullName = code + " - " + parsed.name;

          subjects.push({
            code: code,
            name: parsed.name,
            fullName: fullName,
            year: topName,
            semester: semesterName,
            folderId: subjectFolder.getId(),
            folderUrl: "https://drive.google.com/drive/folders/" + subjectFolder.getId(),
            accent: accent,
            isExtra: false
          });

          collectFilesRecursively(subjectFolder, {
            subjectCode: code,
            subject: fullName,
            subjectName: parsed.name,
            year: topName,
            semester: semesterName,
            isExtra: false
          }, books);
        });
      });
    } else {
      // Carpeta especial en raíz (ej. "Varios" para lecturas recomendadas)
      const code = normTop === "varios" ? "VAR" : "EXT_" + (extraSubjects.length + 1);
      const fullName = topName + " · Lecturas recomendadas";

      extraSubjects.push({
        code: code,
        name: topName,
        fullName: fullName,
        year: topName,
        semester: "Lecturas recomendadas",
        folderId: topFolder.getId(),
        folderUrl: "https://drive.google.com/drive/folders/" + topFolder.getId(),
        accent: "#eab308",
        isExtra: true
      });

      collectFilesRecursively(topFolder, {
        subjectCode: code,
        subject: fullName,
        subjectName: topName,
        year: topName,
        semester: "Lecturas recomendadas",
        isExtra: true
      }, books);
    }
  });

  subjects.sort(function(a, b) {
    return a.code.localeCompare(b.code, "es", { numeric: true });
  });

  return {
    generatedAt: new Date().toISOString(),
    source: "Google Drive (en vivo)",
    rootFolderId: ROOT_FOLDER_ID,
    rootFolderUrl: "https://drive.google.com/drive/folders/" + ROOT_FOLDER_ID,
    subjects: subjects.concat(extraSubjects),
    books: books
  };
}

function collectFilesRecursively(folder, meta, outBooks) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.isTrashed()) continue;
    if (file.getMimeType() === MimeType.FOLDER) continue;

    const rawName = file.getName().trim();
    const parsedFile = parseBookFilename(rawName);
    const id = file.getId();
    const topics = inferTopics(parsedFile.rawBase, meta.isExtra ? "" : meta.subjectName);

    outBooks.push({
      id: id,
      title: parsedFile.title,
      author: parsedFile.author,
      subjectCode: meta.subjectCode,
      subject: meta.subject,
      subjectName: meta.subjectName,
      year: meta.year,
      semester: meta.semester,
      isExtra: Boolean(meta.isExtra),
      topics: topics,
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

function inferTopics(rawTitle, subjectContext) {
  const topics = [];
  // Etiquetas opcionales manuales entre corchetes en el nombre del archivo, ej: [Seguridad]
  const tagRegex = /\[([^\]]+)\]/g;
  let m;
  while ((m = tagRegex.exec(rawTitle)) !== null) {
    const custom = m[1].trim();
    if (custom && topics.indexOf(custom) === -1) topics.push(custom);
  }

  const norm = normalizeStr(rawTitle + " " + (subjectContext || ""));
  TOPIC_RULES.forEach(function(rule) {
    if (rule.re.test(norm) && topics.indexOf(rule.topic) === -1) {
      topics.push(rule.topic);
    }
  });

  if (topics.length === 0) topics.push("General");
  return topics;
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

function normalizeStr(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isExcludedSubject(name) {
  const norm = normalizeStr(name);
  return EXCLUDED_SUBJECTS.some(function(ex) {
    return norm.indexOf(normalizeStr(ex)) !== -1;
  });
}

function parseSubjectName(raw) {
  const match = raw.match(/^(\d{1,2})\s*[-.]\s*(.+)$/);
  if (match) {
    return { code: match[1].padStart(2, "0"), name: match[2].trim() };
  }
  return { code: "", name: raw };
}

function parseBookFilename(filename) {
  const extMatch = filename.match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = extMatch ? extMatch[1].toUpperCase() : "PDF";
  const rawBase = extMatch ? filename.slice(0, -extMatch[0].length).trim() : filename;
  const cleaned = rawBase.replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();

  const sepIdx = cleaned.lastIndexOf(" - ");
  if (sepIdx > 0) {
    return {
      rawBase: rawBase,
      title: cleaned.slice(0, sepIdx).trim().replace(/_/g, " "),
      author: cleaned.slice(sepIdx + 3).trim().replace(/_/g, " "),
      ext: ext
    };
  }

  return {
    rawBase: rawBase,
    title: cleaned.replace(/_/g, " "),
    author: "Autor no especificado",
    ext: ext
  };
}
