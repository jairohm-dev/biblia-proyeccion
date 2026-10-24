# Manual de Biblia

Guía de uso completa. Para instalar, mira el [README](../README.md).

## Primeros pasos

1. En el panel izquierdo elige **Biblia**, **Canciones**, **Estudio** o **Internet** y abre lo que quieras proyectar.
   Sus diapositivas aparecen abajo y la elegida se ve en la pantalla grande (**Vista previa**).
2. Pulsa **Poner en vivo** (o `Intro`): la pantalla se marca en rojo y el proyector muestra lo mismo.
   Mientras está en vivo, cada diapositiva que elijas se proyecta al momento. Pulsa
   **En vivo · Apagar** (o `Intro` otra vez) y el proyector queda solo con el fondo.
3. Pulsa **Abrir proyector**; si hay una segunda pantalla, la ventana se mueve allí.
   Haz clic en ella para verla a pantalla completa.
4. Pulsa **Apariencia** (arriba a la derecha): se abre el panel lateral con las pestañas **Texto**,
   **Cita**, **Fondo**, **Pantalla** y **Animación**. Ajusta la letra, el tamaño, el borde y la sombra
   del texto; la letra, el tamaño, el color y las mayúsculas de la cita; el fondo (color, imagen,
   marco); el formato de la pantalla; y las transiciones y animaciones del texto.

En **Ir a pasaje** escribe o elige el libro (acepta abreviaturas como `jn` o `1 co`), el capítulo y el
versículo, y pulsa `Intro` (vista previa) o `⌘ Intro` (directo a En vivo).

