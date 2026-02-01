import { obsPort, ObsStatus, updateObsStatus } from "../index.mjs";

export default class Obs {
  constructor(initialStatus = ObsStatus.Connecting) {
    this.status = initialStatus;
    this.websocket = undefined;
    this.timerId = undefined;
  }

  setStatus(newStatus) {
    if (this.status == newStatus) {
      return;
    }
    this.status = newStatus;
    updateObsStatus();
  }

  setupWebsocket() {
    this.websocket = new WebSocket(`ws://localhost:${obsPort}`);
    this.setStatus(ObsStatus.Connecting);
    this.websocket.onopen = () => {
      this.setStatus(ObsStatus.Connected);
    };
    this.websocket.onerror = () => {
      this.setStatus(ObsStatus.Connecting);
      this.retry(10000);
    };
    this.websocket.onclose = () => {
      this.setStatus(ObsStatus.Connecting);
      this.retry(10000);
    };
  }

  retry(delayMs) {
    if (this.timerId != undefined) {
      clearTimeout(this.timerId);
    }
    this.timerId = setTimeout(() => {
      this.timerId = undefined;
      this.setupWebsocket();
    }, delayMs);
  }
}
