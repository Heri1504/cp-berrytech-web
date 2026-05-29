/**
 * agent.js — Agente IA para WhatsApp CP BerryTech
 * Stack: Node.js + Express + Anthropic SDK + Meta WhatsApp Business API
 *
 * Uso:
 *   1. Copia .env.example a .env y rellena los valores
 *   2. npm install
 *   3. node agent.js
 *   4. Exponer con ngrok: ngrok http 3000
 *   5. Configurar webhook en Meta Developers
 */

require('dotenv').config();
const express   = require('express');
const Anthropic  = require('@anthropic-ai/sdk');
const axios      = require('axios');

const app       = express();
app.use(express.json());

// ================================================
// CONFIGURACIÓN
// ================================================
const PORT             = process.env.PORT || 3000;
const VERIFY_TOKEN     = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN   = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID  = process.env.PHONE_NUMBER_ID;
const ADMIN_PHONE      = process.env.ADMIN_PHONE; // Número del administrador para alertas
const MAX_HISTORIAL    = 10; // Últimos mensajes por número

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Memoria por número de teléfono: Map<numero, Array<{role, content}>>
const memoria = new Map();

// ================================================
// SYSTEM PROMPT DEL AGENTE
// ================================================
const SYSTEM_PROMPT = `Eres el asistente de CP BerryTech por WhatsApp. Atiendes
productores agrícolas en Colima y estados cercanos.
Sé conciso (máx 3 párrafos), usa emojis con moderación 🌱✅,
termina siempre con una pregunta o acción clara.
El sistema tiene UN SOLO PLAN: pago único $28,500 MXN +
mantenimiento $1,200/mes. Cuando alguien quiera cotización,
pregunta: nombre del rancho, número de empleados, y si quieren
que los visitemos para una demostración.

El sistema incluye:
- PC servidor instalada y configurada
- Tablet 8" con pantalla de checador (modo quiosco)
- Lector RFID con 30 tarjetas/llaveros para empleados
- Mini router TP-Link (red local privada sin internet)
- Instalación presencial + capacitación hasta 4 horas
- Alta de todos los empleados en el sistema
- 1er mes de soporte gratis
- Módulos: asistencia RFID, tareas, pagos, inventario, reportes

Zona de servicio: Colima y estados cercanos.
Funciona sin internet (red local privada).
Correo: cpberrytech@gmail.com`;

// ================================================
// MENSAJES PREDEFINIDOS
// ================================================
function mensajeMenu() {
  return `Hola 👋 Soy el asistente de *CP BerryTech*.
Sistema de gestión para ranchos y huertas 🌱

¿En qué te puedo ayudar?
1️⃣ Ver el sistema en acción
2️⃣ Conocer el precio
3️⃣ Hablar con un asesor`;
}

function mensajePrecio() {
  return `💰 *Precio de CP BerryTech*

*Pago único: $28,500 MXN* (todo incluido)
Mantenimiento: $1,200/mes desde el 2° mes
Anticipo: 50% al contratar ($14,250 MXN)

✅ Incluye: PC servidor, tablet con checador RFID, red local sin internet, 30 tarjetas, instalación presencial, capacitación y 1er mes de soporte gratis.

¿Te gustaría agendar una demostración en tu rancho? 🌱`;
}

function mensajeDemo() {
  return `🎯 *Demo presencial en tu rancho*

Con gusto hacemos una visita para mostrarte cómo funciona el sistema en tu operación real.

La instalación completa (incluyendo la demo) tarda un día y tu equipo queda capacitado ese mismo día.

¿Me puedes decir en qué municipio o zona está tu rancho para coordinar la visita? 📍`;
}

function mensajeAsesor() {
  return `👨‍💼 *Atención personalizada*

Voy a notificar a nuestro equipo para que se contacte contigo directamente.

También puedes escribirnos al correo: cpberrytech@gmail.com

¿Hay algo más en lo que pueda ayudarte mientras tanto? 🌱`;
}

function mensajeBienvenida() {
  return `Hola 👋 Bienvenido a *CP BerryTech* — tecnología al servicio del campo 🌱

¿Tienes un rancho o huerta y quieres ordenar tu operación? Estoy aquí para ayudarte.

Puedes preguntarme lo que quieras sobre el sistema, o escribe *menú* para ver las opciones disponibles.`;
}

// ================================================
// DETECTOR DE COMANDOS
// ================================================
function detectarComando(texto) {
  const t = texto.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g,''); // quitar acentos para comparar

  if (['hola','hi','inicio','menu','start','buenas','buenos dias','buenas tardes'].some(c => t === c || t.startsWith(c))) return 'menu';
  if (['precio','precios','cuanto','cuanto cuesta','cuanto vale','costo','2'].some(c => t === c || t.includes(c))) return 'precio';
  if (['demo','demostracion','ver sistema','como funciona','1'].some(c => t === c || t.includes(c))) return 'demo';
  if (['contacto','asesor','humano','persona','vendedor','3'].some(c => t === c || t.includes(c))) return 'asesor';
  return null;
}

