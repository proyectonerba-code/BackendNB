# NERBA PROYECTO

Proyecto local de Grupo NERBA HIDALGO, separado en frontend y backend.

## Estructura

```text
NERBA PROYECTO/
  NERBA Front/                 Frontend HTML/CSS/JavaScript
  NERBA Back/                  Backend Node.js y datos
  NERBA-FRONT.code-workspace   Proyecto VS Code exclusive del frontend
  NERBA-BACK.code-workspace    Proyecto VS Code exclusive del backend
  README.md
  VERSION
```

`NERBA Front` contiene `index.html`, `login.html`, `catalogo.html`, `cotizador.html`, `js/`, `css/`, `assets/` y las zonas `admin/`, `superadmin/`, `especiales/` y `electronica/`.

`NERBA Back` contiene `server.js`, `package.json`, `run.bat`, `run_server.bat` y `data/`. Los datos y respaldos se conservan dentro de `NERBA Back/data/`.

## Abrir los proyectos en Visual Studio Code

- Frontend: `NERBA-FRONT.code-workspace`
- Backend: `NERBA-BACK.code-workspace`
- Si un workspace aparece vacío, abre `NERBA Front\NERBA-FRONT.project.code-workspace` o `NERBA Back\NERBA-BACK.project.code-workspace`.
- También se puede abrir cada carpeta (`NERBA Front` o `NERBA Back`) directamente.

En el workspace del backend, `F5` inicia `server.js` con puerto `8080`. En el frontend no se requiere otro proceso: el backend sirve ambos proyectos en el mismo puerto.

## Ejecutar localmente

Desde PowerShell:

```powershell
cd "C:\Users\DELL\Downloads\NERBA PROYECTO\NERBA Back"
node server.js 8080
```

O doble clic en `NERBA Back\run.bat`. Después abre `http://localhost:8080`.

El backend busca el frontend hermano en `NERBA Front`; no depende de la carpeta anterior `Pruebas proyecto`.

## Cuentas demo

| Rol | Email | Contraseña |
|---|---|---|
| CLIENTE | `cliente@nerba.mx` | `cliente123` |
| ADMIN | `admin@nerba.mx` | `admin123` |
| SUPERADMIN | `superadmin@nerba.mx` | `super123` |
| PROYECTOS_ESPECIALES | `proyectos@nerba.mx` | `especial123` |
| PRODUCTOS_ELECTRONICOS | `electronica@nerba.mx` | `electronica123` |

## Google Sign-In (opcional)

El botón queda desactivado hasta configurar `GOOGLE_CLIENT_ID` en el servidor. El backend valida el token y no se expone ningún client secret en el frontend.

```powershell
$env:GOOGLE_CLIENT_ID='TU_CLIENT_ID.apps.googleusercontent.com'
node server.js 8080
```

Opcionalmente se puede definir `GOOGLE_ALLOWED_DOMAIN` para restringir el dominio corporativo.

## API principal

- `GET /api/health`
- `GET /api/config`
- `POST /api/login`
- `POST /api/auth/google`
- `GET/PUT /api/me`
- `POST /api/logout`
- `GET/POST/PUT/DELETE /api/productos`
- `GET/POST /api/cotizaciones`
- `GET /api/catalogo`

Los datos se guardan en `NERBA Back/data/*.json`. Antes de producción se recomienda migrar el almacenamiento y definir las variables de entorno en el servidor.
