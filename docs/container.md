# The container

What [@wayuse/build](../packages/build/README.md) writes, and how its image runs.
The examples are of a project in the directory `myproject`, with the [sample](../packages/build/sample/) of @wayuse/build copied into it.

## BUILD DIRECTORY

`npx wayuse build` writes the build directory, `docker/wayuse` in the sample. Among its files:

| File | What it is |
|---|---|
| `Dockerfile` | The image. |
| `compose.yml` | The service for [Docker Compose](#docker-compose). |
| `docker-build.sh`, `docker-run.sh` | The image and the container for a host [without Docker Compose](#without-docker-compose). |
| `rootfs/` | What the image has, laid out as its file system. |
| `rootfs/opt/wayuse/wayuse.config.json` | The resolved configuration. The server reads it, and `GET /wayuse/config` answers with it. |
| `rootfs/opt/wayuse/package.json` | What npm installs into the image. |
| `rootfs/opt/wayuse/htdocs/console/` | The [console](console.md#files). The server serves `htdocs/` without a token. |

A build writes `rootfs/opt/wayuse/` anew, and its other files over those of the build before.
`rootfs/opt/wayuse/` has a `.gitignore`, so git keeps none of it.
Outside `rootfs/opt/wayuse/`, a file stays when the option that wrote it is removed. Remove it by hand.

@wayuse/build bundles [noVNC](https://github.com/novnc/noVNC) into the console, as `console/vendor/novnc.js`, for the console's vnc page.
noVNC is under the MPL 2.0. It comes from its own package and is in none of wayuse's, and its notices stay in the bundle.

## DOCKER RUN

| `docker run` | Meaning |
|---|---|
| `--shm-size 256m` | Required. sway dies of a bus error on the 64MB Docker gives by default. |
| `-e WAYUSE_SCREEN_OUTPUTS=<n>` | The number of screens, `HEADLESS-1` and up. Default: `screen.outputs`. |
| `-e WAYUSE_USER_AGENT=<string>` | Chrome's User-Agent. Default: the one in `apps.chrome.env`, or else Chrome's own. |
| `-e WAYUSE_JWT_PUBLIC_KEY=<key>` | The key @wayuse/server verifies tokens with. Without it, every API that needs a token is refused. |
| `-e WAYUSE_JWT_AUDIENCE=<string>` | The `aud` a token must carry. Default: `wayuse`. |
| `-v <volume>:/home/wayuse/.config` | Keeps Chrome's profile when the image is rebuilt. |
| `--uts=host` | Optional. `GET /wayuse/status` then reports the host's name in place of the container's id. |

The container runs as the user `wayuse` (uid 1000).
It keeps a session D-Bus, sway, wayvnc, Chrome and @wayuse/server running: one that exits is started again.
tini is PID 1 in the image, so `--init` is not needed.

| Port | Listener |
|---|---|
| 9580 | @wayuse/server. Publish it with `-p` to reach the container from outside |
| 9222 | Chrome DevTools Protocol, on 127.0.0.1 inside the container |
| 5900 + n | wayvnc for `HEADLESS-n`, on 127.0.0.1 inside the container |

## DOCKER COMPOSE

For the sample, a build writes this `compose.yml`. Its header comments are left out here:

```yaml
volumes:
  # Chrome's profile outlives the image.
  wayuse_config:

services:
  wayuse:
    build:
      context: "."
    # sway dies of a bus error on the 64MB Docker gives by default.
    shm_size: "256m"
    extra_hosts:
      # A server on this host is http://host.docker.internal:<port>/
      - "host.docker.internal:host-gateway"
    ports:
      # Reached from this host alone, unless .env says otherwise: WAYUSE_PUBLISH=0.0.0.0:9580
      - "${WAYUSE_PUBLISH:-127.0.0.1:9580}:9580"
    environment:
      # A value in .env or the shell wins.
      WAYUSE_SCREEN_OUTPUTS: "${WAYUSE_SCREEN_OUTPUTS:-1}"
      WAYUSE_USER_AGENT: "${WAYUSE_USER_AGENT:-}"
      WAYUSE_JWT_PUBLIC_KEY: "${WAYUSE_JWT_PUBLIC_KEY:-}"
      WAYUSE_JWT_AUDIENCE: "${WAYUSE_JWT_AUDIENCE:-}"
    volumes:
      - "wayuse_config:/home/wayuse/.config"
```

It gives the container what the [`docker run` table](#docker-run) names, `--uts=host` aside.
It passes on the `-e` variables there from `.env` or the shell, or else the values the image has.
A variable the image does not read is left out, such as the key for an image built with `auth: false`.

This `.env` has the two keys of `npx wayuse jwt keygen`, and two more lines:

```sh
WAYUSE_JWT_PRIVATE_KEY=...
WAYUSE_JWT_PUBLIC_KEY=...
WAYUSE_SCREEN_OUTPUTS=2
WAYUSE_PUBLISH=0.0.0.0:9580
```

The container then has two screens. `WAYUSE_PUBLISH` moves the published port, here to every address of the host.
Only the public key reaches the container, as `compose.yml` names no private key.

The service is `wayuse` and the volume is `wayuse_config`. Docker Compose names the rest after the project:

| | In `myproject` |
|---|---|
| Image | `myproject-wayuse` |
| Container | `myproject-wayuse-1` |
| Volume | `myproject_wayuse_config` |

A build writes `compose.yml` again, so a setting of the project's own goes in the project's compose file, under `wayuse`.
Docker Compose merges it into the service of `compose.yml`. A variable written there wins over `.env`, and a port is added.
This one publishes the port of `apps.redir` for [Chrome DevTools Protocol](#chrome-devtools-protocol):

```yaml
include:
  - "docker/wayuse/compose.yml"

services:
  wayuse:
    ports:
      - "127.0.0.1:9222:9223"
    environment:
      WAYUSE_SCREEN_OUTPUTS: "2"
```

## WITHOUT DOCKER COMPOSE

For the sample in `myproject`, a build writes this `docker-run.sh`. Its header comments are left out here:

```sh
# A value in the environment wins, such as one that EnvironmentFile= of a systemd unit gives.
export WAYUSE_IMAGE=${WAYUSE_IMAGE:-"myproject-wayuse"}
export WAYUSE_PUBLISH=${WAYUSE_PUBLISH:-"127.0.0.1:9580"}
export WAYUSE_SCREEN_OUTPUTS=${WAYUSE_SCREEN_OUTPUTS:-"1"}
export WAYUSE_USER_AGENT=${WAYUSE_USER_AGENT:-""}
export WAYUSE_JWT_PUBLIC_KEY=${WAYUSE_JWT_PUBLIC_KEY:-""}
export WAYUSE_JWT_AUDIENCE=${WAYUSE_JWT_AUDIENCE:-""}

# The container gets the variables named here alone, so the private key of the .env stays out.
exec docker run --rm --name myproject-wayuse-1 \
    --shm-size 256m \
    --add-host host.docker.internal:host-gateway \
    -p "$WAYUSE_PUBLISH:9580" \
    -e WAYUSE_SCREEN_OUTPUTS \
    -e WAYUSE_USER_AGENT \
    -e WAYUSE_JWT_PUBLIC_KEY \
    -e WAYUSE_JWT_AUDIENCE \
    -v myproject_wayuse_config:/home/wayuse/.config \
    "$@" \
    "$WAYUSE_IMAGE"
```

It gives the container what `compose.yml` gives, under the names Docker Compose gives them.
The variables come from the environment, such as from `EnvironmentFile=` of a systemd unit, which takes the project's `.env` as it is.

`WAYUSE_IMAGE` gives the image another name. Give the same one to both scripts:

```sh
WAYUSE_IMAGE=my-wayuse docker/wayuse/docker-build.sh
WAYUSE_IMAGE=my-wayuse docker/wayuse/docker-run.sh
```

Their arguments go to `docker build` and `docker run` as options. A variable given with `-e` there wins over the script's:

```sh
docker/wayuse/docker-build.sh --pull
docker/wayuse/docker-run.sh -p 127.0.0.1:9222:9223 -e WAYUSE_SCREEN_OUTPUTS=2
```

To change an option they already give, write a script of the project's own.

## CHROME DEVTOOLS PROTOCOL

[The README](../packages/build/README.md#chrome-devtools-protocol-from-the-host) has `apps.redir` forward port 9223 to Chrome, and publishes it with `docker run`.
With Docker Compose, the project's compose file publishes it, as in [DOCKER COMPOSE](#docker-compose).
redir listens on every address of the container, one redir for each port. Publish the port to the host's `127.0.0.1` only.

Chrome takes a request whose `Host` header is an IP address or `localhost`, and refuses one with another name:

```sh
curl http://127.0.0.1:9222/json/version    # answered
curl http://localhost:9222/json/version    # answered
curl -H "Host: myhost:9222" http://127.0.0.1:9222/json/version
# Host header is specified and is not an IP address or localhost.
```

`webSocketDebuggerUrl` in the answer has the host and the port of the request.
A host that publishes the port as 9333 gets `ws://127.0.0.1:9333/devtools/browser/<id>`, so a client connects through the same port.

## A SERVER ON THE HOST

[The README](../packages/build/README.md#a-server-on-the-host) has the two things needed. The address the server on the host listens on decides who reaches it:

| The server on the host listens on | From the container |
|---|---|
| `0.0.0.0` | Reached. The network the host is on reaches it too. |
| the address of Docker's bridge, which `ip -4 addr show docker0` tells, such as `172.17.0.1` | Reached, and by the containers alone. |
| `127.0.0.1` | Not reached: Chrome shows that the connection was refused. |

`apps.redir` gives the page the same server as `http://127.0.0.1:8787/`, where a page is in a secure context:

```ts
export default defineConfig({
    apps: {
        chrome: {},
        redir: {ports: {8787: "host.docker.internal:8787"}},
    },
})
```

```sh
npx wayuse chrome open http://127.0.0.1:8787/
```

redir looks the name up when it starts. Without `--add-host`, it ends at once and the supervisor keeps starting it again, every redir with it.
The `compose.yml` and `docker-run.sh` of a build give the container `--add-host`.

`docker run --network host` is another way: the container then shares the host's network, `127.0.0.1` included.
Its own ports are then the host's as well: 9580, on every address of the host, and 9222 and 5900 + n.

```sh
docker run --rm --shm-size 256m --network host -e WAYUSE_JWT_PUBLIC_KEY my-wayuse
npx wayuse chrome open http://127.0.0.1:8787/
```
