// --- NUEVO: CONFIGURACIÓN FIREBASE Y VARIABLES GLOBALES ---
let map; // Define el mapa globalmente para poder acceder a él desde otras funciones
const capasRutasActivas = {}; // Diccionario para guardar las líneas dibujadas y borrarlas

const firebaseConfig = {
    apiKey: "AIzaSyC7V0TZR3tk7vZL2xZrGJzM5xbJkIok6mY",
    authDomain: "waynorte-1f57c.firebaseapp.com",
    projectId: "waynorte-1f57c",
    storageBucket: "waynorte-1f57c.firebasestorage.app",
    messagingSenderId: "872233471576",
    appId: "1:872233471576:web:24d2c63c5cdf71a09bc42d",
    measurementId: "G-PKQ7LPV12G"
};

// Inicializamos Firebase y Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- 1. SISTEMA DE USUARIOS WAYNORTE ---

let usuarioActual = null; 

async function registrarUsuario() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!email || !password) {
        return alert("Por favor, ingresa tu correo y contraseña para registrarte.");
    }

    try {
        const respuesta = await fetch('https://waynorte-backend.onrender.com/api/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }) 
        });

        const data = await respuesta.json(); 

        if (!respuesta.ok) {
            alert(data.error); 
        } else {
            alert("¡Cuenta creada con éxito! Ahora puedes iniciar sesión.");
            document.getElementById('auth-password').value = ''; 
        }
    } catch (error) {
        console.error("Error:", error);
        alert("No se pudo conectar con el servidor de base de datos.");
    }
}

async function iniciarSesion() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!email || !password) {
        return alert("Por favor, ingresa tu correo y contraseña.");
    }

    try {
        // CORREGIDO: Apunta a /api/login
        const respuesta = await fetch('https://waynorte-backend.onrender.com/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            alert(data.error); 
        } else {
            usuarioActual = data.usuario; 
            alert(`¡Bienvenido a WayNorte, ${usuarioActual.email}!`);
            mostrarMapa(); 
        }
    } catch (error) {
        console.error("Error:", error);
        alert("No se pudo conectar con el servidor.");
    }
}

function mostrarMapa() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('map').style.display = 'block';
    document.getElementById('map-legend').style.display = 'block';
    initMap(); 
}


// --- 2. GESTIÓN DE COMENTARIOS REALES (CON BACKEND) ---

window.enviarComentario = async function(marcadorId) {
    const input = document.getElementById(`input-${marcadorId}`);
    const stars = document.getElementById(`stars-${marcadorId}`).value;
    const texto = input.value.trim();

    if (texto === "") return; 

    try {
        // CORREGIDO: Apunta a /api/comentarios
        const respuesta = await fetch('https://waynorte-backend.onrender.com/api/comentarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                marcador_id: marcadorId,
                usuario_id: usuarioActual.id,
                texto: texto,
                estrellas: parseInt(stars)
            })
        });

        if (respuesta.ok) {
            input.value = ""; 
            alert("Reseña publicada con éxito.");
            document.querySelector('.leaflet-popup-close-button').click();
        } else {
            alert("No se pudo guardar la reseña.");
        }
    } catch (error) {
        console.error("Error al publicar comentario:", error);
    }
};

window.eliminarComentario = async function(comentarioId, autorId) {
    if (usuarioActual.id !== autorId) {
        return alert("Disculpa, solo puedes eliminar tus propias reseñas.");
    }

    if (!confirm("¿Deseas eliminar este comentario permanentemente?")) return;

    try {
        // CORREGIDO: Mantiene la ID dinámica del comentario al final
        const respuesta = await fetch(`https://waynorte-backend.onrender.com/api/comentarios/${comentarioId}`, {
            method: 'DELETE'
        });

        if (respuesta.ok) {
            alert("Comentario eliminado.");
            document.querySelector('.leaflet-popup-close-button').click();
        }
    } catch (error) {
        console.error("Error al eliminar comentario:", error);
    }
};

