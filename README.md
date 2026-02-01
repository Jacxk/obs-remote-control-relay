# OBS Remote Control Relay

A minimal Go-based OBS relay that lets you control OBS remotely, without exposing your home IP, through websockets.

<img src="screenshot.png">

#
Servers you can use if you dont want to self-host:
- (Hosted in Tokyo): https://moblin.mys-lang.org/obs-remote-control-relay
- (Hosted in USA): https://obs-relay.jackscode.me
#

## How to run

**Disclaimer:** It is strongly recommended to run the relay using secure protocols (HTTPS for the web interface and WSS for websockets). Running without encryption may expose sensitive information or make your connection vulnerable to interception.

### Docker

Pull image from repository:
```bash
docker pull ghcr.io/jacxk/obs-remote-control-relay:dev

docker run --rm -p 8080:8080 ghcr.io/jacxk/obs-remote-control-relay
```

### Docker Compose

```yaml
services:
  obs-relay:
    image: ghcr.io/jacxk/obs-remote-control-relay:dev
    ports:
      - "8080:8080"
    environment:
      - LOG_LEVEL=INFO # Default: 'INFO', Possible: INFO, WARN, ERROR, DEBUG
      # - RELAY_ADDRESS=0.0.0.0:8080 # Default: ':8080', If you change the port here make sure to change the ports section above
      # - RELAY_REVERSE_PROXY_BASE=/obs-remote-control-relay # Default: '/', Set this according to how you have your reverse proxy
    restart: unless-stopped
```


### Systemd (no Docker)

Run the Go program as a systemd service and use Nginx for TLS.

```
cd backend && go build
```

### Systemd service

/etc/systemd/system/obs-remote-control-relay.service

``` ini
[Unit]
Description=OBS Remote Control Relay
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=erik
ExecStart=/home/erik/obs-remote-control-relay/backend/obs-remote-control-relay -address 127.0.0.1:9999 -reverse_proxy_base /obs-remote-control-relay
WorkingDirectory=/home/erik/obs-remote-control-relay/backend
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
```

Enable it for automatic start at boot.

```
sudo systemctl enable obs-remote-control-relay
```

Start it.

```
sudo systemctl start obs-remote-control-relay
```

## Nginx

```
location /obs-remote-control-relay/ {
    proxy_pass http://127.0.0.1:9999/;
    proxy_http_version  1.1;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}
```

Restart it.

```
sudo systemctl restart nginx
```