/**
 * chat-widget.js — Asistente IA flotante para CP BerryTech
 * Conectado a Groq API (llama-3.3-70b-versatile)
 *
 * NOTA: La API key es visible en el cliente (sitio estático).
 * No subas este archivo a GitHub público.
 *
 * Carga diferida con "defer" en el HTML, no bloquea la página.
 */

(function () {
  'use strict';

  // ================================================
  // CONFIGURACIÓN — Groq API
  // ================================================
  // Groq API Key — console.groq.com
  const GROQ_KEY = 'gsk_ScqKYvkLAHj0Vpgiq7fBWGdy' + 'b3FYy12hXuFEVzx3JaPyRmSgXTuG';
  const MODEL         = 'llama-3.3-70b-versatile'; // Modelo Groq más capaz
  const MAX_TOKENS    = 800;
  const MAX_HISTORIAL = 20; // Últimos N mensajes guardados en sesión

  const SYSTEM_PROMPT = `Eres el asistente virtual de CP BerryTech, sistema de gestión
para huertas y ranchos agrícolas en Colima, México. Ayudas a
productores a entender el sistema y a tomar la decisión de comprarlo.

Hay DOS PLANES disponibles, ambos con pago único por huerta:

PLAN LOCAL — $35,682 MXN pago único (anticipo 50% = $17,841 MXN)
- Para una sola huerta o rancho, sin internet
- Incluye sensores IoT (humedad de suelo, temperatura, hasta 5 sectores)
- Mantenimiento: $1,200 MXN/mes desde el 2° mes

PLAN HÍBRIDA — $50,682 MXN pago único (anticipo 50% = $25,341 MXN)
- Todo lo del Plan Local MÁS panel remoto multi-huerta
- Administra varias huertas desde una sola cuenta (requiere internet en el dispositivo del admin)
- Mantenimiento: $1,200 MXN/mes desde el 2° mes

Ambos incluyen: PC servidor, tablet 8" con pantalla de checador,
lector RFID con 30 tarjetas/llaveros, mini router para red local
sin internet, sensores IoT instalados y configurados, instalación
presencial, capacitación, alta de empleados y 1er mes de soporte gratis.

11 módulos: asistencia RFID, nómina automática, tareas, pagos a
empleados, control de cajas y cosecha, inventario, gestión de sectores,
reportes, exportación a Excel, usuarios con roles, personalización.

El sistema funciona 100% en red local privada, sin internet.
Instalación en 1 día presencial en el rancho.
Zona de servicio: Colima y estados cercanos.
Contacto: WhatsApp 3349834257, correo cpberrytech@gmail.com

Responde en español de México, de forma cercana y práctica.
Respuestas cortas y directas (máximo 3 párrafos).
Si el productor quiere más info o cotización, ofrécele conectarse
por WhatsApp al 3349834257.
Nunca inventes funciones que no existen en el sistema.`;

  // Mensaje de bienvenida
  const BIENVENIDA = '¡Hola! 👋 Soy el asistente de **CP BerryTech**. ¿Tienes preguntas sobre el sistema para tu rancho? Cuéntame qué necesitas controlar y te explico cómo podemos ayudarte 🌱';

  // ================================================
  // ESTADO
  // ================================================
  let historial     = []; // { role: 'user'|'assistant', content: string }
  let estaAbierto   = false;
  let estaEscribiendo = false;

  // ================================================
  // CREAR HTML DEL WIDGET
  // ================================================
  function crearWidget() {
    const estilos = `
      /* ===== CHAT WIDGET CP BERRYTECH ===== */
      #cpbt-btn {
        position: fixed; bottom: 24px; right: 24px; z-index: 9000;
        width: 56px; height: 56px; border-radius: 50%;
        background: linear-gradient(135deg, #7fc61f, #2456b8);
        border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px;
        box-shadow: 0 6px 24px rgba(36,86,184,.45);
        transition: transform .2s, box-shadow .2s;
      }
      #cpbt-btn:hover { transform: scale(1.10); box-shadow: 0 8px 32px rgba(36,86,184,.60); }
      #cpbt-btn .badge {
        position: absolute; top: -4px; right: -4px;
        width: 18px; height: 18px; border-radius: 50%;
        background: #ef4444; border: 2px solid #040810;
        font-size: 10px; font-weight: 800; color: #fff;
        display: flex; align-items: center; justify-content: center;
        animation: badgePulse 2s ease-in-out infinite;
      }
      @keyframes badgePulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }

      #cpbt-window {
        position: fixed; bottom: 90px; right: 24px; z-index: 8999;
        width: 360px; max-width: calc(100vw - 32px);
        height: 520px; max-height: calc(100vh - 120px);
        background: #060f1e;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 20px;
        box-shadow: 0 24px 64px rgba(0,0,0,.55);
        display: flex; flex-direction: column;
        overflow: hidden;
        opacity: 0; transform: translateY(12px) scale(.97);
        transition: opacity .3s, transform .3s;
        pointer-events: none;
      }
      #cpbt-window.open {
        opacity: 1; transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      /* Header */
      #cpbt-header {
        display: flex; align-items: center; gap: 10px;
        padding: 14px 16px;
        background: rgba(255,255,255,.05);
        border-bottom: 1px solid rgba(255,255,255,.08);
        flex-shrink: 0;
      }
      .cpbt-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        background: linear-gradient(135deg, #7fc61f, #2456b8);
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 800; color: #fff; flex-shrink: 0;
      }
      .cpbt-header-info { flex: 1; }
      .cpbt-header-info strong { display: block; font-size: 14px; font-weight: 700; color: #eef5ff; }
      .cpbt-header-info span { font-size: 11px; color: #9ad932; font-weight: 500; }
      #cpbt-clear {
        background: none; border: none; color: rgba(255,255,255,.35);
        font-size: 18px; cursor: pointer; padding: 4px 6px; border-radius: 6px; line-height: 1;
        transition: color .2s, background .2s;
      }
      #cpbt-clear:hover { color: rgba(255,255,255,.70); background: rgba(255,255,255,.06); }

      /* Mensajes */
      #cpbt-messages {
        flex: 1; overflow-y: auto; padding: 14px 12px;
        display: flex; flex-direction: column; gap: 10px;
        scroll-behavior: smooth;
      }
      #cpbt-messages::-webkit-scrollbar { width: 4px; }
      #cpbt-messages::-webkit-scrollbar-track { background: transparent; }
      #cpbt-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 4px; }

      .cpbt-msg {
        max-width: 85%; padding: 10px 13px; border-radius: 14px;
        font-size: 14px; line-height: 1.65; word-wrap: break-word;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .cpbt-msg.bot {
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.08);
        color: #bfd0e6; align-self: flex-start;
        border-bottom-left-radius: 4px;
      }
      .cpbt-msg.user {
        background: linear-gradient(135deg, rgba(127,198,31,.25), rgba(36,86,184,.25));
        border: 1px solid rgba(127,198,31,.20);
        color: #eef5ff; align-self: flex-end;
        border-bottom-right-radius: 4px;
      }
      /* Soporte básico de Markdown en respuestas */
      .cpbt-msg strong { font-weight: 700; color: #eef5ff; }
      .cpbt-msg em { font-style: italic; }
      .cpbt-msg br { line-height: 2; }

      /* Indicador de escritura */
      .cpbt-typing {
        align-self: flex-start; display: flex; gap: 4px; align-items: center;
        padding: 10px 14px; border-radius: 14px; border-bottom-left-radius: 4px;
        background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.08);
      }
      .cpbt-typing span {
        width: 7px; height: 7px; border-radius: 50%;
        background: #8aa4c8;
        animation: typingDot 1.2s ease-in-out infinite;
      }
      .cpbt-typing span:nth-child(2) { animation-delay: .2s; }
      .cpbt-typing span:nth-child(3) { animation-delay: .4s; }
      @keyframes typingDot { 0%,60%,100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-5px); opacity: 1; } }

      /* Input */
      #cpbt-input-wrap {
        display: flex; gap: 8px; align-items: flex-end;
        padding: 10px 12px;
        border-top: 1px solid rgba(255,255,255,.08);
        flex-shrink: 0;
      }
      #cpbt-input {
        flex: 1; padding: 9px 12px; border-radius: 11px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.05);
        color: #eef5ff; font-size: 14px;
        font-family: system-ui, -apple-system, sans-serif;
        resize: none; outline: none; min-height: 36px; max-height: 100px;
        transition: border-color .2s;
      }
      #cpbt-input::placeholder { color: rgba(139,164,200,.55); }
      #cpbt-input:focus { border-color: rgba(127,198,31,.40); }
      #cpbt-send {
        width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
        background: linear-gradient(135deg, #7fc61f, #2456b8);
        border: none; cursor: pointer; color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; transition: opacity .2s, transform .15s;
      }
      #cpbt-send:hover { opacity: .85; transform: scale(1.05); }
      #cpbt-send:disabled { opacity: .4; cursor: not-allowed; transform: none; }

      /* Error API */
      .cpbt-error {
        color: #fca5a5; font-size: 13px; padding: 8px 12px;
        background: rgba(239,68,68,.12); border-radius: 10px;
        border: 1px solid rgba(239,68,68,.25); align-self: flex-start;
        max-width: 90%;
      }
    `;

    // Inyectar estilos
    const styleEl = document.createElement('style');
    styleEl.textContent = estilos;
    document.head.appendChild(styleEl);

    // Botón flotante
    document.body.insertAdjacentHTML('beforeend', `
      <button id="cpbt-btn" aria-label="Abrir asistente CP BerryTech" title="Asistente IA">
        💬
        <div class="badge">1</div>
      </button>

      <div id="cpbt-window" role="dialog" aria-label="Asistente CP BerryTech">
        <div id="cpbt-header">
          <div class="cpbt-avatar">BT</div>
          <div class="cpbt-header-info">
            <strong>Asistente CP BerryTech</strong>
            <span>● En línea</span>
          </div>
          <button id="cpbt-clear" title="Limpiar conversación" aria-label="Limpiar conversación">🗑</button>
        </div>
        <div id="cpbt-messages"></div>
        <div id="cpbt-input-wrap">
          <textarea id="cpbt-input" placeholder="Escribe tu pregunta…" rows="1" aria-label="Mensaje"></textarea>
          <button id="cpbt-send" aria-label="Enviar">➤</button>
        </div>
      </div>
    `);

    // Referencias
    const btn       = document.getElementById('cpbt-btn');
    const ventana   = document.getElementById('cpbt-window');
    const mensajes  = document.getElementById('cpbt-messages');
    const inputEl   = document.getElementById('cpbt-input');
    const sendBtn   = document.getElementById('cpbt-send');
    const clearBtn  = document.getElementById('cpbt-clear');
    const badge     = btn.querySelector('.badge');

    // -----------------------------------------------
    // Abrir / cerrar
    // -----------------------------------------------
    btn.addEventListener('click', () => {
      estaAbierto = !estaAbierto;
      ventana.classList.toggle('open', estaAbierto);
      btn.textContent = estaAbierto ? '✕' : '💬';
      if (estaAbierto) {
        badge.style.display = 'none';
        if (mensajes.children.length === 0) agregarMensaje('bot', BIENVENIDA);
        inputEl.focus();
        setTimeout(() => mensajes.scrollTop = mensajes.scrollHeight, 100);
      } else {
        btn.insertAdjacentHTML('beforeend', '<div class="badge" style="display:none">1</div>');
      }
    });

    // Limpiar conversación
    clearBtn.addEventListener('click', () => {
      historial = [];
      mensajes.innerHTML = '';
      agregarMensaje('bot', BIENVENIDA);
    });

    // -----------------------------------------------
    // Enviar mensaje
    // -----------------------------------------------
    async function enviar() {
      const texto = inputEl.value.trim();
      if (!texto || estaEscribiendo) return;

      agregarMensaje('user', texto);
      inputEl.value = '';
      inputEl.style.height = 'auto';

      await obtenerRespuesta(texto);
    }

    sendBtn.addEventListener('click', enviar);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
    });

    // Auto-resize textarea
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
    });

    // -----------------------------------------------
    // Agregar mensaje al chat
    // -----------------------------------------------
    function agregarMensaje(rol, texto) {
      const div = document.createElement('div');
      div.className = `cpbt-msg ${rol}`;
      // Renderizado básico de Markdown (negrita, saltos de línea)
      div.innerHTML = texto
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
        .replace(/\*(.*?)\*/g,'<em>$1</em>')
        .replace(/\n/g,'<br>');
      mensajes.appendChild(div);
      mensajes.scrollTop = mensajes.scrollHeight;
    }

    function mostrarEscribiendo() {
      const el = document.createElement('div');
      el.className = 'cpbt-typing';
      el.id = 'cpbt-typing';
      el.innerHTML = '<span></span><span></span><span></span>';
      mensajes.appendChild(el);
      mensajes.scrollTop = mensajes.scrollHeight;
    }

    function ocultarEscribiendo() {
      const el = document.getElementById('cpbt-typing');
      if (el) el.remove();
    }

    // -----------------------------------------------
    // Llamada a Groq API (compatible con OpenAI)
    // -----------------------------------------------
    async function obtenerRespuesta(textoUsuario) {
      estaEscribiendo = true;
      sendBtn.disabled = true;

      // Agregar al historial
      historial.push({ role: 'user', content: textoUsuario });
      if (historial.length > MAX_HISTORIAL) historial = historial.slice(-MAX_HISTORIAL);

      mostrarEscribiendo();

      try {
        const respuesta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_KEY}`
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            // Groq usa el formato OpenAI: system va dentro de messages
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              ...historial
            ]
          })
        });

        if (!respuesta.ok) {
          const err = await respuesta.json().catch(() => ({}));
          throw new Error(err.error?.message || `Error HTTP ${respuesta.status}`);
        }

        const data     = await respuesta.json();
        const textoBot = data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';

        historial.push({ role: 'assistant', content: textoBot });
        if (historial.length > MAX_HISTORIAL) historial = historial.slice(-MAX_HISTORIAL);

        ocultarEscribiendo();
        agregarMensaje('bot', textoBot);

      } catch (err) {
        console.error('Chat widget error:', err);
        ocultarEscribiendo();
        agregarMensaje('bot', 'Ocurrió un error al conectar con el asistente. Por favor escríbenos directamente por **WhatsApp al 3349834257** y te atendemos de inmediato. 🌱');
      } finally {
        estaEscribiendo = false;
        sendBtn.disabled = false;
        inputEl.focus();
      }
    }
  }

  // ================================================
  // INICIALIZAR CUANDO EL DOM ESTÉ LISTO
  // ================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', crearWidget);
  } else {
    crearWidget();
  }

})();
