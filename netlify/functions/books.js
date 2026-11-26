/**
 * Alternativa opcional de sincronización vía Netlify Function + Google Drive API v3.
 * Soporta carpetas de años + carpeta raíz "Varios" + categorización temática automática.
 */
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "18nwSi3XYcgd9TXWOoPEohFmeK6RledF7";
const API_KEY = process.env.GOOGLE_DRIVE_API_KEY || "";
const EXCLUDED = ["seguridad informatica", "seguridad informática"];
const ACCENTS = [
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

async function listChildren(folderId) {
  const items = [];
  let pageToken = "";
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,size,modifiedTime)");
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100&key=${API_KEY}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Drive API ${res.status}`);
    const data = await res.json();
    items.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return items;
}

function normalize(str) {
  return String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function inferTopics(rawTitle, subjectContext) {
  const topics = [];
  for (const m of rawTitle.matchAll(/\[([^\]]+)\]/g)) {
    const custom = m[1].trim();
    if (custom && !topics.includes(custom)) topics.push(custom);
  }
  const norm = normalize(`${rawTitle} ${subjectContext || ""}`);
  for (const rule of TOPIC_RULES) {
    if (rule.re.test(norm) && !topics.includes(rule.topic)) topics.push(rule.topic);
  }
  return topics.length ? topics : ["General"];
}

function parseSubject(raw) {
  const m = raw.trim().match(/^(\d{1,2})\s*[-.]\s*(.+)$/);
  return m ? { code: m[1].padStart(2, "0"), name: m[2].trim() } : { code: "", name: raw.trim() };
}

function parseFilename(filename) {
  const m = filename.trim().match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = m ? m[1].toUpperCase() : "PDF";
  const rawBase = m ? filename.trim().slice(0, -m[0].length).trim() : filename.trim();
  const cleaned = rawBase.replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();
  const idx = cleaned.lastIndexOf(" - ");
  if (idx > 0) {
    return { rawBase, title: cleaned.slice(0, idx).trim().replace(/_/g, " "), author: cleaned.slice(idx + 3).trim().replace(/_/g, " "), ext };
  }
  return { rawBase, title: cleaned.replace(/_/g, " "), author: "Autor no especificado", ext };
}

async function collectFiles(folderId, meta, out) {
  const children = await listChildren(folderId);
  const subfolders = [];
  for (const item of children) {
    if (item.mimeType === "application/vnd.google-apps.folder") {
      subfolders.push(item);
    } else {
      const parsed = parseFilename(item.name);
      out.push({
        id: item.id,
        title: parsed.title,
        author: parsed.author,
        subjectCode: meta.subjectCode,
        subject: meta.subject,
        subjectName: meta.subjectName,
        year: meta.year,
        semester: meta.semester,
        isExtra: Boolean(meta.isExtra),
        topics: inferTopics(parsed.rawBase, meta.isExtra ? "" : meta.subjectName),
        format: parsed.ext,
        sizeBytes: Number(item.size || 0),
        modifiedTime: item.modifiedTime || new Date().toISOString(),
        viewUrl: `https://drive.google.com/file/d/${item.id}/view`,
        previewUrl: `https://drive.google.com/file/d/${item.id}/preview`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${item.id}`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${item.id}&sz=w600`
      });
    }
  }
  await Promise.all(subfolders.map((sf) => collectFiles(sf.id, meta, out)));
}

export async function handler() {
  if (!API_KEY) {
    return { statusCode: 501, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "GOOGLE_DRIVE_API_KEY not configured" }) };
  }

  try {
    const subjects = [];
    const extraSubjects = [];
    const books = [];
    const rootFolders = (await listChildren(ROOT_FOLDER_ID))
      .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
      .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));

    for (const top of rootFolders) {
      const topName = top.name.trim();
      const normTop = normalize(topName);
      if (normTop.includes("ano")) {
        const semesters = (await listChildren(top.id))
          .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
          .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));

        for (const sem of semesters) {
          const subFolders = (await listChildren(sem.id))
            .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
            .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));

          for (const sf of subFolders) {
            const norm = normalize(sf.name);
            if (EXCLUDED.some((ex) => norm.includes(normalize(ex)))) continue;

            const parsed = parseSubject(sf.name);
            const code = parsed.code || String(subjects.length + 1).padStart(2, "0");
            const fullName = `${code} - ${parsed.name}`;
            subjects.push({
              code, name: parsed.name, fullName, year: topName, semester: sem.name.trim(),
              folderId: sf.id, folderUrl: `https://drive.google.com/drive/folders/${sf.id}`,
              accent: ACCENTS[subjects.length % ACCENTS.length], isExtra: false
            });

            await collectFiles(sf.id, {
              subjectCode: code, subject: fullName, subjectName: parsed.name,
              year: topName, semester: sem.name.trim(), isExtra: false
            }, books);
          }
        }
      } else {
        const code = normTop === "varios" ? "VAR" : `EXT_${extraSubjects.length + 1}`;
        const fullName = `${topName} · Lecturas recomendadas`;
        extraSubjects.push({
          code, name: topName, fullName, year: topName, semester: "Lecturas recomendadas",
          folderId: top.id, folderUrl: `https://drive.google.com/drive/folders/${top.id}`,
          accent: "#eab308", isExtra: true
        });
        await collectFiles(top.id, {
          subjectCode: code, subject: fullName, subjectName: topName,
          year: topName, semester: "Lecturas recomendadas", isExtra: true
        }, books);
      }
    }

    subjects.sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300, s-maxage=600" },
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        source: "Google Drive (Netlify Function)",
        rootFolderId: ROOT_FOLDER_ID,
        rootFolderUrl: `https://drive.google.com/drive/folders/${ROOT_FOLDER_ID}`,
        subjects: subjects.concat(extraSubjects),
        books
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message }) };
  }
}
