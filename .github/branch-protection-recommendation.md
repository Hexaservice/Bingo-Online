# Recomendación de protección de ramas

Este repositorio debe usar la siguiente configuración en **GitHub > Settings > Branches**.

## `main` (producción)
- Require a pull request before merging: **ON**.
- Require status checks to pass before merging: **ON**.
  - Checks mínimos recomendados:
    - `CI Tests / test`
- Require branches to be up to date before merging: **ON**.
- Restrict who can push to matching branches: **ON** (sin push directo).
- Allow force pushes: **OFF**.
- Allow deletions: **OFF**.

## `dev` (integración)
- Require a pull request before merging: **ON**.
- Require status checks to pass before merging: **ON**.
  - Checks mínimos recomendados:
    - `CI Tests / test`
- Require branches to be up to date before merging: **ON**.
- Restrict direct pushes: recomendado para mantener trazabilidad (se permite iteración vía PRs de equipo).
- Allow force pushes: **OFF**.
- Allow deletions: **OFF**.

## Flujo operativo esperado
1. Trabajo diario desde ramas `fix/*`, `feat/*`, `chore/*`, `docs/*` creadas desde `dev`.
2. Pull Request hacia `dev` para integración.
3. Release por Pull Request `dev` → `main` para promoción controlada.

> Nota: estas protecciones se aplican a nivel de configuración del repositorio en GitHub (no pueden imponerse únicamente con archivos versionados).
