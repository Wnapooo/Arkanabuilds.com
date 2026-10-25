// Cada personaje de la tier list lleva a su build.
// claret_card.webp  ->  builds.html#claret
document.querySelectorAll('.char-icon').forEach(function (icon) {
  var img = icon.querySelector('img');
  if (!img) return; // el cuadro vacío no lleva a ningún lado

  var slug = img.getAttribute('src').split('/').pop().replace('_card.webp', '');

  var a = document.createElement('a');
  a.href = './builds.html#' + slug;
  a.title = img.alt;
  a.style.display = 'block';
  a.style.flexShrink = '0';
  a.style.textDecoration = 'none';

  icon.replaceWith(a);
  a.appendChild(icon);
});