async function cargarComentariosPopup(marcadorId) {
    try {
        // CORREGIDO: Mantiene la ID del marcador al final
        const respuesta = await fetch(`https://waynorte-backend.onrender.com/api/comentarios/${marcadorId}`);
        const comentarios = await respuesta.json();

        const listaHtml = comentarios.map(c => `
            <div class="comment-item" style="border-left: 3px solid ${usuarioActual.id === c.usuario_id ? '#2ed573' : '#1e90ff'}">
                <span>
                    <b>${"★".repeat(c.estrellas)}</b> <br>
                    <small style="color: #888">${c.email.split('@')[0]}:</small> ${c.texto}
                </span>
                ${usuarioActual.id === c.usuario_id ? `<button class="btn-delete" onclick="eliminarComentario(${c.id}, ${c.usuario_id})">✕</button>` : ''}
            </div>
        `).join("");

        document.getElementById(`comment-list-${marcadorId}`).innerHTML = listaHtml || "Sin reseñas aún. ¡Sé el primero!";
    } catch (error) {
        console.error("Error cargando comentarios:", error);
    }
}


// --- 3. INICIALIZACIÓN DEL MAPA ---

async function initMap() {
    map = L.map('map').setView([-18.4783, -70.3126], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // NUEVO: Oculta la tarjetita automáticamente al pellizcar o alejar el mapa para que no estorbe la vista
    map.on('zoomstart', () => {
        map.closePopup();
    });

    const layerTurismo = L.layerGroup().addTo(map);
    const layerReciclaje = L.layerGroup().addTo(map);
    const layerParaderos = L.layerGroup().addTo(map);

    try {
        // CORREGIDO: Estaba en localhost, ahora apunta a la nube
        const respuesta = await fetch('https://waynorte-backend.onrender.com/api/marcadores');
        const puntosArica = await respuesta.json(); 

        puntosArica.forEach(p => {
            // NUEVO: Íconos más pequeños [18, 29] para no cubrir toda la ciudad cuando te alejas
            const iconTurismo = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [18, 29], iconAnchor: [9, 29], popupAnchor: [1, -24], shadowSize: [29, 29] });
            const iconReciclaje = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [18, 29], iconAnchor: [9, 29], popupAnchor: [1, -24], shadowSize: [29, 29] });
            const iconParadero = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [18, 29], iconAnchor: [9, 29], popupAnchor: [1, -24], shadowSize: [29, 29] });

            // --- NUEVO: Generar el HTML de las líneas Ocultando botones que no corresponden ---
            let lineasHtml = "";
            if (p.lineas_que_pasan && p.lineas_que_pasan.length > 0) {
                lineasHtml = `<div class="contenedor-lineas">
                                <h4>Micros que se detienen aquí:</h4>`;
                
                p.lineas_que_pasan.forEach(linea => {
                    const destinoTxt = linea.destino ? ` (Hacia: ${linea.destino})` : '';
                    
                    lineasHtml += `
                    <div class="micro-item">
                        <span class="micro-titulo">🚌 <strong>${linea.nombre}</strong>${destinoTxt}</span>
                        <div class="opciones-ruta">`;

                    // Si el sentido es "ida" O si aún no le asignas sentido en pgAdmin
                    if (linea.sentido === 'ida' || !linea.sentido) {
                        const idIda = `${linea.nombre.trim()}_ruta_ida`;
                        
                        // CORREGIDO: Usamos la clase "switch-ruta" y "data-idcapa" para sincronizarlos después
                        lineasHtml += `
                            <label class="toggle-label">
                                <div class="color-dot" style="background-color: #1e90ff;"></div> Ida
                                <label class="switch">
                                    <input type="checkbox" class="switch-ruta" data-idcapa="${idIda}" onchange="alternarCapaRuta('${linea.nombre}', 'ruta_ida', this.checked)">
                                    <span class="slider"></span>
                                </label>
                            </label>`;
                    }

                    // Si el sentido es "vuelta" O si aún no le asignas sentido en pgAdmin
                    if (linea.sentido === 'vuelta' || !linea.sentido) {
                        const idVuelta = `${linea.nombre.trim()}_ruta_vuelta`;
                        
                        // CORREGIDO: Usamos la clase "switch-ruta" y "data-idcapa" para sincronizarlos después
                        lineasHtml += `
                            <label class="toggle-label">
                                <div class="color-dot" style="background-color: #ba1a3a;"></div> Vuelta
                                <label class="switch">
                                    <input type="checkbox" class="switch-ruta" data-idcapa="${idVuelta}" onchange="alternarCapaRuta('${linea.nombre}', 'ruta_vuelta', this.checked)">
                                    <span class="slider"></span>
                                </label>
                            </label>`;
                    }

                    lineasHtml += `
                        </div>
                    </div>`;
                });
                lineasHtml += `</div>`;
            }

            // Inyectamos las líneas justo antes de la sección de comentarios
            const card = `
                <div class="custom-card">
                    <img src="${p.img}" class="popup-img">
                    <div class="popup-info">
                        <h3>${p.nombre}</h3>
                        ${lineasHtml}
                        <div class="comment-section">
                            <div class="comment-list" id="comment-list-${p.id}">Cargando opiniones...</div>
                            <select id="stars-${p.id}" class="comment-input">
                                <option value="5">★★★★★</option><option value="4">★★★★</option>
                                <option value="3">★★★</option><option value="2">★★</option><option value="1">★</option>
                            </select>
                            <input type="text" id="input-${p.id}" class="comment-input" placeholder="Tu opinión...">
                            <button onclick="enviarComentario('${p.id}')" class="btn-comment">Publicar</button>
                        </div>
                    </div>
                </div>`;
            
            let iconoActual;
            if (p.tipo === "turismo") iconoActual = iconTurismo;
            else if (p.tipo === "reciclaje") iconoActual = iconReciclaje;
            else if (p.tipo === "paradero") iconoActual = iconParadero;

            const coordenadasReales = [parseFloat(p.latitud), parseFloat(p.longitud)];

            const marker = L.marker(coordenadasReales, { icon: iconoActual }).bindPopup(card, { className: 'custom-popup' });
            
            marker.on('popupopen', () => {
                cargarComentariosPopup(p.id);
                
                // --- NUEVO: Sincronización visual de los botones (switches) ---
                // Le damos un respiro pequeñito de 10 milisegundos para que la tarjeta se dibuje en la pantalla
                setTimeout(() => {
                    const switches = document.querySelectorAll('.switch-ruta');
                    switches.forEach(btn => {
                        const idCapa = btn.getAttribute('data-idcapa');
                        // Si la ruta está en nuestro diccionario de "rutas activas", encendemos el switch
                        if (capasRutasActivas[idCapa]) {
                            btn.checked = true;
                        } else {
                            btn.checked = false;
                        }
                    });
                }, 10);
            });

            if (p.tipo === "turismo") marker.addTo(layerTurismo);
            else if (p.tipo === "reciclaje") marker.addTo(layerReciclaje);
            else if (p.tipo === "paradero") marker.addTo(layerParaderos);
        });

        const overlays = { "📍 Turismo": layerTurismo, "♻️ Reciclaje": layerReciclaje, "🚌 Paraderos": layerParaderos };
        L.control.layers(null, overlays, { collapsed: false }).addTo(map);

        const gpsIcon = L.divIcon({ className: 'user-location-icon', iconSize: [14, 14], iconAnchor: [7, 7] });
        let userMarker = L.marker([0, 0], { icon: gpsIcon }).addTo(map);
        let currentLatLng = null;

        map.locate({ watch: true, setView: false }); 
        map.on('locationfound', (e) => {
            currentLatLng = e.latlng;
            userMarker.setLatLng(e.latlng);
        });

        window.centrarEnUsuario = function() {
            if (currentLatLng) map.setView(currentLatLng, 16);
            else alert("Buscando señal GPS...");
        };

    } catch (error) {
        console.error("Error al conectar con el servidor de WayNorte:", error);
        alert("No se pudieron cargar los marcadores desde la base de datos.");
    }
}

