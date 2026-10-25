document.querySelectorAll('.char-icon').forEach(function (icon) {
    var img = icon.querySelector('img');
    if (!img) return; // Si el cuadro está vacío, no hace nada

    // Extrae el nombre limpio del personaje (ej: 'claret' o 'sigrid')
    var slug = img.getAttribute('src').split('/').pop().replace(/(_card)?\.webp$/, '');

    var a = document.createElement('a');
    // Genera el enlace apuntando a tu sistema de rutas en builds.html
    a.href = './builds.html#' + slug;
    a.title = img.alt || slug;
    a.style.display = 'block';
    a.style.flexShrink = '0';
    a.style.textDecoration = 'none';

    icon.replaceWith(a);
    a.appendChild(icon);
});
