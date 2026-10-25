// Esperamos a que la página de la Tier List cargue por completo
document.addEventListener("DOMContentLoaded", () => {
  // Selecciona todas las imágenes de la Tier List
  const imagenes = document.querySelectorAll('img');

  imagenes.forEach(function (img) {
    var src = img.getAttribute('src');
    if (!src) return;
    
    // Si es un icono de interfaz o un cuadro vacío, lo saltamos
    if (src.includes('vacio') || src.includes('logo') || src.includes('icon')) return; 

    // Cambiamos el cursor a una mano para que el usuario sepa que es clickeable
    img.style.cursor = 'pointer';

    // Extraemos el nombre limpio del personaje desde el nombre de su archivo de imagen
    var slug = src.split('/').pop().replace('_card.webp', '').replace('.webp', '');

    // Al hacer clic en la foto, te redirige automáticamente a la página de builds de ese personaje
    img.addEventListener('click', function() {
      window.location.href = './builds.html#' + slug;
    });
  });
});
