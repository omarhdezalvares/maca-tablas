# Maca Tablas ✖️

App para aprender las tablas de multiplicar del 1 al 10 con trucos, rimas y repetición espaciada. Está pensada para iPad, es HTML/CSS/JS puro y no tiene dependencias, así que funciona directo en GitHub Pages.

## Qué tiene

- **🎯 Repaso del día**: elige solas las multiplicaciones que tocan hoy (repetición espaciada con 5 cajas). Si no hay pendientes, introduce las nuevas tabla por tabla.
- **🧠 Aprender**: el truco de cada tabla, rimas para las difíciles, dibujo de puntos y el truco de los dedos para la tabla del 9. Tiene botón para escuchar.
- **✏️ Practicar**: 10 preguntas de una tabla. Se adapta: al principio son de opción múltiple, después hay que escribir la respuesta y al final aparecen "huecos" (`7 × ? = 56`).
- **⏱️ Contrarreloj**: un minuto, contra su propio récord.
- **🃏 Memorama**: encontrar las parejas operación-resultado.
- **🗺️ Mi mapa**: la tabla 10×10 se colorea según lo que ya domina.
- **🏆 Stickers y mascota**: la mascota crece con las estrellas y cada tabla dominada da un sticker.

Cuando falla, la app le muestra el truco o la rima y le repite la pregunta al final de la ronda.

## Cambiar rimas, trucos o la mascota

Todo el texto está en [data/contenido.json](data/contenido.json). Las rimas se escriben con el número menor primero (`"6x8"`). Puedes cambiar la mascota (emojis y cuántas estrellas necesita cada etapa) y los stickers.

## Publicar en GitHub Pages

1. Sube el repo a GitHub.
2. Ve a **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
3. Abre `https://TU_USUARIO.github.io/maca-tablas/` en el iPad. En Safari usa **Compartir → Agregar a pantalla de inicio** para que se abra como app, a pantalla completa.

## Guardar el progreso en GitHub (opcional)

El progreso siempre se guarda en el navegador del iPad. Para guardarlo también en un JSON del repositorio:

1. En GitHub ve a **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. En **Repository access**, elige solo este repositorio.
3. En **Permissions → Contents**, elige **Read and write**.
4. En la app, abre ⚙️ **Ajustes** y pega el token. Usuario y repositorio se llenan solos cuando la app corre en GitHub Pages. Después toca **Guardar y sincronizar**.

La app crea o actualiza `data/progreso.json` al terminar cada ronda. El token se queda solo en ese iPad, no en el código. Cada guardado es un commit y vuelve a publicar la página; eso no causa problemas.

## Probar en la computadora

Abrir `index.html` con doble clic no funciona, porque el navegador bloquea la lectura del JSON. Usa un servidor local:

```sh
python -m http.server 8000
```

Y abre http://localhost:8000.
