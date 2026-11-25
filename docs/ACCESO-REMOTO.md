# Controlar Biblia desde otro dispositivo

El control desde otro dispositivo usa el servidor web (`serve.sh` o `iniciar-windows.cmd`).
Desde la app de escritorio puedes compartir la proyección con OBS.

## Por IP en la misma red

1. En Mac, ejecuta `./serve.sh` en Terminal. En Windows, abre `iniciar-windows.cmd`.
   Elige **Iniciar con acceso al panel por IP (HTTPS)** mientras ambos dispositivos están en la misma red.
2. Si es la primera vez que usas Biblia, crea el PIN en el navegador de la PC que ejecuta el servidor.
3. Copia `Biblia-autoridad-red.cer` desde la ruta que muestra la terminal y agrégalo como
   autoridad raíz de confianza en cada dispositivo que vaya a controlar el panel. Transfiere el
   certificado público directamente desde la PC de Biblia. En iPhone o iPad, habilita también
   la confianza SSL/TLS para el certificado. [Guía de Apple](https://support.apple.com/en-ie/102390)
4. En Biblia, pulsa **Acceso al panel → Copiar**. Abre ese enlace en el otro dispositivo
   e introduce el PIN. La terminal también muestra el enlace, por ejemplo `https://192.168.1.25:3737`.

`localhost`, el panel por IP y OBS usan el mismo puerto. Si el 3737 está ocupado, los tres usan
el siguiente disponible. En Windows, al abrir la IP por HTTP, Biblia te lleva a HTTPS en ese mismo puerto.
El enlace del visor se copia desde **OBS**.
Con el panel por IP activo en Mac, el visor de red también usa HTTPS y el mismo certificado.
Reinicia Biblia con la misma opción para volver a habilitar el panel por IP.

En Mac puedes iniciar directamente con `./serve.sh --panel-red`. Para un puerto fijo añade el número,
por ejemplo `./serve.sh --panel-red 4000`.

En Windows puedes usar `iniciar-windows.cmd -PanelRed`. Usa `-Puerto`
para elegir un puerto fijo y `-CertificadoPanel` si ya tienes un archivo PFX vigente
que cubra las IP del equipo y cuya autoridad sea de confianza en los dispositivos.

## Desde internet con Cloudflare

1. En Mac o Linux, abre `./serve.sh` en Terminal. En Windows, abre `iniciar-windows.cmd`.
   Elige **Compartir por internet (Cloudflare)**. Si hace falta, Biblia descarga el cliente oficial
   en tu equipo y verifica la descarga. Funciona sin una cuenta de Cloudflare.
2. Entra al panel que se abre en el navegador. Si es tu primera vez, crea el PIN en ese equipo.
   Pulsa **Acceso al panel → Copiar**. También puedes copiar el enlace de la terminal.
3. Comparte el enlace completo con las personas que van a operar Biblia. Pueden abrirlo con datos
   móviles o en otra red y entrar con el PIN. La parte después del `#` va incluida en el enlace.
4. Mantén abierta la ventana del servidor mientras lo uses. Para cerrar el acceso, pulsa Ctrl+C.
   Al volver a elegir esta opción se genera otro enlace.

Cloudflare se conecta desde el equipo que ejecuta Biblia. Comparte el puerto de la app sin abrir
puertos entrantes en el router. Cada enlace es temporal. Cloudflare ofrece los Quick Tunnels para
pruebas y su disponibilidad puede variar. [Documentación de Cloudflare](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

Puedes abrir este modo directamente con `./serve.sh --internet` o `iniciar-windows.cmd -Internet`.
Si falla la conexión con Cloudflare, Biblia abre el panel local y muestra el aviso en la terminal.

## Qué se comparte

- El PIN sigue siendo necesario para controlar. Las órdenes siguen firmadas y conservan
  su caducidad, protección contra repetición y bloqueo por intentos fallidos.
- Ver la proyección o descargar medios por el dominio remoto requiere la llave de visor
  incluida en los enlaces de OBS y del proyector generados tras entrar. Un enlace de visor
  permite ver, pero no controlar.
- Al entrar, cada navegador recibe la apariencia de la proyección, el tema, el modo estudio y las
  preferencias de tamaño guardadas en el servidor. Las canciones, presentaciones y archivos de la
  biblioteca se guardan en el navegador que los agregó.
- El proyector y OBS reciben lo que se envía con **Poner en vivo**. Coordina quién controla la salida
  cuando hay varias personas conectadas.
- El audio que la aplicación reproduce en la consola sale de la computadora que la controla,
  tal como en el funcionamiento actual.
- El acceso de control se limita al panel de Biblia.

## Si ya tienes un túnel con dominio propio

Crea primero el PIN desde el equipo que ejecuta Biblia. Arranca con
`BIBLIA_ORIGEN_REMOTO=https://biblia.tu-dominio.com ./serve.sh` en Mac o Linux, o con
`iniciar-windows.cmd -OrigenRemoto https://biblia.tu-dominio.com` en Windows. Configura tu túnel
para conectarse a `127.0.0.1` en el puerto que muestra la línea `App` y conservar el `Host` y el
`Origin` del navegador junto con la cabecera `X-Forwarded-Proto: https`.

## Pruebas de integración

Pruebas de integración para desarrolladores en macOS/Linux (requieren Node solo para ejecutarlas):

```bash
node server/test-remote.mjs
```

Las pruebas crean un servidor, un PIN y archivos temporales separados; no usan los datos de
la iglesia ni detienen el servidor habitual.
