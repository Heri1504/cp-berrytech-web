# CP BerryTech — Agente WhatsApp IA

Agente de WhatsApp conectado a Claude (Anthropic) para atender clientes de CP BerryTech de forma automática.

---

## Requisitos

- Node.js 18 o superior
- Cuenta en Meta Developers con app de WhatsApp Business
- API Key de Anthropic

---

## Instalación rápida

```bash
cd whatsapp-agent
npm install
cp .env.example .env
# Editar .env con tus valores reales
node agent.js
```

---

## Paso 1 — Obtener credenciales de Meta

1. Ir a [developers.facebook.com](https://developers.facebook.com)
2. Crear nueva app → Tipo: **Business**
3. Agregar producto: **WhatsApp**
4. En **WhatsApp → Configuración de API**:
   - Copiar el **Phone Number ID** → pegar en `.env` como `PHONE_NUMBER_ID`
   - Generar **Token de acceso temporal** → pegar como `WHATSAPP_TOKEN`
5. Para token permanente: crear un **System User** en Business Manager

---

## Paso 2 — Configurar el Webhook

### En desarrollo (con ngrok)

```bash
# En una terminal: iniciar el agente
node agent.js

# En otra terminal: exponer con ngrok
npx ngrok http 3000
```

Ngrok te dará una URL como `https://abc123.ngrok.io`.

En Meta Developers → WhatsApp → Configuración:
- **URL del webhook**: `https://abc123.ngrok.io/webhook`
- **Token de verificación**: el valor de `VERIFY_TOKEN` en tu `.env`
- **Campos a suscribir**: marcar `messages`

### En producción (Railway o Render)

Ver sección **Despliegue** más abajo.

---

## Paso 3 — Probar

Envía un WhatsApp al número de prueba de Meta (o a tu número business si ya está activo):

- `hola` → Menú de bienvenida
- `precio` → Precio del sistema
- `demo` → Agendar demostración
- `asesor` → Alerta al admin
- Cualquier otra pregunta → Claude responde con contexto de CP BerryTech

---

## Despliegue gratuito en Railway

1. Ir a [railway.app](https://railway.app) y crear cuenta
2. **New Project → Deploy from GitHub repo** (o subir esta carpeta)
3. En **Variables**, agregar todas las del `.env`
4. Railway detecta automáticamente que es Node.js y lo despliega
5. Copiar la URL pública generada → usarla como webhook en Meta

### Alternativa: Render

1. Ir a [render.com](https://render.com)
2. New → **Web Service** → conectar repositorio
3. Build Command: `npm install`
4. Start Command: `node agent.js`
5. Agregar las variables de entorno
6. Copiar URL pública para el webhook

---

## Estructura del agente

```
/webhook GET  → Verificación de Meta (handshake)
/webhook POST → Recibe mensajes entrantes
/          GET → Health check (status del servidor)
```

### Comandos reconocidos

| Mensaje del usuario | Respuesta |
|---------------------|-----------|
| `hola`, `inicio`, `menu` | Menú principal |
| `precio`, `cuanto cuesta` | Precio del sistema |
| `demo`, `ver sistema` | Agendar demostración |
| `asesor`, `humano`, `contacto` | Notifica al admin |
| Cualquier otra cosa | Claude responde con contexto de CP BerryTech |

### Memoria por sesión

El agente guarda los últimos 10 mensajes por número de teléfono en memoria RAM. Al reiniciar el servidor se pierde el historial (esto es intencional para mantenerlo simple).

---

## Notas de seguridad

- **Nunca** subas el archivo `.env` a Git (ya está en `.gitignore`)
- El `WHATSAPP_TOKEN` temporal expira cada 24 hrs — usar System User para producción
- Validar la firma de las peticiones de Meta en producción (ver documentación de Meta)
