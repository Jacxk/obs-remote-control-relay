import { ConnectionStatus } from "../index.mjs";
import { baseUrl, wsScheme } from "../utils.mjs";

export default class Connection {
  constructor(connectionId) {
    this.connectionId = connectionId;
    this.relayDataWebsocket = undefined;
    this.obsWebsocket = undefined;
    this.status = ConnectionStatus.ConnectingToRelay;
    this.statusUpdateTime = new Date();
    this.bridgeToRemoteControllerBytes = 0;
    this.bridgeToObsBytes = 0;
    this.bitrateToRemoteController = 0;
    this.bitrateToObs = 0;
    this.prevBitrateToRemoteControllerBytes = 0;
    this.prevBitrateToObsBytes = 0;
    this.textEncoder = new TextEncoder();
  }

  close() {
    if (this.relayDataWebsocket != undefined) {
      this.relayDataWebsocket.close();
    }
    if (this.obsWebsocket != undefined) {
      this.obsWebsocket.close();
    }
  }

  setStatus(newStatus) {
    if (this.status == newStatus) {
      return;
    }
    if (this.isAborted() && newStatus != ConnectionStatus.RateLimitExceeded) {
      return;
    }
    this.status = newStatus;
    this.statusUpdateTime = new Date();
    updateConnections();
  }

  isAborted() {
    return [
      ConnectionStatus.RemoteControllerClosed,
      ConnectionStatus.RemoteControllerError,
      ConnectionStatus.ObsClosed,
      ConnectionStatus.ObsError,
      ConnectionStatus.RateLimitExceeded,
    ].includes(this.status);
  }

  setupRelayDataWebsocket() {
    this.relayDataWebsocket = new WebSocket(
      `${wsScheme}://${baseUrl}/bridge/data/${bridgeId}/${this.connectionId}`
    );
    this.status = ConnectionStatus.ConnectingToRelay;
    this.relayDataWebsocket.onopen = () => {
      this.setupObsWebsocket();
    };
    this.relayDataWebsocket.onerror = () => {
      this.setStatus(ConnectionStatus.RemoteControllerError);
      this.close();
    };
    this.relayDataWebsocket.onclose = () => {
      this.setStatus(ConnectionStatus.RemoteControllerClosed);
      this.close();
    };
    this.relayDataWebsocket.onmessage = async (event) => {
      if (this.obsWebsocket.readyState == WebSocket.OPEN) {
        this.bridgeToObsBytes += this.textEncoder.encode(event.data).length;
        this.obsWebsocket.send(event.data);
      }
    };
  }

  setupObsWebsocket() {
    this.obsWebsocket = new WebSocket(`ws://localhost:${obsPort}`);
    this.setStatus(ConnectionStatus.ConnectingToObs);
    this.obsWebsocket.onopen = () => {
      this.setStatus(ConnectionStatus.Connected);
    };
    this.obsWebsocket.onerror = () => {
      this.setStatus(ConnectionStatus.ObsError);
      this.close();
    };
    this.obsWebsocket.onclose = () => {
      this.setStatus(ConnectionStatus.ObsClosed);
      this.close();
    };
    this.obsWebsocket.onmessage = async (event) => {
      if (this.relayDataWebsocket.readyState == WebSocket.OPEN) {
        this.bridgeToRemoteControllerBytes += this.textEncoder.encode(
          event.data
        ).length;
        this.relayDataWebsocket.send(event.data);
      }
    };
  }

  updateBitrates() {
    this.bitrateToRemoteController =
      8 *
      (this.bridgeToRemoteControllerBytes -
        this.prevBitrateToRemoteControllerBytes);
    this.prevBitrateToRemoteControllerBytes =
      this.bridgeToRemoteControllerBytes;
    this.bitrateToObs =
      8 * (this.bridgeToObsBytes - this.prevBitrateToObsBytes);
    this.prevBitrateToObsBytes = this.bridgeToObsBytes;
  }
}
