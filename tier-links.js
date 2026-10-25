// ==========================================
// 1. GENERADOR DE ENLACES (Para tu Tier List)
// ==========================================
document.querySelectorAll('.char-icon').forEach(function (icon) {
    var img = icon.querySelector('img');
    if (!img) return; // Si el cuadro está vacío, no hace nada

    // Extrae el nombre limpio del personaje (ej: 'claret' o 'soldier-11')
    var slug = img.getAttribute('src').split('/').pop().replace(/(_card)?\.webp$/, '');

    var a = document.createElement('a');
    // Te redirige a builds.html con el ancla del personaje (ej: builds.html#claret)
    a.href = './builds.html#' + slug;
    a.title = img.alt || slug;
    a.style.display = 'block';
    a.style.flexShrink = '0';
    a.style.textDecoration = 'none';

    icon.replaceWith(a);
    a.appendChild(icon);
});

// ==========================================
// 2. DETECTOR DE PERSONAJE (Para tu página builds.html)
// ==========================================
function cargarBuildPorHash() {
    // Detecta qué personaje viene en la URL después del '#' (ej: 'claret')
    var slug = window.location.hash.replace('#', '');
    
    if (slug) {
        // Formatea el nombre visual poniendo la primera letra en mayúscula (ej: 'claret' -> 'Claret')
        // Si tiene guion (ej: 'soldier-11'), lo limpia un poco para el título
        var nombrePersonaje = slug.split('-').map(function(word) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');

        // 1. Actualiza el título H1 con el nombre del personaje
        var nameElement = document.querySelector('.div-detail h1');
        if (nameElement) {
            nameElement.textContent = nombrePersonaje;
        }
        
        // 2. Cambia la foto grande por la versión correspondente (ej: ./claret_card.webp)
        var imgPortrait = document.querySelector('.portrait'); 
        if (imgPortrait) {
            imgPortrait.src = './' + slug + '_card.webp';
            imgPortrait.alt = nombrePersonaje;
        }

        // 3. Manejo de secciones (Muestra el detalle del personaje y oculta la galería principal si existe)
        var detailSection = document.getElementById('detail');
        var gallerySection = document.getElementById('gallery');
        
        if (detailSection) {
            detailSection.removeAttribute('hidden');
            detailSection.style.display = 'block';
        }
        if (gallerySection) {
            gallerySection.setAttribute('hidden', 'true');
            gallerySection.style.display = 'none';
        }
    }
}

// Escucha cuando la página se termina de cargar
window.addEventListener('DOMContentLoaded', cargarBuildPorHash);
// Escucha si cambias de personaje sin cerrar la pestaña
window.addEventListener('hashchange', cargarBuildPorHash);
