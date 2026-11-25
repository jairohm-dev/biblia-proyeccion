# Controlar Biblia desde otro dispositivo

El control por IP usa el servidor web (`serve.sh` o `iniciar-windows.cmd`). Desde la app de
escritorio puedes compartir la proyección con OBS.

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

## Por ngrok

1. Abre el servidor de forma habitual y entra en la dirección que muestra la línea `App`.
   Crea el PIN si todavía no existe. Después detén ese servidor con Ctrl+C antes de reiniciarlo.
2. Copia tu dominio HTTPS desde ngrok. En estos ejemplos sustituye
   `https://tu-dominio.ngrok-free.app` por tu URL real, sin barra final ni ruta.
3. Inicia el servidor autorizando ese único dominio.

   macOS / Linux:

   ```bash
   BIBLIA_ORIGEN_REMOTO=https://tu-dominio.ngrok-free.app ./serve.sh
   ```

   Windows:

   ```powershell
   .\iniciar-windows.cmd -OrigenRemoto https://tu-dominio.ngrok-free.app
   ```

4. En otra terminal del mismo equipo, ejecuta el comando de la línea `Túnel`.
   Este ejemplo usa el puerto 3737.

   ```bash
   ngrok http http://127.0.0.1:3737 --url https://tu-dominio.ngrok-free.app --inspect=false
   ```

   Conserva `Host` y `Origin` originales: no uses `--host-header` ni reglas para
   reescribirlos. El servidor comprueba el dominio autorizado y la cabecera HTTPS
   del túnel local. El comando usa las opciones de la [CLI de ngrok](https://ngrok.com/docs/gateway/agent/cli).
5. Comparte la URL HTTPS. En la otra computadora se abre la misma portada y se introduce
   el PIN existente. Cada navegador obtiene su propia llave de firma.
6. En el equipo conectado al proyector, añade `/?salida` a la dirección de la línea `App`
   y abre esa URL en la pantalla de proyección. Para OBS, usa la dirección de la línea `OBS`.
   Los cambios de **Poner en vivo** de la consola remota llegan a esa salida. Mantén
   encendidos el servidor y ngrok.

No necesitas `--red` / `-Red` para ngrok. El puerto puede seguir escuchando solo en
`127.0.0.1`. Si cambia el dominio, reinicia el servidor con la nueva URL autorizada.

## Qué se comparte

- El PIN sigue siendo necesario para controlar. Las órdenes siguen firmadas y conservan
  su caducidad, protección contra repetición y bloqueo por intentos fallidos.
- Ver la proyección o descargar medios por el dominio remoto requiere la llave de visor
  incluida en los enlaces de OBS y del proyector generados tras entrar. Un enlace de visor
  permite ver, pero no controlar.
- Las canciones, presentaciones y ajustes guardados en un navegador no se copian automáticamente
  al otro. Se comparte el estado publicado **En vivo**. Usa una consola a la vez para evitar
  que dos operadores sobrescriban lo proyectado.
- El audio que la aplicación reproduce en la consola sale de la computadora que la controla,
  tal como en el funcionamiento actual.
- Esto controla Biblia, no el escritorio ni otras aplicaciones de la computadora.

Para restringir además el enlace a correos autorizados, ngrok ofrece una
[política de OAuth](https://ngrok.com/docs/gateway/traffic-policy/examples/oauth-protection).
Es una capa adicional y no se activa con los comandos anteriores.

## Desactivar

Detén ngrok con Ctrl+C. Para volver al modo exclusivamente local, detén el servidor y
arráncalo sin `BIBLIA_ORIGEN_REMOTO` / `-OrigenRemoto`. Si habías exportado la variable,
elimínala también del entorno. No se borra el PIN ni tus datos.

## Comprobaciones

`You don't have permission to access this resource.` indica que Apache rechazó la petición.
Comprueba que la URL configurada coincida exactamente con la URL HTTPS de ngrok y que
hayas reiniciado el servidor después de configurarla. Verifica que el túnel apunte al
puerto que muestra el servidor web en la línea `App`.

Pruebas de integración para desarrolladores en macOS/Linux (requieren Node solo para ejecutarlas):

```bash
node server/test-remote.mjs
```

Las pruebas crean un servidor, un PIN y archivos temporales separados; no usan los datos de
la iglesia ni detienen el servidor habitual.
