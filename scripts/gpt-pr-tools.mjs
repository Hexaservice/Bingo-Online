// scripts/gpt-pr-tools.mjs
import OpenAI from "openai";
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const {
  OPENAI_API_KEY,
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,    // owner/repo (lo inyecta Actions)
  INPUT_TASK,           // qué cambio quieres
  INPUT_FILES,          // "a,b,c" para dar contexto
  INPUT_BASE = "dev",
  INPUT_BRANCH          // opcional
} = process.env;

if (!OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY");
if (!GITHUB_TOKEN)    throw new Error("Falta GITHUB_TOKEN");
if (!GITHUB_REPOSITORY) throw new Error("Falta GITHUB_REPOSITORY");
if (!INPUT_TASK) throw new Error("Falta INPUT_TASK");

const [owner, repo] = GITHUB_REPOSITORY.split("/");
const files = (INPUT_FILES || "").split(",").map(s => s.trim()).filter(Boolean);
if (files.length === 0) files.push("README.md");

const SUPPORTED_BASES = new Set(["dev", "staging", "main"]);
if (!SUPPORTED_BASES.has(INPUT_BASE)) {
  throw new Error(`INPUT_BASE debe ser una de: ${Array.from(SUPPORTED_BASES).join(", ")}. Valor recibido: "${INPUT_BASE}"`);
}
const baseBranch = INPUT_BASE;

const blobs = files.map(fp => {
  const abs = path.resolve(process.cwd(), fp);
  const content = readFileSync(abs, "utf8");
  return { path: fp, content };
});

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

/* ============ 1) Pedimos el PATCH a GPT-5 ============ */
const sys = `Eres un ingeniero de software senior.
Devuelve SOLO un parche 'unified diff' entre <PATCH> y </PATCH>.
Rutas relativas a la raíz. No incluyas comentarios ni explicaciones.`;

const usr = [
  `Tarea: ${INPUT_TASK}`,
  `Base: ${baseBranch}`,
  `Archivos de contexto:`,
  ...blobs.map(f => `--- START ${f.path} ---\n${f.content}\n--- END ${f.path} ---`)
].join("\n\n");

const r1 = await client.chat.completions.create({
  model: "gpt-5",
  temperature: 0.2,
  messages: [
    { role: "system", content: sys },
    { role: "user",   content: usr }
  ]
});

const txt = r1.choices[0]?.message?.content || "";
const m = txt.match(/<PATCH>\s*([\s\S]*?)\s*<\/PATCH>/);
if (!m) throw new Error("No se encontró <PATCH>...</PATCH> con diff válido.");
const patch = m[1];
const patchPath = "/tmp/gpt.patch";
writeFileSync(patchPath, patch, "utf8");

/* ============ 2) Aplicamos patch, creamos rama y push ============ */
const branch = INPUT_BRANCH || `gpt-change/${Date.now()}`;

execSync(`git config user.name "github-actions[bot]"`);
execSync(`git config user.email "41898282+github-actions[bot]@users.noreply.github.com"`);
execSync(`git checkout -B ${branch}`);
execSync(`git apply --whitespace=fix ${patchPath}`);
execSync(`git add -A`);
execSync(`git commit -m "chore: ${INPUT_TASK.slice(0, 72)}"`);
execSync(`git push --set-upstream origin ${branch}`);

/* ============ 3) Exponemos herramienta createPullRequest ============ */
const tools = [
  {
    type: "function",
    function: {
      name: "createPullRequest",
      description: "Crea un PR en GitHub desde una rama hacia otra",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo:  { type: "string" },
          head:  { type: "string", description: "rama origen (ya pusheada)" },
          base:  { type: "string", description: "rama destino" },
          title: { type: "string" },
          body:  { type: "string" }
        },
        required: ["owner","repo","head","base","title"]
      }
    }
  }
];

/* Handler real que llama al API de GitHub */
async function createPR({ owner, repo, head, base, title, body }) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title, head, base, body })
  });
  if (!res.ok) throw new Error(`GitHub PR error: ${res.status} ${await res.text()}`);
  return await res.json();
}

/* ============ 4) Segundo turno: pedimos al modelo que llame a la herramienta ============ */
const followUp = [
  { role: "system", content: "Ahora debes crear el Pull Request llamando a la herramienta disponible." },
  { role: "user", content:
`Se aplicó la tarea y se subió la rama.
Repositorio: ${owner}/${repo}
Rama base: ${baseBranch}
Rama head: ${branch}
Redacta un título breve y un body con puntos claros. Luego LLAMA a createPullRequest.` }
];

const r2 = await client.chat.completions.create({
  model: "gpt-5",
  temperature: 0.1,
  messages: followUp,
  tools,
  tool_choice: "auto"
});

const choice = r2.choices[0];
const tool = choice.message.tool_calls?.[0];

if (tool?.function?.name === "createPullRequest") {
  const args = JSON.parse(tool.function.arguments || "{}");
  // Rellenamos por seguridad si el modelo no lo puso
  args.owner ||= owner;
  args.repo  ||= repo;
  args.head  ||= branch;
  args.base  ||= baseBranch;
  args.title ||= `LLM: ${INPUT_TASK.slice(0,80)}`;
  args.body  ||= `Cambio generado automáticamente por GPT-5.\n\nTarea:\n${INPUT_TASK}\n\nRama: ${branch}`;
  const pr = await createPR(args);
  console.log(`PR_URL=${pr.html_url}`);
} else {
  // Fallback: crear PR nosotros si el modelo no invocó la herramienta
  const title = `LLM: ${INPUT_TASK.slice(0,80)}`;
  const body  = `Cambio generado automáticamente por GPT-5.\n\nTarea:\n${INPUT_TASK}\n\nRama: ${branch}`;
  const pr = await createPR({ owner, repo, head: branch, base: baseBranch, title, body });
  console.log(`PR_URL=${pr.html_url}`);
}
