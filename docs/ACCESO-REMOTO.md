# Controlar Biblia desde otra computadora con ngrok

Este modo corresponde al servidor web (`serve.sh` o `serve.ps1`). La app de escritorio
mantiene su funcionamiento actual; su servidor para OBS solo permite ver.

## Preparar y compartir

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
