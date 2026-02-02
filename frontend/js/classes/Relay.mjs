import {
  bridgeId,
  ConnectionStatus,
  RelayStatus,
  reset,
  updateRelayStatus,
} from "../index.mjs";
import { baseUrl, wsScheme } from "../utils.mjs";
import Connection from "./Connection.mjs";

const ControlMessageType = {
  Connect: "connect",
  StartStatus: "startStatus",
  StopStatus: "stopStatus",
  Kicked: "kicked",
  RateLimitExceeded: "rateLimitExceeded",
};

export default class Relay {
  constructor(connections, initialStatus = RelayStatus.Connecting) {
    this.controlWebsocket;
    this.statusEnabled = false;
    this.status = initialStatus;
    this.connections = connections;
  }

  close() {
    if (this.controlWebsocket) {
      this.controlWebsocket.close();
      this.controlWebsocket = undefined;
    }
  }

  setStatus(newStatus) {
    if (this.status === newStatus) {
      return;
    }
    this.status = newStatus;
    updateRelayStatus();
  }

  sendStatus(status) {
    if (
      this.controlWebsocket &&
      this.controlWebsocket.readyState === WebSocket.OPEN
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
      if (this.status !== RelayStatus.Kicked) {
        reset(10000);
      }
    };
    this.controlWebsocket.onclose = () => {
      if (this.status !== RelayStatus.Kicked) {
        reset(10000);
      }
    };
    this.controlWebsocket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case ControlMessageType.Connect:
          {
            const connectionId = message.data.connectionId;
            const connection = new Connection(connectionId);
            connection.setupRelayDataWebsocket();
            this.connections.unshift(connection);
            while (this.connections.length > 5) {
              this.connections.pop().close();
            }
          }
          break;
        case ControlMessageType.StartStatus:
          this.statusEnabled = true;
          break;
        case ControlMessageType.StopStatus:
          this.statusEnabled = false;
          break;
        case ControlMessageType.Kicked:
          this.setStatus(RelayStatus.Kicked);
          break;
        case ControlMessageType.RateLimitExceeded:
          for (const connection of this.connections) {
            if (connection.connectionId === message.data.connectionId) {
              connection.setStatus(ConnectionStatus.RateLimitExceeded);
            }
          }
          break;
      }
    };
  }
}
