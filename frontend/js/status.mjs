import {
  appendToRow,
  baseUrl,
  bitrateToString,
  getTableBody,
  randomUUID,
  timeAgoString,
  wsScheme,
} from "./utils.mjs";

const ConnectionStatus = {
  Connected: "Connected"
};

let bridgeId;
let timerId;

class Relay {
  constructor() {
    this.websocket;
  }

  close() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = undefined;
    }
  }

  setupWebsocket() {
    this.websocket = new WebSocket(
      `${wsScheme}://${baseUrl}/status/${bridgeId}`
    );
    this.websocket.onerror = () => {
      updateConnections([]);
      reset(5000);
    };
    this.websocket.onclose = () => {
      updateConnections([]);
      reset(5000);
    };
    this.websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      updateConnections(message.connections);
    };
  }
}

let relay;

function reset(delayMs) {
  relay.close();
  relay = new Relay();

  if (timerId) {
    clearTimeout(timerId);
  }

  timerId = setTimeout(() => {
    timerId = undefined;
    relay.setupWebsocket();
  }, delayMs);
}

function updateConnections(connections) {
  const body = getTableBody("connections");

  for (const connection of connections) {
    const row = body.insertRow(-1);
    const statusWithIcon = `<i class="p-icon--spinner u-animation--spin"></i> ${connection.status}`;

    if (connection.status === ConnectionStatus.Connected) {
      statusWithIcon = `<i class="p-icon--success"></i> ${connection.status}`;
    } else if (connection.aborted) {
      statusWithIcon = `<i class="p-icon--error"></i> ${connection.status}`;
    }

    appendToRow(row, statusWithIcon);
    appendToRow(row, timeAgoString(new Date(connection.statusUpdateTime)));
    appendToRow(row, bitrateToString(connection.bitrateToRemoteController));
    appendToRow(row, bitrateToString(connection.bitrateToObs));
  }
}

function loadbridgeId(urlParams) {
  bridgeId = urlParams.get("bridgeId");
  if (bridgeId === undefined) {
    bridgeId = randomUUID();
  }
}

window.addEventListener("DOMContentLoaded", async (event) => {
  const urlParams = new URLSearchParams(window.location.search);
  loadbridgeId(urlParams);

  relay = new Relay();
  relay.setupWebsocket();
});