// --- NUEVO: 4. LÓGICA PARA DIBUJAR LAS RUTAS DESDE FIRESTORE CON FLECHAS ---

async function alternarCapaRuta(nombreLinea, tipoRuta, encendido) {
    // Llave única y limpia para identificar la capa (Ej: "Linea 4_ruta_vuelta")
    const identificadorCapa = `${nombreLinea.trim()}_${tipoRuta.trim()}`;

    if (encendido) {
        // Evitar que haga peticiones dobles si ya se está cargando
        if (capasRutasActivas[identificadorCapa]) return;
        
        capasRutasActivas[identificadorCapa] = "cargando"; // Candado de seguridad temporal

        try {
            // Buscamos el documento en Firestore por el nombre de la línea
            const consulta = await db.collection("lineas").where("nombre", "==", nombreLinea).get();
            
            // Si el usuario apagó el switch antes de que cargara, frenamos todo
            if (consulta.empty || capasRutasActivas[identificadorCapa] !== "cargando") {
                return;
            }

            const datosLinea = consulta.docs[0].data();
            const stringCoordenadas = datosLinea[tipoRuta]; // Trae el texto JSON largo
            const colorLinea = tipoRuta === 'ruta_ida' ? datosLinea.color_ida : datosLinea.color_vuelta;

            if (!stringCoordenadas || stringCoordenadas === "[]") {
                alert(`La ruta seleccionada para la ${nombreLinea} aún no tiene coordenadas cargadas.`);
                delete capasRutasActivas[identificadorCapa];
                return;
            }

            // Convertimos la cadena de texto a un array de JavaScript
            const coordenadasGeoJSON = JSON.parse(stringCoordenadas);

            // Volteamos las coordenadas de [Lng, Lat] a [Lat, Lng] para Leaflet
            const coordenadasLeaflet = coordenadasGeoJSON.map(coord => [coord[1], coord[0]]);

            // 1. Dibujamos la línea principal en el mapa
            const polilinea = L.polyline(coordenadasLeaflet, {
                color: colorLinea || '#3388ff',
                weight: 6,
                opacity: 0.8
            });

            // 2. CREAMOS LAS FLECHAS (Decorador)
            const decorador = L.polylineDecorator(polilinea, {
                patterns: [
                    {
                        offset: 25,          // Empieza a 25px del inicio
                        repeat: 100,         // Repite la flecha cada 100px
                        symbol: L.Symbol.arrowHead({
                            pixelSize: 12,
                            polygon: false,
                            pathOptions: { stroke: true, weight: 2, color: 'white' }
                        })
                    }
                ]
            });

            // 3. Agrupamos la línea y las flechas para poder tratarlas como un solo objeto
            const grupoCapa = L.layerGroup([polilinea, decorador]).addTo(map);

            // Verificamos por última vez si no lo han apagado antes de dibujarlo en el mapa
            if (capasRutasActivas[identificadorCapa] === "cargando") {
                capasRutasActivas[identificadorCapa] = grupoCapa;
            } else {
                map.removeLayer(grupoCapa);
            }

            // map.fitBounds(polilinea.getBounds()); // ELIMINADO para que no aleje la cámara en celular

        } catch (error) {
            console.error("Error obteniendo el trazado desde Firestore:", error);
            delete capasRutasActivas[identificadorCapa];
        }
    } else {
        // Si el switch se apaga, removemos el GRUPO (línea + flechas) del mapa usando el ID exacto
        const capa = capasRutasActivas[identificadorCapa];
        if (capa) {
            // Solo lo borra del mapa si ya había terminado de cargar
            if (capa !== "cargando") {
                map.removeLayer(capa);
            }
            delete capasRutasActivas[identificadorCapa]; // Elimina la memoria de la ruta
        }
    }
}

// --- CONTROL DEL MODO NOCTURNO ---
document.getElementById('btn-darkMode').addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
    
    if (document.body.classList.contains('dark-mode')) {
        this.innerHTML = '☀️'; 
        this.title = "Modo Claro";
        this.style.background = "#2b3643"; 
        this.style.color = "white";
    } else {
        this.innerHTML = '🌙'; 
        this.title = "Modo Nocturno";
        this.style.background = "white"; 
        this.style.color = "black";
    }
});