El buscador de la Biblia entiende citas (`Juan 3:16`, `jn 3 16`, `Sal 23`, `1 Co 13:4-7`), varias a la
vez separadas por `;` (`Juan 3:16-18; Rom 8:28`) y palabras sueltas. Un rango carga solo esos versículos.
**Buscar canciones** consulta [LRCLIB](https://lrclib.net) y convierte la letra en diapositivas;
puedes guardarla en **Mis canciones** (se guarda en este navegador).

## Biblias

En la pestaña **Biblia**, el selector de arriba cambia de versión y **Más Biblias** muestra el
catálogo con el peso de cada una: Reina-Valera 1960 (incluida), Reina-Valera 1909, Reina-Valera
1865, King James y World English Bible. Al pulsar **Descargar** se baja desde GitHub, se guarda en
el navegador (IndexedDB) y después funciona sin internet. La cita puede mostrar la versión
(Apariencia → Cita → Añadir la versión).

## Canciones y carpetas

La pestaña **Canciones** muestra tus colecciones como lista: los himnarios, **Todas mis canciones**
y cada carpeta con su número de canciones. El buscador busca en todas a la vez.

- **Subir letra** abre el editor: pega la letra, escríbela o pulsa **Abrir archivo de texto**
  (también puedes arrastrar un `.txt` o `.lrc` al cuadro). Elige la carpeta y guarda.
- **Nueva carpeta** crea carpetas como «Adoración» o «Júbilo». Dentro de una carpeta puedes
  renombrarla o eliminarla (sus canciones no se borran).
- Al abrir una canción tuya, el menú **Carpeta** de la barra de diapositivas la mueve a otra.
- Las canciones de internet se guardan con **Guardar en Mis canciones**, eligiendo la carpeta.

Todo se guarda en este navegador.

## Estudio

La pestaña **Estudio** sirve para crear tus propias diapositivas y guardar archivos:

- **Presentación** crea una colección de diapositivas y abre el editor. Ahí puedes:
  - añadir **Texto** e **Imagen**, o soltar imágenes desde tu computadora sobre la diapositiva;
  - **arrastrar** para mover y usar las **esquinas** para agrandar (las imágenes mantienen su
    proporción; con `Mayús` se deforman), con guías rojas al pasar por el centro;
  - cambiar letra, tamaño, grosor, alineación, color y sombra del texto; ajuste, opacidad y
    esquinas redondeadas de la imagen; ordenar (al frente / atrás), duplicar o eliminar;
  - elegir el fondo de cada diapositiva (o usar el de Apariencia) y poner una imagen de fondo;
  - añadir, duplicar, eliminar y **reordenar diapositivas arrastrándolas** en la lista de la izquierda.
  
  Teclado en el editor: `Supr` borra, flechas mueven (con `Mayús`, más rápido), `⌘D` duplica.
- **Imagen** y **Video** guardan archivos para proyectarlos tal cual (Ver completa / Llenar, Repetir).
  Con un video abierto aparece sobre la pantalla una **barra de reproducción**: Reproducir/Pausar,
  Desde el inicio, **línea de tiempo** que puedes arrastrar (el proyector y OBS saltan al mismo punto)
  y **volumen** con silenciar.
- **Audio** guarda música o pistas. Al tocar un audio se abre un **reproductor** en la barra superior
  (línea de tiempo, volumen, cerrar) que **sigue sonando mientras cambias de diapositiva**. El audio
  sale de la consola; no se proyecta.
- **Texto** crea diapositivas de solo texto (anuncios, bienvenida).

Todo se guarda en este navegador. Las presentaciones también se ven en el proyector y en OBS.

**Sonido de los videos:** cuando un video está En vivo, el sonido sale de la consola (esta
ventana). La ventana del proyector va en silencio porque el navegador no la deja sonar sin que
alguien la toque, y así tampoco suena doble. OBS lleva su propio sonido. Si el navegador bloquea
el sonido, aparece un aviso con **Activar sonido**.

## Diseño de la pantalla (cajas del texto y de la cita)

En **Apariencia → Pantalla → Diseño** se abre el editor de diseño, como el de los temas de EasyWorship:

- El texto y la cita tienen cada uno **su caja**, con borde punteado. Arrástralas para moverlas en
  **X** e **Y** y usa las **esquinas** para cambiar su tamaño; al pasar por el centro aparecen guías rojas.
- Para separar la cita del texto no hace falta tocar márgenes: **mueve la caja de la cita**.
- En el panel: posición y tamaño exactos, **Centrar**, **Mismo ancho**, **Todo el ancho** y
  «Texto dentro de su caja» (arriba, centro o abajo). Las flechas del teclado la mueven poco a poco.
- Si el versículo no cabe, la letra del texto se reduce sola; la cita mantiene su tamaño.
- Los cambios se ven al momento en el proyector y en OBS.

## Editar versículos

Con un versículo abierto, **Editar versículo** cambia su texto solo en este equipo (por ejemplo, para
corregir una errata o acortarlo). Se marca como «editado» y se puede **Restaurar** el original.

## Previa + En vivo

El interruptor **Previa + En vivo** muestra dos pantallas: a la izquierda preparas lo siguiente y a la
derecha está lo que se proyecta. Las flechas pasan directamente En vivo.

## Fondo (Apariencia → Fondo)

Color o imagen de fondo. Con imagen: **Llenar la pantalla** o **Ver completa**, **Zoom** (de 0 % a 300 %), **Mover
horizontal (X)** y **vertical (Y)**, **Desenfoque**, y un **velo** con su color y opacidad para que el
texto se lea mejor. Con el panel abierto en Fondo también puedes arrastrar la imagen sobre la pantalla
para moverla y usar la rueda o el pellizco para el zoom. **Centrar** la deja como al principio.

## OBS

Pulsa **OBS** en la barra superior (o **Enlace para OBS** junto a la pantalla cuando estás en vivo).
Hay dos enlaces:

- **Pantalla completa**: `http://localhost:3737/?salida&obs`
- **Solo texto con fondo transparente**, para superponer a la cámara:
  `http://localhost:3737/?salida&obs&transparente`

En OBS: Fuentes → + → Navegador, pega el enlace y pon el tamaño de tu formato (Apariencia →
Pantalla): 16:9 → 1920 × 1080, 16:10 → 1920 × 1200, 4:3 → 1440 × 1080. El diálogo de OBS lo indica solo. Lo que pongas En vivo
aparece en OBS al momento. Requiere abrir la app con el servidor (`./serve.sh` o
`iniciar-windows.cmd`). Para OBS en **otro equipo**, arranca con `--red` (Windows: `-Red`) y usa el
enlace con `&k=…` que aparece al arrancar.

## Agregar himnos

Edita `himnarios.json`. Cada himnario aparece en la barra lateral:

```json
{
  "id": "mi-himnario",
  "nombre": "Himnario de la iglesia",
  "descripcion": "Opcional",
  "himnos": [
    {
      "numero": 1,
      "titulo": "Título",
      "autor": "Opcional",
      "estrofas": [
        { "tipo": "estrofa", "texto": "Línea 1\nLínea 2" },
        { "tipo": "coro", "texto": "Línea del coro" }
      ]
    }
  ]
}
```

## Atajos de teclado

- `→` `↓` espacio — siguiente diapositiva
- `←` `↑` — anterior
- `Intro` — encender o apagar En vivo
- `⌘K` o `/` — buscar
- `Esc` — cerrar Apariencia o un diálogo
- `⌘ Intro` en «Ir a pasaje» — abrir y poner en vivo

Funcionan también con la ventana del proyector enfocada.

## Búsqueda en internet

En **Internet** escribe una canción, un cantante o una orquesta y pulsa `Intro`. Aparecen:

- **Artistas**, desde el catálogo público de Apple (iTunes). Al abrir uno se ven todas sus canciones,
  con carátula, álbum y duración, y un filtro. Al tocar una canción la app busca su letra y la
  convierte en diapositivas; si no la encuentra, ofrece buscarla en Google o escribirla a mano.
- **Canciones con letra**, desde LRCLIB, listas para proyectar.

LRCLIB es gratuito y a veces está saturado («servidor ocupado»). La app reintenta sola hasta
6 veces y muestra el progreso. El catálogo de Apple se consulta para la tienda de México (`MX`);
se puede cambiar en `STORE_COUNTRY`, dentro de `app.js`.