// ================================================
// CLAUDE — Respuesta con contexto
// ================================================
async function obtenerRespuestaClaude(numero, textoUsuario) {
  // Obtener o crear historial del número
  if (!memoria.has(numero)) memoria.set(numero, []);
  const hist = memoria.get(numero);

  hist.push({ role: 'user', content: textoUsuario });

  // Mantener solo los últimos MAX_HISTORIAL mensajes
  if (hist.length > MAX_HISTORIAL) {
    hist.splice(0, hist.length - MAX_HISTORIAL);
  }

  const respuesta = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: hist
  });

  const textoBot = respuesta.content[0].text;
  hist.push({ role: 'assistant', content: textoBot });

  // Limpiar formato Markdown pesado para WhatsApp (convierte **bold** a *bold*)
  return textoBot.replace(/\*\*(.*?)\*\*/g, '*$1*');
}

// ================================================
// ENVIAR MENSAJE WHATSAPP
// ================================================
async function enviarWhatsApp(numero, texto) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: numero,
        type: 'text',
        text: { body: texto, preview_url: false }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error(`Error enviando a ${numero}:`, err.response?.data || err.message);
  }
}

// Notificar al admin cuando alguien pide asesor
async function notificarAdmin(numeroDe, mensaje) {
  if (!ADMIN_PHONE) return;
  const aviso = `🔔 *Nuevo lead CP BerryTech*\n\nNúmero: +${numeroDe}\nMensaje: "${mensaje}"\n\nResponde directo para conectar con el cliente.`;
  await enviarWhatsApp(ADMIN_PHONE, aviso);
}

// ================================================
// WEBHOOK — Verificación Meta (GET)
// ================================================
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado por Meta');
    res.status(200).send(challenge);
  } else {
    console.warn('⚠️ Token de verificación incorrecto');
    res.sendStatus(403);
  }
});

// ================================================
// WEBHOOK — Recibir mensajes (POST)
// ================================================
app.post('/webhook', async (req, res) => {
  // Responder 200 inmediatamente a Meta (requerido)
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const entry   = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;

    // Ignorar si no hay mensajes (puede ser status update)
    const message = value?.messages?.[0];
    if (!message || message.type !== 'text') return;

    const numeroDe   = message.from;
    const textoCrudo = message.text.body.trim();

    console.log(`📩 [${numeroDe}]: ${textoCrudo}`);

    // Primer mensaje: bienvenida
    const esNuevo = !memoria.has(numeroDe);

    // Detectar comando especial
    const comando = detectarComando(textoCrudo);

    if (esNuevo && !comando) {
      await enviarWhatsApp(numeroDe, mensajeBienvenida());
      // Continuar y también responder con Claude
    }

    let respuesta;

    switch (comando) {
      case 'menu':
        respuesta = mensajeMenu();
        break;
      case 'precio':
        respuesta = mensajePrecio();
        break;
      case 'demo':
        respuesta = mensajeDemo();
        break;
      case 'asesor':
        respuesta = mensajeAsesor();
        await notificarAdmin(numeroDe, textoCrudo);
        break;
      default:
        // Sin comando: respuesta con Claude
        respuesta = await obtenerRespuestaClaude(numeroDe, textoCrudo);
    }

    await enviarWhatsApp(numeroDe, respuesta);
    console.log(`📤 [${numeroDe}]: respuesta enviada`);

  } catch (err) {
    console.error('❌ Error procesando mensaje:', err.message);
  }
});

// ================================================
// RUTA DE SALUD (health check)
// ================================================
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    app: 'CP BerryTech WhatsApp Agent',
    uptime: Math.floor(process.uptime()) + 's'
  });
});

// ================================================
// INICIAR SERVIDOR
// ================================================
app.listen(PORT, () => {
  console.log(`\n🌱 CP BerryTech WhatsApp Agent`);
  console.log(`   Servidor: http://localhost:${PORT}`);
  console.log(`   Webhook:  http://localhost:${PORT}/webhook`);
  console.log(`   Estado:   http://localhost:${PORT}/\n`);

  if (!process.env.ANTHROPIC_API_KEY) console.warn('⚠️  ANTHROPIC_API_KEY no configurada en .env');
  if (!process.env.WHATSAPP_TOKEN)    console.warn('⚠️  WHATSAPP_TOKEN no configurado en .env');
  if (!process.env.PHONE_NUMBER_ID)   console.warn('⚠️  PHONE_NUMBER_ID no configurado en .env');
});
