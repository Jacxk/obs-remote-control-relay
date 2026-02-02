import {
  bridgeId,
  ConnectionStatus,
  RelayStatus,
  reset,
  updateRelayStatus,
} from "../index.mjs";
import { baseUrl, wsScheme } from "../utils.mjs";
import Connection from "./Connection.mjs";

export default class Relay {
  constructor(connections, initialStatus = RelayStatus.Connecting) {
    this.controlWebsocket = undefined;
    this.statusEnabled = false;
    this.status = initialStatus;
    this.connections = connections;
  }

  close() {
    if (this.controlWebsocket != undefined) {
      this.controlWebsocket.close();
      this.controlWebsocket = undefined;
    }
  }

  setStatus(newStatus) {
    if (this.status == newStatus) {
      return;
    }
    this.status = newStatus;
    updateRelayStatus();
  }

  sendStatus(status) {
    if (
      this.controlWebsocket != undefined &&
      this.controlWebsocket.readyState == WebSocket.OPEN
    ) {
      this.controlWebsocket.send(JSON.stringify(status));
    }
  }

  setupControlWebsocket() {
    this.controlWebsocket = new WebSocket(
      `${wsScheme}://${baseUrl}/bridge/control/${bridgeId}`
    );
    this.setStatus(RelayStatus.Connecting);
    this.controlWebsocket.onopen = () => {
      this.setStatus(RelayStatus.Connected);
    };
    this.controlWebsocket.onerror = () => {
      if (this.status != RelayStatus.Kicked) {
        reset(10000);
      }
    };
    this.controlWebsocket.onclose = () => {
      if (this.status != RelayStatus.Kicked) {
        reset(10000);
      }
    };
    this.controlWebsocket.onmessage = async (event) => {
      let message = JSON.parse(event.data);
      if (message.type == "connect") {
        let connectionId = message.data.connectionId;
        let connection = new Connection(connectionId);
        connection.setupRelayDataWebsocket();
        this.connections.unshift(connection);
        while (this.connections.length > 5) {
          this.connections.pop().close();
        }
      } else if (message.type == "startStatus") {
        this.statusEnabled = true;
      } else if (message.type == "stopStatus") {
        this.statusEnabled = false;
      } else if (message.type == "kicked") {
        this.setStatus(RelayStatus.Kicked);
      } else if (message.type == "rateLimitExceeded") {
        for (const connection of this.connections) {
          if (connection.connectionId == message.data.connectionId) {
            connection.setStatus(ConnectionStatus.RateLimitExceeded);
          }
        }
      }
    };
  }
}
