[README.md](https://github.com/user-attachments/files/28239330/README.md)
# FinanzasApp

Sistema de control financiero personal. HTML + JS puro, Supabase, Vercel.

---

## Stack

- **Frontend**: HTML + CSS + JS vanilla (sin frameworks)
- **Base de datos**: Supabase (PostgreSQL + Auth)
- **Hosting**: Vercel
- **Repo**: GitHub

---

## Estructura

```
finanzas-app/
├── index.html              ← Login / Registro
├── app.html                ← Dashboard principal
├── css/
│   └── styles.css
├── js/
│   ├── supabase-client.js  ← Inicializa Supabase + helpers
│   └── app.js              ← Toda la lógica de la app
├── supabase_setup.sql      ← SQL para crear tablas en Supabase
└── README.md
```

---

## Pasos para desplegar

### 1. Supabase

1. Ir a https://supabase.com → tu proyecto
2. Ir a **SQL Editor** → **New query**
3. Pegar el contenido completo de `supabase_setup.sql` y ejecutar
4. Ir a **Settings → API**:
   - Copiar **Project URL** → es tu `SUPABASE_URL`
   - Copiar **anon public** key → es tu `SUPABASE_ANON_KEY`

### 2. Reemplazar las claves

En `index.html` y `app.html`, reemplazá estas dos líneas:

```js
window.ENV_SUPABASE_URL = 'TU_SUPABASE_URL';
window.ENV_SUPABASE_KEY = 'TU_SUPABASE_ANON_KEY';
```

Por tus valores reales, por ejemplo:

```js
window.ENV_SUPABASE_URL = 'https://xyzxyzxyz.supabase.co';
window.ENV_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 3. GitHub

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/finanzas-app.git
git push -u origin main
```

### 4. Vercel

1. Ir a https://vercel.com → **New Project**
2. Importar el repo de GitHub
3. En **Build & Output Settings**:
   - Framework Preset: **Other**
   - Output Directory: *(dejar vacío)*
4. Click **Deploy**

Listo. Cada `git push` a `main` hace deploy automático.

---

## Crear usuarios

Los usuarios se crean desde la pantalla de registro (`/index.html`). Máximo recomendado: 5 usuarios.

También podés crearlos directamente desde **Supabase → Authentication → Users → Add user**.

---

## Seguridad

- Cada usuario ve **únicamente sus propios datos** (Row Level Security activo en todas las tablas)
- La `anon key` de Supabase es pública y segura para usar en el frontend: las políticas RLS garantizan el aislamiento
- Las contraseñas las maneja Supabase Auth (nunca se guardan en texto plano)
