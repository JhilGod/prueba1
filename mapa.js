// --- CONFIGURACIÓN FIREBASE Y VARIABLES GLOBALES ---
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
    
    const limitesArica = [
        [-18.5600, -70.3800], 
        [-18.4000, -70.2000]  
    ];

    map = L.map('map', {
        maxBounds: limitesArica,      
        maxBoundsViscosity: 1.0,      
        minZoom: 13                   
    }).setView([-18.4783, -70.3126], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    map.on('zoomstart', () => {
        map.closePopup();
    });

    const layerTurismo = L.layerGroup().addTo(map);
    const layerReciclaje = L.layerGroup().addTo(map);
    const layerParaderos = L.layerGroup().addTo(map);

    try {
        const respuesta = await fetch('https://waynorte-backend.onrender.com/api/marcadores');
        const puntosArica = await respuesta.json(); 

        puntosArica.forEach(p => {
            const iconTurismo = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [18, 29], iconAnchor: [9, 29], popupAnchor: [1, -24], shadowSize: [29, 29] });
            const iconReciclaje = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [18, 29], iconAnchor: [9, 29], popupAnchor: [1, -24], shadowSize: [29, 29] });
            const iconParadero = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [18, 29], iconAnchor: [9, 29], popupAnchor: [1, -24], shadowSize: [29, 29] });

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

                    if (linea.sentido === 'ida' || !linea.sentido) {
                        const idIda = `${linea.nombre.trim()}_ruta_ida`;
                        lineasHtml += `
                            <label class="toggle-label">
                                <div class="color-dot" style="background-color: #1e90ff;"></div> Ida
                                <label class="switch">
                                    <input type="checkbox" class="switch-ruta" data-idcapa="${idIda}" onchange="alternarCapaRuta('${linea.nombre}', 'ruta_ida', this.checked)">
                                    <span class="slider"></span>
                                </label>
                            </label>`;
                    }

                    if (linea.sentido === 'vuelta' || !linea.sentido) {
                        const idVuelta = `${linea.nombre.trim()}_ruta_vuelta`;
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
                
                setTimeout(() => {
                    const switches = document.querySelectorAll('.switch-ruta');
                    switches.forEach(btn => {
                        const idCapa = btn.getAttribute('data-idcapa');
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

// --- 4. LÓGICA PARA DIBUJAR LAS RUTAS DESDE FIRESTORE CON FLECHAS ---

async function alternarCapaRuta(nombreLinea, tipoRuta, encendido) {
    const identificadorCapa = `${nombreLinea.trim()}_${tipoRuta.trim()}`;

    if (encendido) {
        if (capasRutasActivas[identificadorCapa]) return;
        
        capasRutasActivas[identificadorCapa] = "cargando"; 

        try {
            const consulta = await db.collection("lineas").where("nombre", "==", nombreLinea).get();
            
            if (consulta.empty || capasRutasActivas[identificadorCapa] !== "cargando") {
                return;
            }

            const datosLinea = consulta.docs[0].data();
            const stringCoordenadas = datosLinea[tipoRuta]; 
            const colorLinea = tipoRuta === 'ruta_ida' ? datosLinea.color_ida : datosLinea.color_vuelta;

            if (!stringCoordenadas || stringCoordenadas === "[]") {
                alert(`La ruta seleccionada para la ${nombreLinea} aún no tiene coordenadas cargadas.`);
                delete capasRutasActivas[identificadorCapa];
                return;
            }

            const coordenadasGeoJSON = JSON.parse(stringCoordenadas);
            const coordenadasLeaflet = coordenadasGeoJSON.map(coord => [coord[1], coord[0]]);

            const polilinea = L.polyline(coordenadasLeaflet, {
                color: colorLinea || '#3388ff',
                weight: 6,
                opacity: 0.8
            });

            const decorador = L.polylineDecorator(polilinea, {
                patterns: [
                    {
                        offset: 30,          
                        repeat: 120,         
                        symbol: L.Symbol.arrowHead({
                            pixelSize: 14,   
                            polygon: true,   
                            pathOptions: { 
                                stroke: true, 
                                weight: 2, 
                                color: 'white', 
                                fillColor: colorLinea || '#3388ff', 
                                fillOpacity: 1 
                            }
                        })
                    }
                ]
            });

            const grupoCapa = L.layerGroup([polilinea, decorador]).addTo(map);

            if (capasRutasActivas[identificadorCapa] === "cargando") {
                capasRutasActivas[identificadorCapa] = grupoCapa;
            } else {
                map.removeLayer(grupoCapa);
            }

        } catch (error) {
            console.error("Error obteniendo el trazado desde Firestore:", error);
            delete capasRutasActivas[identificadorCapa];
        }
    } else {
        const capa = capasRutasActivas[identificadorCapa];
        if (capa) {
            if (capa !== "cargando") {
                map.removeLayer(capa);
            }
            delete capasRutasActivas[identificadorCapa]; 
        }
    }
}

// --- NUEVO: CONTROL DEL MODO NOCTURNO CON SWITCH FLOTANTE ---
document.getElementById('dark-mode-toggle').addEventListener('change', function() {
    if (this.checked) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
});